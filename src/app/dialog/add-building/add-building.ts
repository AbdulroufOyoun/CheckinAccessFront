import { Component, inject } from '@angular/core';
import { FormsModule } from "@angular/forms";
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';
import { Apiendpointd } from '../../apiEndpoints';
import { ApiResponse } from '../../interfaces/api-response';
import { SnackbarService } from '../../services/snackbar.service';
import { Building } from '../../model/Building';
import { BuildingService } from '../../services/building.service';
import { Floor } from '../../model/Floor';

@Component({
  selector: 'app-add-building',
  imports: [FormsModule],
  templateUrl: './add-building.html',
  styleUrl: './add-building.css',
})
export class AddBuilding {
  buildingName: string = '';
  buildingNumber: string = '';
  createFloors: boolean = false;
  numberFloor: number = 0;
  numberOfFloor: number = 0;
  isLoading: boolean = false;
  isRTL: boolean = false;
  dialog = inject(MatDialog);

  constructor(private api: ApiService, private snackbar: SnackbarService, public buildingService: BuildingService) {
  }

  async addBuilding() {
    if (!this.buildingName || !this.buildingNumber) {
      return;
    }
    this.isLoading = true;
    try {
      const params = new FormData();
      params.append('name', this.buildingName.trim());
      params.append('number', this.buildingNumber.trim());
      if (this.createFloors && this.numberFloor > 0 && this.numberOfFloor > 0) {
        params.append('numberFloor', this.numberFloor.toString());
        params.append('numberOfFloor', this.numberOfFloor.toString());
      }
      const result = await this.api.post<ApiResponse<any>>(Apiendpointd.addBuildin, params);
      console.log(result)
      if (result.success) {
        if (result.data.floors?.length) {
          const floors = result.data.floors.map((f: any) => new Floor(f));
          this.buildingService.addFloorList(floors);
        }
        const building = new Building(result.data.building);
        this.buildingService.addBuilding(building);
        this.snackbar.show(result.message, 'success');
      }
    } catch (error: any) {
      this.snackbar.show(error.error.message, 'error');
    } finally {
      this.isLoading = false;
    }
  }

  close() {
    this.dialog.closeAll();
  }

}
