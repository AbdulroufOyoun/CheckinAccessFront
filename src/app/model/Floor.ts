export class Floor {
  id!: number;
  building_id!: number;
  number!: number;
  created_at!: string;

  constructor(init?: Partial<Floor>) {
    Object.assign(this, init);
  }

}
