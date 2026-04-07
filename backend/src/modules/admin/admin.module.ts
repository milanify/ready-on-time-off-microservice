import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalance } from '../balance/entities/leave-balance.entity';
import { SyncLog } from './entities/sync-log.entity';
import { AdminController } from './admin.controller';
import { ReconciliationService } from './reconciliation.service';
import { HcmSyncModule } from '../hcm-sync/hcm-sync.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveBalance, SyncLog]),
    HcmSyncModule,
  ],
  controllers: [AdminController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class AdminModule {}
