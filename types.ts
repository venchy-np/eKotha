
export enum UserRole {
  SEEKER = 'SEEKER',
  LANDLORD = 'LANDLORD', 
  ADMIN = 'ADMIN', // New Role
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
  isPhoneVerified?: boolean;
  facebookLink?: string;
  kycDocuments?: {
    officialName: string;
    address: string;
    phone: string;
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
  contactDetails?: {
    phone?: string;
    facebookLink?: string;
  };
}

export interface Chat {
  id: string;
  participants: string[];
  participantDetails: {
    [userId: string]: {
      username: string;
      avatar?: string;
      isOnline?: boolean;
      lastSeen?: number;
    }
  };
  roomId?: string;
  roomTitle?: string;
  updatedAt: number;
  lastMessage?: string;
  unreadCount: {
    [userId: string]: number;
  };
  pinnedBy?: string[];
  typing?: {
    [userId: string]: boolean;
  };
}

export type MessageType = 'text' | 'image' | 'voice' | 'room_share' | 'attachment';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: number;
  readBy: string[];
  type?: MessageType;
  mediaUrl?: string;
  replyTo?: string; // messageId
  reactions?: {
    [userId: string]: string; // emoji
  };
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
