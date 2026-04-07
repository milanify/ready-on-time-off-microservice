import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HcmClientService } from './hcm-client.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TimeOffRequest } from '../timeoff/entities/timeoff-request.entity';
import { SyncOutboxCron } from './sync-outbox.cron';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([TimeOffRequest]),
    ScheduleModule.forRoot()
  ],
  providers: [HcmClientService, SyncOutboxCron],
  exports: [HcmClientService],
})
export class HcmSyncModule {}
