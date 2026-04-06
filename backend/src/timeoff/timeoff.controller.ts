import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { TimeOffService } from './timeoff.service';

@Controller('timeoff')
export class TimeOffController {
  constructor(private readonly timeOffService: TimeOffService) {}

  @Get('balance/:employeeId')
  getBalance(@Param('employeeId') employeeId: string) {
    return this.timeOffService.getBalance(employeeId);
  }

  @Post('request')
  requestTimeOff(@Body() body: { employeeId: string; locationId: string; days: number }) {
    return this.timeOffService.requestTimeOff(body.employeeId, body.locationId, body.days);
  }
}