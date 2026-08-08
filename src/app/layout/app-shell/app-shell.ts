import { ChangeDetectorRef, Component, DOCUMENT, OnInit, PLATFORM_ID, Inject, Renderer2, inject } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { User } from '../../model/User';
import { ChangePassword } from '../../dialog/change-password/change-password';

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
  | 'roles';

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

@Component({
  selector: 'app-app-shell',
  imports: [RouterOutlet, CommonModule, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShell implements OnInit {
  private readonly dialog = inject(MatDialog);

  sidebarOpen = true;
  userMenuOpen = false;
  isRTL = false;
  currentLang: 'ar' | 'en' = 'en';
  activePage = '';
  user: User | null = null;

  constructor(
    public router: Router,
    private translate: TranslateService,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {
    this.currentLang = this.getLang();
    this.translate.setFallbackLang('en');
    this.translate.use(this.currentLang);
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
            visible: this.auth.hasModule('property'),
          },
          {
            labelKey: 'ROOM_STATUS_NAV',
            route: '/RoomStatus',
            icon: 'room-status',
            visible: this.auth.hasModule('property'),
          },
          {
            labelKey: 'HOL_NAV',
            route: '/Holidays',
            icon: 'holidays',
            visible: this.auth.hasModule('property'),
          },
          {
            labelKey: 'PROP_NAV',
            route: '/Property',
            icon: 'facilities',
            visible: this.auth.hasModule('property'),
          },
          {
            labelKey: 'REPORTS',
            route: '/Reports',
            icon: 'reports',
            visible: this.auth.hasModule('property'),
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
    });

    this.user = this.auth.getUser();

    if (isPlatformBrowser(this.platformId)) {
      void this.auth.ensureMe().then((user) => {
        this.user = user;
        this.cdr.markForCheck();
      }).catch(() => {
        // Keep cached session user if /me fails briefly.
      });
    }
  }

  getLang(): 'ar' | 'en' {
    if (typeof window === 'undefined') return 'en';
    return (localStorage.getItem('lang') as 'ar' | 'en') || 'en';
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
    this.currentLang = this.currentLang === 'en' ? 'ar' : 'en';
    localStorage.setItem('lang', this.currentLang);
    this.translate.use(this.currentLang);
    this.applyLang();
  }

  closeDropdowns(): void {
    this.userMenuOpen = false;
  }

  toggleUserMenu(): void {
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
    this.auth.logout();
  }
}
