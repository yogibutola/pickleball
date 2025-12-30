import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from './admin';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {
  adminService = inject(AdminService);
  leagues = this.adminService.leagues;

  triggerSlotting() {
    if (this.adminService.triggerSlotting()) {
      alert('Daily slotting triggered successfully! Groups have been updated.');
    }
  }
}
