import {
  ChangeDetectorRef,
  Component,
  DOCUMENT,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Renderer2,
  ViewChild,
  inject,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { LocaleService } from '../../services/locale.service';
import { User } from '../../model/User';
import { ChangePassword } from '../../dialog/change-password/change-password';
import { TenantUser, UsersService } from '../../services/users.service';
import { RealtimeService } from '../../services/realtime.service';
import {
  NAV_SEARCH_PAGE_META,
  classifyNavQuery,
  isNavIntentQuery,
  pageMatchesNavQuery,
  type NavSearchPage,
} from './nav-search';

type NavIcon =
  | 'dashboard'
  | 'reservations'
  | 'room-status'
  | 'holidays'
  | 'facilities'
  | 'reports'
  | 'subjects'
  | 'sections'
  | 'schedule'
  | 'enrollments'
  | 'edu-reports'
  | 'users'
  | 'admins'
  | 'roles'
  | 'locks';

interface NavItem {
  labelKey: string;
  route: string;
  visible: boolean;
  icon: NavIcon;
}

interface NavSection {
  id: string;
  labelKey: string;
  items: NavItem[];
}

interface NavSearchHit {
  kind: 'page' | 'user' | 'action';
  key: string;
  label: string;
  hint?: string;
  initials?: string;
  route: (string | number)[];
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'app-app-shell',
  imports: [RouterOutlet, CommonModule, FormsModule, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShell implements OnInit, OnDestroy {
  private readonly dialog = inject(MatDialog);
  private readonly usersApi = inject(UsersService);
  private readonly realtime = inject(RealtimeService);
  private readonly locale = inject(LocaleService);

  @ViewChild('navSearchInput') navSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('navSearchResults') navSearchResults?: ElementRef<HTMLElement>;

  sidebarOpen = true;
  userMenuOpen = false;
  isRTL = false;
  currentLang: 'ar' | 'en' = 'en';
  activePage = '';
  user: User | null = null;

  searchQuery = '';
  searchOpen = false;
  searchLoading = false;
  searchActiveIndex = 0;
  pageHits: NavSearchHit[] = [];
  userHits: NavSearchHit[] = [];
  actionHits: NavSearchHit[] = [];

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchGen = 0;

  constructor(
    public router: Router,
    private translate: TranslateService,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {
    this.currentLang = this.locale.lang();
    this.applyLang();
  }

  get navSections(): NavSection[] {
    const sections: NavSection[] = [
      {
        id: 'overview',
        labelKey: 'NAV_SECTION_OVERVIEW',
        items: [
          { labelKey: 'DASHBOARD', route: '/Dashboard', icon: 'dashboard', visible: true },
        ],
      },
      {
        id: 'property',
        labelKey: 'NAV_SECTION_PROPERTY',
        items: [
          {
            labelKey: 'RESERVATIONS',
            route: '/Reservations',
            icon: 'reservations',
            visible: this.canProperty('manage bookings'),
          },
          {
            labelKey: 'ROOM_STATUS_NAV',
            route: '/RoomStatus',
            icon: 'room-status',
            visible: this.canProperty('manage bookings', 'view buildings', 'manage buildings'),
          },
          {
            labelKey: 'HOL_NAV',
            route: '/Holidays',
            icon: 'holidays',
            visible: this.canProperty('manage bookings'),
          },
          {
            labelKey: 'PROP_NAV',
            route: '/Property',
            icon: 'facilities',
            visible: this.canProperty(
              'manage buildings',
              'view buildings',
              'manage rooms',
              'view rooms',
              'manage compounds',
              'view compounds',
            ),
          },
          {
            labelKey: 'LOCKS_NAV',
            route: '/Locks',
            icon: 'locks',
            visible: this.canProperty('manage locks'),
          },
          {
            labelKey: 'REPORTS',
            route: '/Reports',
            icon: 'reports',
            visible: this.canProperty('view reports'),
          },
        ],
      },
      {
        id: 'education',
        labelKey: 'NAV_SECTION_EDUCATION',
        items: [
          {
            labelKey: 'EDU_SUBJECTS',
            route: '/Education/Subjects',
            icon: 'subjects',
            visible: this.auth.hasModule('education') && this.auth.can('manage education'),
          },
          {
            labelKey: 'EDU_SECTIONS',
            route: '/Education/Sections',
            icon: 'sections',
            visible: this.auth.hasModule('education') && this.auth.can('manage education'),
          },
          {
            labelKey: 'EDU_SCHEDULE',
            route: '/Education/Schedule',
            icon: 'schedule',
            visible: this.auth.hasModule('education') && this.auth.can('manage education'),
          },
          {
            labelKey: 'EDU_ENROLLMENTS',
            route: '/Education/Enrollments',
            icon: 'enrollments',
            visible: this.auth.hasModule('education') && this.auth.can('manage enrollments'),
          },
          {
            labelKey: 'EDU_TERMS',
            route: '/Education/Terms',
            icon: 'schedule',
            visible: this.auth.hasModule('education') && this.auth.can('manage education'),
          },
          {
            labelKey: 'EDU_ENROLLMENT_HISTORY',
            route: '/Education/EnrollmentHistory',
            icon: 'edu-reports',
            visible: this.auth.hasModule('education') && this.auth.can('manage enrollments'),
          },
          {
            labelKey: 'EDU_COMPOUND_ACCESS',
            route: '/Education/CompoundAccess',
            icon: 'locks',
            visible: this.auth.hasModule('education') && this.auth.can('manage education'),
          },
          {
            labelKey: 'EDU_REPORTS',
            route: '/Education/Reports',
            icon: 'edu-reports',
            visible: this.auth.hasModule('education') && this.auth.can('view education reports'),
          },
        ],
      },
      {
        id: 'admin',
        labelKey: 'NAV_SECTION_ADMIN',
        items: [
          {
            labelKey: 'USERS',
            route: '/Users',
            icon: 'users',
            visible: this.auth.can('manage users'),
          },
          {
            labelKey: 'ADMINS',
            route: '/Admins',
            icon: 'admins',
            visible: this.auth.can('manage admins'),
          },
          {
            labelKey: 'ROLES_PERMISSIONS',
            route: '/Roles',
            icon: 'roles',
            visible: this.auth.can('manage roles'),
          },
        ],
      },
    ];

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.visible),
      }))
      .filter((section) => section.items.length > 0);
  }

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.activePage = this.translate.instant('DASHBOARD');
      this.document.title = `${this.activePage} - CheckinAccess`;
      if (this.searchQuery.trim()) {
        this.refreshPageHits(this.searchQuery);
      }
    });

    this.user = this.auth.getUser();

    if (isPlatformBrowser(this.platformId)) {
      void this.auth.ensureMe().then((user) => {
        this.user = user;
        this.connectRealtime(user);
        this.cdr.detectChanges();
      }).catch(() => {
        // Keep cached session user if /me fails briefly.
        this.connectRealtime(this.user);
      });
    }
  }

  private connectRealtime(user: User | null): void {
    const tenantId = user?.tenant_id != null ? String(user.tenant_id) : '';
    if (tenantId) {
      this.realtime.connect(tenantId);
      return;
    }
    void this.auth.refreshMe(true).then((fresh) => {
      this.user = fresh;
      if (fresh.tenant_id != null) {
        this.realtime.connect(String(fresh.tenant_id));
      }
      this.cdr.detectChanges();
    }).catch(() => undefined);
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.realtime.disconnect();
  }

  get searchHits(): NavSearchHit[] {
    return [...this.actionHits, ...this.pageHits, ...this.userHits];
  }

  get searchHasQuery(): boolean {
    return this.searchQuery.trim().length > 0;
  }

  onSearchFocus(): void {
    this.userMenuOpen = false;
    if (this.searchHasQuery) {
      this.searchOpen = true;
    }
  }

  onSearchQueryChange(): void {
    this.userMenuOpen = false;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const q = this.searchQuery.trim();
    if (!q) {
      this.searchGen += 1;
      this.searchOpen = false;
      this.searchLoading = false;
      this.pageHits = [];
      this.userHits = [];
      this.actionHits = [];
      this.searchActiveIndex = 0;
      return;
    }
    this.searchOpen = true;
    this.refreshPageHits(q);
    this.searchTimer = setTimeout(() => void this.searchUsers(q), 280);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const hits = this.searchHits;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSearch(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!hits.length) return;
      this.searchOpen = true;
      this.searchActiveIndex = (this.searchActiveIndex + 1) % hits.length;
      this.scrollActiveSearchHitIntoView();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!hits.length) return;
      this.searchOpen = true;
      this.searchActiveIndex = (this.searchActiveIndex - 1 + hits.length) % hits.length;
      this.scrollActiveSearchHitIntoView();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const hit = hits[this.searchActiveIndex] ?? hits[0];
      if (hit) this.goToHit(hit);
    }
  }

  isSearchHitActive(hit: NavSearchHit): boolean {
    return this.searchHits[this.searchActiveIndex]?.key === hit.key;
  }

  private scrollActiveSearchHitIntoView(): void {
    this.cdr.detectChanges();
    const active = this.navSearchResults?.nativeElement.querySelector(
      '.navbar__search-item--active',
    );
    active?.scrollIntoView({ block: 'nearest' });
  }

  goToHit(hit: NavSearchHit): void {
    this.closeSearch(true);
    this.searchQuery = '';
    this.pageHits = [];
    this.userHits = [];
    this.actionHits = [];
    void this.router.navigate(hit.route, hit.queryParams ? { queryParams: hit.queryParams } : undefined);
  }

  closeSearch(blur = false): void {
    this.searchOpen = false;
    this.searchLoading = false;
    if (blur) {
      this.navSearchInput?.nativeElement.blur();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.navbar__search')) {
      this.closeSearch();
    }
    if (!target?.closest('.navbar__user-wrapper')) {
      this.userMenuOpen = false;
    }
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === 'TEXTAREA') return;
    event.preventDefault();
    this.navSearchInput?.nativeElement.focus();
    this.navSearchInput?.nativeElement.select();
  }

  private refreshPageHits(raw: string): void {
    const pages: NavSearchPage[] = this.navSections.flatMap((section) =>
      section.items.map((item) => ({
        route: item.route,
        label: this.translate.instant(item.labelKey),
        hint: this.translate.instant(section.labelKey),
        meta: NAV_SEARCH_PAGE_META[item.route] ?? { aliases: [], capabilities: [] },
      })),
    );
    pages.push({
      route: '/Settings',
      label: this.translate.instant('SETTINGS'),
      hint: this.translate.instant('NAV_SECTION_ADMIN'),
      meta: NAV_SEARCH_PAGE_META['/Settings'],
    });

    const matched = pages.filter((page) => pageMatchesNavQuery(page, raw));
    this.pageHits = matched.map((page) => ({
      kind: 'page' as const,
      key: `page:${page.route}`,
      label: page.label,
      hint: page.hint,
      route: [page.route],
    }));

    this.actionHits = [];
    const intent = classifyNavQuery(raw);
    if (intent.add) {
      for (const page of matched) {
        const addRoute = page.meta.addRoute;
        if (!page.meta.capabilities.includes('add') || !addRoute || addRoute === page.route) {
          continue;
        }
        this.actionHits.push({
          kind: 'action',
          key: `action:add:${page.route}`,
          label: this.translate.instant('NAV_SEARCH_ADD_ON', { page: page.label }),
          hint: page.label,
          route: [addRoute],
        });
      }
    } else if (raw.trim().length >= 2 && !matched.length && !intent.edit) {
      if (this.auth.can('manage users')) {
        this.actionHits.push({
          kind: 'action',
          key: `action:users:${raw.trim().toLowerCase()}`,
          label: this.translate.instant('NAV_SEARCH_USERS_FOR', { q: raw.trim() }),
          hint: this.translate.instant('USERS'),
          route: ['/Users'],
          queryParams: { q: raw.trim() },
        });
      }
      if (this.canProperty('manage bookings')) {
        this.actionHits.push({
          kind: 'action',
          key: `action:bookings:${raw.trim().toLowerCase()}`,
          label: this.translate.instant('NAV_SEARCH_BOOKINGS_FOR', { q: raw.trim() }),
          hint: this.translate.instant('RESERVATIONS'),
          route: ['/Reservations'],
          queryParams: { q: raw.trim() },
        });
      }
    }
    this.clampActiveIndex();
  }

  private async searchUsers(raw: string): Promise<void> {
    const q = raw.trim();
    if (q.length < 2 || !this.auth.can('manage users') || isNavIntentQuery(q) || this.pageHits.length) {
      this.searchGen += 1;
      this.userHits = [];
      this.searchLoading = false;
      this.clampActiveIndex();
      this.cdr.detectChanges();
      return;
    }

    const gen = ++this.searchGen;
    this.searchLoading = true;
    this.cdr.detectChanges();
    try {
      const page = await this.usersApi.searchByName(q, 8);
      if (gen !== this.searchGen) return;
      const rows = Array.isArray(page.data) ? page.data : [];
      this.userHits = rows.slice(0, 6).map((user) => this.toUserHit(user));
    } catch {
      if (gen !== this.searchGen) return;
      this.userHits = [];
    } finally {
      if (gen === this.searchGen) {
        this.searchLoading = false;
        this.clampActiveIndex();
        this.cdr.detectChanges();
      }
    }
  }

  private toUserHit(user: TenantUser): NavSearchHit {
    return {
      kind: 'user',
      key: `user:${user.id}`,
      label: user.name || `#${user.id}`,
      hint: user.email || user.mobile || '',
      initials: this.initials(user.name),
      route: ['/Users', user.id],
    };
  }

  private initials(name: string): string {
    const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  private clampActiveIndex(): void {
    const total = this.searchHits.length;
    if (!total) {
      this.searchActiveIndex = 0;
      return;
    }
    if (this.searchActiveIndex >= total) {
      this.searchActiveIndex = 0;
    }
  }

  private canProperty(...permissions: string[]): boolean {
    return this.auth.hasModule('property') && this.auth.canAny(...permissions);
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  applyLang(): void {
    const html = this.document.documentElement;
    if (this.currentLang === 'ar') {
      this.renderer.setAttribute(html, 'dir', 'rtl');
      this.renderer.setAttribute(html, 'lang', 'ar');
      this.isRTL = true;
    } else {
      this.renderer.setAttribute(html, 'dir', 'ltr');
      this.renderer.setAttribute(html, 'lang', 'en');
      this.isRTL = false;
    }
  }

  setLang(): void {
    void this.locale.toggle().then(() => {
      this.currentLang = this.locale.lang();
      this.applyLang();
      this.refreshPageHits(this.searchQuery);
      this.cdr.detectChanges();
    });
  }

  closeDropdowns(): void {
    this.userMenuOpen = false;
    this.closeSearch();
  }

  toggleUserMenu(): void {
    this.closeSearch();
    this.userMenuOpen = !this.userMenuOpen;
  }

  currentPage(pageName: string): void {
    this.activePage = this.translate.instant(pageName);
    this.document.title = `${this.activePage} - CheckinAccess`;
  }

  openChangePassword(): void {
    this.closeDropdowns();
    this.dialog.open(ChangePassword, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '480px',
      maxWidth: '94vw',
      maxHeight: '90vh',
      autoFocus: false,
      data: { mode: 'self' },
    });
  }

  logOut(): void {
    this.realtime.disconnect();
    this.auth.logout();
  }
}
