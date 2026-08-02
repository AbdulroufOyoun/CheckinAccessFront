import { Injectable } from '@angular/core';
import { Building } from '../model/Building';
import { Floor } from '../model/Floor';

@Injectable({
  providedIn: 'root'
})
export class BuildingService {

  buildings: Building[] = [];
  floors: Floor[] = []
  /*------------ Buildin -------------*/
  addBuilding(building: Building) {
    this.buildings.push(building);
  }

  setBuildings(buildings: Building[]) {
    this.buildings = buildings;
  }

  getBuildings() {
    return this.buildings;
  }

  /*------------ Floor --------------*/
  addFloorList(floors: Floor[]) {
    this.floors.push(...floors);
  }

  setFloor(floors: Floor[]) {
    this.floors = floors;
  }

  getFloor() {
    return this.floors;
  }

}
