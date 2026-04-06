import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffModule } from './timeoff/timeoff.module';
import { TimeOffRequest } from './timeoff/timeoff.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'data/db.sqlite',
      entities: [TimeOffRequest],
      synchronize: true, // dev only
    }),
    TimeOffModule,
  ],
})
export class AppModule {}