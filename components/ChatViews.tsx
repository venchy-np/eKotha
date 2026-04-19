import React, { useState, useEffect, useRef } from 'react';
import { User, Chat, Message, Room } from '../types';
import { db as firestore } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/db';
import { ChevronLeft, Send, User as UserIcon, MessageCircle, Phone, Info, Paperclip, Camera, Mic, Check, CheckCheck, MoreVertical, Image as ImageIcon, Search, X, Home, Plus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const InboxView = ({ currentUser, onSelectChat }: { currentUser: User, onSelectChat: (chat: Chat) => void }) => {
    const [chats, setChats] = useState<Chat[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'messages' | 'notifications'>('messages');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!currentUser) return;
        const qChats = query(
            collection(firestore, 'chats'),
            where('participants', 'array-contains', currentUser.id)
        );
        
        const unsubscribeChats = onSnapshot(qChats, (snapshot) => {
            const chatsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
            setChats(chatsData);
        });

        const qNotifs = query(
            collection(firestore, 'notifications'),
            where('userId', '==', currentUser.id)
        );
        
        const unsubscribeNotifs = onSnapshot(qNotifs, (snapshot) => {
            const notifsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNotifications(notifsData.sort((a: any, b: any) => b.timestamp - a.timestamp));
        });

        return () => {
            unsubscribeChats();
            unsubscribeNotifs();
        };
    }, [currentUser]);

    const filteredChats = chats
        .filter(chat => {
            const otherUserId = chat.participants.find(id => id !== currentUser.id) || currentUser.id;
            const otherUser = chat.participantDetails[otherUserId];
            const matchesSearch = otherUser?.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                chat.roomTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                chat.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        })
        .sort((a, b) => {
            const aPinned = a.pinnedBy?.includes(currentUser.id);
            const bPinned = b.pinnedBy?.includes(currentUser.id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return b.updatedAt - a.updatedAt;
        });

    return (
        <div className="p-6 pb-24 max-w-2xl mx-auto h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-4xl font-bold dark:text-white tracking-tight">Inbox</h2>
                <div className="flex gap-2">
                </div>
            </div>
            
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text"
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-brandPrimary transition-all dark:text-white"
                />
            </div>

            <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700 pb-2">
                <button 
                    onClick={() => setActiveTab('messages')}
                    className={`font-bold text-lg transition-colors relative ${activeTab === 'messages' ? 'text-brandPrimary' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    Messages
                    {activeTab === 'messages' && <motion.div layoutId="tab" className="absolute -bottom-[10px] left-0 right-0 h-0.5 bg-brandPrimary" />}
                </button>
                <button 
                    onClick={() => setActiveTab('notifications')}
                    className={`font-bold text-lg transition-colors relative ${activeTab === 'notifications' ? 'text-brandPrimary' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    Notifications
                    {notifications.filter(n => !n.read).length > 0 && (
                        <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full align-top">
                            {notifications.filter(n => !n.read).length}
                        </span>
                    )}
                    {activeTab === 'notifications' && <motion.div layoutId="tab" className="absolute -bottom-[10px] left-0 right-0 h-0.5 bg-brandPrimary" />}
                </button>
            </div>

            {activeTab === 'messages' ? (
                filteredChats.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <MessageCircle size={48} className="mb-4 opacity-50" />
                        <p className="font-bold">No messages yet</p>
                        <p className="text-sm">When you contact an owner, messages will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-1 overflow-y-auto no-scrollbar">
                        {filteredChats.map(chat => {
                            const otherUserId = chat.participants.find(id => id !== currentUser.id) || currentUser.id;
                            const otherUser = chat.participantDetails[otherUserId];
                            const unreadCount = chat.unreadCount?.[currentUser.id] || 0;
                            const isPinned = chat.pinnedBy?.includes(currentUser.id);
                            const isOnline = otherUser?.isOnline;

                            return (
                                <motion.div 
                                    key={chat.id} 
                                    layout
                                    className="relative overflow-hidden rounded-2xl"
                                >
                                    <div className="absolute inset-0 flex items-center justify-between px-6 bg-brandPrimary/10">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                db.pinChat(chat.id, currentUser.id, !isPinned);
                                            }}
                                            className="flex flex-col items-center gap-1 text-brandPrimary"
                                        >
                                            <MoreVertical size={20} className={isPinned ? 'rotate-45' : ''} />
                                            <span className="text-[10px] font-bold">{isPinned ? 'Unpin' : 'Pin'}</span>
                                        </button>
                                    </div>

                                    <motion.div 
                                        drag="x"
                                        dragConstraints={{ left: 0, right: 80 }}
                                        dragElastic={0.1}
                                        onDragEnd={(_, info) => {
                                            if (info.offset.x > 50) {
                                                db.pinChat(chat.id, currentUser.id, !isPinned);
                                            }
                                        }}
                                        onClick={() => onSelectChat(chat)}
                                        className="relative bg-white dark:bg-slate-900 p-3 flex items-center gap-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-all group z-10"
                                    >
                                        <div className="relative flex-shrink-0">
                                            <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border border-gray-100 dark:border-gray-800">
                                                {otherUser?.avatar ? (
                                                    <img src={otherUser.avatar} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                                        <UserIcon size={28} />
                                                    </div>
                                                )}
                                            </div>
                                            {isOnline && (
                                                <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 border-b border-gray-100 dark:border-gray-800 pb-3 group-last:border-none">
                                            <div className="flex justify-between items-baseline mb-0.5">
                                                <h4 className="font-bold text-[17px] dark:text-white truncate">{otherUser?.username || 'User'}</h4>
                                                <span className={`text-xs font-medium ${unreadCount > 0 ? 'text-brandPrimary' : 'text-gray-500'}`}>
                                                    {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <p className={`text-[14px] truncate flex-1 ${unreadCount > 0 ? 'text-slate-900 dark:text-white font-bold' : 'text-gray-500'}`}>
                                                    {chat.typing?.[otherUserId] ? (
                                                        <span className="text-brandPrimary animate-pulse">typing...</span>
                                                    ) : (
                                                        chat.lastMessage || (chat.roomTitle ? `Inquiry about ${chat.roomTitle}` : 'New chat')
                                                    )}
                                                </p>
                                                <div className="flex items-center gap-2 ml-2">
                                                    {isPinned && <MoreVertical size={14} className="text-gray-400 rotate-45" />}
                                                    {unreadCount > 0 && (
                                                        <span className="bg-brandPrimary text-white text-[11px] font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full px-1">
                                                            {unreadCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </motion.div>
                            );
                        })}
                    </div>
                )
            ) : (
                <div className="space-y-4 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-gray-500 mt-10">
                            <p className="font-bold">No notifications</p>
                        </div>
                    ) : (
                        notifications.map(note => (
                            <div key={note.id} className="glass p-4 border border-gray-200 dark:border-gray-700 shadow-sm rounded-2xl flex gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${note.type === 'SYSTEM' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                    <MessageCircle size={20} />
                                </div>
                                <div>
                                    <p className="text-sm dark:text-white font-medium">{note.message}</p>
                                    <span className="text-xs text-gray-500 mt-1 block">
                                        {new Date(note.timestamp).toLocaleDateString()} {new Date(note.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const RoomCard = ({ roomId }: { roomId: string }) => {
    const [room, setRoom] = useState<Room | null>(null);

    useEffect(() => {
        const fetchRoom = async () => {
            const roomDoc = await getDoc(doc(firestore, 'rooms', roomId));
            if (roomDoc.exists()) {
                setRoom({ id: roomDoc.id, ...roomDoc.data() } as Room);
            }
        };
        fetchRoom();
    }, [roomId]);

    if (!room) return <div className="w-64 h-32 bg-gray-100 animate-pulse rounded-xl" />;

    return (
        <div className="w-64 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md border border-gray-100 dark:border-gray-700">
            <img src={room.images[0]} className="w-full h-32 object-cover" alt={room.title} />
            <div className="p-3">
                <h4 className="font-bold text-sm truncate dark:text-white">{room.title}</h4>
                <p className="text-xs text-gray-500 truncate mb-2">{room.location}</p>
                <div className="flex justify-between items-center">
                    <span className="text-brandPrimary font-bold text-sm">NPR {room.price.toLocaleString()}</span>
                    <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">View Room</span>
                </div>
            </div>
        </div>
    );
};

export const ChatView = ({ currentUser, chat, onBack }: { currentUser: User, chat: Chat, onBack: () => void }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [showReactions, setShowReactions] = useState<string | null>(null);
    const [searchInChat, setSearchInChat] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    const [selectedFile, setSelectedFile] = useState<{ file: File | Blob; type: 'image' | 'attachment' | 'voice' } | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const [showAttachments, setShowAttachments] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    
    const photoInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const otherUserId = chat.participants.find(id => id !== currentUser.id) || currentUser.id;
    const otherUser = chat.participantDetails[otherUserId];
    const otherUserTyping = chat.typing?.[otherUserId];

    useEffect(() => {
        const q = query(
            collection(firestore, 'chats', chat.id, 'messages'),
            orderBy('timestamp', 'asc')
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(msgs);
            
            // Mark unread messages as read
            const unreadIds = msgs.filter(m => m.senderId !== currentUser.id && !m.readBy.includes(currentUser.id)).map(m => m.id);
            if (unreadIds.length > 0) {
                db.markMessagesAsRead(chat.id, currentUser.id, unreadIds);
            }

            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        db.markChatAsRead(chat.id, currentUser.id);

        return () => unsubscribe();
    }, [chat.id, currentUser.id]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputText(e.target.value);
        
        if (!isTyping) {
            setIsTyping(true);
            db.setTypingStatus(chat.id, currentUser.id, true);
        }
        
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            db.setTypingStatus(chat.id, currentUser.id, false);
        }, 1500);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!inputText.trim() && !selectedFile) || isSending) return;

        const text = inputText.trim();
        const fileToSend = selectedFile;
        
        setIsSending(true);

        setIsTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        db.setTypingStatus(chat.id, currentUser.id, false);

        try {
            if (fileToSend) {
                const extension = fileToSend.type === 'voice' 
                    ? (fileToSend.file.type.includes('mp4') ? 'mp4' : 'webm') 
                    : (fileToSend.file as File).name?.split('.').pop() || 'file';
                const fileName = fileToSend.type === 'voice' ? `voice.${extension}` : (fileToSend.file as File).name;
                const path = `chats/${chat.id}/${Date.now()}_${fileName}`;
                
                const url = await db.uploadFile(fileToSend.file, path);
                await db.sendMessage(chat.id, currentUser.id, otherUserId, text || (fileToSend.type === 'voice' ? 'Voice note' : fileName), fileToSend.type, url, replyingTo?.id);
            } else {
                await db.sendMessage(chat.id, currentUser.id, otherUserId, text, 'text', undefined, replyingTo?.id);
            }
            
            // Clear inputs on success
            setSelectedFile(null);
            setPreviewUrl(null);
            setInputText('');
            setReplyingTo(null);
        } catch (error) {
            console.error("Failed to send message", error);
            alert("Failed to send message. Please check your connection.");
        } finally {
            setIsSending(false);
        }
    };

    const handleShareRoom = async () => {
        if (!chat.roomId) return;
        try {
            await db.sendMessage(chat.id, currentUser.id, otherUserId, `Shared room: ${chat.roomTitle}`, 'room_share', chat.roomId);
            setShowAttachments(false);
        } catch (error) {
            console.error("Failed to share room", error);
        }
    };

    const handleReaction = (messageId: string, emoji: string) => {
        db.addReaction(chat.id, messageId, currentUser.id, emoji);
        setShowReactions(null);
    };

    const handleFileSelect = (type: 'image' | 'attachment') => {
        if (type === 'image') photoInputRef.current?.click();
        else docInputRef.current?.click();
        setShowAttachments(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'attachment') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile({ file, type });
        setPreviewUrl(URL.createObjectURL(file));
        setShowAttachments(false);
    };

    const startRecording = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Your browser does not support audio recording. Please try a different browser or open the app in a new tab.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Check supported types
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
                ? 'audio/webm' 
                : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');

            const recorder = mimeType 
                ? new MediaRecorder(stream, { mimeType }) 
                : new MediaRecorder(stream);
                
            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
                setSelectedFile({ file: blob, type: 'voice' });
                setPreviewUrl(URL.createObjectURL(blob));
                
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingDuration(0);
            recordingIntervalRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (error: any) {
            console.error("Failed to start recording", error);
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                alert("Microphone access denied. Please enable microphone permissions in your browser settings and ensure you are using the app in a secure context (HTTPS). If you are in the preview, try opening the app in a new tab.");
            } else {
                alert("Could not start recording: " + error.message);
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
            if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const filteredMessages = messages.filter(m => 
        m.text.toLowerCase().includes(searchInChat.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-[#EFEAE2] dark:bg-slate-900 absolute inset-0 z-50">
            {/* Header */}
            <div className="flex flex-col border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 -ml-2 text-brandPrimary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                            <ChevronLeft size={28} strokeWidth={2.5} />
                        </button>
                        <div className="flex items-center gap-3 cursor-pointer">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 overflow-hidden border border-gray-300 dark:border-gray-600">
                                    {otherUser?.avatar ? (
                                        <img src={otherUser.avatar} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                                            <UserIcon size={20} />
                                        </div>
                                    )}
                                </div>
                                {otherUser?.isOnline && (
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-lg dark:text-white truncate leading-tight">{otherUser?.username || 'User'}</h3>
                                <p className="text-xs text-brandPrimary font-medium truncate">
                                    {otherUserTyping ? 'typing...' : (otherUser?.isOnline ? 'Online' : 'Offline')}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-brandPrimary">
                        <button onClick={() => setShowSearch(!showSearch)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                            <Search size={22} />
                        </button>
                        <button onClick={async () => {
                            try {
                                const userDoc = await getDoc(doc(firestore, 'users', otherUserId));
                                if (userDoc.exists()) {
                                    const userData = userDoc.data() as User;
                                    const phone = userData.phone || userData.kycDocuments?.phone;
                                    if (phone) {
                                        window.open(`tel:${phone}`);
                                    } else {
                                        alert("This user hasn't provided a phone number.");
                                    }
                                }
                            } catch (error) {
                                console.error("Failed to fetch user phone number", error);
                                alert("Could not retrieve phone number.");
                            }
                        }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                            <Phone size={22} />
                        </button>
                    </div>
                </div>
                {showSearch && (
                    <div className="px-4 pb-3 animate-in slide-in-from-top duration-200">
                        <input 
                            type="text"
                            placeholder="Search in chat..."
                            value={searchInChat}
                            onChange={(e) => setSearchInChat(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-800 border-none rounded-lg py-2 px-4 text-sm focus:ring-2 focus:ring-brandPrimary transition-all dark:text-white"
                            autoFocus
                        />
                    </div>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[url('https://i.pinimg.com/originals/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] dark:bg-none bg-cover bg-center bg-fixed no-scrollbar">
                <AnimatePresence initial={false}>
                    {filteredMessages.map((msg, index) => {
                        const isMine = msg.senderId === currentUser.id;
                        const showAvatar = !isMine && (index === messages.length - 1 || messages[index + 1]?.senderId !== msg.senderId);
                        const isSeen = msg.readBy.includes(otherUserId);
                        const replyMsg = msg.replyTo ? messages.find(m => m.id === msg.replyTo) : null;
                        
                        return (
                            <motion.div 
                                key={msg.id} 
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className={`flex ${isMine ? 'justify-end' : 'justify-start'} items-end gap-2 group`}
                            >
                                {!isMine && (
                                    <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden mb-1">
                                        {showAvatar && otherUser?.avatar ? (
                                            <img src={otherUser.avatar} className="w-full h-full object-cover" />
                                        ) : showAvatar ? (
                                            <div className="w-full h-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                                                <UserIcon size={14} />
                                            </div>
                                        ) : <div className="w-7 h-7" />}
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 max-w-[75%]">
                                    <div 
                                        className={`relative px-3 py-2 text-[15px] leading-relaxed shadow-sm ${
                                            isMine 
                                            ? 'bg-[#E7FFDB] dark:bg-brandPrimary text-slate-900 dark:text-white rounded-2xl rounded-tr-sm' 
                                            : 'bg-white dark:bg-gray-800 text-slate-900 dark:text-white rounded-2xl rounded-tl-sm'
                                        }`}
                                        onDoubleClick={() => setReplyingTo(msg)}
                                    >
                                        {replyMsg && (
                                            <div className={`mb-2 p-2 rounded-lg text-xs border-l-4 ${isMine ? 'bg-black/5 border-brandPrimary' : 'bg-gray-100 dark:bg-gray-700 border-gray-400'}`}>
                                                <p className="font-bold opacity-70">{replyMsg.senderId === currentUser.id ? 'You' : otherUser?.username}</p>
                                                <p className="truncate opacity-80">{replyMsg.text}</p>
                                            </div>
                                        )}

                                        {msg.type === 'image' && msg.mediaUrl ? (
                                            <div className="mb-1 -mx-1 -mt-1">
                                                <img src={msg.mediaUrl} className="rounded-xl max-w-full h-auto" alt="Shared image" />
                                            </div>
                                        ) : msg.type === 'room_share' && msg.mediaUrl ? (
                                            <div className="mb-2 -mx-1 -mt-1">
                                                <RoomCard roomId={msg.mediaUrl} />
                                            </div>
                                        ) : msg.type === 'voice' && msg.mediaUrl ? (
                                            <div className="mb-1 flex items-center gap-2 bg-black/5 dark:bg-white/5 p-2 rounded-lg min-w-[200px]">
                                                <button className="w-8 h-8 rounded-full bg-brandPrimary text-white flex items-center justify-center">
                                                    <Mic size={14} />
                                                </button>
                                                <div className="flex-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                                                    <div className="w-1/3 h-full bg-brandPrimary" />
                                                </div>
                                                <audio src={msg.mediaUrl} className="hidden" />
                                                <span className="text-[10px] opacity-60">Voice</span>
                                            </div>
                                        ) : msg.type === 'attachment' && msg.mediaUrl ? (
                                            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-3 bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-black/10 dark:border-white/10">
                                                <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                                                    <Paperclip size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold truncate">{msg.text}</p>
                                                    <p className="text-[10px] opacity-60 uppercase">Document</p>
                                                </div>
                                            </a>
                                        ) : null}
                                        
                                        <p className="break-words">{msg.text}</p>
                                        
                                        <div className={`flex items-center justify-end gap-1 mt-1 -mb-1 ${isMine ? 'text-green-600 dark:text-green-300' : 'text-gray-400'}`}>
                                            <span className="text-[10px] opacity-80">{formatTime(msg.timestamp)}</span>
                                            {isMine && (
                                                isSeen ? <CheckCheck size={14} className="text-blue-500" /> : <Check size={14} />
                                            )}
                                        </div>

                                        {/* Reactions */}
                                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                            <div className={`absolute -bottom-3 ${isMine ? 'right-0' : 'left-0'} flex -space-x-1`}>
                                                {Object.entries(msg.reactions).map(([uid, emoji]) => (
                                                    <div key={uid} className="bg-white dark:bg-gray-700 rounded-full px-1 py-0.5 text-[10px] shadow-sm border border-gray-100 dark:border-gray-600">
                                                        {emoji}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Reaction Trigger */}
                                        <button 
                                            onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)}
                                            className={`absolute top-0 ${isMine ? '-left-8' : '-right-8'} p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-brandPrimary`}
                                        >
                                            <MoreVertical size={16} />
                                        </button>

                                        {showReactions === msg.id && (
                                            <div className={`absolute -top-10 ${isMine ? 'right-0' : 'left-0'} bg-white dark:bg-gray-800 rounded-full shadow-xl p-1 flex gap-1 z-20 border border-gray-100 dark:border-gray-700`}>
                                                {['❤️', '👍', '😂', '😮', '😢', '🙏'].map(emoji => (
                                                    <button 
                                                        key={emoji} 
                                                        onClick={() => handleReaction(msg.id, emoji)}
                                                        className="hover:scale-125 transition-transform p-1"
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                {otherUserTyping && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start items-end gap-2"
                    >
                        <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden mb-1">
                            {otherUser?.avatar ? (
                                <img src={otherUser.avatar} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                                    <UserIcon size={14} />
                                </div>
                            )}
                        </div>
                        <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1">
                            <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                            <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                            <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Reply Preview */}
            {replyingTo && (
                <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between animate-in slide-in-from-bottom duration-200">
                    <div className="border-l-4 border-brandPrimary pl-3 overflow-hidden">
                        <p className="text-xs font-bold text-brandPrimary">Replying to {replyingTo.senderId === currentUser.id ? 'yourself' : otherUser?.username}</p>
                        <p className="text-sm text-gray-500 truncate">{replyingTo.text}</p>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="p-1 text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* Input Area */}
            <div className="p-2 bg-[#f0f2f5] dark:bg-slate-900 border-t border-gray-200 dark:border-gray-800 pb-safe relative">
                {selectedFile && previewUrl && (
                    <div className="mb-2 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 relative flex items-center gap-3 w-fit">
                        <button 
                            onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} 
                            className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors shadow-sm"
                        >
                            <X size={14} strokeWidth={3} />
                        </button>
                        
                        {selectedFile.type === 'image' && (
                            <img src={previewUrl} className="h-16 rounded-md object-cover border border-gray-100 dark:border-gray-700" alt="Selected" />
                        )}
                        
                        {selectedFile.type === 'attachment' && (
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex flex-col items-center justify-center">
                                    <Paperclip size={20} />
                                </div>
                                <span className="font-medium text-sm text-gray-700 dark:text-gray-200 truncate max-w-[150px]">
                                    {(selectedFile.file as File).name}
                                </span>
                            </div>
                        )}
                        
                        {selectedFile.type === 'voice' && (
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-brandPrimary text-white flex items-center justify-center shadow-md">
                                    <Mic size={20} />
                                </div>
                                <audio src={previewUrl} controls className="h-8 w-48" />
                            </div>
                        )}
                    </div>
                )}
                
                {showAttachments && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="absolute bottom-20 left-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-4 z-30 border border-gray-100 dark:border-gray-700"
                    >
                        <button onClick={handleShareRoom} className="flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:text-brandPrimary transition-colors">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                <Home size={20} />
                            </div>
                            <span className="font-bold text-sm">Share Room</span>
                        </button>
                        <button onClick={() => handleFileSelect('image')} className="flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:text-brandPrimary transition-colors">
                            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                <ImageIcon size={20} />
                            </div>
                            <span className="font-bold text-sm">Photos & Videos</span>
                        </button>
                        <button onClick={() => handleFileSelect('attachment')} className="flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:text-brandPrimary transition-colors">
                            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                                <Paperclip size={20} />
                            </div>
                            <span className="font-bold text-sm">Document</span>
                        </button>
                    </motion.div>
                )}

                <input 
                    type="file" 
                    ref={photoInputRef} 
                    className="hidden" 
                    accept="image/*,video/*"
                    onChange={(e) => handleFileChange(e, 'image')}
                />
                <input 
                    type="file" 
                    ref={docInputRef} 
                    className="hidden" 
                    onChange={(e) => handleFileChange(e, 'attachment')}
                />

                <form onSubmit={handleSend} className="flex items-end gap-2">
                    <button 
                        type="button" 
                        onClick={() => setShowAttachments(!showAttachments)}
                        className={`p-3 transition-colors ${showAttachments ? 'text-brandPrimary' : 'text-gray-500 hover:text-brandPrimary'}`}
                    >
                        <Paperclip size={24} />
                    </button>
                    <div className="flex-1 bg-white dark:bg-gray-800 rounded-3xl border border-gray-300 dark:border-gray-700 overflow-hidden focus-within:border-brandPrimary transition-colors flex items-end">
                        {isRecording ? (
                            <div className="flex-1 px-4 py-3 flex items-center gap-3">
                                <motion.div 
                                    animate={{ opacity: [1, 0.5, 1] }} 
                                    transition={{ repeat: Infinity, duration: 1 }}
                                    className="w-2 h-2 bg-red-500 rounded-full" 
                                />
                                <span className="text-sm font-bold text-red-500">{formatDuration(recordingDuration)}</span>
                                <span className="text-sm text-gray-500">Recording voice...</span>
                            </div>
                        ) : (
                            <textarea 
                                value={inputText}
                                onChange={handleTextChange}
                                disabled={isSending}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend(e);
                                    }
                                }}
                                placeholder="Message"
                                className="w-full max-h-32 bg-transparent outline-none px-4 py-3 resize-none text-[15px] dark:text-white disabled:opacity-50"
                                rows={1}
                                style={{ minHeight: '44px' }}
                            />
                        )}
                        <button 
                            type="button" 
                            onClick={() => photoInputRef.current?.click()}
                            className="p-3 text-gray-500 hover:text-brandPrimary transition-colors"
                        >
                            <Camera size={24} />
                        </button>
                    </div>
                    {inputText.trim() || isRecording || selectedFile ? (
                        <button 
                            type={isRecording ? "button" : "submit"}
                            onClick={isRecording ? stopRecording : undefined}
                            disabled={isSending}
                            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-colors shadow-sm disabled:opacity-50 ${isRecording ? 'bg-red-500 text-white' : 'bg-brandPrimary text-white'}`}
                        >
                            {isSending ? <Loader2 size={20} className="animate-spin" /> : (
                                isRecording ? <Send size={20} /> : <Send size={20} className="ml-1" />
                            )}
                        </button>
                    ) : (
                        <button 
                            type="button" 
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            onTouchStart={startRecording}
                            onTouchEnd={stopRecording}
                            className="w-12 h-12 rounded-full bg-brandPrimary text-white flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                        >
                            <Mic size={24} />
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
};
