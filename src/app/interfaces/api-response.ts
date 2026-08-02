import { Building } from "../model/Building";
import { Floor } from "../model/Floor";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  code: number;
  data: T;
}

export interface LoginResponse {
  sms: string;
}

export interface AddBuildingResponse {
  building: Building;
  floors?: Floor[]
}
