import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { TimeOffModule } from './modules/timeoff/timeoff.module';
import { BalanceModule } from './modules/balance/balance.module';
import { HcmSyncModule } from './modules/hcm-sync/hcm-sync.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    DatabaseModule,
    TimeOffModule,
    BalanceModule,
    HcmSyncModule,
    AdminModule,
  ],
})
export class AppModule {}