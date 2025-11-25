
export enum UserRole {
  SEEKER = 'SEEKER',
  LANDLORD = 'LANDLORD', // Can verify KYC to list
}

export enum KYCStatus {
  NOT_STARTED = 'NOT_STARTED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string; // Simulated encrypted
  role: UserRole;
  kycStatus: KYCStatus;
  bio?: string;
  avatar?: string;
  phone?: string;
  kycDocuments?: {
    idImage: string;
    selfieImage: string;
    submittedAt: number;
  };
}

export interface Room {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  price: number;
  location: string;
  lat: number;
  lng: number;
  features: string[]; // wifi, kitchen, balcony
  images: string[];
  isAvailable: boolean;
  isExample?: boolean;
  paymentInfo?: {
    esewaId?: string;
    khaltiId?: string;
  };
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: number;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  type: 'BOOKING' | 'SYSTEM' | 'MESSAGE';
  timestamp: number;
}

export type Language = 'en' | 'np';

export interface AppState {
  currentUser: User | null;
  language: Language;
  theme: 'light' | 'dark';
  isOnboarded: boolean;
}
