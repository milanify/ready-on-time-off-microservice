import { Injectable, Logger } from '@nestjs/common';
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
      const hcmData = await this.hcmClient.fetchBalance(employeeId, locationId);
      hcmBalanceDays = hcmData.balanceDays;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const localRecord = await queryRunner.manager.findOne(LeaveBalance, {
        where: { employeeId, locationId }
      });

      if (!localRecord) {
        const newRecord = queryRunner.manager.create(LeaveBalance, {
          employeeId, locationId, balanceDays: hcmBalanceDays, reservedDays: 0
        });
        await queryRunner.manager.save(LeaveBalance, newRecord);

        const log = queryRunner.manager.create(SyncLog, {
           employeeId, source, action: 'CREATE_FROM_DRIFT', delta: hcmBalanceDays
        });
        await queryRunner.manager.save(SyncLog, log);
        
        await queryRunner.commitTransaction();
        return { reconciled: true, delta: hcmBalanceDays };
      }

      const diff = Number(hcmBalanceDays) - Number(localRecord.balanceDays);

      if (diff !== 0) {
        this.logger.warn(`Drift detected for ${employeeId}: Local=${localRecord.balanceDays}, HCM=${hcmBalanceDays}`);
        
        localRecord.balanceDays = hcmBalanceDays as number;
        await queryRunner.manager.save(LeaveBalance, localRecord);

        const log = queryRunner.manager.create(SyncLog, {
           employeeId, source, action: 'UPDATE_FROM_DRIFT', delta: diff
        });
        await queryRunner.manager.save(SyncLog, log);

        await queryRunner.commitTransaction();
        return { reconciled: true, delta: diff };
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
}
