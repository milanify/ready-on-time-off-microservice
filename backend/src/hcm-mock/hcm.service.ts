import { Injectable, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';

export interface HcmBalance {
  locationId: string;
  balanceDays: number;
  version: number;
}

@Injectable()
export class HcmService {
  private readonly logger = new Logger(HcmService.name);
  
  // In-memory store
  private balances = new Map<string, HcmBalance>();
  
  private simulateFailure() {
    const errorRate = parseFloat(process.env.HCM_ERROR_RATE || '0.1'); // 10% default
    if (Math.random() < errorRate) {
      this.logger.warn('Mock HCM randomly failing to simulate unreliable network');
      throw new InternalServerErrorException('HCM System Unavailable');
    }
  }

  // Seeding initial test data
  constructor() {
    this.balances.set('emp-123', { locationId: 'US-NY', balanceDays: 20, version: 1 });
    this.balances.set('emp-456', { locationId: 'UK-LON', balanceDays: 25, version: 1 });
  }

  getBalance(employeeId: string, locationId: string): HcmBalance {
    this.simulateFailure();
    let record = this.balances.get(employeeId);
    if (!record) {
      // Default creation if missing to allow easy testing
      record = { locationId, balanceDays: 0, version: 1 };
      this.balances.set(employeeId, record);
    }
    return record;
  }

  deductBalance(employeeId: string, locationId: string, amount: number): HcmBalance {
    this.simulateFailure();
    const record = this.getBalance(employeeId, locationId); // relies on the default creation above

    if (record.balanceDays < amount) {
      this.logger.error(`Insufficient balance in HCM for ${employeeId}. Current: ${record.balanceDays}, Requested: ${amount}`);
      throw new BadRequestException('Insufficient balance in HCM');
    }

    record.balanceDays = Number(record.balanceDays) - Number(amount);
    record.version += 1;
    this.balances.set(employeeId, record);
    
    return record;
  }

  async triggerBatch() {
    this.logger.log('Triggering Batch push to ReadyOn...');
    const payload = Array.from(this.balances.entries()).map(([employeeId, data]) => ({
      employeeId,
      locationId: data.locationId,
      balanceDays: data.balanceDays,
      version: data.version
    }));

    try {
      await fetch('http://localhost:8080/hcm/batch-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncEventId: `evt_${Date.now()}`, data: payload })
      });
      return { success: true, count: payload.length };
    } catch (e: any) {
      this.logger.error(`Failed to push to ReadyOn Batch webhook: ${e.message}`);
      throw new InternalServerErrorException('ReadyOn unreachable');
    }
  }

  async triggerAnniversary(employeeId: string) {
    const record = this.balances.get(employeeId);
    if (!record) throw new BadRequestException('Employee not found in store');
    
    // Increment balance
    record.balanceDays += 10;
    record.version += 1;
    this.balances.set(employeeId, record);

    this.logger.log(`Anniversary triggered for ${employeeId}. New balance: ${record.balanceDays}`);

    try {
      await fetch('http://localhost:8080/hcm/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          locationId: record.locationId,
          balanceDays: record.balanceDays,
          version: record.version,
          eventType: 'ANNIVERSARY_CREDIT'
        })
      });
      return { success: true, employeeId, balanceDays: record.balanceDays };
    } catch (e: any) {
      this.logger.error(`Failed to push to ReadyOn Webhook: ${e.message}`);
      return { success: false, error: 'Push failed but balance updated internally' };
    }
  }

  async triggerYearReset() {
    for (const [employeeId, record] of this.balances.entries()) {
      record.balanceDays = 20; // reset
      record.version += 1;
      this.balances.set(employeeId, record);
    }
    
    this.logger.log('Yearly reset applied to all employees. Triggering batch sync.');
    return this.triggerBatch();
  }
}