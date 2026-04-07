import { Entity, Column, ManyToOne, JoinColumn, Index, PrimaryColumn } from 'typeorm';
import { Location } from './location.entity';

@Entity('employees')
export class Employee {
  @PrimaryColumn('varchar')
  id: string;

  @Index()
  @Column()
  locationId: string;

  @ManyToOne(() => Location)
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column()
  name: string;
}
