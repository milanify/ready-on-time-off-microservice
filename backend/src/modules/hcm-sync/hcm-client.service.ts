import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HcmClientService {
  private readonly logger = new Logger(HcmClientService.name);
  private readonly baseUrl = 'http://localhost:3001/mock-hcm';

  constructor(private readonly httpService: HttpService) {}

  async fetchBalance(employeeId: string, locationId: string) {
    this.logger.log(`Fetching balance from HCM for ${employeeId} at ${locationId}`);
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/balances/${employeeId}/${locationId}`)
      );
      return response.data;
    } catch (e: any) {
      this.logger.error(`Failed to fetch from HCM: ${e.message}`);
      throw e;
    }
  }
}
