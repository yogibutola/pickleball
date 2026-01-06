import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  currentUser = this.authService.currentUser;

  constructor() {
    // Redirect if not logged in
    effect(() => {
      if (!this.authService.currentUser()) {
        this.router.navigate(['/login']);
      }
    });
  }
}
