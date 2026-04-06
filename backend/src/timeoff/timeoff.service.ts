import { Injectable } from '@nestjs/common';

@Injectable()
export class TimeOffService {
  // For now, just placeholder methods
  getBalance(employeeId: string) {
    return 10; // mock balance
  }

  requestTimeOff(employeeId: string, locationId: string, days: number) {
    // placeholder
    return { success: true };
  }
}