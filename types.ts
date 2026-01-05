export interface Voter {
  id: string;
  fullName: string;
  phoneNumber: string;
  createdAt: number;
}

export interface LocationPoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  district: string;
  count: number;
  createdAt: number;
  voters?: Voter[];
}