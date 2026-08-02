export class User {
  id!: number;
  name!: string;
  mobile!: string;
  email!: string;
  active!: number;
  created_at!: string;
  updated_at!: string;

  constructor(init?: Partial<User>) {
    Object.assign(this, init);
  }

}
