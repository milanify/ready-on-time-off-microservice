import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('locations')
export class Location {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column()
  timezone: string;
}
