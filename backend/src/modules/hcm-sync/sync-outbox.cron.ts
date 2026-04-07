import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffRequest, HcmSyncStatus, TimeOffRequestStatus } from '../timeoff/entities/timeoff-request.entity';
import { HcmClientService } from './hcm-client.service';

@Injectable()
export class SyncOutboxCron {
  private readonly logger = new Logger(SyncOutboxCron.name);

  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly requestRepo: Repository<TimeOffRequest>,
    private readonly hcmClient: HcmClientService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    this.logger.debug('Running Outbox sync cron for PENDING_SYNC requests...');
    const pendingRequests = await this.requestRepo.find({
      where: { hcmSyncStatus: HcmSyncStatus.PENDING_SYNC },
      take: 50,
    });

    if (pendingRequests.length === 0) return;

    for (const request of pendingRequests) {
      try {
        if (request.status === TimeOffRequestStatus.APPROVED) {
           await this.hcmClient.deductBalance(request.employeeId, request.locationId, Number(request.daysRequested));
        } else if (request.status === TimeOffRequestStatus.CANCELLED) {
           // Pass negative amount to simulate credit
           await this.hcmClient.deductBalance(request.employeeId, request.locationId, -Number(request.daysRequested));
        }
        
        request.hcmSyncStatus = HcmSyncStatus.SYNCED;
        await this.requestRepo.save(request);
        this.logger.log(`Successfully synced request ${request.id} to HCM`);
      } catch (e) {
        this.logger.error(`Failed to sync request ${request.id} to HCM - will retry next tick.`);
      }
    }
  }
}
