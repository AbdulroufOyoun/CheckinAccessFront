export type TenantModuleName = 'property' | 'education';

export class User {
  id!: number;
  name!: string;
  mobile!: string;
  email!: string;
  active!: number | boolean;
  created_at?: string;
  updated_at?: string;
  roles: string[] = [];
  permissions: string[] = [];
  modules: TenantModuleName[] = [];

  constructor(init?: Partial<User>) {
    Object.assign(this, init);
    this.roles = Array.isArray(init?.roles) ? [...init!.roles!] : [];
    this.permissions = Array.isArray(init?.permissions) ? [...init!.permissions!] : [];
    this.modules = Array.isArray(init?.modules) ? ([...init!.modules!] as TenantModuleName[]) : [];
  }

  hasModule(module: TenantModuleName): boolean {
    return this.modules.includes(module);
  }

  can(permission: string): boolean {
    if (this.roles.includes('Super Admin')) {
      return true;
    }
    return this.permissions.includes(permission);
  }

  canAny(permissions: string[]): boolean {
    return permissions.some((permission) => this.can(permission));
  }

  get initials(): string {
    const parts = (this.name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
}
