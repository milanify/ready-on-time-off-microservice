import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class TimeOffRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @Column()
  daysRequested: number;

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SYNC_FAILED';
}