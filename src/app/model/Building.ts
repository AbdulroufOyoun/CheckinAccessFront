export class Building {
  id!: number;
  name!: string;
  number!: number;
  active!: string;   // 1 active | 0 Inactive
  created_at!: string;

  constructor(init?: Partial<Building>) {
    Object.assign(this, init);
  }

}
