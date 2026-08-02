import { Component } from '@angular/core';
import { SmartAlerts } from "./smart-alerts/smart-alerts";
import { ActivityPanel } from "./activity-panel/activity-panel";
import { QuickActions } from "./quick-actions/quick-actions";
import { OccupancyChart } from "./occupancy-chart/occupancy-chart";
import { RoomGrid } from "./room-grid/room-grid";
import { KpiCards } from "./kpi-cards/kpi-cards";
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-dashboard',
  imports: [SmartAlerts, ActivityPanel, QuickActions, OccupancyChart, RoomGrid, KpiCards, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})

export class Dashboard {
  dropdownOpen = false;
  filtersOpen = false;
  hasFilters = false;
  selectedFilters = {
    building: '',
    floor: '',
    suite: '',
    status: ''
  };

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  toggleFilters() {
    this.hasFilters = !this.hasFilters;
    this.filtersOpen = !this.filtersOpen;
  }

  resetFilters() {
    this.selectedFilters = {
      building: '',
      floor: '',
      suite: '',
      status: ''
    };
  }
}
