export type Tab = 'home' | 'incidents' | 'routes' | 'profile' | 'system';

export interface Incident {
  id: string;
  type: string;
  status: 'ACTIVATED' | 'CANCELLED' | 'RESOLVED';
  timestamp: string;
  location: {
    lat: number;
    lng: number;
  };
  duration?: string;
  priority?: 'CRITICAL' | 'NORMAL';
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  pronouns?: string;
  verified: boolean;
  photoURL?: string;
  status?: 'ACTIVE' | 'OFFLINE' | 'SOS_ACTIVE';
}

export interface SyncedContact {
  id?: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  isEmergency?: boolean;
}

export interface SafePoint {
  id: string;
  name: string;
  type: 'hospital' | 'police' | 'shelter' | 'fire_station' | 'pharmacy' | 'bunker';
  lat: number;
  lng: number;
  address?: string;
  distance?: number; // In km (calculated on sync)
  subCategory?: 'Government' | 'Private' | 'General';
  phone?: string;
  website?: string;
}

export interface RouteInfo {
  distance: number; // km
  duration: number; // minutes
  coordinates: [number, number][];
  trafficAware?: boolean;
}
