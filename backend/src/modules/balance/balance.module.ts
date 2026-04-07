import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalance } from './entities/leave-balance.entity';
import { BalanceService } from './balance.service';
import { HcmSyncModule } from '../hcm-sync/hcm-sync.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveBalance]),
    HcmSyncModule,
  ],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
