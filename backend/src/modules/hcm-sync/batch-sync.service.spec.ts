import { Test, TestingModule } from '@nestjs/testing';
import { BatchSyncService } from './batch-sync.service';
import { ReconciliationService } from '../admin/reconciliation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SyncEvent } from '../admin/entities/sync-event.entity';
import { SyncSource } from '../admin/entities/sync-log.entity';

describe('BatchSyncService', () => {
  let service: BatchSyncService;
  let reconciliationService: any;
  let syncEventRepo: any;

  beforeEach(async () => {
    reconciliationService = {
      detectDrift: jest.fn().mockResolvedValue({ reconciled: false, delta: 0 }),
    };

    syncEventRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchSyncService,
        { provide: ReconciliationService, useValue: reconciliationService },
        { provide: getRepositoryToken(SyncEvent), useValue: syncEventRepo },
      ],
    }).compile();

    service = module.get<BatchSyncService>(BatchSyncService);
  });

  // ─── applyIdempotentUpdate ────────────────────────────

  describe('applyIdempotentUpdate', () => {
    it('should process a new batch event', async () => {
      syncEventRepo.findOne.mockResolvedValue(null); // not a duplicate

      const payload = [
        { employeeId: 'emp-1', locationId: 'US-NY', balanceDays: 30 },
        { employeeId: 'emp-2', locationId: 'UK-LON', balanceDays: 25 },
      ];

      const result = await service.applyIdempotentUpdate('evt_001', payload);

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(reconciliationService.detectDrift).toHaveBeenCalledTimes(2);
      expect(syncEventRepo.save).toHaveBeenCalledWith({ id: 'evt_001' });
    });

    it('should skip duplicate batch events (idempotency)', async () => {
      syncEventRepo.findOne.mockResolvedValue({ id: 'evt_001' }); // already processed

      const result = await service.applyIdempotentUpdate('evt_001', []);

      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('Duplicate');
      expect(reconciliationService.detectDrift).not.toHaveBeenCalled();
    });

    it('should count reconciled records', async () => {
      syncEventRepo.findOne.mockResolvedValue(null);
      reconciliationService.detectDrift
        .mockResolvedValueOnce({ reconciled: true })
        .mockResolvedValueOnce({ reconciled: false })
        .mockResolvedValueOnce({ reconciled: true });

      const payload = [
        { employeeId: 'emp-1', locationId: 'US-NY', balanceDays: 30 },
        { employeeId: 'emp-2', locationId: 'UK-LON', balanceDays: 25 },
        { employeeId: 'emp-3', locationId: 'US-LA', balanceDays: 20 },
      ];

      const result = await service.applyIdempotentUpdate('evt_002', payload);

      expect(result.reconciled).toBe(2);
      expect(result.total).toBe(3);
    });

    it('should pass correct SyncSource for batch', async () => {
      syncEventRepo.findOne.mockResolvedValue(null);

      await service.applyIdempotentUpdate('evt_003', [
        { employeeId: 'emp-1', locationId: 'US-NY', balanceDays: 30 },
      ]);

      expect(reconciliationService.detectDrift).toHaveBeenCalledWith(
        'emp-1', 'US-NY', SyncSource.HCM_BATCH, 30
      );
    });

    it('should handle empty payload', async () => {
      syncEventRepo.findOne.mockResolvedValue(null);

      const result = await service.applyIdempotentUpdate('evt_004', []);

      expect(result.success).toBe(true);
      expect(result.total).toBe(0);
      expect(result.reconciled).toBe(0);
    });

    it('should save syncEventId after processing', async () => {
      syncEventRepo.findOne.mockResolvedValue(null);

      await service.applyIdempotentUpdate('evt_unique_id', [
        { employeeId: 'emp-1', locationId: 'US-NY', balanceDays: 30 },
      ]);

      expect(syncEventRepo.save).toHaveBeenCalledWith({ id: 'evt_unique_id' });
    });
  });

  // ─── handleWebhook ────────────────────────────────────

  describe('handleWebhook', () => {
    it('should process ANNIVERSARY_CREDIT event', async () => {
      const payload = {
        eventType: 'ANNIVERSARY_CREDIT',
        employeeId: 'emp-1',
        locationId: 'US-NY',
        balanceDays: 40,
      };

      const result = await service.handleWebhook(payload);

      expect(result.success).toBe(true);
      expect(reconciliationService.detectDrift).toHaveBeenCalledWith(
        'emp-1', 'US-NY', SyncSource.HCM_WEBHOOK, 40
      );
    });

    it('should process MANUAL_ADJUSTMENT event', async () => {
      const payload = {
        eventType: 'MANUAL_ADJUSTMENT',
        employeeId: 'emp-2',
        locationId: 'UK-LON',
        balanceDays: 15,
      };

      await service.handleWebhook(payload);

      expect(reconciliationService.detectDrift).toHaveBeenCalledWith(
        'emp-2', 'UK-LON', SyncSource.HCM_WEBHOOK, 15
      );
    });

    it('should ignore unknown event types', async () => {
      const payload = {
        eventType: 'UNKNOWN_EVENT',
        employeeId: 'emp-1',
        locationId: 'US-NY',
        balanceDays: 40,
      };

      const result = await service.handleWebhook(payload);

      expect(result.success).toBe(true);
      expect(reconciliationService.detectDrift).not.toHaveBeenCalled();
    });

    it('should return success even without processing', async () => {
      const result = await service.handleWebhook({ eventType: 'SOMETHING_ELSE' });
      expect(result.success).toBe(true);
    });
  });
});
