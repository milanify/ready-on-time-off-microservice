import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { BatchSyncService } from './batch-sync.service';

@Controller('hcm')
export class HcmWebhookController {
  constructor(private readonly batchSyncService: BatchSyncService) {}

  @Post('batch-sync')
  @HttpCode(200)
  async handleBatchSync(@Body() body: { syncEventId: string; data: any[] }) {
    if (!body.syncEventId || !body.data) return { error: 'Invalid payload' };
    return this.batchSyncService.applyIdempotentUpdate(body.syncEventId, body.data);
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() payload: any) {
    return this.batchSyncService.handleWebhook(payload);
  }
}
