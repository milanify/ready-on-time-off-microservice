import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum SyncSource {
  HCM_BATCH = 'HCM_BATCH',
  HCM_WEBHOOK = 'HCM_WEBHOOK',
  HCM_REALTIME = 'HCM_REALTIME',
  LOCAL_REQUEST = 'LOCAL_REQUEST',
  ADMIN_RECONCILE = 'ADMIN_RECONCILE',
}

@Entity('sync_logs')
export class SyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  employeeId: string;

  @Column({ type: 'varchar', enum: SyncSource })
  source: SyncSource;

  @Column('varchar')
  action: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  delta: number;

  @CreateDateColumn()
  createdAt: Date;
}
