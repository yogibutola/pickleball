import { Component, signal, inject, effect, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { AuthService } from './auth/auth';
import { ThemeService } from './theme.service';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  protected readonly title = signal('Pickleball League');
  currentUser = this.authService.currentUser;
  currentTheme = this.themeService.theme;

  constructor() {
    // Apply theme to document root
    effect(() => {
      if (isPlatformBrowser(this.platformId)) {
        document.documentElement.setAttribute('data-theme', this.currentTheme());
      }
    });
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
