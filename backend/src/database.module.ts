import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './modules/timeoff/entities/employee.entity';
import { Location } from './modules/timeoff/entities/location.entity';
import { TimeOffRequest } from './modules/timeoff/entities/timeoff-request.entity';
import { LeaveBalance } from './modules/balance/entities/leave-balance.entity';
import { SyncLog } from './modules/admin/entities/sync-log.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'data/db.sqlite',
      entities: [Employee, Location, TimeOffRequest, LeaveBalance, SyncLog],
      synchronize: true, // Only for dev. DO NOT USE IN PROD.
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
