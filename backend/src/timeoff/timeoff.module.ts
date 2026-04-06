import { Module } from '@nestjs/common';
import { TimeOffService } from './timeoff.service';
import { TimeOffController } from './timeoff.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequest } from './timeoff.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TimeOffRequest])],
  controllers: [TimeOffController],
  providers: [TimeOffService],
})
export class TimeOffModule {}