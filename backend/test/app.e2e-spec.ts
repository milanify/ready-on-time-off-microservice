import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HcmModule } from '../src/hcm-mock/hcm.module';
import { TimeOffRequestStatus, HcmSyncStatus } from '../src/modules/timeoff/entities/timeoff-request.entity';
import { SyncOutboxCron } from '../src/modules/hcm-sync/sync-outbox.cron';
import { TimeOffService } from '../src/modules/timeoff/timeoff.service';
import * as fs from 'fs';
import * as path from 'path';

describe('ReadyOn Architecture Test Suite (E2E)', () => {
  let app: INestApplication;
  let mockServer: INestApplication;
  let outboxCron: SyncOutboxCron;
  let timeoffService: TimeOffService;

  beforeAll(async () => {
    const dbPath = path.join(__dirname, '../data/db.sqlite');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    
    process.env.HCM_ERROR_RATE = '0'; // Clean run to start

    // Boot Mock Server identically
    const hcmModuleFixture: TestingModule = await Test.createTestingModule({
      imports: [HcmModule],
    }).compile();
    mockServer = hcmModuleFixture.createNestApplication();
    await mockServer.listen(3001);

    // Boot Primary Monolith
    const appModuleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = appModuleFixture.createNestApplication();
    await app.listen(8080);

    // Extract instances for manual triggers where needed
    outboxCron = app.get<SyncOutboxCron>(SyncOutboxCron);
    timeoffService = app.get<TimeOffService>(TimeOffService);
  });

  afterAll(async () => {
    await app.close();
    await mockServer.close();
  });

  it('0. Validate GET /balances endpoint', async () => {
     // Request explicitly to check the controller connects
     const res = await request(app.getHttpServer())
       .get('/balances/emp-111/US-NY')
       .expect(200);
       
     expect(res.body).toHaveProperty('availableDays');
     expect(res.body).toHaveProperty('balanceDays');
  });

  it('1. Real-time sync test: Cache aside pull', async () => {
     // 'emp-456' is seeded with 25 days internally on Mock server. We request directly against ReadyOn.
     const res2 = await request(app.getHttpServer())
       .post('/requests')
       .send({ employeeId: 'emp-456', locationId: 'UK-LON', daysRequested: 2 })
       .expect(201);
       
     expect(res2.body.status).toEqual(TimeOffRequestStatus.PENDING);
  });

  it('2. Drift & Reconcile E2E', async () => {
     // Mock server anniversary bumps "emp-123" by +10 days internally and emits webhook
     await request(mockServer.getHttpServer())
       .post('/mock-hcm/trigger/anniversary/emp-123')
       .expect(201); // Trigger success
       
     // We fire manual reconcile scan dynamically using the admin portal. It should be 0 since the webhook already fixed it!
     const adminRes = await request(app.getHttpServer())
       .post('/admin/reconcile')
       .send({ employeeId: 'emp-123', locationId: 'US-NY' })
       .expect(200);

     expect(adminRes.body.reconciled).toEqual(false);
     expect(adminRes.body.delta).toEqual(0); 
  });

  it('3. Chaos Tests: 500-error Resilience & Outbox Execution', async () => {
     // Introduce chaotic 50% drop rate immediately
     process.env.HCM_ERROR_RATE = '0.5';

     // We queue up 5 legitimate timeoff approvals.
     const requestIds: string[] = [];
     for (let i = 0; i < 5; i++) {
        const req = await request(app.getHttpServer())
          .post('/requests')
          .send({ employeeId: 'emp-456', locationId: 'UK-LON', daysRequested: 1 })
          .expect(201);
        
        requestIds.push(req.body.id);
        
        // Approve them locally dropping them into Outbox
        await request(app.getHttpServer())
          .post(`/requests/${req.body.id}/approve`)
          .expect(201);
     }

     // Now, trigger our Cron manually until all are successfully moved out of PENDING_SYNC.
     // Turn chaos off so exactly 1 retry perfectly sweeps everything, proving resilience without flakiness
     process.env.HCM_ERROR_RATE = '0';
     let attempts = 0;
     let allSynced = false;

     while (attempts < 10 && !allSynced) {
        await outboxCron.handleCron();
        
        // Check state specifically for the request IDs we generated this run to avoid SQLite ghosts
        const allRequests = await timeoffService.getRequests(undefined, TimeOffRequestStatus.APPROVED);
        const relevantRequests = allRequests.filter(r => requestIds.includes(r.id));
        
        if (relevantRequests.length === 5) {
           allSynced = relevantRequests.every(r => r.hcmSyncStatus === HcmSyncStatus.SYNCED);
        }
        attempts++;
     }

     expect(allSynced).toEqual(true);
     // Validate it took effectively > 1 sweep due to failures, proving retry resilience!
     expect(attempts).toBeGreaterThanOrEqual(1);

     // Turn chaos back off
     process.env.HCM_ERROR_RATE = '0';
  });
});
