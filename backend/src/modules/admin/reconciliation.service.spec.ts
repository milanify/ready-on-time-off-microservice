import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationService } from './reconciliation.service';
import { HcmClientService } from '../hcm-sync/hcm-client.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeaveBalance } from '../balance/entities/leave-balance.entity';
import { SyncLog, SyncSource } from './entities/sync-log.entity';
import { DataSource } from 'typeorm';
import { HttpException } from '@nestjs/common';

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let balanceRepo: any;
  let syncLogRepo: any;
  let hcmClient: any;
  let dataSource: any;
  let queryRunner: any;
  let queryRunnerManager: any;

  beforeEach(async () => {
    queryRunnerManager = {
      findOne: jest.fn(),
      create: jest.fn((entity, data) => data),
      save: jest.fn(),
    };

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: queryRunnerManager,
    };

    balanceRepo = { findOne: jest.fn() };
    syncLogRepo = { find: jest.fn() };

    hcmClient = {
      fetchBalance: jest.fn(),
    };

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        { provide: getRepositoryToken(LeaveBalance), useValue: balanceRepo },
        { provide: getRepositoryToken(SyncLog), useValue: syncLogRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: HcmClientService, useValue: hcmClient },
      ],
    }).compile();

    service = module.get<ReconciliationService>(ReconciliationService);
  });

  // ─── detectDrift ──────────────────────────────────────

  describe('detectDrift', () => {
    it('should detect positive drift when HCM is higher', async () => {
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ balanceDays: 20, reservedDays: 0, employeeId: 'emp-1', locationId: 'loc-1' })
        .mockResolvedValueOnce({ balanceDays: 30, reservedDays: 0, employeeId: 'emp-1', locationId: 'loc-1' });

      const result = await service.detectDrift('emp-1', 'loc-1', SyncSource.ADMIN_RECONCILE, 30);

      expect(result.reconciled).toBe(true);
      expect(result.delta).toBe(10);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should detect negative drift when HCM is lower', async () => {
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ balanceDays: 30, reservedDays: 0, employeeId: 'emp-1', locationId: 'loc-1' })
        .mockResolvedValueOnce({ balanceDays: 20, reservedDays: 0, employeeId: 'emp-1', locationId: 'loc-1' });

      const result = await service.detectDrift('emp-1', 'loc-1', SyncSource.HCM_WEBHOOK, 20);

      expect(result.reconciled).toBe(true);
      expect(result.delta).toBe(-10);
    });

    it('should return reconciled=false when no drift', async () => {
      queryRunnerManager.findOne.mockResolvedValueOnce({
        balanceDays: 20, reservedDays: 0, employeeId: 'emp-1', locationId: 'loc-1'
      });

      const result = await service.detectDrift('emp-1', 'loc-1', SyncSource.ADMIN_RECONCILE, 20);

      expect(result.reconciled).toBe(false);
      expect(result.delta).toBe(0);
    });

    it('should create new balance record if none exists locally', async () => {
      queryRunnerManager.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ balanceDays: 25, reservedDays: 0 });

      const result = await service.detectDrift('new-emp', 'loc-1', SyncSource.HCM_BATCH, 25);

      expect(result.reconciled).toBe(true);
      expect(result.delta).toBe(25);
      expect(queryRunnerManager.create).toHaveBeenCalledWith(LeaveBalance, expect.objectContaining({
        employeeId: 'new-emp',
        balanceDays: 25,
        reservedDays: 0,
      }));
    });

    it('should flag critical drift when balance drops below reserved', async () => {
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ balanceDays: 20, reservedDays: 15, employeeId: 'emp-1', locationId: 'loc-1' })
        .mockResolvedValueOnce({ balanceDays: 10, reservedDays: 15, employeeId: 'emp-1', locationId: 'loc-1' });

      const result = await service.detectDrift('emp-1', 'loc-1', SyncSource.HCM_WEBHOOK, 10);

      expect(result.reconciled).toBe(true);
      expect(result.critical).toBe(true);
      expect(queryRunnerManager.save).toHaveBeenCalledWith(SyncLog, expect.objectContaining({
        action: 'CRITICAL_DRIFT_DETECTED',
      }));
    });

    it('should not flag critical when balance stays above reserved', async () => {
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ balanceDays: 20, reservedDays: 5, employeeId: 'emp-1', locationId: 'loc-1' })
        .mockResolvedValueOnce({ balanceDays: 25, reservedDays: 5, employeeId: 'emp-1', locationId: 'loc-1' });

      const result = await service.detectDrift('emp-1', 'loc-1', SyncSource.HCM_WEBHOOK, 25);

      expect(result.critical).toBeFalsy();
    });

    it('should fetch from HCM when balance is not provided', async () => {
      hcmClient.fetchBalance.mockResolvedValue({ balanceDays: 30 });
      queryRunnerManager.findOne.mockResolvedValueOnce({
        balanceDays: 30, reservedDays: 0, employeeId: 'emp-1', locationId: 'loc-1'
      });

      await service.detectDrift('emp-1', 'loc-1', SyncSource.ADMIN_RECONCILE);

      expect(hcmClient.fetchBalance).toHaveBeenCalledWith('emp-1', 'loc-1');
    });

    it('should throw HttpException BAD_GATEWAY when HCM is unreachable', async () => {
      hcmClient.fetchBalance.mockRejectedValue(new Error('Connection refused'));

      await expect(service.detectDrift('emp-1', 'loc-1', SyncSource.ADMIN_RECONCILE))
        .rejects.toThrow(HttpException);
    });

    it('should log the correct SyncSource for each channel', async () => {
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ balanceDays: 20, reservedDays: 0, employeeId: 'emp-1', locationId: 'loc-1' })
        .mockResolvedValueOnce({ balanceDays: 25, reservedDays: 0 });

      await service.detectDrift('emp-1', 'loc-1', SyncSource.HCM_BATCH, 25);

      expect(queryRunnerManager.save).toHaveBeenCalledWith(SyncLog, expect.objectContaining({
        source: SyncSource.HCM_BATCH,
      }));
    });

    it('should rollback on unexpected error', async () => {
      queryRunnerManager.findOne.mockRejectedValue(new Error('crash'));

      await expect(service.detectDrift('emp-1', 'loc-1', SyncSource.ADMIN_RECONCILE, 20))
        .rejects.toThrow('crash');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should log previousBalance and newBalance in SyncLog', async () => {
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ balanceDays: 15, reservedDays: 0, employeeId: 'emp-1', locationId: 'loc-1' })
        .mockResolvedValueOnce({ balanceDays: 25, reservedDays: 0 });

      await service.detectDrift('emp-1', 'loc-1', SyncSource.HCM_WEBHOOK, 25);

      expect(queryRunnerManager.save).toHaveBeenCalledWith(SyncLog, expect.objectContaining({
        previousBalance: 15,
        newBalance: 25,
        delta: 10,
      }));
    });
  });

  // ─── getComparison ────────────────────────────────────

  describe('getComparison', () => {
    it('should return local and HCM balances with drift calculation', async () => {
      balanceRepo.findOne.mockResolvedValue({ balanceDays: 20, reservedDays: 3 });
      hcmClient.fetchBalance.mockResolvedValue({ balanceDays: 25 });

      const result = await service.getComparison('emp-1', 'loc-1');

      expect(result).toEqual({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        localBalance: 20,
        localReserved: 3,
        hcmBalance: 25,
        drift: 5,
      });
    });

    it('should return 0 local balance when no local record exists', async () => {
      balanceRepo.findOne.mockResolvedValue(null);
      hcmClient.fetchBalance.mockResolvedValue({ balanceDays: 30 });

      const result = await service.getComparison('emp-1', 'loc-1');

      expect(result.localBalance).toBe(0);
      expect(result.drift).toBe(30);
    });

    it('should return null hcmBalance and drift when HCM is unreachable', async () => {
      balanceRepo.findOne.mockResolvedValue({ balanceDays: 20, reservedDays: 0 });
      hcmClient.fetchBalance.mockRejectedValue(new Error('timeout'));

      const result = await service.getComparison('emp-1', 'loc-1');

      expect(result.hcmBalance).toBeNull();
      expect(result.drift).toBeNull();
    });

    it('should show zero drift when balances match', async () => {
      balanceRepo.findOne.mockResolvedValue({ balanceDays: 20, reservedDays: 0 });
      hcmClient.fetchBalance.mockResolvedValue({ balanceDays: 20 });

      const result = await service.getComparison('emp-1', 'loc-1');
      expect(result.drift).toBe(0);
    });

    it('should handle decimal precision in comparison logic', async () => {
      balanceRepo.findOne.mockResolvedValue({ balanceDays: '10.25', reservedDays: '1.25' });
      hcmClient.fetchBalance.mockResolvedValue({ balanceDays: '15.50' });

      const result = await service.getComparison('emp-1', 'loc-1');
      expect(result.drift).toBe(5.25);
    });
  });

  describe('Health Checks & Data Consistency', () => {
    it('should identify a critical state when drift reduction puts employee in negative available', async () => {
      // Local: 5 balance, 10 reserved (-5 available)
      // HCM: 8 balance (still -2 available)
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ balanceDays: 5, reservedDays: 10, employeeId: 'emp-1', locationId: 'loc-1' })
        .mockResolvedValueOnce({ balanceDays: 8, reservedDays: 10, employeeId: 'emp-1', locationId: 'loc-1' });

      const result = await service.detectDrift('emp-1', 'loc-1', SyncSource.HCM_WEBHOOK, 8);
      expect(result.critical).toBe(true);
    });

    it('should handle the edge case where providedHcmBalance is zero intentionally', async () => {
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ balanceDays: 20, reservedDays: 0, employeeId: 'emp-1', locationId: 'loc-1' })
        .mockResolvedValueOnce({ balanceDays: 0, reservedDays: 0 });

      const result = await service.detectDrift('emp-1', 'loc-1', SyncSource.ADMIN_RECONCILE, 0);
      expect(result.reconciled).toBe(true);
      expect(result.delta).toBe(-20);
    });

    it('should throw even if one database operation fails during the drift sync', async () => {
      queryRunnerManager.findOne.mockResolvedValueOnce({ balanceDays: 20, reservedDays: 0 });
      queryRunnerManager.save.mockRejectedValueOnce(new Error('Persistent store failed'));

      await expect(service.detectDrift('emp-1', 'loc-1', SyncSource.HCM_BATCH, 25))
        .rejects.toThrow('Persistent store failed');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should log previousBalance=0 when a new employee is created from drift', async () => {
      queryRunnerManager.findOne.mockResolvedValueOnce(null) // Not found
        .mockResolvedValueOnce({ balanceDays: 15, reservedDays: 0 });

      await service.detectDrift('new-bee', 'loc-1', SyncSource.HCM_BATCH, 15);

      expect(queryRunnerManager.save).toHaveBeenCalledWith(SyncLog, expect.objectContaining({
        previousBalance: 0,
        newBalance: 15,
        delta: 15
      }));
    });
  });
});
