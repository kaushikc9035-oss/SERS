import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { 
  initializeTestEnvironment, 
  RulesTestEnvironment,
  assertFails,
  assertSucceeds 
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;

const PROJECT_ID = 'smart-emergency-security-test';
const RULES_PATH = path.resolve(__dirname, '../firestore.rules');

describe('Firestore Security Rules - Phase 1 Security Suite', () => {
  beforeAll(async () => {
    const rules = fs.readFileSync(RULES_PATH, 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      }
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  // =========================================================================
  // 1. Unauthenticated & Public Access Tests
  // =========================================================================
  describe('Unauthenticated & Public Access', () => {
    it('allows unauthenticated users to read hospitals, traffic signals, and connection test', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      await assertSucceeds(unauthDb.collection('hospitals').get());
      await assertSucceeds(unauthDb.collection('trafficSignals').get());
      await assertSucceeds(unauthDb.doc('_connection_test/init').get());
    });

    it('allows unauthenticated and guest users to start emergency runs (emergencies collection)', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      await assertSucceeds(
        unauthDb.collection('emergencies').add({
          ambulanceId: 'amb_guest_1',
          hospitalId: 'hosp_1',
          emergencyType: 'Trauma',
          status: 'active'
        })
      );
    });

    it('allows unauthenticated and guest operators to write ambulance telemetry, traffic preemption, and hospitals', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      await assertSucceeds(unauthDb.collection('hospitals').add({ name: 'Hosp 1', totalBeds: 100, availableBeds: 20 }));
      await assertSucceeds(unauthDb.collection('ambulances').add({ driverName: 'Guest Driver', uid: 'anon' }));
      await assertSucceeds(unauthDb.collection('trafficSignals').add({ status: 'emergency-green' }));
    });

    it('denies unauthenticated users from creating user profile or escalating roles', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      await assertFails(unauthDb.doc('users/hacker').set({ role: 'admin' }));
    });

    it('allows unauthenticated and guest users to create emergency requests with bed_reserved status', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      await assertSucceeds(
        unauthDb.collection('emergencyRequests').add({
          hospitalId: 'hosp_1',
          severity: 'critical',
          status: 'bed_reserved',
          createdAt: new Date().toISOString()
        })
      );
    });

    it('denies non-admin users from deleting emergency runs and ambulance records', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('emergencies/em_10').set({
          status: 'active'
        });
        await context.firestore().doc('ambulances/amb_10').set({
          driverName: 'Driver 10'
        });
      });

      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(unauthDb.doc('emergencies/em_10').delete());
      await assertFails(unauthDb.doc('ambulances/amb_10').delete());
    });
  });

  // =========================================================================
  // 2. Server-Controlled User Role Protection Tests
  // =========================================================================
  describe('User Profile & Role Tampering Protection', () => {
    it('allows authenticated users to create their own user profile with role = "public"', async () => {
      const userCtx = testEnv.authenticatedContext('user_123');
      const userDb = userCtx.firestore();

      await assertSucceeds(
        userDb.doc('users/user_123').set({
          uid: 'user_123',
          email: 'user@example.com',
          role: 'public',
          displayName: 'John Doe'
        })
      );
    });

    it('DENIES authenticated users from self-assigning restricted roles (admin, hospital, ambulance, traffic)', async () => {
      const userCtx = testEnv.authenticatedContext('user_123');
      const userDb = userCtx.firestore();

      await assertFails(
        userDb.doc('users/user_123').set({
          uid: 'user_123',
          email: 'user@example.com',
          role: 'admin',
          displayName: 'Hacker Admin'
        })
      );

      await assertFails(
        userDb.doc('users/user_123').set({
          uid: 'user_123',
          email: 'user@example.com',
          role: 'hospital',
          displayName: 'Fake Hospital'
        })
      );
    });

    it('DENIES authenticated users from updating existing role field from "public" to "admin"', async () => {
      // Seed user profile with role: 'public' via admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('users/user_123').set({
          uid: 'user_123',
          role: 'public',
          displayName: 'Regular User'
        });
      });

      const userCtx = testEnv.authenticatedContext('user_123');
      const userDb = userCtx.firestore();

      await assertFails(
        userDb.doc('users/user_123').update({
          role: 'admin'
        })
      );
    });

    it('ALLOWS Admin to assign or change user roles', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('users/admin_user').set({
          uid: 'admin_user',
          role: 'admin',
          displayName: 'System Admin'
        });
        await context.firestore().doc('users/target_user').set({
          uid: 'target_user',
          role: 'public',
          displayName: 'Target User'
        });
      });

      const adminCtx = testEnv.authenticatedContext('admin_user');
      const adminDb = adminCtx.firestore();

      await assertSucceeds(
        adminDb.doc('users/target_user').update({
          role: 'traffic'
        })
      );
    });
  });

  // =========================================================================
  // 3. Ambulance Role Capabilities
  // =========================================================================
  describe('Ambulance Role Permissions', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('users/amb_driver_1').set({
          uid: 'amb_driver_1',
          role: 'ambulance',
          displayName: 'Driver Alex'
        });
      });
    });

    it('allows authorized ambulance driver to create emergency dispatches and bed requests', async () => {
      const ambCtx = testEnv.authenticatedContext('amb_driver_1');
      const ambDb = ambCtx.firestore();

      await assertSucceeds(
        ambDb.collection('emergencies').add({
          ambulanceId: 'amb_1',
          hospitalId: 'hosp_1',
          status: 'active',
          createdAt: new Date().toISOString()
        })
      );

      await assertSucceeds(
        ambDb.collection('emergencyRequests').add({
          ambulanceId: 'amb_1',
          hospitalId: 'hosp_1',
          severity: 'critical',
          status: 'pending',
          createdAt: new Date().toISOString()
        })
      );
    });

    it('allows ambulance driver to trigger traffic signal preemption corridor', async () => {
      const ambCtx = testEnv.authenticatedContext('amb_driver_1');
      const ambDb = ambCtx.firestore();

      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('trafficSignals/sig_1').set({
          name: 'Main Junction Signal',
          status: 'normal'
        });
      });

      await assertSucceeds(
        ambDb.doc('trafficSignals/sig_1').update({
          status: 'emergency-green',
          activeAmbulanceId: 'amb_1'
        })
      );
    });

    it('allows regular or newly signed-in user to create emergency cases (emergencies collection)', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('users/reg_user').set({
          uid: 'reg_user',
          role: 'public'
        });
      });

      const userCtx = testEnv.authenticatedContext('reg_user');
      const userDb = userCtx.firestore();

      await assertSucceeds(
        userDb.collection('emergencies').add({
          ambulanceId: 'amb_user_1',
          hospitalId: 'hosp_1',
          status: 'active'
        })
      );
    });

    it('allows regular public user to create emergencyRequests', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('users/reg_user').set({
          uid: 'reg_user',
          role: 'public'
        });
      });

      const userCtx = testEnv.authenticatedContext('reg_user');
      const userDb = userCtx.firestore();

      await assertSucceeds(
        userDb.collection('emergencyRequests').add({
          hospitalId: 'hosp_1',
          severity: 'high',
          status: 'pending',
          createdAt: new Date().toISOString()
        })
      );
    });

    it('denies regular public user from deleting emergency requests', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('emergencyRequests/req_user_test').set({
          requestId: 'req_user_test',
          status: 'pending',
          hospitalId: 'hosp_1'
        });
        await context.firestore().doc('users/reg_user').set({
          uid: 'reg_user',
          role: 'public'
        });
      });

      const userCtx = testEnv.authenticatedContext('reg_user');
      const userDb = userCtx.firestore();

      await assertFails(
        userDb.doc('emergencyRequests/req_user_test').delete()
      );
    });
  });

  // =========================================================================
  // 4. Hospital Role & SERS Bed Reservation Compatibility
  // =========================================================================
  describe('Hospital Role & SERS Transactions', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('users/hosp_staff_1').set({
          uid: 'hosp_staff_1',
          role: 'hospital',
          hospitalId: 'hosp_1',
          displayName: 'Hospital Staff'
        });
        await context.firestore().doc('hospitals/hosp_1').set({
          name: 'City General Hospital',
          totalBeds: 100,
          availableBeds: 20
        });
        await context.firestore().doc('emergencyRequests/req_100').set({
          requestId: 'req_100',
          ambulanceId: 'amb_1',
          hospitalId: 'hosp_1',
          status: 'pending'
        });
      });
    });

    it('allows hospital staff to update hospital bed inventory', async () => {
      const hospCtx = testEnv.authenticatedContext('hosp_staff_1');
      const hospDb = hospCtx.firestore();

      await assertSucceeds(
        hospDb.doc('hospitals/hosp_1').update({
          availableBeds: 19
        })
      );
    });

    it('allows hospital staff to accept and reserve bed (SERS workflow)', async () => {
      const hospCtx = testEnv.authenticatedContext('hosp_staff_1');
      const hospDb = hospCtx.firestore();

      await assertSucceeds(
        hospDb.doc('emergencyRequests/req_100').update({
          status: 'bed_reserved',
          reservedBedId: 'BED-CGH-101',
          acceptedAt: new Date().toISOString()
        })
      );
    });

    it('allows operators to update hospital beds (bed reservations & seeding)', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('users/reg_user').set({
          uid: 'reg_user',
          role: 'public'
        });
      });

      const userCtx = testEnv.authenticatedContext('reg_user');
      const userDb = userCtx.firestore();

      await assertSucceeds(
        userDb.doc('hospitals/hosp_1').update({
          availableBeds: 15
        })
      );
    });
  });

  // =========================================================================
  // 5. Traffic Police Role Capabilities
  // =========================================================================
  describe('Traffic Police Role Permissions', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('users/traffic_officer_1').set({
          uid: 'traffic_officer_1',
          role: 'traffic',
          displayName: 'Officer Vance'
        });
        await context.firestore().doc('trafficSignals/sig_domlur').set({
          name: 'Domlur Flyover Signal',
          status: 'normal'
        });
      });
    });

    it('allows traffic officer to manually override traffic signal status', async () => {
      const trafficCtx = testEnv.authenticatedContext('traffic_officer_1');
      const trafficDb = trafficCtx.firestore();

      await assertSucceeds(
        trafficDb.doc('trafficSignals/sig_domlur').update({
          status: 'emergency-green'
        })
      );
    });

    it('allows operators to preempt traffic signals along corridor', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('users/reg_user').set({
          uid: 'reg_user',
          role: 'public'
        });
      });

      const userCtx = testEnv.authenticatedContext('reg_user');
      const userDb = userCtx.firestore();

      await assertSucceeds(
        userDb.doc('trafficSignals/sig_domlur').update({
          status: 'emergency-green'
        })
      );
    });
  });
});
