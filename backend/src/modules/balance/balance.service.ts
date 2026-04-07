import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveBalance } from './entities/leave-balance.entity';
import { HcmClientService } from '../hcm-sync/hcm-client.service';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    @InjectRepository(LeaveBalance)
    private readonly balanceRepo: Repository<LeaveBalance>,
    private readonly hcmClient: HcmClientService,
  ) {}

  async getAvailableBalance(employeeId: string, locationId: string): Promise<{ availableDays: number, balanceDays: number, reservedDays: number }> {
    let balanceRecord = await this.balanceRepo.findOne({
      where: { employeeId, locationId },
    });

    if (!balanceRecord) {
      this.logger.log(`Balance not found locally for ${employeeId}, fetching from HCM...`);
      const hcmData = await this.hcmClient.fetchBalance(employeeId, locationId);
      
      balanceRecord = this.balanceRepo.create({
        employeeId,
        locationId,
        balanceDays: hcmData.balanceDays ?? 0,
        reservedDays: 0,
      });
      await this.balanceRepo.save(balanceRecord);
    }

    // Defensive validation logic
    const available = Number(balanceRecord.balanceDays) - Number(balanceRecord.reservedDays);
    
    if (available < 0) {
       this.logger.warn(`Negative available balance calculated for ${employeeId}`);
    }

    return {
      availableDays: available,
      balanceDays: Number(balanceRecord.balanceDays),
      reservedDays: Number(balanceRecord.reservedDays)
    };
  }

  async validateSufficientBalance(employeeId: string, locationId: string, requestedDays: number) {
     const { availableDays } = await this.getAvailableBalance(employeeId, locationId);
     if (availableDays < requestedDays) {
         throw new BadRequestException('Insufficient balance available locally');
     }
     return true;
  }
}
