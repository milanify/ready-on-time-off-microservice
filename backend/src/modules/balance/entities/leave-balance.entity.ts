import { Entity, PrimaryGeneratedColumn, Column, VersionColumn, Unique, Index } from 'typeorm';

@Entity('leave_balances')
@Unique(['employeeId', 'locationId'])
export class LeaveBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('varchar')
  employeeId: string;

  @Index()
  @Column('varchar')
  locationId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balanceDays: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  reservedDays: number;

  @VersionColumn()
  version: number;
}
