
import { User, Room, Notification, KYCStatus, UserRole } from "../types";
import { MOCK_ROOMS } from "../constants";

const USERS_KEY = 'gharpeti_users';
const CURRENT_USER_KEY = 'gharpeti_current_user';
const ROOMS_KEY = 'gharpeti_rooms';
const NOTIFS_KEY = 'gharpeti_notifs';

// Helper to simulate encryption
const encrypt = (data: string) => btoa(data); // Simple base64 for demo
// const decrypt = (data: string) => atob(data);

export const db = {
  getUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveUser: (user: User) => {
    const users = db.getUsers();
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  updateUser: (updatedUser: User) => {
    const users = db.getUsers();
    const index = users.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = updatedUser;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      // Update session if it's the current user
      const currentUser = db.getCurrentUser();
      if (currentUser && currentUser.id === updatedUser.id) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
      }
    }
  },

  submitKYC: (userId: string, idImage: string, selfieImage: string): User | null => {
    const users = db.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      // In a real app, status would be PENDING. 
      // For this demo, we auto-verify to let the user test features, 
      // but we store the files as if they are waiting for manual review.
      const updatedUser: User = {
        ...users[index],
        kycStatus: KYCStatus.VERIFIED, // Changed from PENDING for demo usability
        kycDocuments: {
            idImage,
            selfieImage,
            submittedAt: Date.now()
        }
      };
      users[index] = updatedUser;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      
      const currentUser = db.getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
      }
      return updatedUser;
    }
    return null;
  },

  login: (email: string, password: string): User | null => {
    const users = db.getUsers();
    const hash = encrypt(password);
    const user = users.find(u => u.email === email && u.passwordHash === hash);
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      return user;
    }
    return null;
  },

  logout: () => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
  },

  getRooms: (): Room[] => {
    const data = localStorage.getItem(ROOMS_KEY);
    return data ? JSON.parse(data) : MOCK_ROOMS;
  },

  addRoom: (room: Room) => {
    const rooms = db.getRooms();
    const newRoom = { ...room, isExample: false }; // Ensure users cannot create example rooms
    rooms.unshift(newRoom);
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  },

  getNotifications: (userId: string): Notification[] => {
    const data = localStorage.getItem(NOTIFS_KEY);
    const allNotifs: Notification[] = data ? JSON.parse(data) : [];
    return allNotifs.filter(n => n.userId === userId);
  }
};
