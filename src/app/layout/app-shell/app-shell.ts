import { ChangeDetectorRef, Component, DOCUMENT } from '@angular/core';
import { Router, RouterOutlet } from "@angular/router";
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Renderer2, Inject } from '@angular/core';

@Component({
  selector: 'app-app-shell',
  imports: [RouterOutlet, CommonModule, RouterLink,
    RouterLinkActive, TranslateModule],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShell {
  sidebarOpen = true;
  notifOpen = false
  userMenuOpen = false
  isRTL = false
  currentLang: 'ar' | 'en' = 'en';
  activePage: string = '';
  isLoading = true;

  constructor(public router: Router, private translate: TranslateService, private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document, private cdr: ChangeDetectorRef) {
    this.currentLang = this.getLang();
    this.translate.setFallbackLang('en');
    this.translate.use(this.currentLang);
    this.applyLang();
  }

  ngOnInit() {
    this.translate.onLangChange.subscribe(() => {
      this.activePage = this.translate.instant('DASHBOARD');
    });
    setTimeout(() => {
      this.isLoading = false;
      console.log('Finsh ' + this.isLoading)
      this.cdr.detectChanges();
    }, 1100);
  }

  getLang(): 'ar' | 'en' {
    if (typeof window === 'undefined') return 'en';
    return (localStorage.getItem('lang') as 'ar' | 'en') || 'en';
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    console.log(this.sidebarOpen);
  }

  applyLang() {
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

  setLang() {
    this.currentLang = this.currentLang === 'en' ? 'ar' : 'en';
    localStorage.setItem('lang', this.currentLang);
    this.translate.use(this.currentLang);
    this.applyLang();
  }

  toggleNotif() {
    this.notifOpen = !this.notifOpen;
    this.userMenuOpen = false;
  }

  closeDropdowns() {
    this.userMenuOpen = false;
    this.notifOpen = false;
  }

  toggleUserMenu() {
    this.userMenuOpen = !this.userMenuOpen;
    this.notifOpen = false;
  }

  currentPage(pageName: string) {
    this.activePage = this.translate.instant(pageName);
    this.isLoading = true;

    setTimeout(() => {
      this.isLoading = false;
      console.log('Finsh ' + this.isLoading)
      this.cdr.detectChanges();
    }, 1100);
  }

  logOut() {
    console.log("GO TO LOGIN")
    this.router.navigate(['/Login']);
  }
}
