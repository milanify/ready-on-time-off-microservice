import { Test, TestingModule } from '@nestjs/testing';
import { BalanceService } from './balance.service';
import { HcmClientService } from '../hcm-sync/hcm-client.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeaveBalance } from './entities/leave-balance.entity';
import { BadRequestException } from '@nestjs/common';

describe('BalanceService', () => {
  let service: BalanceService;
  let balanceRepo: any;
  let hcmClient: any;

  beforeEach(async () => {
    balanceRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    hcmClient = {
      fetchBalance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        { provide: getRepositoryToken(LeaveBalance), useValue: balanceRepo },
        { provide: HcmClientService, useValue: hcmClient },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
  });

  describe('getAvailableBalance', () => {
    it('should calculate available balance correctly when locally present', async () => {
      balanceRepo.findOne.mockResolvedValue({
        balanceDays: 10,
        reservedDays: 3,
      });

      const result = await service.getAvailableBalance('emp-1', 'loc-1');
      expect(result.availableDays).toEqual(7); // 10 - 3
      expect(result.balanceDays).toEqual(10);
      expect(result.reservedDays).toEqual(3);
      expect(hcmClient.fetchBalance).not.toHaveBeenCalled();
    });

    it('should calculate correctly even with decimal strings returned from DB', async () => {
      // TypeORM can return decimals as strings
      balanceRepo.findOne.mockResolvedValue({
        balanceDays: '15.5',
        reservedDays: '2.5',
      });

      const result = await service.getAvailableBalance('emp-1', 'loc-1');
      expect(result.availableDays).toEqual(13); 
    });

    it('should fetch from HCM if not found locally', async () => {
      balanceRepo.findOne.mockResolvedValue(null);
      hcmClient.fetchBalance.mockResolvedValue({ balanceDays: 20 });
      balanceRepo.create.mockReturnValue({
        balanceDays: 20,
        reservedDays: 0,
      });

      const result = await service.getAvailableBalance('new-emp', 'loc-1');
      expect(hcmClient.fetchBalance).toHaveBeenCalledWith('new-emp', 'loc-1');
      expect(balanceRepo.create).toHaveBeenCalled();
      expect(balanceRepo.save).toHaveBeenCalled();
      expect(result.availableDays).toEqual(20);
    });
  });

  describe('validateSufficientBalance', () => {
    it('should pass if available >= requested', async () => {
      balanceRepo.findOne.mockResolvedValue({ balanceDays: 5, reservedDays: 1 }); // 4 available
      await expect(service.validateSufficientBalance('emp', 'loc', 3)).resolves.toBe(true);
    });

    it('should pass if available exactly equals requested', async () => {
      balanceRepo.findOne.mockResolvedValue({ balanceDays: 5, reservedDays: 1 }); // 4 available
      await expect(service.validateSufficientBalance('emp', 'loc', 4)).resolves.toBe(true);
    });

    it('should throw BadRequestException if available < requested', async () => {
      balanceRepo.findOne.mockResolvedValue({ balanceDays: 5, reservedDays: 3 }); // 2 available
      await expect(
        service.validateSufficientBalance('emp', 'loc', 3)
      ).rejects.toThrow(BadRequestException);
    });
  });
});
