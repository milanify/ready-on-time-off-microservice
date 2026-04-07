import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { TimeOffService } from './timeoff.service';
import { TimeOffRequestStatus } from './entities/timeoff-request.entity';

@Controller('requests')
export class TimeOffController {
  constructor(private readonly timeoffService: TimeOffService) {}

  @Post()
  async submitRequest(@Body() body: { employeeId: string; locationId: string; daysRequested: number }) {
    return this.timeoffService.submitRequest(body.employeeId, body.locationId, body.daysRequested);
  }

  @Get()
  async getRequests(
    @Query('locationId') locationId?: string,
    @Query('status') status?: TimeOffRequestStatus,
  ) {
    return this.timeoffService.getRequests(locationId, status);
  }

  @Get(':id')
  async getRequest(@Param('id') id: string) {
    const list = await this.timeoffService.getRequests();
    return list.find(r => r.id === id);
  }

  @Post(':id/approve')
  async approveRequest(@Param('id') id: string) {
    return this.timeoffService.approveRequest(id);
  }

  @Post(':id/reject')
  async rejectRequest(@Param('id') id: string) {
    return this.timeoffService.rejectRequest(id);
  }

  @Delete(':id')
  async cancelRequest(@Param('id') id: string) {
    return this.timeoffService.cancelRequest(id);
  }
}
