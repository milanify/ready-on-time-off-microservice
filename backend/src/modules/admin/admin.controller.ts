import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { SyncSource } from './entities/sync-log.entity';

@Controller('admin')
export class AdminController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Post('reconcile')
  @HttpCode(200)
  async reconcile(@Body() body: { employeeId: string; locationId: string }) {
    if (!body.employeeId || !body.locationId) {
      // In a real system, diff everything, but for scope we require specific ID
      return { message: 'employeeId and locationId are required for manual reconciliation' };
    }
    const result = await this.reconciliationService.detectDrift(body.employeeId, body.locationId, SyncSource.ADMIN_RECONCILE);
    return result;
  }
}
