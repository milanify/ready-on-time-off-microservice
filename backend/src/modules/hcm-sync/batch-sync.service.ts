import { Injectable, Logger } from '@nestjs/common';
import { ReconciliationService } from '../admin/reconciliation.service';
import { SyncSource } from '../admin/entities/sync-log.entity';

@Injectable()
export class BatchSyncService {
  private readonly logger = new Logger(BatchSyncService.name);
  
  // Basic setup for idempotency
  private processedSyncEvents = new Set<string>();

  constructor(private readonly reconciliationService: ReconciliationService) {}

  async applyIdempotentUpdate(syncEventId: string, payload: Array<{employeeId: string, locationId: string, balanceDays: number}>) {
    if (this.processedSyncEvents.has(syncEventId)) {
       this.logger.log(`Skipping duplicate batch push event: ${syncEventId}`);
       return { skipped: true, reason: 'Duplicate syncEventId' };
    }

    this.logger.log(`Processing batch push event: ${syncEventId} with ${payload.length} records`);
    
    let reconciledCount = 0;

    for (const record of payload) {
      const result = await this.reconciliationService.detectDrift(
         record.employeeId, 
         record.locationId, 
         SyncSource.HCM_BATCH, 
         record.balanceDays
      );
      if (result.reconciled) reconciledCount++;
    }

    this.processedSyncEvents.add(syncEventId);
    return { success: true, total: payload.length, reconciled: reconciledCount };
  }
  
  async handleWebhook(payload: any) {
    if (payload.eventType === 'ANNIVERSARY_CREDIT' || payload.eventType === 'MANUAL_ADJUSTMENT') {
       await this.reconciliationService.detectDrift(
          payload.employeeId,
          payload.locationId,
          SyncSource.HCM_WEBHOOK,
          payload.balanceDays
       );
    }
    return { success: true };
  }
}
