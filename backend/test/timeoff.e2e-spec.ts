import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HcmClientService } from '../src/modules/hcm-sync/hcm-client.service';
import { TimeOffRequestStatus, HcmSyncStatus } from '../src/modules/timeoff/entities/timeoff-request.entity';

describe('TimeOffController (e2e) with Outbox mask', () => {
  let app: INestApplication;
  let hcmClientMock = {
    fetchBalance: jest.fn(),
    deductBalance: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // Must actually import the main app module
    })
      .overrideProvider(HcmClientService)
      .useValue(hcmClientMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let createdRequestId: string;

  it('/requests (POST) - Insufficient Mock Balance', async () => {
    hcmClientMock.fetchBalance.mockResolvedValueOnce({ balanceDays: 2 });
    
    return request(app.getHttpServer())
      .post('/requests')
      .send({ employeeId: 'emp-mask-1', locationId: 'US', daysRequested: 5 })
      .expect(400);
  });

  it('/requests (POST) - Success', async () => {
    hcmClientMock.fetchBalance.mockResolvedValueOnce({ balanceDays: 10 });
    
    const response = await request(app.getHttpServer())
      .post('/requests')
      .send({ employeeId: 'emp-mask-2', locationId: 'US', daysRequested: 3 })
      .expect(201);
      
    expect(response.body.status).toEqual(TimeOffRequestStatus.PENDING);
    createdRequestId = response.body.id;
  });

  it('/requests/:id/approve (POST) - Triggers Outbox state', async () => {
    const response = await request(app.getHttpServer())
      .post(`/requests/${createdRequestId}/approve`)
      .expect(201);
      
    expect(response.body.status).toEqual(TimeOffRequestStatus.APPROVED);
    expect(response.body.hcmSyncStatus).toEqual(HcmSyncStatus.PENDING_SYNC);
  });
});
