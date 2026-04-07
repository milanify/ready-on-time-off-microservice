import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { HcmService } from './hcm.service';

@Controller('mock-hcm')
export class HcmController {
  constructor(private readonly hcmService: HcmService) {}

  @Get('balances/:employeeId/:locationId')
  getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.hcmService.getBalance(employeeId, locationId);
  }

  @Post('balances/deduct')
  deductBalance(@Body() body: { employeeId: string; locationId: string; amount: number }) {
    return this.hcmService.deductBalance(body.employeeId, body.locationId, body.amount);
  }

  @Post('trigger/batch')
  triggerBatch() {
    return this.hcmService.triggerBatch();
  }

  @Post('trigger/anniversary/:employeeId')
  triggerAnniversary(@Param('employeeId') employeeId: string) {
    return this.hcmService.triggerAnniversary(employeeId);
  }

  @Post('trigger/year-reset')
  triggerYearReset() {
    return this.hcmService.triggerYearReset();
  }
}
