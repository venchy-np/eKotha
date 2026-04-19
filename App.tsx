
import React, { useState, useEffect, useRef } from 'react';
import { Home, Map as MapIcon, Search, Bell, User as UserIcon, LogOut, Moon, Languages, Plus, CheckCircle, X, ChevronRight, UploadCloud, Info, SlidersHorizontal, MessageCircle, MapPin, DollarSign, Image as ImageIcon, ArrowDown, RefreshCw, ShieldCheck, Check, Ban } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { User, Room, KYCStatus, UserRole } from './types';
import { TRANSLATIONS } from './constants';
import { db } from './services/db';
import { searchRoomsWithAI } from './services/geminiService';
import { auth, db as firestore, storage } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import KYCModal from './components/KYCModal';
import { InboxView, ChatView } from './components/ChatViews';
import { Chat } from './types';

// --- Types for Filters ---
interface SearchFilters {
  priceRange: [number, number];
  features: string[];
}

const ALL_FEATURES = ['wifi', 'kitchen', 'balcony', 'parking', 'water_24h', 'attached_bathroom', 'furnished', 'ac'];

const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
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
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

// --- Fix Leaflet Marker Icons ---
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

const MapUpdater = ({ center, zoom }: { center: [number, number], zoom?: number }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map, center, zoom]);
  return null;
};

const LocationPicker = ({ onLocationSelect, initialPos }: { onLocationSelect: (lat: number, lng: number, address: string) => void, initialPos?: [number, number] }) => {
    const [pos, setPos] = useState<[number, number] | null>(initialPos || null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const MapEvents = () => {
        useMapEvents({
            click(e) {
                setPos([e.latlng.lat, e.latlng.lng]);
                onLocationSelect(e.latlng.lat, e.latlng.lng, "");
            },
        });
        return null;
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=np`);
            const data = await response.json();
            setSearchResults(data);
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const selectLocation = (result: any) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        setPos([lat, lng]);
        setSearchResults([]);
        setSearchQuery(result.display_name);
        onLocationSelect(lat, lng, result.display_name);
    };

    return (
        <div className="space-y-3">
            <div className="relative">
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text"
                            placeholder="Search location (e.g. Koteshwor, Kathmandu)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brandPrimary"
                        />
                    </div>
                    <button 
                        type="button"
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="px-4 bg-brandPrimary text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                    >
                        {isSearching ? "..." : "Search"}
                    </button>
                </div>
                
                {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-[1000] mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-48 overflow-y-auto overflow-x-hidden">
                        {searchResults.map((result, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => selectLocation(result)}
                                className="w-full text-left p-3 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0 dark:text-white truncate"
                            >
                                {result.display_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="h-64 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 relative z-0">
                <MapContainer center={pos || [27.7172, 85.3240]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapEvents />
                    {pos && <Marker position={pos} icon={icon} />}
                    <MapUpdater center={pos || [27.7172, 85.3240]} />
                </MapContainer>
                <div className="absolute bottom-2 left-2 z-[400] bg-white/90 dark:bg-slate-900/90 px-2 py-1 rounded text-[10px] font-bold dark:text-white">
                    Tap on map to pin location
                </div>
            </div>
        </div>
    );
};

// --- Components Defined OUTSIDE App to fix re-rendering focus loss ---

const Onboarding = ({ onFinish }: { onFinish: () => void }) => {
  const [slide, setSlide] = useState(0);
  const getPath = (name: string) => `${import.meta.env.BASE_URL}${name}`;

  const slides = [
    { title: "eKotha: Rooms in Nepal", desc: "Find your perfect space. Rent with ease.", img: getPath("room.jpg") },
    { title: "Browse Listings", desc: "Apartments, flats, and single rooms available now.", img: getPath("browse.png") },
    { title: "Interactive Maps", desc: "Locate rooms near your college or workplace.", img: getPath("map.jpg") },
    { title: "AI Recommendations", desc: "Our AI finds the best matches for your needs.", img: getPath("ai.jpg") },
    { title: "Local Payments", desc: "Securely pay via eSewa or Khalti.", img: getPath("payments.jpg") }
  ];

  return (
    <div className="h-screen flex flex-col bg-brandLight dark:bg-brandDark">
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-64 h-64 mb-8 relative group">
             <div className="absolute inset-0 bg-gradient-to-r from-brandPrimary to-brandSecondary text-white translate-x-3 translate-y-3 border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl"></div>
             <img src={slides[slide].img} alt="Onboarding" className="w-full h-full object-cover relative z-10 border border-gray-200 dark:border-gray-700" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight ">{slides[slide].title}</h1>
        <p className="text-gray-600 dark:text-gray-400 text-xl font-bold">{slides[slide].desc}</p>
      </div>
      <div className="p-8">
        <div className="flex justify-center gap-3 mb-8">
          {slides.map((_, i) => (
            <div key={i} className={`h-3 border border-gray-200 dark:border-gray-700 transition-all ${i === slide ? 'w-10 bg-gradient-to-r from-brandPrimary to-brandSecondary text-white' : 'w-3 bg-white'}`} />
          ))}
        </div>
        <button 
          onClick={() => {
            if (slide < slides.length - 1) setSlide(slide + 1);
            else onFinish();
          }}
          className="w-full py-4 bg-gradient-to-r from-brandPrimary to-brandSecondary text-white font-bold text-xl hover:opacity-90 transition-all  border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          {slide === slides.length - 1 ? 'Get Started' : 'Next'}
        </button>
        {slide < slides.length - 1 && (
          <button onClick={onFinish} className="w-full py-4 mt-2 text-gray-500 dark:text-gray-400 font-bold tracking-wide text-sm hover:text-slate-900 dark:text-white dark:hover:text-white">Skip Intro</button>
        )}
      </div>
    </div>
  );
};

const Auth = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const user = await db.loginWithGoogle();
      if (user) {
        onLogin(user);
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Login cancelled. Please keep the window open to sign in.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Google Login is not enabled in the Firebase Console.');
      } else {
        setError(err.message || 'An error occurred during Google login.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const user = await db.loginWithFacebook();
      if (user) {
        onLogin(user);
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Login cancelled. Please keep the window open to sign in.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Facebook Login is not enabled in the Firebase Console.');
      } else {
        setError(err.message || 'An error occurred during Facebook login.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center p-6 bg-brandLight dark:bg-brandDark">
      <div className="w-full max-w-md glass p-8 border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl ">
        <h2 className="text-4xl font-bold text-center mb-8 text-slate-900 dark:text-white tracking-tight">
          Welcome
        </h2>
        
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-800 dark:text-blue-200">
           <p className="font-bold mb-1">Secure Login</p>
           <p>We use Google and Facebook Authentication to keep your account secure. No passwords to remember.</p>
        </div>

        {error && <p className="text-red-600 mb-6 bg-red-100 p-3 font-bold border border-red-500 rounded-xl">{error}</p>}
        
        <div className="space-y-4">
            <button 
              onClick={handleGoogleLogin} 
              disabled={isLoading}
              className="w-full py-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xl hover:opacity-90 transition-all border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <span className="animate-pulse">Connecting...</span>
              ) : (
                <>
                  <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="whitespace-nowrap">Continue with Google</span>
                </>
              )}
            </button>

            <button 
              onClick={handleFacebookLogin} 
              disabled={isLoading}
              className="w-full py-4 bg-[#1877F2] text-white font-bold text-xl hover:opacity-90 transition-all border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <span className="animate-pulse">Connecting...</span>
              ) : (
                <>
                  <div className="w-6 h-6 shrink-0 flex items-center justify-center bg-white text-[#1877F2] rounded-full">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <span className="whitespace-nowrap">Continue with Facebook</span>
                </>
              )}
            </button>
        </div>
      </div>
    </div>
  );
};

const RoomFormModal = ({ user, onClose, onSave, editingRoom }: { user: User, onClose: () => void, onSave: (room: Room) => void, editingRoom?: Room }) => {
    const [title, setTitle] = useState(editingRoom?.title || '');
    const [price, setPrice] = useState(editingRoom?.price.toString() || '');
    const [location, setLocation] = useState(editingRoom?.location || '');
    const [description, setDescription] = useState(editingRoom?.description || '');
    const [features, setFeatures] = useState<string[]>(editingRoom?.features || []);
    const [customFeature, setCustomFeature] = useState('');
    const [isAddingFeature, setIsAddingFeature] = useState(false);
    const [esewaId, setEsewaId] = useState(editingRoom?.paymentInfo?.esewaId || '');
    const [khaltiId, setKhaltiId] = useState(editingRoom?.paymentInfo?.khaltiId || '');
    const [contactPhone, setContactPhone] = useState(editingRoom?.contactDetails?.phone || '');
    const [contactFacebook, setContactFacebook] = useState(editingRoom?.contactDetails?.facebookLink || user.facebookLink || '');
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>(editingRoom?.images || []);
    const [lat, setLat] = useState<number | null>(editingRoom?.lat || null);
    const [lng, setLng] = useState<number | null>(editingRoom?.lng || null);
    const [isUploading, setIsUploading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []) as File[];
        setSelectedImages(prev => [...prev, ...files]);
        
        const newPreviews = files.map(file => URL.createObjectURL(file));
        setImagePreviews(prev => [...prev, ...newPreviews]);
    };

    const removeImage = (index: number) => {
        const preview = imagePreviews[index];
        const isExisting = typeof preview === 'string' && preview.startsWith('http');
        
        if (!isExisting) {
            const newImageIndex = imagePreviews.slice(0, index).filter(p => !p.startsWith('http')).length;
            setSelectedImages(prev => prev.filter((_, i) => i !== newImageIndex));
        }
        
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        
        if (imagePreviews.length === 0) {
            setErrorMsg("Please upload at least one image.");
            return;
        }
        if (lat === null || lng === null) {
            setErrorMsg("Please pin the location on the map.");
            return;
        }

        setIsUploading(true);
        try {
            const newImageUrls = await Promise.all(
                selectedImages.map(async (file) => {
                    return await resizeImage(file);
                })
            );

            const existingImages = imagePreviews.filter(p => p.startsWith('http'));
            const finalImages = [...existingImages, ...newImageUrls];

            const roomData: any = {
                ownerId: user.id,
                title,
                description,
                price: parseInt(price),
                location,
                lat,
                lng,
                features,
                images: finalImages,
                isAvailable: true,
                isExample: false,
            };

            if (esewaId || khaltiId) {
                roomData.paymentInfo = {};
                if (esewaId) roomData.paymentInfo.esewaId = esewaId;
                if (khaltiId) roomData.paymentInfo.khaltiId = khaltiId;
            }

            if (contactPhone || contactFacebook) {
                roomData.contactDetails = {};
                if (contactPhone) roomData.contactDetails.phone = contactPhone;
                if (contactFacebook) roomData.contactDetails.facebookLink = contactFacebook;
            }
            
            if (editingRoom) {
                await db.updateRoom(editingRoom.id, roomData);
                onSave({ ...editingRoom, ...roomData });
            } else {
                const newRoom = await db.addRoom({ ...roomData, id: '' } as Room);
                onSave(newRoom);
            }
            onClose();
        } catch (error) {
            console.error("Failed to save room", error);
            setErrorMsg("Failed to save room. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    const toggleFeature = (f: string) => {
        setFeatures(prev => prev.includes(f) ? prev.filter(item => item !== f) : [...prev, f]);
    };

    const handleAddCustomFeature = () => {
        if (customFeature.trim()) {
            const feature = customFeature.trim().substring(0, 20);
            if (!features.includes(feature)) {
                setFeatures(prev => [...prev, feature]);
            }
            setCustomFeature('');
            setIsAddingFeature(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/80 flex items-end md:items-center justify-center p-4 md:p-6 overflow-y-auto">
            <div className="glass w-full max-w-xl border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-center p-4 border-b-2 border-gray-200 dark:border-gray-700 dark:border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold  dark:text-white">{editingRoom ? 'Edit Room' : 'List a Room'}</h2>
                    <button onClick={onClose}><X size={24} className="dark:text-white"/></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
                    {errorMsg && (
                        <div className="p-3 bg-red-100 text-red-800 border border-red-200 rounded-lg text-sm font-bold">
                            {errorMsg}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold  mb-1 dark:text-gray-300">Room Title</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-3 border border-gray-200 dark:border-gray-700 font-bold outline-none focus:bg-white/50" placeholder="e.g. Sunny Single Room"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold  mb-1 dark:text-gray-300">Price (NPR)</label>
                            <input type="number" value={price} onChange={e => setPrice(e.target.value)} required className="w-full p-3 border border-gray-200 dark:border-gray-700 font-bold outline-none focus:bg-white/50" placeholder="15000"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold  mb-1 dark:text-gray-300">Location</label>
                            <input value={location} onChange={e => setLocation(e.target.value)} required className="w-full p-3 border border-gray-200 dark:border-gray-700 font-bold outline-none focus:bg-white/50" placeholder="e.g. Koteshwor"/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold  mb-1 dark:text-gray-300">Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={4} className="w-full p-3 border border-gray-200 dark:border-gray-700 font-bold outline-none focus:bg-white/50" placeholder="Describe your room..."/>
                    </div>

                    <div>
                        <label className="block text-xs font-bold  mb-2 dark:text-gray-300">Amenities</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {ALL_FEATURES.map(f => (
                                <button 
                                    key={f} 
                                    type="button"
                                    onClick={() => toggleFeature(f)}
                                    className={`px-3 py-1 border text-xs font-bold  transition-all ${features.includes(f) ? 'bg-brandPrimary text-white shadow-md rounded-xl' : 'glass border-gray-300 dark:border-gray-600 text-gray-500'}`}
                                >
                                    {f.replace('_', ' ')}
                                </button>
                            ))}
                            {features.filter(f => !ALL_FEATURES.includes(f)).map(f => (
                                <button 
                                    key={f} 
                                    type="button"
                                    onClick={() => toggleFeature(f)}
                                    className="px-3 py-1 bg-brandSecondary text-white shadow-md rounded-xl text-xs font-bold"
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        {isAddingFeature ? (
                            <div className="flex gap-2">
                                <input 
                                    autoFocus
                                    value={customFeature} 
                                    onChange={e => setCustomFeature(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCustomFeature())}
                                    className="flex-1 p-2 border border-gray-200 dark:border-gray-700 text-xs font-bold outline-none" 
                                    placeholder="Enter feature..."
                                />
                                <button type="button" onClick={handleAddCustomFeature} className="bg-brandPrimary text-white px-3 text-xs font-bold">Add</button>
                                <button type="button" onClick={() => setIsAddingFeature(false)} className="text-gray-500 text-xs font-bold">Cancel</button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => setIsAddingFeature(true)} className="text-brandPrimary text-xs font-bold flex items-center gap-1 hover:underline">
                                <Plus size={14}/> Add Custom Feature
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold  mb-1 dark:text-gray-300">eSewa ID (Optional)</label>
                            <input value={esewaId} onChange={e => setEsewaId(e.target.value)} className="w-full p-3 border border-gray-200 dark:border-gray-700 font-bold outline-none focus:bg-white/50" placeholder="98XXXXXXXX"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold  mb-1 dark:text-gray-300">Khalti ID (Optional)</label>
                            <input value={khaltiId} onChange={e => setKhaltiId(e.target.value)} className="w-full p-3 border border-gray-200 dark:border-gray-700 font-bold outline-none focus:bg-white/50" placeholder="98XXXXXXXX"/>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold  mb-1 dark:text-gray-300">Contact Phone</label>
                            <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="w-full p-3 border border-gray-200 dark:border-gray-700 font-bold outline-none focus:bg-white/50" placeholder="98XXXXXXXX"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold  mb-1 dark:text-gray-300">Facebook Link</label>
                            <input value={contactFacebook} onChange={e => setContactFacebook(e.target.value)} className="w-full p-3 border border-gray-200 dark:border-gray-700 font-bold outline-none focus:bg-white/50" placeholder="facebook.com/profile"/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold  mb-2 dark:text-gray-300">Photos (Max 5)</label>
                        <div className="grid grid-cols-5 gap-2 mb-2">
                            {imagePreviews.map((p, i) => (
                                <div key={i} className="aspect-square relative group">
                                    <img src={p} className="w-full h-full object-cover border border-gray-200 dark:border-gray-700" />
                                    <button type="button" onClick={() => removeImage(i)} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 shadow-lg"><X size={12}/></button>
                                </div>
                            ))}
                            {imagePreviews.length < 5 && (
                                <label className="aspect-square border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <ImageIcon size={20} className="text-gray-400 mb-1"/>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Add Photo</span>
                                    <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                                </label>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold mb-2 dark:text-gray-300">Pin Location on Map *</label>
                        <LocationPicker 
                            initialPos={lat && lng ? [lat, lng] : undefined}
                            onLocationSelect={(lt, ln, addr) => {
                                setLat(lt);
                                setLng(ln);
                                if (addr && !location) setLocation(addr.split(',')[0]);
                            }}
                        />
                    </div>

                    <button type="submit" disabled={isUploading} className="w-full py-4 bg-gradient-to-r from-brandPrimary to-brandSecondary text-white font-bold  border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl active:translate-y-1 active:shadow-none hover:opacity-90 disabled:opacity-50">
                        {isUploading ? "Saving..." : (editingRoom ? "Update Room" : "List Room Now")}
                    </button>
                </form>
            </div>
        </div>
    );
};

const ListerDashboard = ({ rooms, onEdit, onDelete, t }: { rooms: Room[], onEdit: (room: Room) => void, onDelete: (roomId: string) => void, t: any }) => {
    return (
        <div className="p-6 pb-24 max-w-2xl mx-auto">
            <h2 className="text-4xl font-bold mb-8 dark:text-white tracking-tight">{t.your_rooms}</h2>
            
            <div className="grid grid-cols-1 gap-5">
                {rooms.map((room) => (
                    <div key={room.id} className="glass p-4 border border-gray-200 dark:border-gray-700 rounded-2xl flex gap-4 relative group">
                        <img src={room.images[0]} className="w-32 h-24 object-cover border border-gray-200 dark:border-gray-700" />
                        <div className="flex-1 flex flex-col justify-center">
                            <h4 className="font-bold text-xl dark:text-white tracking-tight line-clamp-1">{room.title}</h4>
                            <p className="text-sm text-gray-500 font-bold mb-2 flex items-center gap-1"><MapPin size={12}/> {room.location}</p>
                            <div className="flex justify-between items-center mt-auto">
                                <p className="text-slate-900 dark:text-white font-bold text-lg">NPR {room.price.toLocaleString()}</p>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => onEdit(room)}
                                        className="p-2 bg-blue-600 text-white rounded-xl hover:opacity-90 transition-all"
                                    >
                                        Edit
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (window.confirm("Are you sure you want to delete this room?")) {
                                                onDelete(room.id);
                                            }
                                        }}
                                        className="p-2 bg-red-600 text-white rounded-xl hover:opacity-90 transition-all"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {rooms.length === 0 && (
                    <div className="text-center py-20 opacity-50">
                        <Home size={64} className="mx-auto mb-4 text-gray-400" />
                        <p className="text-xl font-bold">You haven't listed any rooms yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const RoomCard: React.FC<{ room: Room, t: any, onClick: () => void }> = ({ room, t, onClick }) => (
  <div onClick={onClick} className="glass cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-brandPrimary dark:hover:border-brandPrimary transition-all duration-200 group relative shadow-md rounded-xl hover:shadow-glass rounded-2xl hover:-translate-y-1">
    <div className="h-56 relative overflow-hidden border-b-2 border-gray-200 dark:border-gray-700 dark:border-gray-500">
      <img src={room.images[0]} alt={room.title} className="w-full h-full object-cover transition-all duration-500" />
      
      <div className="absolute top-3 left-3 bg-gradient-to-r from-brandPrimary to-brandSecondary text-white px-3 py-1 text-xs font-bold tracking-wide border border-gray-200 dark:border-gray-700 shadow-md z-10">
        {t.available}
      </div>
      
      {room.isExample && (
        <div className="absolute top-3 right-3 bg-red-600 text-white px-3 py-1 text-xs font-bold tracking-wide text-gray-500 border border-gray-200 dark:border-gray-700 shadow-md z-10">
          Example
        </div>
      )}

      <div className="absolute bottom-0 left-0 bg-slate-900 text-white px-4 py-2 border-t-2 border-r-2 border-gray-200 dark:border-gray-700 font-bold text-lg">
        NPR {room.price.toLocaleString()}
      </div>
    </div>
    <div className="p-4">
      <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-2 leading-tight  line-clamp-1">{room.title}</h3>
      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 flex items-center gap-2 font-bold  tracking-wide">
         <MapPin size={16} className="text-slate-900 dark:text-white dark:text-brandPrimary" /> {room.location}
      </p>
      <div className="flex flex-wrap gap-2">
        {room.features.slice(0, 3).map((f, i) => (
          <span key={i} className="text-[10px] font-bold bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 dark:border-gray-500 text-slate-900 dark:text-white dark:text-gray-300 px-2 py-1 ">{f.replace('_', ' ')}</span>
        ))}
      </div>
    </div>
  </div>
);

// --- VIEW COMPONENTS ---

const AdminDashboard = ({ currentUser }: any) => {
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    
    useEffect(() => {
        const q = query(collection(firestore, 'users'), where('kycStatus', '==', 'PENDING'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            setPendingUsers(users);
        });
        return () => unsubscribe();
    }, []);

    const handleVerify = async (userId: string, isApproved: boolean, reason?: string) => {
        try {
            await db.verifyUserKYC(userId, isApproved ? KYCStatus.VERIFIED : KYCStatus.REJECTED, reason);
            setRejectingId(null);
            setRejectReason('');
        } catch (error) {
            console.error("Error verifying KYC:", error);
        }
    }

    return (
        <div className="p-6 pb-24 max-w-4xl mx-auto">
             <div className="flex items-center gap-4 mb-8">
                 <div className="bg-red-600 text-white p-3 border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl">
                     <ShieldCheck size={32} />
                 </div>
                 <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Admin Dashboard</h1>
                    <p className="text-sm font-bold text-gray-500 tracking-wide text-gray-500">KYC Verification Queue</p>
                 </div>
             </div>

             {pendingUsers.length === 0 ? (
                 <div className="p-10 border border-dashed border-gray-400 text-center rounded-lg bg-gray-50 dark:bg-white/5">
                     <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
                     <h3 className="text-xl font-bold  dark:text-white">All Caught Up!</h3>
                     <p className="text-gray-500 font-bold">No pending KYC requests found.</p>
                 </div>
             ) : (
                 <div className="space-y-8">
                     {pendingUsers.map(user => (
                         <div key={user.id} className="glass border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl p-6">
                             <div className="flex justify-between items-start mb-6 border-b-2 border-gray-200 dark:border-gray-700 pb-4">
                                 <div>
                                     <h3 className="text-2xl font-bold  dark:text-white">{user.username}</h3>
                                     <p className="text-sm font-bold text-gray-500">{user.email}</p>
                                 </div>
                                 <div className="bg-yellow-100 text-yellow-800 px-3 py-1 font-bold text-xs  border border-yellow-500">
                                     Pending Review
                                 </div>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-50 dark:bg-slate-900/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                 <div>
                                     <span className="block text-[10px] uppercase font-bold text-gray-500">Official Name</span>
                                     <span className="font-bold dark:text-white">{user.kycDocuments?.officialName || 'N/A'}</span>
                                 </div>
                                 <div>
                                     <span className="block text-[10px] uppercase font-bold text-gray-500">Permanent Address</span>
                                     <span className="font-bold dark:text-white">{user.kycDocuments?.address || 'N/A'}</span>
                                 </div>
                                 <div>
                                     <span className="block text-[10px] uppercase font-bold text-gray-500">Verified Phone</span>
                                     <span className="font-bold dark:text-white">{user.kycDocuments?.phone || 'N/A'}</span>
                                 </div>
                             </div>
                             
                             <div className="relative bg-gray-50 dark:bg-slate-900/40 p-6 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 mt-4">
                                 <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brandPrimary text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
                                     <ShieldCheck size={14} /> Compare Faces
                                 </div>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                     <div className="space-y-2">
                                         <span className="block text-xs font-bold text-gray-500 text-center uppercase tracking-wider">Govt ID Card</span>
                                         <div className="h-64 border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 rounded-xl relative group overflow-hidden hover:border-brandPrimary transition-colors">
                                            <img src={user.kycDocuments?.idImage} className="w-full h-full object-contain hover:scale-110 transition-transform duration-300" />
                                         </div>
                                     </div>
                                     <div className="space-y-2">
                                         <span className="block text-xs font-bold text-gray-500 text-center uppercase tracking-wider">Live Selfie</span>
                                         <div className="h-64 border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 rounded-xl relative group overflow-hidden hover:border-brandPrimary transition-colors">
                                            <img src={user.kycDocuments?.selfieImage} className="w-full h-full object-contain hover:scale-110 transition-transform duration-300" />
                                         </div>
                                     </div>
                                 </div>
                             </div>

                             {rejectingId === user.id ? (
                                 <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl animate-in slide-in-from-top-2">
                                     <label className="block text-xs font-bold text-red-800 dark:text-red-300 mb-2">Reason for Rejection</label>
                                     <textarea 
                                         value={rejectReason}
                                         onChange={(e) => setRejectReason(e.target.value)}
                                         className="w-full p-3 bg-white dark:bg-slate-800 border border-red-300 dark:border-red-700 rounded-xl outline-none focus:border-red-500 mb-3 text-sm font-medium"
                                         placeholder="e.g., ID is blurry, face doesn't match..."
                                         rows={2}
                                     />
                                     <div className="flex gap-3">
                                         <button onClick={() => { setRejectingId(null); setRejectReason(''); }} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-800 dark:text-white font-bold rounded-xl transition-colors">Cancel</button>
                                         <button onClick={() => handleVerify(user.id, false, rejectReason)} disabled={!rejectReason.trim()} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors">Confirm Rejection</button>
                                     </div>
                                 </div>
                             ) : (
                                 <div className="flex gap-4">
                                     <button 
                                        onClick={() => setRejectingId(user.id)}
                                        className="flex-1 py-4 bg-red-100 hover:bg-red-200 text-red-800 font-bold border border-red-800 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95"
                                     >
                                         <Ban size={20} /> Reject
                                     </button>
                                     <button 
                                        onClick={() => handleVerify(user.id, true)}
                                        className="flex-1 py-4 bg-green-500 hover:bg-green-400 text-white font-bold border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl flex items-center justify-center gap-2 transition-transform active:translate-y-1 active:shadow-none"
                                     >
                                         <Check size={20} /> Approve KYC
                                     </button>
                                 </div>
                             )}
                         </div>
                     ))}
                 </div>
             )}
        </div>
    )
}

const ExploreView = ({ rooms, currentUser, setView, handleRoomClick, t }: any) => (
  <div className="pb-24 p-5 max-w-5xl mx-auto">
    <div className="flex justify-between items-center mb-8 mt-4 border-b-4 border-brandBlack dark:border-brandPrimary pb-4">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight  dark:">eKotha<span className="text-brandPrimary text-5xl leading-none">.</span></h1>
        <p className="text-sm font-bold text-gray-500 tracking-wide text-gray-500 mt-1">{t.rent_rooms_in_nepal}</p>
      </div>
      <button onClick={() => setView('profile')} className="w-14 h-14 bg-white dark:bg-gray-800 hover:bg-brandPrimary hover:text-white transition-colors flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl overflow-hidden">
          {currentUser?.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : <UserIcon size={28} className="text-slate-900 dark:text-white"/>}
      </button>
    </div>

    <div className="mb-6">
      <h2 className="text-2xl font-bold  mb-4 dark:text-white">{t.featured_rooms}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room: Room) => (
          <RoomCard key={room.id} room={room} t={t} onClick={() => handleRoomClick(room)} />
        ))}
      </div>
    </div>
  </div>
);

const MapView = ({ rooms, handleRoomClick }: any) => {
    const [center, setCenter] = useState<[number, number]>([27.7172, 85.3240]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=np`);
            const data = await response.json();
            setSearchResults(data);
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const selectLocation = (result: any) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        setCenter([lat, lng]);
        setSearchResults([]);
        setSearchQuery(result.display_name);
    };

    return (
        <div className="h-[calc(100vh-80px)] w-full relative z-0">
            <div className="absolute top-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[400] space-y-2">
                <div className="flex gap-2 glass p-2 border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text"
                            placeholder="Search area..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full pl-10 pr-4 py-2 bg-transparent dark:text-white outline-none font-bold text-sm"
                        />
                    </div>
                    <button 
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="p-2 bg-brandPrimary text-white rounded-xl"
                    >
                        {isSearching ? <RefreshCw size={20} className="animate-spin" /> : <Search size={20} />}
                    </button>
                </div>

                {searchResults.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto overflow-x-hidden">
                        {searchResults.map((result, idx) => (
                            <button
                                key={idx}
                                onClick={() => selectLocation(result)}
                                className="w-full text-left p-3 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0 dark:text-white truncate"
                            >
                                {result.display_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
            <MapUpdater center={center} />
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
            />
            {rooms.map((room: Room) => (
                <Marker 
                    key={room.id} 
                    position={[room.lat, room.lng]}
                    icon={icon}
                    eventHandlers={{
                        click: () => handleRoomClick(room),
                    }}
                >
                </Marker>
            ))}
            </MapContainer>
            
            <div className="absolute bottom-4 left-4 z-[400] bg-white/90 dark:bg-slate-900/90 border border-gray-200 dark:border-gray-700 p-3 shadow-glass rounded-2xl max-w-xs hidden md:block">
                <h3 className="font-bold text-sm mb-1">Interactive Map</h3>
                <p className="text-[10px] font-bold text-gray-500">Tap markers to view details.</p>
            </div>
        </div>
    )
}

const SearchView = ({ 
  rooms, 
  searchQuery, 
  setSearchQuery, 
  isSearching, 
  performSearch, 
  handleRoomClick, 
  t,
  filters,
  setFilters,
  showFilters,
  setShowFilters
}: any) => {

  const toggleFeature = (feature: string) => {
    const newFeatures = filters.features.includes(feature)
      ? filters.features.filter((f: string) => f !== feature)
      : [...filters.features, feature];
    setFilters({ ...filters, features: newFeatures });
  };

  return (
    <div className="p-6 pb-24 max-w-2xl mx-auto">
      <h2 className="text-5xl font-bold mb-8 dark:text-white tracking-tight ">{t.search}</h2>
      
      {/* Search Bar */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl glass">
          <input 
            type="text" 
            placeholder={t.search_placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 p-4 bg-transparent dark:text-white outline-none font-bold text-lg placeholder-gray-400"
          />
        </div>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all ${showFilters ? 'bg-gradient-to-r from-brandPrimary to-brandSecondary text-white ' : 'text-slate-900 dark:text-white'}`}
        >
          <SlidersHorizontal size={24} strokeWidth={2.5} />
        </button>
        <button 
          onClick={performSearch}
          disabled={isSearching}
          className="bg-gradient-to-r from-brandPrimary to-brandSecondary text-white px-6 font-bold hover:opacity-90 disabled:opacity-50 tracking-wide text-gray-500 border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
        >
          {isSearching ? <span className="animate-spin block">⏳</span> : <Search size={28} strokeWidth={3} />}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-8 p-6 glass border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl animate-in slide-in-from-top-2 duration-200">
           <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold  text-lg dark:text-white">Filters</h3>
              <button onClick={() => setFilters({priceRange: [0, 100000], features: []})} className="text-xs font-bold text-red-500  hover:underline">Reset</button>
           </div>
           
           <div className="mb-4">
             <label className="block text-xs font-bold  mb-2 dark:text-gray-300">Max Price: NPR {filters.priceRange[1].toLocaleString()}</label>
             <input 
                type="range" 
                min="0" 
                max="100000" 
                step="1000"
                value={filters.priceRange[1]}
                onChange={(e) => setFilters({...filters, priceRange: [0, parseInt(e.target.value)]})}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brandYellow"
             />
           </div>

           <div>
             <label className="block text-xs font-bold  mb-2 dark:text-gray-300">Amenities</label>
             <div className="flex flex-wrap gap-2">
                {ALL_FEATURES.map(f => (
                  <button 
                    key={f}
                    onClick={() => toggleFeature(f)}
                    className={`px-3 py-1 border text-xs font-bold  transition-all ${
                      filters.features.includes(f) 
                      ? 'bg-gradient-to-r from-brandPrimary to-brandSecondary text-white shadow-md rounded-xl' 
                      : 'glass border-gray-300 dark:border-gray-600 text-gray-500 hover:border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {f.replace('_', ' ')}
                  </button>
                ))}
             </div>
           </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6 border-b-2 border-gray-200 dark:border-gray-700 dark:border-gray-200 dark:border-gray-700 pb-2">
        <h3 className="font-bold text-gray-500 tracking-wide text-gray-500 text-sm">Results ({rooms.length})</h3>
        {searchQuery && <span className="text-[10px] font-bold text-white bg-gradient-to-r from-brandPrimary to-brandSecondary px-2 py-1  border border-gray-200 dark:border-gray-700">AI Powered</span>}
      </div>
      
      <div className="grid grid-cols-1 gap-5">
        {rooms.map((room: Room) => (
          <div key={room.id} onClick={() => handleRoomClick(room)} className="flex gap-4 glass p-4 border border-gray-200 dark:border-gray-700 hover:border-brandPrimary dark:hover:border-brandPrimary cursor-pointer transition-all hover:-translate-y-1 hover:shadow-glass rounded-2xl group relative">
            {room.isExample && (
                <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-2 py-0.5 font-bold tracking-wide border-b-2 border-l-2 border-gray-200 dark:border-gray-700">Example</div>
            )}
            <img src={room.images[0]} className="w-32 h-24 object-cover border border-gray-200 dark:border-gray-700" />
            <div className="flex-1 flex flex-col justify-center">
              <h4 className="font-bold text-xl dark:text-white  tracking-tight line-clamp-1 group-hover:text-slate-900 dark:text-white dark:group-hover:text-brandPrimary">{room.title}</h4>
              <p className="text-sm text-gray-500 font-bold  mb-2 flex items-center gap-1"><MapPin size={12}/> {room.location}</p>
              <div className="flex justify-between items-center mt-auto">
                 <p className="text-slate-900 dark:text-white font-bold text-lg bg-gradient-to-r from-brandPrimary to-brandSecondary text-white px-2 -ml-1 transform -skew-x-12">NPR {room.price.toLocaleString()}</p>
                 <ChevronRight size={24} className="text-slate-900 dark:text-white group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        ))}
        {rooms.length === 0 && (
          <div className="text-center py-10 opacity-50">
            <Search size={48} className="mx-auto mb-2"/>
            <p className="font-bold ">No rooms found</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ProfileView = ({ currentUser, handleListRoom, setShowKYC, lang, setLang, setView, t, rooms }: any) => {
    const userRooms = rooms.filter((r: Room) => r.ownerId === currentUser?.id);
    const hasRooms = userRooms.length > 0;

    return (
        <div className="p-6 pb-24 max-w-xl mx-auto">
           <div className="flex flex-col items-center mb-10 mt-6 relative">
              <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 mb-5 flex items-center justify-center overflow-hidden shadow-glass rounded-2xl">
                 {currentUser?.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : <UserIcon size={64} className="text-gray-400"/>}
              </div>
              <h2 className="text-3xl font-bold dark:text-white tracking-tight ">{currentUser?.username}</h2>
              <p className="text-gray-500 font-bold mb-4">{currentUser?.email}</p>
              
              <div className={`px-6 py-2 border border-gray-200 dark:border-gray-700 font-bold text-xs  tracking-[0.2em] shadow-md rounded-xl ${
                  currentUser?.kycStatus === 'VERIFIED' 
                  ? 'bg-green-400 text-slate-900 dark:text-white' 
                  : currentUser?.kycStatus === 'PENDING'
                  ? 'bg-orange-400 text-slate-900 dark:text-white'
                  : currentUser?.kycStatus === 'REJECTED'
                  ? 'bg-red-500 text-white'
                  : 'bg-yellow-400 text-slate-900 dark:text-white'
              }`}>
                {currentUser?.kycStatus === 'VERIFIED' ? 'Verified Citizen' : 
                 currentUser?.kycStatus === 'PENDING' ? 'Verification Pending' :
                 currentUser?.kycStatus === 'REJECTED' ? 'Verification Rejected' :
                 'Verification Needed'}
              </div>
           </div>
    
           <div className="space-y-4">
              {currentUser?.role === UserRole.ADMIN && (
                  <button 
                    onClick={() => setView('admin')} 
                    className="w-full p-5 bg-red-600 text-white font-bold text-lg  tracking-wide flex justify-between items-center hover:bg-red-500 hover:shadow-glass rounded-2xl transition-all border border-gray-200 dark:border-gray-700"
                  >
                      <span className="flex items-center gap-4"><ShieldCheck size={24} strokeWidth={3}/> {t.admin_dashboard}</span>
                      <ChevronRight size={24} strokeWidth={3} />
                  </button>
              )}

              {hasRooms && (
                  <button 
                    onClick={() => setView('lister_dashboard')} 
                    className="w-full p-5 bg-brandPrimary text-white font-bold text-lg tracking-wide flex justify-between items-center hover:opacity-90 hover:shadow-glass rounded-2xl transition-all border border-gray-200 dark:border-gray-700"
                  >
                      <span className="flex items-center gap-4"><Home size={24} strokeWidth={3}/> {t.your_rooms}</span>
                      <ChevronRight size={24} strokeWidth={3} />
                  </button>
              )}
    
              <button 
                 onClick={handleListRoom} 
                 className="w-full p-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 dark:text-white font-bold text-lg  tracking-wide flex justify-between items-center hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all border border-transparent hover:border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl"
              >
                  <span className="flex items-center gap-4"><Plus size={24} strokeWidth={3}/> {t.list_a_room}</span>
                  <ChevronRight size={24} strokeWidth={3} />
              </button>

          {currentUser?.kycStatus === 'NOT_STARTED' || currentUser?.kycStatus === 'REJECTED' ? (
             <button onClick={() => setShowKYC(true)} className="w-full p-5 glass border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white font-bold  tracking-wide flex justify-between items-center hover:bg-white/50 dark:hover:bg-gray-800 transition-colors shadow-glass rounded-2xl hover:shadow-none hover:translate-x-1 hover:translate-y-1">
                <span className="flex items-center gap-4"><UploadCloud size={24}/> {t.verify_kyc}</span>
                <span className="text-xs bg-gradient-to-r from-brandPrimary to-brandSecondary text-white border border-gray-200 dark:border-gray-700 px-3 py-1 font-bold">REQUIRED</span>
             </button>
          ) : null}

          {currentUser?.kycStatus === 'PENDING' && (
              <div className="w-full p-5 bg-orange-100 border border-orange-400 text-orange-800 font-bold  text-center text-sm">
                  Documents submitted. Waiting for Admin review.
              </div>
          )}

          <div className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-8 space-y-3">
             <button onClick={() => setLang(lang === 'en' ? 'np' : 'en')} className="w-full p-4 glass border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left font-bold dark:text-white flex justify-between items-center shadow-md">
                <span className="flex items-center gap-3"><Languages size={20}/> {t.language}</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white tracking-wide text-gray-500">{lang === 'en' ? 'English' : 'नेपाली'}</span>
             </button>
             <button 
                onClick={() => {
                  document.documentElement.classList.toggle('dark');
                }} 
                className="w-full p-4 glass border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left font-bold dark:text-white flex justify-between items-center shadow-md"
             >
                <span className="flex items-center gap-3"><Moon size={20}/> {t.appearance}</span>
                <span className="text-sm font-bold text-gray-500 tracking-wide text-gray-500">Toggle</span>
             </button>
             <button onClick={async () => {
                await db.logout();
             }} className="w-full p-4 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 font-bold flex justify-between items-center mt-6 border border-red-100 hover:border-red-500 shadow-md">
                 <span className="flex items-center gap-3"><LogOut size={20}/> {t.sign_out}</span>
             </button>
          </div>
       </div>
    </div>
  );
};

const RoomDetailModal = ({ room, user, t, onClose, onRent, onKYCRequired }: { room: Room, user: User, t: any, onClose: () => void, onRent: () => void, onKYCRequired: () => void }) => {
    const [msg, setMsg] = useState('');

    const handlePaymentRequest = (provider: 'esewa' | 'khalti') => {
      if (user.kycStatus !== KYCStatus.VERIFIED) {
          onKYCRequired();
          return;
      }

      // Check if room has specific payment info
      const providerId = provider === 'esewa' ? room.paymentInfo?.esewaId : room.paymentInfo?.khaltiId;
      const url = provider === 'esewa' ? 'https://esewa.com.np' : 'https://khalti.com';

      if(providerId) {
          setMsg(`Owner's ${provider} ID: ${providerId} copied! Redirecting to ${provider}...`);
          setTimeout(() => {
              window.open(url, '_blank');
              onRent();
          }, 1500);
      } else {
          setMsg(`Redirecting to ${provider} for manual transfer...`);
          setTimeout(() => {
              window.open(url, '_blank');
              onRent();
          }, 1500);
      }
    };
  
    return (
      <div className="fixed inset-0 z-50 bg-brandLight dark:bg-brandDark overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300">
        {msg && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl font-bold text-sm animate-in fade-in slide-in-from-top-4">
                {msg}
            </div>
        )}
        <div className="relative h-[45vh]">
          <img src={room.images[0]} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-slate-900/30"></div>
          
          <button onClick={onClose} className="absolute top-4 right-4 bg-white text-slate-900 dark:text-white p-2 rounded-full hover:scale-110 border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl transition-all z-20"><X size={24} /></button>
          
          {room.isExample && (
               <div className="absolute top-4 left-4 bg-red-600 text-white px-4 py-2 font-bold tracking-wide text-gray-500 border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl z-20">
                  Example Listing
               </div>
          )}
  
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent">
              <h1 className="text-3xl md:text-5xl font-bold text-white  leading-none mb-2 drop-shadow-lg">{room.title}</h1>
              <p className="text-brandPrimary flex items-center gap-2 font-bold tracking-wide text-lg drop-shadow-md"><MapPin size={20} strokeWidth={3} /> {room.location}</p>
          </div>
        </div>
        
        <div className="p-6 pb-40 max-w-3xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 border-b border-gray-200 dark:border-gray-700 pb-6 gap-4">
              <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400  font-bold tracking-wider mb-1">{t.monthly_rent}</p>
                  <span className="text-5xl font-bold text-slate-900 dark:text-white drop-shadow-md">NPR {room.price.toLocaleString()}</span>
              </div>
              <div className="flex gap-2">
                 <button onClick={onRent} className="bg-blue-600 text-white px-6 py-3 font-bold text-sm tracking-wide text-gray-500 border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl hover:translate-y-1 hover:shadow-none transition-all flex items-center gap-2">
                    <MessageCircle size={18} /> {t.chat}
                 </button>
                 <div className="bg-slate-900 text-white px-4 py-3 font-bold text-sm tracking-wide text-gray-500 border border-gray-200 dark:border-gray-700">
                    {t.verified_owner}
                 </div>
              </div>
          </div>
          
          <h3 className="font-bold text-3xl mb-4 dark:text-white  tracking-tight decoration-brandPrimary underline decoration-4 underline-offset-4">{t.about_this_place}</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-10 leading-relaxed text-xl font-medium">{room.description}</p>
  
          <h3 className="font-bold text-3xl mb-4 dark:text-white  tracking-tight decoration-brandPrimary underline decoration-4 underline-offset-4">{t.amenities}</h3>
          <div className="flex flex-wrap gap-3 mb-10">
            {room.features.map(f => (
              <span key={f} className="glass border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm dark:text-gray-200  font-bold tracking-wide shadow-md rounded-xl">{f.replace('_', ' ')}</span>
            ))}
          </div>

          <div className="bg-gray-100 dark:bg-slate-900/20 p-6 border border-dashed border-gray-400 mb-8">
               <h3 className="font-bold  mb-3 flex items-center gap-2 dark:text-white"><DollarSign size={16}/> {t.payment_methods}</h3>
               <div className="flex gap-4">
                   {room.paymentInfo?.esewaId && <span className="bg-[#60bb46] text-white px-3 py-1 text-xs font-bold ">eSewa Available</span>}
                   {room.paymentInfo?.khaltiId && <span className="bg-[#5c2d91] text-white px-3 py-1 text-xs font-bold ">Khalti Available</span>}
                   {!room.paymentInfo?.esewaId && !room.paymentInfo?.khaltiId && <span className="text-gray-500 text-xs font-bold ">Cash on Delivery / Negotiable</span>}
               </div>
          </div>

          {(room.contactDetails?.phone || room.contactDetails?.facebookLink) && (
              <div className="bg-gray-100 dark:bg-slate-900/20 p-6 border border-dashed border-gray-400">
                  <h3 className="font-bold  mb-3 flex items-center gap-2 dark:text-white"><UserIcon size={16}/> Contact Details</h3>
                  <div className="flex flex-col gap-3">
                      {room.contactDetails.phone && (
                          <div className="flex items-center gap-2">
                              <span className="text-gray-500 font-bold text-sm">Phone:</span>
                              <a href={`tel:${room.contactDetails.phone}`} className="text-brandPrimary font-bold hover:underline">{room.contactDetails.phone}</a>
                          </div>
                      )}
                      {room.contactDetails.facebookLink && (
                          <div className="flex items-center gap-2">
                              <span className="text-gray-500 font-bold text-sm">Facebook:</span>
                              <a href={room.contactDetails.facebookLink} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline break-all">{room.contactDetails.facebookLink}</a>
                          </div>
                      )}
                  </div>
              </div>
          )}
        </div>
  
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-brandDark border-t border-gray-200 dark:border-gray-700 z-40">
          <div className="max-w-3xl mx-auto">
              <button 
                onClick={onRent} 
                className="w-full bg-brandPrimary hover:bg-brandSecondary text-white py-4 font-bold flex items-center justify-center gap-2 tracking-wide border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl active:translate-y-1 active:shadow-none transition-all"
              >
                  <MessageCircle size={20} /> Rent
              </button>
          </div>
        </div>
      </div>
    );
  };

// --- MAIN APP COMPONENT ---

const App = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [view, setView] = useState('explore'); 
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showKYC, setShowKYC] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [lang, setLang] = useState<'en' | 'np'>('en');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  
  // Search State hoisted to App to persist between tabs
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  
  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    priceRange: [0, 100000],
    features: []
  });

  // Pull to refresh state
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef(0);
  const mainRef = useRef<HTMLElement>(null);

  const t = TRANSLATIONS[lang];

  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const onboarded = localStorage.getItem('gharpeti_onboarded');
    if (onboarded) setIsOnboarded(true);

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(firestore, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          setCurrentUser(userData);
          // Update online status
          db.updateOnlineStatus(firebaseUser.uid, true);
          
          // Set up visibility change listener for online status
          const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
              db.updateOnlineStatus(firebaseUser.uid, true);
            } else {
              db.updateOnlineStatus(firebaseUser.uid, false);
            }
          };
          document.addEventListener('visibilitychange', handleVisibilityChange);
          window.addEventListener('beforeunload', () => db.updateOnlineStatus(firebaseUser.uid, false));
        }
      } else {
        if (currentUser) {
          db.updateOnlineStatus(currentUser.id, false);
        }
        setCurrentUser(null);
      }
      setIsAuthReady(true);
    });

    const unsubscribeRooms = onSnapshot(collection(firestore, 'rooms'), (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setRooms(roomsData);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeRooms();
    };
  }, []);

  const handleFinishOnboarding = () => {
    localStorage.setItem('gharpeti_onboarded', 'true');
    setIsOnboarded(true);
  };

  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room);
  };

  const handleListRoom = () => {
    setEditingRoom(null);
    if (currentUser?.kycStatus !== KYCStatus.VERIFIED) {
        setShowKYC(true);
    } else {
        setShowAddRoom(true);
    }
  }

  const handleSaveRoom = (room: Room) => {
      // Rooms are auto-updated via onSnapshot
      setEditingRoom(null);
  }

  const handleRent = async (room: Room) => {
      if (!currentUser) return;
      if (currentUser.kycStatus !== KYCStatus.VERIFIED) {
          setShowKYC(true);
          return;
      }
      try {
          const chat = await db.createOrGetChat(currentUser.id, room.ownerId, room.id, room.title);
          setSelectedChat(chat);
          setView('inbox');
          setSelectedRoom(null);
      } catch (error) {
          console.error("Failed to start chat", error);
      }
  };

  const performSearch = async () => {
    setIsSearching(true);
    const allRooms = rooms;
    
    // 1. AI/Text Search
    let matchedRoomIds: string[] = [];
    if (!searchQuery.trim()) {
      matchedRoomIds = allRooms.map(r => r.id);
    } else {
      matchedRoomIds = await searchRoomsWithAI(searchQuery, allRooms);
    }

    // 2. Filter & Sort
    let results = allRooms.filter(r => matchedRoomIds.includes(r.id));
    
    // Apply filters
    results = results.filter(r => {
        const matchesPrice = r.price <= filters.priceRange[1];
        const matchesFeatures = filters.features.length === 0 || filters.features.every(f => r.features.includes(f));
        return matchesPrice && matchesFeatures;
    });

    // Sort by AI relevance if searched
    if (searchQuery.trim()) {
        results.sort((a, b) => matchedRoomIds.indexOf(a.id) - matchedRoomIds.indexOf(b.id));
    }

    setRooms(results);
    setIsSearching(false);
  };

  // --- Pull to Refresh Handlers ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((mainRef.current && mainRef.current.scrollTop > 0) || view === 'map') return;
    touchStartRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if ((mainRef.current && mainRef.current.scrollTop > 0) || view === 'map') return;
    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStartRef.current;
    
    // Only allow pulling down
    if (diff > 0) {
        // Add resistance
        setPullY(diff * 0.4);
    }
  };

  const handleTouchEnd = () => {
    if (view === 'map') return;
    if (pullY > 80) { // Threshold
        handleRefresh();
    }
    setPullY(0);
  };

  const handleRefresh = async () => {
      setIsRefreshing(true);
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 1500));
      // Refresh rooms from source of truth
      // Rooms are auto-updated via onSnapshot
      // Reset search if in search view, but keep query in input
      if (view === 'search' && searchQuery) {
          // Optional: re-run search logic here if desired
          // performSearch(); 
      }
      setIsRefreshing(false);
  };

  if (!isOnboarded) return <Onboarding onFinish={handleFinishOnboarding} />;
  if (!currentUser) return <Auth onLogin={setCurrentUser} />;

  return (
    <div className="h-screen bg-brandLight dark:bg-slate-900 font-sans flex justify-center text-slate-900 dark:text-white overflow-hidden">
      {/* Content */}
      <main 
        ref={mainRef}
        className="w-full max-w-lg bg-brandLight dark:bg-brandDark h-screen shadow-2xl relative border-x-2 border-gray-300 dark:border-gray-800 overflow-y-auto touch-pan-y"
        style={{ overscrollBehaviorY: 'contain' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Refresh Indicator */}
        <div 
            className="absolute top-0 left-0 right-0 h-20 flex items-center justify-center bg-gradient-to-r from-brandPrimary to-brandSecondary text-white border-b border-gray-200 dark:border-gray-700 z-10"
            style={{ 
                transform: `translateY(${isRefreshing ? '0px' : (pullY > 0 ? -80 + pullY : '-100%')})`,
                transition: isRefreshing ? 'transform 0.3s ease-out' : 'none'
            }}
        >
            <div className="flex flex-col items-center">
                 {isRefreshing ? (
                     <>
                       <div className="w-6 h-6 border border-gray-200 dark:border-gray-700 border-t-transparent rounded-full animate-spin mb-1"></div>
                       <span className="font-bold text-xs tracking-wide text-gray-500 text-slate-900 dark:text-white">Refreshing...</span>
                     </>
                 ) : (
                     <>
                        <div className={`transition-transform duration-300 ${pullY > 80 ? 'rotate-180' : ''}`}>
                            <ArrowDown size={24} className="text-slate-900 dark:text-white" strokeWidth={4} />
                        </div>
                        <span className="font-bold text-xs tracking-wide text-gray-500 text-slate-900 dark:text-white">
                            {pullY > 80 ? "Release" : "Pull Down"}
                        </span>
                     </>
                 )}
            </div>
        </div>

        {/* Scrollable Content Container */}
        <div 
            style={{ 
                transform: `translateY(${isRefreshing ? '80px' : (pullY > 0 ? `${pullY}px` : '0px')})`,
                transition: isRefreshing || pullY === 0 ? 'transform 0.3s ease-out' : 'none'
            }}
            className="min-h-screen"
        >
            {view === 'explore' && (
                <ExploreView 
                    rooms={rooms} 
                    currentUser={currentUser} 
                    setView={setView} 
                    handleRoomClick={handleRoomClick} 
                    t={t} 
                />
            )}
            {view === 'map' && <MapView rooms={rooms} handleRoomClick={handleRoomClick} />}
            {view === 'search' && (
                <SearchView 
                    rooms={rooms} 
                    searchQuery={searchQuery} 
                    setSearchQuery={setSearchQuery} 
                    isSearching={isSearching} 
                    performSearch={performSearch} 
                    handleRoomClick={handleRoomClick} 
                    t={t}
                    filters={filters}
                    setFilters={setFilters}
                    showFilters={showFilters}
                    setShowFilters={setShowFilters}
                />
            )}
            {view === 'inbox' && (
                <InboxView 
                    currentUser={currentUser} 
                    onSelectChat={(chat) => setSelectedChat(chat)} 
                />
            )}
            {view === 'profile' && (
                <ProfileView 
                    currentUser={currentUser} 
                    handleListRoom={handleListRoom} 
                    setShowKYC={setShowKYC} 
                    lang={lang} 
                    setLang={setLang}
                    setView={setView}
                    t={t}
                    rooms={rooms}
                />
            )}
            {view === 'lister_dashboard' && (
                <ListerDashboard 
                    rooms={rooms.filter(r => r.ownerId === currentUser.id)} 
                    onEdit={(room) => {
                        setEditingRoom(room);
                        setShowAddRoom(true);
                    }}
                    onDelete={async (roomId) => {
                        try {
                            await db.deleteRoom(roomId);
                        } catch (error) {
                            console.error("Delete failed", error);
                        }
                    }}
                    t={t}
                />
            )}
            {view === 'admin' && (
                <AdminDashboard currentUser={currentUser} />
            )}
        </div>
      </main>

      {/* Bottom Nav */}
      {!selectedChat && (
        <div className="fixed bottom-0 left-0 right-0 glass border-t border-gray-200 dark:border-gray-700 dark:border-brandPrimary z-40 max-w-lg mx-auto shadow-[0px_-4px_0px_rgba(0,0,0,0.1)]">
          <div className="flex justify-around items-center h-20 pb-2">
            <button onClick={() => setView('explore')} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${view === 'explore' ? 'text-slate-900 dark:text-white dark:text-brandPrimary bg-gray-100 dark:bg-white/10 border-t-4 border-brandPrimary' : 'text-gray-400 border-t-4 border-transparent'}`}>
              <Home size={24} strokeWidth={view === 'explore' ? 3 : 2} className="mb-1" />
              <span className="text-[10px] font-bold tracking-wide text-gray-500">{t.home}</span>
            </button>
            <button onClick={() => setView('map')} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${view === 'map' ? 'text-slate-900 dark:text-white dark:text-brandPrimary bg-gray-100 dark:bg-white/10 border-t-4 border-brandPrimary' : 'text-gray-400 border-t-4 border-transparent'}`}>
              <MapIcon size={24} strokeWidth={view === 'map' ? 3 : 2} className="mb-1" />
              <span className="text-[10px] font-bold tracking-wide text-gray-500">{t.map}</span>
            </button>
            
            <div className="relative -top-10">
               <button onClick={() => setView('search')} className="bg-gradient-to-r from-brandPrimary to-brandSecondary text-white p-5 border border-gray-200 dark:border-gray-700 shadow-glass rounded-2xl hover:shadow-none hover:translate-y-1 transition-all group">
                  <Search size={32} strokeWidth={3} className="group-hover:rotate-12 transition-transform duration-300" />
               </button>
            </div>

            <button onClick={() => { setView('inbox'); setSelectedChat(null); }} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${view === 'inbox' ? 'text-slate-900 dark:text-white dark:text-brandPrimary bg-gray-100 dark:bg-white/10 border-t-4 border-brandPrimary' : 'text-gray-400 border-t-4 border-transparent'}`}>
              <MessageCircle size={24} strokeWidth={view === 'inbox' ? 3 : 2} className="mb-1" />
              <span className="text-[10px] font-bold tracking-wide text-gray-500">Inbox</span>
            </button>
            <button onClick={() => setView('profile')} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${view === 'profile' || view === 'admin' ? 'text-slate-900 dark:text-white dark:text-brandPrimary bg-gray-100 dark:bg-white/10 border-t-4 border-brandPrimary' : 'text-gray-400 border-t-4 border-transparent'}`}>
              <UserIcon size={24} strokeWidth={view === 'profile' || view === 'admin' ? 3 : 2} className="mb-1" />
               <span className="text-[10px] font-bold tracking-wide text-gray-500">{t.profile}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showKYC && (
        <KYCModal 
          user={currentUser} 
          onClose={() => setShowKYC(false)} 
          onSuccess={(updated) => {
             setCurrentUser(updated);
             setShowKYC(false);
          }} 
        />
      )}

      {showAddRoom && currentUser && (
        <RoomFormModal 
            user={currentUser} 
            onClose={() => {
                setShowAddRoom(false);
                setEditingRoom(null);
            }} 
            onSave={handleSaveRoom}
            editingRoom={editingRoom || undefined}
        />
      )}

      {selectedRoom && (
        <RoomDetailModal 
          room={selectedRoom} 
          user={currentUser} 
          t={t}
          onClose={() => setSelectedRoom(null)} 
          onRent={() => handleRent(selectedRoom)}
          onKYCRequired={() => setShowKYC(true)}
        />
      )}

      {selectedChat && (
          <div className="fixed inset-0 z-50 flex justify-center pointer-events-none">
              <div className="w-full max-w-lg pointer-events-auto relative h-screen border-x-2 border-gray-300 dark:border-gray-800 shadow-2xl overflow-hidden">
                  <ChatView 
                      currentUser={currentUser} 
                      chat={selectedChat} 
                      onBack={() => setSelectedChat(null)} 
                  />
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
