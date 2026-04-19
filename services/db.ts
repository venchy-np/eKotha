import { User, Room, Notification, KYCStatus, UserRole } from "../types";
import { db as firestore, auth, googleProvider, facebookProvider, storage } from "../firebase";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, onSnapshot, addDoc, orderBy, writeBatch, arrayUnion, arrayRemove, deleteDoc, increment } from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export const db = {
  uploadFile: async (file: File | Blob, path: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      // For images, we can compress them using canvas to keep them well under Firestore's 1MB limit
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            // Compress heavily to ensure it fits in 1MB Firestore limit
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            resolve(dataUrl);
          };
          img.onerror = () => reject(new Error("Image processing failed"));
        };
        reader.onerror = () => reject(new Error("Failed to read image file"));
        return;
      }

      // For voice notes or small attachments (< 700KB)
      if (file.size > 700 * 1024) {
        reject(new Error(`File is too large. Max size is 700KB. This file is ${(file.size / 1024).toFixed(0)}KB.`));
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  },

  loginWithGoogle: async (): Promise<User | null> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      
      const userRef = doc(firestore, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      
      const isAdminEmail = firebaseUser.email === 'sajandahal794@gmail.com';
      
      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        if (isAdminEmail && userData.role !== UserRole.ADMIN) {
          await updateDoc(userRef, { role: UserRole.ADMIN });
          return { ...userData, role: UserRole.ADMIN };
        }
        return userData;
      } else {
        const newUser: any = {
          id: firebaseUser.uid,
          username: firebaseUser.displayName || 'User',
          email: firebaseUser.email || '',
          passwordHash: '',
          role: isAdminEmail ? UserRole.ADMIN : UserRole.SEEKER,
          kycStatus: KYCStatus.NOT_STARTED,
        };
        if (firebaseUser.photoURL) newUser.avatar = firebaseUser.photoURL;
        
        await setDoc(userRef, newUser as User);
        return newUser as User;
      }
    } catch (error: any) {
      console.error("Login error", error);
      throw error;
    }
  },

  loginWithFacebook: async (): Promise<User | null> => {
    try {
      const result = await signInWithPopup(auth, facebookProvider);
      const firebaseUser = result.user;
      
      const userRef = doc(firestore, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      
      const isAdminEmail = firebaseUser.email === 'sajandahal794@gmail.com';
      
      // Get Facebook profile link if available
      const facebookProfile = firebaseUser.providerData.find(p => p.providerId === 'facebook.com')?.uid;
      const facebookLink = facebookProfile ? `https://facebook.com/${facebookProfile}` : undefined;
      
      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        const updates: any = {};
        if (isAdminEmail && userData.role !== UserRole.ADMIN) {
          updates.role = UserRole.ADMIN;
        }
        if (facebookLink && !userData.facebookLink) {
          updates.facebookLink = facebookLink;
        }
        if (Object.keys(updates).length > 0) {
          await updateDoc(userRef, updates);
          return { ...userData, ...updates };
        }
        return userData;
      } else {
        const newUser: any = {
          id: firebaseUser.uid,
          username: firebaseUser.displayName || 'User',
          email: firebaseUser.email || '',
          passwordHash: '',
          role: isAdminEmail ? UserRole.ADMIN : UserRole.SEEKER,
          kycStatus: KYCStatus.NOT_STARTED,
        };
        if (firebaseUser.photoURL) newUser.avatar = firebaseUser.photoURL;
        if (facebookLink) newUser.facebookLink = facebookLink;
        
        await setDoc(userRef, newUser as User);
        return newUser as User;
      }
    } catch (error: any) {
      console.error("Facebook Login error", error);
      throw error;
    }
  },

  logout: async () => {
    await signOut(auth);
  },

  submitKYC: async (userId: string, kycData: { officialName: string, address: string, phone: string, idImage: string, selfieImage: string }): Promise<User | null> => {
    try {
      const userRef = doc(firestore, 'users', userId);
      await updateDoc(userRef, {
        kycStatus: KYCStatus.PENDING,
        phone: kycData.phone,
        isPhoneVerified: true, // Assuming verification happened in UI
        kycDocuments: {
          ...kycData,
          submittedAt: Date.now()
        }
      });
      const snap = await getDoc(userRef);
      return snap.data() as User;
    } catch (error) {
      console.error("KYC submit error", error);
      return null;
    }
  },

  verifyUserKYC: async (userId: string, status: KYCStatus.VERIFIED | KYCStatus.REJECTED, reason?: string): Promise<void> => {
    try {
      const userRef = doc(firestore, 'users', userId);
      await updateDoc(userRef, { kycStatus: status });
      
      const notifRef = doc(collection(firestore, 'notifications'));
      const newNotif: Notification = {
        id: notifRef.id,
        userId: userId,
        type: 'SYSTEM',
        message: status === KYCStatus.VERIFIED 
          ? "Your KYC has been VERIFIED! You can now list rooms." 
          : `Your KYC was REJECTED. ${reason ? `Reason: ${reason}` : 'Please try again with clearer photos.'}`,
        read: false,
        timestamp: Date.now()
      };
      await setDoc(notifRef, newNotif);
    } catch (error) {
      console.error("Verify KYC error", error);
    }
  },

  addRoom: async (room: Room) => {
    try {
      const roomRef = doc(collection(firestore, 'rooms'));
      const newRoom = { ...room, id: roomRef.id, isExample: false };
      await setDoc(roomRef, newRoom);
      return newRoom;
    } catch (error) {
      console.error("Add room error", error);
      throw error;
    }
  },

  createOrGetChat: async (currentUserId: string, otherUserId: string, roomId?: string, roomTitle?: string) => {
    try {
      // Check if chat already exists
      const chatsRef = collection(firestore, 'chats');
      const q = query(chatsRef, where('participants', 'array-contains', currentUserId));
      const querySnapshot = await getDocs(q);
      
      let existingChat = null;
      querySnapshot.forEach((doc) => {
        const chat = doc.data();
        if (chat.participants.includes(otherUserId) && chat.roomId === roomId) {
          existingChat = { ...chat, id: doc.id };
        }
      });

      if (existingChat) return existingChat;

      // Create new chat
      const currentUserSnap = await getDoc(doc(firestore, 'users', currentUserId));
      const otherUserSnap = await getDoc(doc(firestore, 'users', otherUserId));
      
      const currentUser = currentUserSnap.data();
      const otherUser = otherUserSnap.data();

      const newChatRef = doc(collection(firestore, 'chats'));
      const newChat = {
        id: newChatRef.id,
        participants: [currentUserId, otherUserId],
        participantDetails: {
          [currentUserId]: { username: currentUser?.username || 'User', avatar: currentUser?.avatar },
          [otherUserId]: { username: otherUser?.username || 'User', avatar: otherUser?.avatar }
        },
        roomId: roomId || null,
        roomTitle: roomTitle || null,
        updatedAt: Date.now(),
        lastMessage: '',
        unreadCount: {
          [currentUserId]: 0,
          [otherUserId]: 0
        }
      };

      await setDoc(newChatRef, newChat);
      return newChat;
    } catch (error) {
      console.error("Create chat error", error);
      throw error;
    }
  },

  sendMessage: async (chatId: string, senderId: string, receiverId: string, text: string, type: 'text' | 'image' | 'voice' | 'room_share' | 'attachment' = 'text', mediaUrl?: string, replyTo?: string) => {
    try {
      const chatRef = doc(firestore, 'chats', chatId);
      const messagesRef = collection(chatRef, 'messages');
      const newMessageRef = doc(messagesRef);
      
      const newMessage: any = {
        id: newMessageRef.id,
        chatId,
        senderId,
        text,
        timestamp: Date.now(),
        readBy: [senderId],
        type
      };

      if (mediaUrl) newMessage.mediaUrl = mediaUrl;
      if (replyTo) newMessage.replyTo = replyTo;

      await setDoc(newMessageRef, newMessage);

      let lastMsgText = text;
      if (type === 'image') lastMsgText = '📷 Image';
      if (type === 'voice') lastMsgText = '🎤 Voice message';
      if (type === 'room_share') lastMsgText = '🏠 Shared a room';
      if (type === 'attachment') lastMsgText = '📎 Attachment';

      await updateDoc(chatRef, {
        lastMessage: lastMsgText,
        updatedAt: Date.now(),
        [`unreadCount.${receiverId}`]: increment(1)
      });

      // Send notification to receiver
      const notifRef = doc(collection(firestore, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        userId: receiverId,
        type: 'MESSAGE',
        message: `New message: ${text ? text.substring(0, 20) : lastMsgText}...`,
        read: false,
        timestamp: Date.now()
      });

      return newMessage;
    } catch (error) {
      console.error("Send message error", error);
      throw error;
    }
  },

  setTypingStatus: async (chatId: string, userId: string, isTyping: boolean) => {
    try {
      const chatRef = doc(firestore, 'chats', chatId);
      await updateDoc(chatRef, {
        [`typing.${userId}`]: isTyping
      });
    } catch (error) {
      console.error("Set typing status error", error);
    }
  },

  markMessagesAsRead: async (chatId: string, userId: string, messageIds: string[]) => {
    try {
      const batch = writeBatch(firestore);
      messageIds.forEach(msgId => {
        const msgRef = doc(firestore, 'chats', chatId, 'messages', msgId);
        batch.update(msgRef, {
          readBy: arrayUnion(userId)
        });
      });
      await batch.commit();
    } catch (error) {
      console.error("Mark messages read error", error);
    }
  },

  addReaction: async (chatId: string, messageId: string, userId: string, emoji: string) => {
    try {
      const msgRef = doc(firestore, 'chats', chatId, 'messages', messageId);
      await updateDoc(msgRef, {
        [`reactions.${userId}`]: emoji
      });
    } catch (error) {
      console.error("Add reaction error", error);
    }
  },

  updateOnlineStatus: async (userId: string, isOnline: boolean) => {
    try {
      const userRef = doc(firestore, 'users', userId);
      await updateDoc(userRef, { isOnline, lastSeen: Date.now() });
      
      // Also update all active chats where this user is a participant
      const chatsRef = collection(firestore, 'chats');
      const q = query(chatsRef, where('participants', 'array-contains', userId));
      const querySnapshot = await getDocs(q);
      
      const batch = writeBatch(firestore);
      querySnapshot.forEach((chatDoc) => {
        batch.update(chatDoc.ref, {
          [`participantDetails.${userId}.isOnline`]: isOnline,
          [`participantDetails.${userId}.lastSeen`]: Date.now()
        });
      });
      await batch.commit();
    } catch (error) {
      console.error("Update online status error", error);
    }
  },

  pinChat: async (chatId: string, userId: string, isPinned: boolean) => {
    try {
      const chatRef = doc(firestore, 'chats', chatId);
      if (isPinned) {
        await updateDoc(chatRef, {
          pinnedBy: arrayUnion(userId)
        });
      } else {
        await updateDoc(chatRef, {
          pinnedBy: arrayRemove(userId)
        });
      }
    } catch (error) {
      console.error("Pin chat error", error);
    }
  },

  markChatAsRead: async (chatId: string, userId: string) => {
    try {
      const chatRef = doc(firestore, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const chatData = chatSnap.data();
        const unreadCount = chatData.unreadCount || {};
        unreadCount[userId] = 0;
        await updateDoc(chatRef, { unreadCount });
      }
    } catch (error) {
      console.error("Mark chat read error", error);
    }
  },

  updateRoom: async (roomId: string, updates: Partial<Room>) => {
    try {
      const roomRef = doc(firestore, 'rooms', roomId);
      await updateDoc(roomRef, updates);
    } catch (error) {
      console.error("Update room error", error);
      throw error;
    }
  },

  deleteRoom: async (roomId: string) => {
    try {
      const roomRef = doc(firestore, 'rooms', roomId);
      await deleteDoc(roomRef);
    } catch (error) {
      console.error("Delete room error", error);
      throw error;
    }
  }
};
