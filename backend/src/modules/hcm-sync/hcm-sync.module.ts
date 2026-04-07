import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { HcmClientService } from './hcm-client.service';
import { TimeOffRequest } from '../timeoff/entities/timeoff-request.entity';
import { SyncOutboxCron } from './sync-outbox.cron';
import { BatchSyncService } from './batch-sync.service';
import { HcmWebhookController } from './hcm-webhook.controller';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([TimeOffRequest]),
    ScheduleModule.forRoot(),
    forwardRef(() => AdminModule)
  ],
  controllers: [HcmWebhookController],
  providers: [HcmClientService, SyncOutboxCron, BatchSyncService],
  exports: [HcmClientService, BatchSyncService],
})
export class HcmSyncModule {}
