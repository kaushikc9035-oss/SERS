import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, DocumentReference } from 'firebase-admin/firestore';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';

// Initialize Firebase Admin SDK safely
if (!getApps().length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0091455757";
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccountRaw) {
      const serviceAccount = JSON.parse(serviceAccountRaw);
      initializeApp({
        credential: cert(serviceAccount)
      });
    } else if (clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
    } else {
      // Fallback for GCP / Vercel ambient service credentials
      initializeApp({
        projectId
      });
    }
  } catch (err) {
    console.error("Firebase Admin initialization failed:", err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Authenticate & Authorize Request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ error: 'Unauthorized: Invalid ID token' });
    }

    const callerUid = decodedToken.uid;
    const { emergencyId, ambulanceId, signalId, signalName, distanceKm, etaMins } = req.body || {};

    if (!emergencyId || !signalId) {
      return res.status(400).json({ error: 'Bad Request: Missing required parameters (emergencyId, signalId)' });
    }

    const db = getFirestore();

    // 2. Validate Active Ambulance Trip Event
    const emergencyDoc = await db.collection('emergencies').doc(emergencyId).get();
    if (!emergencyDoc.exists) {
      return res.status(404).json({ error: 'Emergency trip record not found' });
    }

    const emergencyData = emergencyDoc.data();
    if (emergencyData?.status !== 'active') {
      return res.status(400).json({ error: 'Emergency trip is not currently active' });
    }

    // 3. Deduplication & Rate Limiting Check (5-minute cooldown per signal/emergency pair)
    const logId = `${emergencyId}_${signalId}`;
    const logRef = db.collection('notificationLogs').doc(logId);
    const logDoc = await logRef.get();
    const now = Date.now();
    const COOLDOWN_MS = 5 * 60 * 1000;

    if (logDoc.exists) {
      const lastSent = logDoc.data()?.sentAtTimestamp || 0;
      if (now - lastSent < COOLDOWN_MS) {
        return res.status(200).json({
          success: true,
          deduplicated: true,
          message: 'Notification suppressed: duplicate alert within 5-minute window.'
        });
      }
    }

    // Record notification dispatch timestamp
    await logRef.set({
      emergencyId,
      signalId,
      ambulanceId: ambulanceId || emergencyData?.ambulanceId,
      sentByUid: callerUid,
      sentAtTimestamp: now,
      sentAtISO: new Date().toISOString()
    });

    // 4. Query Authorized Traffic Police FCM Tokens
    const trafficUsersSnap = await db.collection('users').where('role', '==', 'traffic').get();
    const fcmTokens: { token: string; ref: DocumentReference }[] = [];

    for (const userDoc of trafficUsersSnap.docs) {
      const tokensSnap = await userDoc.ref.collection('fcmTokens').get();
      for (const tDoc of tokensSnap.docs) {
        const tokenVal = tDoc.data()?.token;
        if (tokenVal) {
          fcmTokens.push({ token: tokenVal, ref: tDoc.ref });
        }
      }
    }

    if (fcmTokens.length === 0) {
      return res.status(200).json({
        success: true,
        sentCount: 0,
        message: 'No registered Traffic Police FCM device tokens found.'
      });
    }

    // 5. Construct Privacy-Safe Push Notification Payload (NO patient details)
    const payloadTitle = '🚨 Emergency Green Corridor Alert';
    const payloadBody = `Ambulance approaching ${signalName || 'Traffic Signal'} (ETA ~${etaMins || 2} mins, ${distanceKm || 0.5} km away). Please clear intersection.`;

    const messagingPayload: MulticastMessage = {
      tokens: fcmTokens.map(t => t.token),
      notification: {
        title: payloadTitle,
        body: payloadBody
      },
      data: {
        emergencyId,
        signalId: String(signalId),
        distanceKm: String(distanceKm || 0.5),
        etaMins: String(etaMins || 2),
        tag: `signal-${signalId}`
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          priority: 'max',
          channelId: 'emergency_corridors'
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          title: payloadTitle,
          body: payloadBody,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          requireInteraction: true
        }
      }
    };

    // 6. Send FCM Messages & Handle Stale / Invalid Tokens
    const response = await getMessaging().sendEachForMulticast(messagingPayload);
    let staleTokensRemoved = 0;

    for (let i = 0; i < response.responses.length; i++) {
      const resp = response.responses[i];
      if (!resp.success && resp.error) {
        const errorCode = resp.error.code;
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          // Delete invalid/stale token from Firestore automatically
          await fcmTokens[i].ref.delete().catch(() => {});
          staleTokensRemoved++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      sentCount: response.successCount,
      failureCount: response.failureCount,
      staleTokensRemoved,
      deduplicated: false
    });

  } catch (error: any) {
    console.error('Traffic Notification Server Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error?.message });
  }
}
