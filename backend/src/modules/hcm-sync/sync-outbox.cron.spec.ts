import { Test, TestingModule } from '@nestjs/testing';
import { SyncOutboxCron } from './sync-outbox.cron';
import { HcmClientService } from './hcm-client.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TimeOffRequest, TimeOffRequestStatus, HcmSyncStatus } from '../timeoff/entities/timeoff-request.entity';

describe('SyncOutboxCron', () => {
  let cron: SyncOutboxCron;
  let requestRepo: any;
  let hcmClient: any;

  beforeEach(async () => {
    requestRepo = {
      find: jest.fn(),
      save: jest.fn(),
    };

    hcmClient = {
      deductBalance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncOutboxCron,
        { provide: getRepositoryToken(TimeOffRequest), useValue: requestRepo },
        { provide: HcmClientService, useValue: hcmClient },
      ],
    }).compile();

    cron = module.get<SyncOutboxCron>(SyncOutboxCron);
  });

  it('should do nothing when no pending requests', async () => {
    requestRepo.find.mockResolvedValue([]);
    await cron.handleCron();
    expect(hcmClient.deductBalance).not.toHaveBeenCalled();
  });

  it('should sync APPROVED requests by deducting from HCM', async () => {
    const request = {
      id: 'req-1', status: TimeOffRequestStatus.APPROVED,
      hcmSyncStatus: HcmSyncStatus.PENDING_SYNC,
      employeeId: 'emp-1', locationId: 'US-NY', daysRequested: 3,
    };
    requestRepo.find.mockResolvedValue([request]);
    hcmClient.deductBalance.mockResolvedValue({});

    await cron.handleCron();

    expect(hcmClient.deductBalance).toHaveBeenCalledWith('emp-1', 'US-NY', 3);
    expect(request.hcmSyncStatus).toEqual(HcmSyncStatus.SYNCED);
    expect(requestRepo.save).toHaveBeenCalledWith(request);
  });

  it('should sync CANCELLED requests by crediting HCM (negative deduction)', async () => {
    const request = {
      id: 'req-2', status: TimeOffRequestStatus.CANCELLED,
      hcmSyncStatus: HcmSyncStatus.PENDING_SYNC,
      employeeId: 'emp-1', locationId: 'US-NY', daysRequested: 5,
    };
    requestRepo.find.mockResolvedValue([request]);
    hcmClient.deductBalance.mockResolvedValue({});

    await cron.handleCron();

    expect(hcmClient.deductBalance).toHaveBeenCalledWith('emp-1', 'US-NY', -5);
    expect(request.hcmSyncStatus).toEqual(HcmSyncStatus.SYNCED);
  });

  it('should mark as FAILED on 400 business logic errors', async () => {
    const request = {
      id: 'req-3', status: TimeOffRequestStatus.APPROVED,
      hcmSyncStatus: HcmSyncStatus.PENDING_SYNC,
      employeeId: 'emp-1', locationId: 'US-NY', daysRequested: 100,
    };
    requestRepo.find.mockResolvedValue([request]);
    hcmClient.deductBalance.mockRejectedValue({ response: { status: 400 }, message: 'Insufficient balance in HCM' });

    await cron.handleCron();

    expect(request.hcmSyncStatus).toEqual(HcmSyncStatus.FAILED);
    expect(requestRepo.save).toHaveBeenCalledWith(request);
  });

  it('should leave as PENDING_SYNC on transient 500 errors (retry later)', async () => {
    const request = {
      id: 'req-4', status: TimeOffRequestStatus.APPROVED,
      hcmSyncStatus: HcmSyncStatus.PENDING_SYNC,
      employeeId: 'emp-1', locationId: 'US-NY', daysRequested: 2,
    };
    requestRepo.find.mockResolvedValue([request]);
    hcmClient.deductBalance.mockRejectedValue({ response: { status: 500 }, message: 'HCM unavailable' });

    await cron.handleCron();

    expect(request.hcmSyncStatus).toEqual(HcmSyncStatus.PENDING_SYNC);
    expect(requestRepo.save).not.toHaveBeenCalled();
  });

  it('should leave as PENDING_SYNC on network errors (no response object)', async () => {
    const request = {
      id: 'req-5', status: TimeOffRequestStatus.APPROVED,
      hcmSyncStatus: HcmSyncStatus.PENDING_SYNC,
      employeeId: 'emp-1', locationId: 'US-NY', daysRequested: 2,
    };
    requestRepo.find.mockResolvedValue([request]);
    hcmClient.deductBalance.mockRejectedValue(new Error('ECONNREFUSED'));

    await cron.handleCron();

    expect(request.hcmSyncStatus).toEqual(HcmSyncStatus.PENDING_SYNC);
  });

  it('should process multiple requests in a single cron tick', async () => {
    const requests = [
      { id: 'r1', status: TimeOffRequestStatus.APPROVED, hcmSyncStatus: HcmSyncStatus.PENDING_SYNC, employeeId: 'emp-1', locationId: 'US-NY', daysRequested: 1 },
      { id: 'r2', status: TimeOffRequestStatus.APPROVED, hcmSyncStatus: HcmSyncStatus.PENDING_SYNC, employeeId: 'emp-2', locationId: 'UK-LON', daysRequested: 2 },
      { id: 'r3', status: TimeOffRequestStatus.CANCELLED, hcmSyncStatus: HcmSyncStatus.PENDING_SYNC, employeeId: 'emp-1', locationId: 'US-NY', daysRequested: 3 },
    ];
    requestRepo.find.mockResolvedValue(requests);
    hcmClient.deductBalance.mockResolvedValue({});

    await cron.handleCron();

    expect(hcmClient.deductBalance).toHaveBeenCalledTimes(3);
    expect(requestRepo.save).toHaveBeenCalledTimes(3);
    requests.forEach(r => expect(r.hcmSyncStatus).toEqual(HcmSyncStatus.SYNCED));
  });

  it('should continue processing remaining requests even if one fails', async () => {
    const requests = [
      { id: 'r1', status: TimeOffRequestStatus.APPROVED, hcmSyncStatus: HcmSyncStatus.PENDING_SYNC, employeeId: 'emp-1', locationId: 'US-NY', daysRequested: 1 },
      { id: 'r2', status: TimeOffRequestStatus.APPROVED, hcmSyncStatus: HcmSyncStatus.PENDING_SYNC, employeeId: 'emp-2', locationId: 'UK-LON', daysRequested: 2 },
    ];
    requestRepo.find.mockResolvedValue(requests);
    hcmClient.deductBalance
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({});

    await cron.handleCron();

    expect(requests[0].hcmSyncStatus).toEqual(HcmSyncStatus.PENDING_SYNC);
    expect(requests[1].hcmSyncStatus).toEqual(HcmSyncStatus.SYNCED);
    expect(requestRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should handle decimal daysRequested values', async () => {
    const request = {
      id: 'req-dec', status: TimeOffRequestStatus.APPROVED,
      hcmSyncStatus: HcmSyncStatus.PENDING_SYNC,
      employeeId: 'emp-1', locationId: 'US-NY', daysRequested: '2.5',
    };
    requestRepo.find.mockResolvedValue([request]);
    hcmClient.deductBalance.mockResolvedValue({});

    await cron.handleCron();

    expect(hcmClient.deductBalance).toHaveBeenCalledWith('emp-1', 'US-NY', 2.5);
  });

  it('should query for PENDING_SYNC with batch size limit', async () => {
    requestRepo.find.mockResolvedValue([]);
    await cron.handleCron();

    expect(requestRepo.find).toHaveBeenCalledWith({
      where: { hcmSyncStatus: HcmSyncStatus.PENDING_SYNC },
      take: 50,
    });
  });
  it('should not call deductBalance for PENDING status requests', async () => {
    const request = {
      id: 'req-pending', status: TimeOffRequestStatus.PENDING,
      hcmSyncStatus: HcmSyncStatus.PENDING_SYNC,
      employeeId: 'emp-1', locationId: 'US-NY', daysRequested: 2,
    };
    requestRepo.find.mockResolvedValue([request]);

    await cron.handleCron();

    expect(hcmClient.deductBalance).not.toHaveBeenCalled();
    expect(request.hcmSyncStatus).toEqual(HcmSyncStatus.SYNCED);
  });

  describe('Complex Failure & Batching Scenarios', () => {
    it('should ignore non-APPROVED/non-CANCELLED statuses but mark them as SYNCED (idempotency safety)', async () => {
      // If a request is PENDING_SYNC but status is REJECTED (shouldn't happen with current UI but good for safety)
      const request = {
        id: 'req-rej', status: TimeOffRequestStatus.REJECTED,
        hcmSyncStatus: HcmSyncStatus.PENDING_SYNC,
        employeeId: 'emp-1', locationId: 'US-NY', daysRequested: 2,
      } as any;
      requestRepo.find.mockResolvedValue([request]);

      await cron.handleCron();

      expect(hcmClient.deductBalance).not.toHaveBeenCalled();
      expect(request.hcmSyncStatus).toEqual(HcmSyncStatus.SYNCED);
      expect(requestRepo.save).toHaveBeenCalled();
    });

    it('should treat 429 Too Many Requests as a transient failure and retry later', async () => {
      const request = {
        id: 'req-rate', status: TimeOffRequestStatus.APPROVED,
        hcmSyncStatus: HcmSyncStatus.PENDING_SYNC,
        employeeId: 'emp-1', locationId: 'US-NY', daysRequested: 1,
      } as any;
      requestRepo.find.mockResolvedValue([request]);
      hcmClient.deductBalance.mockRejectedValue({ response: { status: 429 }, message: 'Rate limit' });

      await cron.handleCron();

      expect(request.hcmSyncStatus).toEqual(HcmSyncStatus.PENDING_SYNC);
      expect(requestRepo.save).not.toHaveBeenCalled();
    });

    it('should handle missing error response objects gracefully during sync', async () => {
      const request = {
        id: 'req-error', status: TimeOffRequestStatus.APPROVED,
        hcmSyncStatus: HcmSyncStatus.PENDING_SYNC,
        employeeId: 'emp-1',
      } as any;
      requestRepo.find.mockResolvedValue([request]);
      hcmClient.deductBalance.mockRejectedValue(new Error('Generic failure'));

      await cron.handleCron();

      expect(request.hcmSyncStatus).toEqual(HcmSyncStatus.PENDING_SYNC); // Should retry
    });

    it('should maintain sequential integrity in logs even when skipping requests', async () => {
      const requests = [
        { id: 'r1', status: TimeOffRequestStatus.APPROVED, hcmSyncStatus: HcmSyncStatus.PENDING_SYNC },
        { id: 'r2', status: 'UNKNOWN' as any, hcmSyncStatus: HcmSyncStatus.PENDING_SYNC },
        { id: 'r3', status: TimeOffRequestStatus.CANCELLED, hcmSyncStatus: HcmSyncStatus.PENDING_SYNC },
      ];
      requestRepo.find.mockResolvedValue(requests);
      hcmClient.deductBalance.mockResolvedValue({});

      await cron.handleCron();

      expect(hcmClient.deductBalance).toHaveBeenCalledTimes(2); // r1 and r3
      expect(requestRepo.save).toHaveBeenCalledTimes(3); // all marked as SYNCED
    });
  });
});
