import { Test, TestingModule } from '@nestjs/testing';
import { TimeOffService } from './timeoff.service';
import { BalanceService } from '../balance/balance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TimeOffRequest, TimeOffRequestStatus, HcmSyncStatus } from './entities/timeoff-request.entity';
import { LeaveBalance } from '../balance/entities/leave-balance.entity';
import { DataSource, QueryRunner } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TimeOffService', () => {
  let service: TimeOffService;
  let requestRepo: any;
  let balanceService: any;
  let dataSource: any;
  let queryRunner: any;
  let queryRunnerManager: any;

  beforeEach(async () => {
    queryRunnerManager = {
      findOne: jest.fn(),
      create: jest.fn((entity, data) => data),
      save: jest.fn((entity, data) => ({ id: 'test-uuid', ...data })),
    };

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: queryRunnerManager,
    };

    requestRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    balanceService = {
      getAvailableBalance: jest.fn().mockResolvedValue({ availableDays: 20, balanceDays: 20, reservedDays: 0 }),
    };

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeOffService,
        { provide: getRepositoryToken(TimeOffRequest), useValue: requestRepo },
        { provide: BalanceService, useValue: balanceService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<TimeOffService>(TimeOffService);
  });

  // ─── submitRequest ─────────────────────────────────────

  describe('submitRequest', () => {
    it('should create a PENDING request and reserve days', async () => {
      queryRunnerManager.findOne.mockResolvedValue({
        balanceDays: 20,
        reservedDays: 0,
      });

      const result = await service.submitRequest('emp-1', 'loc-1', 5);

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunnerManager.save).toHaveBeenCalledWith(LeaveBalance, expect.objectContaining({ reservedDays: 5 }));
      expect(queryRunnerManager.save).toHaveBeenCalledWith(TimeOffRequest, expect.objectContaining({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        daysRequested: 5,
        status: TimeOffRequestStatus.PENDING,
        hcmSyncStatus: HcmSyncStatus.PENDING_SYNC,
      }));
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should reject zero days requested', async () => {
      await expect(service.submitRequest('emp-1', 'loc-1', 0))
        .rejects.toThrow(BadRequestException);
    });

    it('should reject negative days requested', async () => {
      await expect(service.submitRequest('emp-1', 'loc-1', -3))
        .rejects.toThrow(BadRequestException);
    });

    it('should reject when available balance is insufficient', async () => {
      queryRunnerManager.findOne.mockResolvedValue({
        balanceDays: 10,
        reservedDays: 8,
      });

      await expect(service.submitRequest('emp-1', 'loc-1', 5))
        .rejects.toThrow(BadRequestException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should reject when balance record is missing during transaction', async () => {
      queryRunnerManager.findOne.mockResolvedValue(null);

      await expect(service.submitRequest('emp-1', 'loc-1', 5))
        .rejects.toThrow(BadRequestException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should handle exact balance (request all available days)', async () => {
      queryRunnerManager.findOne.mockResolvedValue({
        balanceDays: 5,
        reservedDays: 0,
      });

      const result = await service.submitRequest('emp-1', 'loc-1', 5);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunnerManager.save).toHaveBeenCalledWith(LeaveBalance, expect.objectContaining({ reservedDays: 5 }));
    });

    it('should handle decimal balance values from SQLite', async () => {
      queryRunnerManager.findOne.mockResolvedValue({
        balanceDays: '15.5',
        reservedDays: '3.5',
      });

      const result = await service.submitRequest('emp-1', 'loc-1', 10);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunnerManager.save).toHaveBeenCalledWith(LeaveBalance, expect.objectContaining({ reservedDays: 13.5 }));
    });

    it('should rollback and release on unexpected error', async () => {
      queryRunnerManager.findOne.mockRejectedValue(new Error('DB crashed'));

      await expect(service.submitRequest('emp-1', 'loc-1', 5)).rejects.toThrow('DB crashed');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should accumulate reservedDays from existing reservations', async () => {
      queryRunnerManager.findOne.mockResolvedValue({
        balanceDays: 20,
        reservedDays: 5,
      });

      await service.submitRequest('emp-1', 'loc-1', 3);

      expect(queryRunnerManager.save).toHaveBeenCalledWith(LeaveBalance, expect.objectContaining({ reservedDays: 8 }));
    });

    it('should first call balanceService.getAvailableBalance to ensure cache', async () => {
      queryRunnerManager.findOne.mockResolvedValue({ balanceDays: 20, reservedDays: 0 });

      await service.submitRequest('emp-1', 'loc-1', 5);

      expect(balanceService.getAvailableBalance).toHaveBeenCalledWith('emp-1', 'loc-1');
    });
  });

  // ─── approveRequest ────────────────────────────────────

  describe('approveRequest', () => {
    it('should approve a PENDING request and deduct from balance', async () => {
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ id: 'req-1', status: TimeOffRequestStatus.PENDING, employeeId: 'emp-1', locationId: 'loc-1', daysRequested: 3 })
        .mockResolvedValueOnce({ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 20, reservedDays: 3 });

      const result = await service.approveRequest('req-1');

      expect(queryRunnerManager.save).toHaveBeenCalledWith(LeaveBalance, expect.objectContaining({
        reservedDays: 0,
        balanceDays: 17,
      }));
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should reject approving a non-PENDING request', async () => {
      queryRunnerManager.findOne.mockResolvedValueOnce({
        id: 'req-1', status: TimeOffRequestStatus.APPROVED,
      });

      await expect(service.approveRequest('req-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject approving a REJECTED request', async () => {
      queryRunnerManager.findOne.mockResolvedValueOnce({
        id: 'req-1', status: TimeOffRequestStatus.REJECTED,
      });

      await expect(service.approveRequest('req-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent request', async () => {
      queryRunnerManager.findOne.mockResolvedValueOnce(null);

      await expect(service.approveRequest('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should set hcmSyncStatus to PENDING_SYNC on approval', async () => {
      const request = { id: 'req-1', status: TimeOffRequestStatus.PENDING, employeeId: 'emp-1', locationId: 'loc-1', daysRequested: 2, hcmSyncStatus: HcmSyncStatus.PENDING_SYNC };
      queryRunnerManager.findOne
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce({ balanceDays: 20, reservedDays: 2, employeeId: 'emp-1', locationId: 'loc-1' });

      await service.approveRequest('req-1');

      expect(request.hcmSyncStatus).toEqual(HcmSyncStatus.PENDING_SYNC);
    });

    it('should handle decimal daysRequested during approval', async () => {
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ id: 'req-1', status: TimeOffRequestStatus.PENDING, employeeId: 'emp-1', locationId: 'loc-1', daysRequested: '2.5' })
        .mockResolvedValueOnce({ balanceDays: '20.0', reservedDays: '2.5', employeeId: 'emp-1', locationId: 'loc-1' });

      await service.approveRequest('req-1');

      expect(queryRunnerManager.save).toHaveBeenCalledWith(LeaveBalance, expect.objectContaining({
        reservedDays: 0,
        balanceDays: 17.5,
      }));
    });

    it('should rollback transaction on failure', async () => {
      queryRunnerManager.findOne.mockResolvedValueOnce({
        id: 'req-1', status: TimeOffRequestStatus.PENDING, employeeId: 'emp-1', locationId: 'loc-1', daysRequested: 2
      });
      queryRunnerManager.findOne.mockRejectedValueOnce(new Error('boom'));

      await expect(service.approveRequest('req-1')).rejects.toThrow('boom');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  // ─── rejectRequest ─────────────────────────────────────

  describe('rejectRequest', () => {
    it('should reject a PENDING request and free reserved days', async () => {
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ id: 'req-1', status: TimeOffRequestStatus.PENDING, employeeId: 'emp-1', locationId: 'loc-1', daysRequested: 3 })
        .mockResolvedValueOnce({ balanceDays: 20, reservedDays: 3, employeeId: 'emp-1', locationId: 'loc-1' });

      const result = await service.rejectRequest('req-1');

      expect(queryRunnerManager.save).toHaveBeenCalledWith(LeaveBalance, expect.objectContaining({ reservedDays: 0 }));
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw for non-PENDING requests', async () => {
      queryRunnerManager.findOne.mockResolvedValueOnce({ id: 'req-1', status: TimeOffRequestStatus.APPROVED });

      await expect(service.rejectRequest('req-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for missing request', async () => {
      queryRunnerManager.findOne.mockResolvedValueOnce(null);

      await expect(service.rejectRequest('not-found')).rejects.toThrow(NotFoundException);
    });

    it('should not touch balanceDays on rejection (only reservedDays)', async () => {
      const balance = { balanceDays: 20, reservedDays: 5, employeeId: 'emp-1', locationId: 'loc-1' };
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ id: 'req-1', status: TimeOffRequestStatus.PENDING, employeeId: 'emp-1', locationId: 'loc-1', daysRequested: 3 })
        .mockResolvedValueOnce(balance);

      await service.rejectRequest('req-1');

      expect(balance.balanceDays).toEqual(20);
      expect(balance.reservedDays).toEqual(2);
    });
  });

  // ─── cancelRequest ─────────────────────────────────────

  describe('cancelRequest', () => {
    it('should cancel a PENDING request and free reserved days', async () => {
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ id: 'req-1', status: TimeOffRequestStatus.PENDING, employeeId: 'emp-1', locationId: 'loc-1', daysRequested: 3 })
        .mockResolvedValueOnce({ balanceDays: 20, reservedDays: 5 });

      const result = await service.cancelRequest('req-1');

      expect(queryRunnerManager.save).toHaveBeenCalledWith(LeaveBalance, expect.objectContaining({ reservedDays: 2 }));
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should cancel an APPROVED request and refund balanceDays', async () => {
      const request = { id: 'req-1', status: TimeOffRequestStatus.APPROVED, employeeId: 'emp-1', locationId: 'loc-1', daysRequested: 3, hcmSyncStatus: HcmSyncStatus.SYNCED };
      queryRunnerManager.findOne
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce({ balanceDays: 17, reservedDays: 0 });

      await service.cancelRequest('req-1');

      expect(queryRunnerManager.save).toHaveBeenCalledWith(LeaveBalance, expect.objectContaining({ balanceDays: 20 }));
      expect(request.hcmSyncStatus).toEqual(HcmSyncStatus.PENDING_SYNC);
    });

    it('should throw NotFoundException for missing request', async () => {
      queryRunnerManager.findOne.mockResolvedValueOnce(null);

      await expect(service.cancelRequest('not-found')).rejects.toThrow(NotFoundException);
    });

    it('should set final status to CANCELLED regardless of previous state', async () => {
      const request = { id: 'req-1', status: TimeOffRequestStatus.PENDING, employeeId: 'emp-1', locationId: 'loc-1', daysRequested: 2 };
      queryRunnerManager.findOne
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce({ balanceDays: 20, reservedDays: 2 });

      await service.cancelRequest('req-1');

      expect(request.status).toEqual(TimeOffRequestStatus.CANCELLED);
    });

    it('should handle cancellation when balance record is null for PENDING', async () => {
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ id: 'req-1', status: TimeOffRequestStatus.PENDING, employeeId: 'emp-1', locationId: 'loc-1', daysRequested: 3 })
        .mockResolvedValueOnce(null);

      const result = await service.cancelRequest('req-1');

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  // ─── getRequests ───────────────────────────────────────

  describe('getRequests', () => {
    it('should return all requests when no filters', async () => {
      requestRepo.find.mockResolvedValue([{ id: '1' }, { id: '2' }]);
      const result = await service.getRequests();
      expect(requestRepo.find).toHaveBeenCalledWith({ where: {} });
      expect(result).toHaveLength(2);
    });

    it('should filter by locationId', async () => {
      requestRepo.find.mockResolvedValue([]);
      await service.getRequests('UK-LON');
      expect(requestRepo.find).toHaveBeenCalledWith({ where: { locationId: 'UK-LON' } });
    });

    it('should filter by status', async () => {
      requestRepo.find.mockResolvedValue([]);
      await service.getRequests(undefined, TimeOffRequestStatus.PENDING);
      expect(requestRepo.find).toHaveBeenCalledWith({ where: { status: TimeOffRequestStatus.PENDING } });
    });

    it('should filter by both locationId and status', async () => {
      requestRepo.find.mockResolvedValue([]);
      await service.getRequests('US-NY', TimeOffRequestStatus.APPROVED);
      expect(requestRepo.find).toHaveBeenCalledWith({ where: { locationId: 'US-NY', status: TimeOffRequestStatus.APPROVED } });
    });

    it('should handle repository errors gracefully in getRequests', async () => {
      requestRepo.find.mockRejectedValue(new Error('Query failed'));
      await expect(service.getRequests()).rejects.toThrow('Query failed');
    });
  });

  describe('Complex State Transitions & Edge Cases', () => {
    it('should throw BadRequestException if approving an already CANCELLED request', async () => {
      queryRunnerManager.findOne.mockResolvedValueOnce({
        id: 'req-1', status: TimeOffRequestStatus.CANCELLED,
      });
      await expect(service.approveRequest('req-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if rejecting an already APPROVED request', async () => {
      queryRunnerManager.findOne.mockResolvedValueOnce({
        id: 'req-1', status: TimeOffRequestStatus.APPROVED,
      });
      await expect(service.rejectRequest('req-1')).rejects.toThrow(BadRequestException);
    });

    it('should return the already CANCELLED request if cancelling it again (idempotent behavior)', async () => {
      // Note: Current implementation just sets status to CANCELLED. Logic check:
      const request = { id: 'req-1', status: TimeOffRequestStatus.CANCELLED, employeeId: 'emp-1', locationId: 'loc-1', daysRequested: 5 };
      queryRunnerManager.findOne.mockResolvedValueOnce(request);
      
      const result = await service.cancelRequest('req-1');
      expect(result.status).toBe(TimeOffRequestStatus.CANCELLED);
      expect(queryRunnerManager.save).toHaveBeenCalled();
    });

    it('should handle very large decimal precision safely in requests', async () => {
      queryRunnerManager.findOne
        .mockResolvedValueOnce({ id: 'req-1', status: TimeOffRequestStatus.PENDING, employeeId: 'emp-1', locationId: 'loc-1', daysRequested: 0.123456 })
        .mockResolvedValueOnce({ balanceDays: 20, reservedDays: 0.123456, employeeId: 'emp-1', locationId: 'loc-1' });

      await service.approveRequest('req-1');
      expect(queryRunnerManager.save).toHaveBeenCalledWith(LeaveBalance, expect.objectContaining({
        balanceDays: 20 - 0.123456,
        reservedDays: 0
      }));
    });

    it('should handle non-PENDING status error during rejection specifically', async () => {
      queryRunnerManager.findOne.mockResolvedValueOnce({ id: 'req-1', status: TimeOffRequestStatus.REJECTED });
      await expect(service.rejectRequest('req-1')).rejects.toThrow('Only PENDING requests can be rejected');
    });

    it('should handle edge case where balance is found but not enough at approval time (though unlikely due to soft-reservation)', async () => {
       // This would mean reservedDays logic was bypassed somehow.
       // Even if balanceDays < daysRequested, the code currently just does the subtraction.
       // We should verify it does the math correctly.
       queryRunnerManager.findOne
        .mockResolvedValueOnce({ id: 'req-1', status: TimeOffRequestStatus.PENDING, employeeId: 'emp-1', locationId: 'loc-1', daysRequested: 10 })
        .mockResolvedValueOnce({ balanceDays: 5, reservedDays: 10, employeeId: 'emp-1', locationId: 'loc-1' });

       await service.approveRequest('req-1');
       expect(queryRunnerManager.save).toHaveBeenCalledWith(LeaveBalance, expect.objectContaining({
         balanceDays: -5,
         reservedDays: 0
       }));
    });
  });
});
