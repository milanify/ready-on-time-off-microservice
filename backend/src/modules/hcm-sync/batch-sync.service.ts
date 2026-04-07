import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReconciliationService } from '../admin/reconciliation.service';
import { SyncSource } from '../admin/entities/sync-log.entity';
import { SyncEvent } from '../admin/entities/sync-event.entity';

@Injectable()
export class BatchSyncService {
  private readonly logger = new Logger(BatchSyncService.name);

  constructor(
    private readonly reconciliationService: ReconciliationService,
    @InjectRepository(SyncEvent)
    private readonly syncEventRepo: Repository<SyncEvent>
  ) {}

  async applyIdempotentUpdate(syncEventId: string, payload: Array<{employeeId: string, locationId: string, balanceDays: number}>) {
    const existing = await this.syncEventRepo.findOne({ where: { id: syncEventId } });
    if (existing) {
       this.logger.log(`Skipping duplicate batch push event (Persistent): ${syncEventId}`);
       return { skipped: true, reason: 'Duplicate syncEventId' };
    }

    this.logger.log(`Processing batch push event: ${syncEventId} with ${(payload || []).length} records`);
    
    let reconciledCount = 0;
    const records = Array.isArray(payload) ? payload : [];
    
    for (const record of records) {
      try {
        const result = await this.reconciliationService.detectDrift(
           record.employeeId, 
           record.locationId, 
           SyncSource.HCM_BATCH, 
           record.balanceDays
        );
        if (result.reconciled) reconciledCount++;
      } catch (e: any) {
        this.logger.error(`Failed to process batch record for ${record.employeeId}: ${e.message}`);
      }
    }

    await this.syncEventRepo.save({ id: syncEventId });
    return { success: true, total: records.length, reconciled: reconciledCount };
  }
  
  async handleWebhook(payload: any) {
    if ((payload.eventType === 'ANNIVERSARY_CREDIT' || payload.eventType === 'MANUAL_ADJUSTMENT') && payload.employeeId) {
       await this.reconciliationService.detectDrift(
          payload.employeeId,
          payload.locationId,
          SyncSource.HCM_WEBHOOK,
          payload.balanceDays || 0
       );
    }
    return { success: true };
  }
}
