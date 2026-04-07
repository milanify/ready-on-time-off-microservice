import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

export enum TimeOffRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum HcmSyncStatus {
  SYNCED = 'SYNCED',
  PENDING_SYNC = 'PENDING_SYNC',
  FAILED = 'FAILED',
}

@Entity('time_off_requests')
export class TimeOffRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('varchar')
  employeeId: string;

  @Column('varchar')
  locationId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  daysRequested: number;

  @Index()
  @Column({ type: 'varchar', enum: TimeOffRequestStatus, default: TimeOffRequestStatus.PENDING })
  status: TimeOffRequestStatus;

  @Column({ type: 'varchar', enum: HcmSyncStatus, default: HcmSyncStatus.PENDING_SYNC })
  hcmSyncStatus: HcmSyncStatus;

  @CreateDateColumn()
  createdAt: Date;
}
