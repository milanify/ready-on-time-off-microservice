import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LeaveBalance } from '../balance/entities/leave-balance.entity';
import { SyncLog, SyncSource } from './entities/sync-log.entity';
import { HcmClientService } from '../hcm-sync/hcm-client.service';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @InjectRepository(LeaveBalance)
    private readonly balanceRepo: Repository<LeaveBalance>,
    @InjectRepository(SyncLog)
    private readonly syncLogRepo: Repository<SyncLog>,
    private readonly dataSource: DataSource,
    private readonly hcmClient: HcmClientService,
  ) {}

  async detectDrift(employeeId: string, locationId: string, source: SyncSource, providedHcmBalance?: number) {
    let hcmBalanceDays = providedHcmBalance;
    
    if (hcmBalanceDays === undefined) {
      // Pull manually
      try {
        const hcmData = await this.hcmClient.fetchBalance(employeeId, locationId);
        hcmBalanceDays = hcmData.balanceDays;
      } catch (e: any) {
        this.logger.error(`Network failure hitting Mock HCM for drift detection: ${e.message}`);
        throw new HttpException(
          `Unable to connect to Mock HCM to verify truth balance for ${employeeId}. Is it running?`, 
          HttpStatus.BAD_GATEWAY
        );
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const localRecord = await queryRunner.manager.findOne(LeaveBalance, {
        where: { employeeId, locationId }
      });

        const previousBalance = localRecord ? Number(localRecord.balanceDays) : 0;
        const diff = Number(hcmBalanceDays) - previousBalance;

        if (diff !== 0 || !localRecord) {
          const action = localRecord ? 'UPDATE_FROM_DRIFT' : 'CREATE_FROM_DRIFT';
          this.logger.warn(`Drift detected for ${employeeId}: Local=${previousBalance}, HCM=${hcmBalanceDays}`);
          
          if (localRecord) {
            localRecord.balanceDays = hcmBalanceDays as number;
            await queryRunner.manager.save(LeaveBalance, localRecord);
          } else {
            const newRecord = queryRunner.manager.create(LeaveBalance, {
              employeeId, locationId, balanceDays: hcmBalanceDays, reservedDays: 0
            });
            await queryRunner.manager.save(LeaveBalance, newRecord);
          }

          // Health Check: balance - reserved should be >= 0
          const updatedRecord = await queryRunner.manager.findOne(LeaveBalance, { where: { employeeId, locationId } });
          const isCritical = updatedRecord && (Number(updatedRecord.balanceDays) - Number(updatedRecord.reservedDays) < 0);

          const log = queryRunner.manager.create(SyncLog, {
             employeeId, 
             source, 
             action: isCritical ? 'CRITICAL_DRIFT_DETECTED' : action, 
             delta: diff,
             previousBalance,
             newBalance: hcmBalanceDays
          });
          await queryRunner.manager.save(SyncLog, log);

          await queryRunner.commitTransaction();
          return { reconciled: true, delta: diff, critical: isCritical };
        }

        await queryRunner.commitTransaction();
        return { reconciled: false, delta: 0 };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async getComparison(employeeId: string, locationId: string) {
    const local = await this.balanceRepo.findOne({ where: { employeeId, locationId } });
    let hcmBalance = null;
    try {
      const hcmData = await this.hcmClient.fetchBalance(employeeId, locationId);
      hcmBalance = hcmData.balanceDays;
    } catch (e: any) {
      this.logger.error(`Failed to fetch Comparison from HCM: ${e.message}`);
    }

    return {
      employeeId,
      locationId,
      localBalance: local ? Number(local.balanceDays) : 0,
      localReserved: local ? Number(local.reservedDays) : 0,
      hcmBalance,
      drift: hcmBalance !== null ? hcmBalance - (local ? Number(local.balanceDays) : 0) : null
    };
  }
}
