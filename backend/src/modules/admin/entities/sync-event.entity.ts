import { Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('sync_events')
export class SyncEvent {
  @PrimaryColumn('varchar')
  id: string;

  @CreateDateColumn()
  processedAt: Date;
}
