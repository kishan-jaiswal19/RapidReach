import { Timestamp } from 'firebase/firestore';

export type Language = 'en' | 'hi';

export interface FamilyMember {
  name: string;
  relation: string;
  status: 'safe' | 'alerting' | 'offline';
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: 'user' | 'responder' | 'admin';
  bloodType?: string;
  allergies?: string;
  medications?: string;
  conditions?: string;
  emergencyContact?: string;
  status: 'safe' | 'alerting';
  language?: Language;
  familyMembers?: FamilyMember[];
  lastLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
  };
}

export interface Incident {
  id?: string;
  type: string;
  description: string;
  severity: 'critical' | 'moderate' | 'low';
  status: 'reported' | 'dispatched' | 'resolved';
  reporterUid: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  createdAt: Timestamp;
  responderUid?: string;
}

export type Screen = 'splash' | 'home' | 'report' | 'track' | 'community' | 'profile';
