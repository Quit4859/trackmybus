export enum UserRole {
  STUDENT = 'STUDENT',
  PARENT = 'PARENT',
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER'
}

export interface UserCredentials {
  email: string;
  password?: string;
}

export interface Driver extends UserCredentials {
  id: string;
  name: string;
  phone: string;
}

export interface Student extends UserCredentials {
  id: string;
  name: string;
  assignedRouteId: string;
  branch: string;
  mobileNumber: string;
  registerNumber: string;
}

export interface Bus {
  id: string;
  numberPlate: string;
  driverId: string; // Linked to Driver.id
}

export interface BusStop {
  id: string;
  name: string;
  time: string;
  status: 'passed' | 'upcoming' | 'current';
  lat: number;
  lng: number;
}

export interface BusRoute {
  id: string;
  name: string;
  driver: string; 
  driverPhone: string;
  numberPlate: string;
  eta: string; 
  stops: BusStop[];
  path?: [number, number][]; 
  liveLat?: number; // Public-facing (student/parent)
  liveLng?: number; // Public-facing (student/parent)
  actualLat?: number; // Hidden (admin only)
  actualLng?: number; // Hidden (admin only)
  isLive?: boolean; // Tracking status
  busId?: string;
  heading?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export type ViewState = 'TRACKING' | 'CHAT' | 'ADMIN' | 'PROFILE' | 'DRIVER' | 'SCAN';