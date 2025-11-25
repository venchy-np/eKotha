
import React, { useState, useEffect } from 'react';
import { Home, Map as MapIcon, Search, Bell, User as UserIcon, LogOut, Moon, Languages, Plus, CheckCircle, X, ChevronRight, UploadCloud, Info, SlidersHorizontal, MessageCircle, MapPin, DollarSign, Image as ImageIcon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

import { User, Room, KYCStatus } from './types';
import { MOCK_ROOMS, TRANSLATIONS } from './constants';
import { db } from './services/db';
import { searchRoomsWithAI } from './services/geminiService';
import KYCModal from './components/KYCModal';

// --- Types for Filters ---
interface SearchFilters {
  priceRange: [number, number];
  features: string[];
}

const ALL_FEATURES = ['wifi', 'kitchen', 'balcony', 'parking', 'water_24h', 'attached_bathroom', 'furnished', 'ac'];

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

// --- Components Defined OUTSIDE App to fix re-rendering focus loss ---

const Onboarding = ({ onFinish }: { onFinish: () => void }) => {
  const [slide, setSlide] = useState(0);
  const slides = [
    { title: "eKotha: Rooms in Nepal", desc: "Find your perfect space. Rent with ease.", img: "https://picsum.photos/400/400?random=10" },
    { title: "Browse Listings", desc: "Apartments, flats, and single rooms available now.", img: "https://picsum.photos/400/400?random=11" },
    { title: "Interactive Maps", desc: "Locate rooms near your college or workplace.", img: "https://picsum.photos/400/400?random=12" },
    { title: "AI Recommendations", desc: "Our AI finds the best matches for your needs.", img: "https://picsum.photos/400/400?random=13" },
    { title: "Local Payments", desc: "Securely pay via eSewa or Khalti.", img: "https://picsum.photos/400/400?random=14" }
  ];

  return (
    <div className="h-screen flex flex-col bg-brandLight dark:bg-brandBlack">
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-64 h-64 mb-8 relative group">
             <div className="absolute inset-0 bg-brandYellow translate-x-3 translate-y-3 border-2 border-black dark:border-white shadow-neo"></div>
             <img src={slides[slide].img} alt="Onboarding" className="w-full h-full object-cover grayscale relative z-10 border-2 border-black dark:border-white" />
        </div>
        <h1 className="text-4xl font-black text-brandBlack dark:text-brandYellow mb-4 uppercase tracking-tighter [text-shadow:2px_2px_0px_rgba(0,0,0,0.2)]">{slides[slide].title}</h1>
        <p className="text-gray-600 dark:text-gray-400 text-xl font-bold">{slides[slide].desc}</p>
      </div>
      <div className="p-8">
        <div className="flex justify-center gap-3 mb-8">
          {slides.map((_, i) => (
            <div key={i} className={`h-3 border-2 border-black transition-all ${i === slide ? 'w-10 bg-brandYellow' : 'w-3 bg-white'}`} />
          ))}
        </div>
        <button 
          onClick={() => {
            if (slide < slides.length - 1) setSlide(slide + 1);
            else onFinish();
          }}
          className="w-full py-4 bg-brandYellow text-black font-black text-xl hover:bg-yellow-400 transition-all uppercase border-2 border-black shadow-neo active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          {slide === slides.length - 1 ? 'Get Started' : 'Next'}
        </button>
        {slide < slides.length - 1 && (
          <button onClick={onFinish} className="w-full py-4 mt-2 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-sm hover:text-black dark:hover:text-white">Skip Intro</button>
        )}
      </div>
    </div>
  );
};

const Auth = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      const user = db.login(email, password);
      if (user) onLogin(user);
      else setError('Invalid credentials');
    } else {
      const newUser: User = {
        id: Date.now().toString(),
        username: name,
        email,
        passwordHash: btoa(password),
        role: 'SEEKER' as any,
        kycStatus: KYCStatus.NOT_STARTED,
      };
      db.saveUser(newUser);
      db.login(email, password);
      onLogin(newUser);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center p-6 bg-brandLight dark:bg-brandBlack">
      <div className="w-full max-w-md bg-white dark:bg-brandGray p-8 border-2 border-black dark:border-white shadow-neo dark:shadow-neo-yellow">
        <h2 className="text-4xl font-black text-center mb-8 text-brandBlack dark:text-white uppercase tracking-tighter">
          {isLogin ? 'Login' : 'Sign Up'}
        </h2>
        {error && <p className="text-red-600 mb-6 bg-red-100 p-3 font-bold border-2 border-red-500">{error}</p>}
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <input 
              type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required 
              className="w-full p-4 border-2 border-black dark:border-white bg-gray-50 dark:bg-black/40 dark:text-white focus:bg-yellow-50 outline-none font-bold"
            />
          )}
          <input 
            type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required 
            className="w-full p-4 border-2 border-black dark:border-white bg-gray-50 dark:bg-black/40 dark:text-white focus:bg-yellow-50 outline-none font-bold"
          />
          <input 
            type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required 
            className="w-full p-4 border-2 border-black dark:border-white bg-gray-50 dark:bg-black/40 dark:text-white focus:bg-yellow-50 outline-none font-bold"
          />
          <button type="submit" className="w-full py-4 bg-brandYellow text-black font-black text-xl hover:bg-yellow-400 transition-all uppercase border-2 border-black shadow-neo active:translate-x-1 active:translate-y-1 active:shadow-none mt-4">
            {isLogin ? 'Enter App' : 'Create Account'}
          </button>
        </form>
        <div className="text-center mt-8 pt-6 border-t-2 border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-gray-600 dark:text-gray-300 font-bold mb-2">
            {isLogin ? "New to eKotha?" : "Have an account?"}
          </p>
          <button onClick={() => setIsLogin(!isLogin)} className="text-brandBlack dark:text-brandYellow font-black uppercase tracking-wide hover:underline text-lg decoration-4 decoration-brandYellow underline-offset-4">
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AddRoomModal = ({ user, onClose, onAdd }: { user: User, onClose: () => void, onAdd: (room: Room) => void }) => {
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [features, setFeatures] = useState<string[]>([]);
    const [esewaId, setEsewaId] = useState('');
    const [khaltiId, setKhaltiId] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newRoom: Room = {
            id: Date.now().toString(),
            ownerId: user.id,
            title,
            description,
            price: parseInt(price),
            location,
            lat: 27.7172 + (Math.random() - 0.5) * 0.1, // Random nearby lat
            lng: 85.3240 + (Math.random() - 0.5) * 0.1, // Random nearby lng
            features,
            images: ['https://picsum.photos/600/400?random=' + Date.now()],
            isAvailable: true,
            isExample: false,
            paymentInfo: {
                esewaId: esewaId || undefined,
                khaltiId: khaltiId || undefined
            }
        };
        db.addRoom(newRoom);
        onAdd(newRoom);
        onClose();
    };

    const toggleFeature = (f: string) => {
        setFeatures(prev => prev.includes(f) ? prev.filter(item => item !== f) : [...prev, f]);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center p-4 md:p-6 overflow-y-auto">
            <div className="bg-white dark:bg-brandGray w-full max-w-xl border-2 border-black dark:border-white shadow-neo animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-center p-4 border-b-2 border-black dark:border-white">
                    <h2 className="text-2xl font-black uppercase dark:text-white">List a Room</h2>
                    <button onClick={onClose}><X size={24} className="dark:text-white"/></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
                    <div>
                        <label className="block text-xs font-black uppercase mb-1 dark:text-gray-300">Room Title</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-3 border-2 border-black font-bold outline-none focus:bg-yellow-50" placeholder="e.g. Sunny Single Room"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase mb-1 dark:text-gray-300">Price (NPR)</label>
                            <input type="number" value={price} onChange={e => setPrice(e.target.value)} required className="w-full p-3 border-2 border-black font-bold outline-none focus:bg-yellow-50" placeholder="15000"/>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase mb-1 dark:text-gray-300">Location</label>
                            <input value={location} onChange={e => setLocation(e.target.value)} required className="w-full p-3 border-2 border-black font-bold outline-none focus:bg-yellow-50" placeholder="e.g. Koteshwor"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase mb-1 dark:text-gray-300">Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={3} className="w-full p-3 border-2 border-black font-bold outline-none focus:bg-yellow-50" placeholder="Details about the room..."/>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-black uppercase mb-2 dark:text-gray-300">Features</label>
                        <div className="flex flex-wrap gap-2">
                            {ALL_FEATURES.map(f => (
                                <button type="button" key={f} onClick={() => toggleFeature(f)} className={`px-2 py-1 text-xs font-bold border-2 uppercase ${features.includes(f) ? 'bg-brandYellow border-black text-black' : 'border-gray-300 text-gray-500'}`}>
                                    {f.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gray-100 dark:bg-black/20 p-4 border-2 border-dashed border-gray-400">
                        <h3 className="font-black uppercase mb-3 flex items-center gap-2 dark:text-white"><DollarSign size={16}/> Payment Details</h3>
                        <p className="text-xs text-gray-500 mb-3">Add your wallet IDs so tenants can pay you directly.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase mb-1 text-[#60bb46]">eSewa ID (Mobile)</label>
                                <input value={esewaId} onChange={e => setEsewaId(e.target.value)} className="w-full p-2 border-2 border-gray-300 focus:border-[#60bb46] font-bold outline-none" placeholder="98XXXXXXXX"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase mb-1 text-[#5c2d91]">Khalti ID (Mobile)</label>
                                <input value={khaltiId} onChange={e => setKhaltiId(e.target.value)} className="w-full p-2 border-2 border-gray-300 focus:border-[#5c2d91] font-bold outline-none" placeholder="98XXXXXXXX"/>
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="w-full py-4 bg-brandYellow text-black font-black uppercase border-2 border-black shadow-neo active:translate-y-1 active:shadow-none hover:bg-yellow-400">
                        List Room Now
                    </button>
                </form>
            </div>
        </div>
    );
};

const RoomCard: React.FC<{ room: Room, t: any, onClick: () => void }> = ({ room, t, onClick }) => (
  <div onClick={onClick} className="bg-white dark:bg-brandGray cursor-pointer border-2 border-black dark:border-gray-500 hover:border-brandYellow dark:hover:border-brandYellow transition-all duration-200 group relative shadow-neo-sm hover:shadow-neo hover:-translate-y-1">
    <div className="h-56 relative overflow-hidden border-b-2 border-black dark:border-gray-500">
      <img src={room.images[0]} alt={room.title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
      
      <div className="absolute top-3 left-3 bg-brandYellow text-black px-3 py-1 text-xs font-black uppercase tracking-wider border-2 border-black shadow-sm z-10">
        Available
      </div>
      
      {room.isExample && (
        <div className="absolute top-3 right-3 bg-red-600 text-white px-3 py-1 text-xs font-black uppercase tracking-widest border-2 border-white shadow-sm z-10">
          Example
        </div>
      )}

      <div className="absolute bottom-0 left-0 bg-black text-white px-4 py-2 border-t-2 border-r-2 border-black font-black text-lg">
        NPR {room.price.toLocaleString()}
      </div>
    </div>
    <div className="p-4">
      <h3 className="font-black text-xl text-brandBlack dark:text-white mb-2 leading-tight uppercase line-clamp-1">{room.title}</h3>
      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 flex items-center gap-2 font-bold uppercase tracking-wide">
         <MapPin size={16} className="text-black dark:text-brandYellow" /> {room.location}
      </p>
      <div className="flex flex-wrap gap-2">
        {room.features.slice(0, 3).map((f, i) => (
          <span key={i} className="text-[10px] font-bold bg-gray-100 dark:bg-black border border-black dark:border-gray-500 text-black dark:text-gray-300 px-2 py-1 uppercase">{f.replace('_', ' ')}</span>
        ))}
      </div>
    </div>
  </div>
);

// --- VIEW COMPONENTS ---

const ExploreView = ({ rooms, currentUser, setView, handleRoomClick, t }: any) => (
  <div className="pb-24 p-5 max-w-5xl mx-auto">
    <div className="flex justify-between items-center mb-8 mt-4 border-b-4 border-brandBlack dark:border-brandYellow pb-4">
      <div>
        <h1 className="text-4xl font-black text-brandBlack dark:text-white uppercase tracking-tighter [text-shadow:3px_3px_0px_#FFD700] dark:[text-shadow:3px_3px_0px_#444]">eKotha<span className="text-brandYellow text-5xl leading-none">.</span></h1>
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Rent Rooms in Nepal</p>
      </div>
      <button onClick={() => setView('profile')} className="w-14 h-14 bg-white dark:bg-gray-800 hover:bg-brandYellow transition-colors flex items-center justify-center border-2 border-black shadow-neo overflow-hidden">
          {currentUser?.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : <UserIcon size={28} className="text-black dark:text-white"/>}
      </button>
    </div>

    <div className="mb-6">
      <h2 className="text-2xl font-black uppercase mb-4 dark:text-white">Featured Rooms</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room: Room) => (
          <RoomCard key={room.id} room={room} t={t} onClick={() => handleRoomClick(room)} />
        ))}
      </div>
    </div>
  </div>
);

const MapView = ({ rooms, handleRoomClick }: any) => {
    const center: [number, number] = [27.7172, 85.3240]; 
    return (
        <div className="h-[calc(100vh-80px)] w-full relative z-0">
            <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
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
            
            <div className="absolute top-4 left-4 z-[400] bg-white border-2 border-black p-4 shadow-neo max-w-xs">
                <h3 className="font-black uppercase text-lg mb-1">Interactive Map</h3>
                <p className="text-xs font-bold text-gray-500">Tap markers to view details.</p>
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
      <h2 className="text-5xl font-black mb-8 dark:text-white uppercase tracking-tighter [text-shadow:4px_4px_0px_rgba(0,0,0,0.1)]">{t.search}</h2>
      
      {/* Search Bar */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex border-2 border-black dark:border-white shadow-neo bg-white dark:bg-black">
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
          className={`px-4 bg-white dark:bg-gray-800 border-2 border-black dark:border-white shadow-neo hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all ${showFilters ? 'bg-brandYellow dark:bg-brandYellow text-black' : 'text-black dark:text-white'}`}
        >
          <SlidersHorizontal size={24} strokeWidth={2.5} />
        </button>
        <button 
          onClick={performSearch}
          disabled={isSearching}
          className="bg-brandYellow text-black px-6 font-black hover:bg-yellow-400 disabled:opacity-50 uppercase tracking-widest border-2 border-black dark:border-white shadow-neo active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
        >
          {isSearching ? <span className="animate-spin block">⏳</span> : <Search size={28} strokeWidth={3} />}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-8 p-6 bg-white dark:bg-brandGray border-2 border-black dark:border-white shadow-neo animate-in slide-in-from-top-2 duration-200">
           <div className="flex justify-between items-center mb-4">
              <h3 className="font-black uppercase text-lg dark:text-white">Filters</h3>
              <button onClick={() => setFilters({priceRange: [0, 100000], features: []})} className="text-xs font-bold text-red-500 uppercase hover:underline">Reset</button>
           </div>
           
           <div className="mb-4">
             <label className="block text-xs font-black uppercase mb-2 dark:text-gray-300">Max Price: NPR {filters.priceRange[1].toLocaleString()}</label>
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
             <label className="block text-xs font-black uppercase mb-2 dark:text-gray-300">Amenities</label>
             <div className="flex flex-wrap gap-2">
                {ALL_FEATURES.map(f => (
                  <button 
                    key={f}
                    onClick={() => toggleFeature(f)}
                    className={`px-3 py-1 border-2 text-xs font-bold uppercase transition-all ${
                      filters.features.includes(f) 
                      ? 'bg-brandYellow border-black text-black shadow-neo-sm' 
                      : 'bg-white dark:bg-black border-gray-300 dark:border-gray-600 text-gray-500 hover:border-black'
                    }`}
                  >
                    {f.replace('_', ' ')}
                  </button>
                ))}
             </div>
           </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6 border-b-2 border-black dark:border-white pb-2">
        <h3 className="font-black text-gray-500 uppercase tracking-widest text-sm">Results ({rooms.length})</h3>
        {searchQuery && <span className="text-[10px] font-black text-black bg-brandYellow px-2 py-1 uppercase border border-black">AI Powered</span>}
      </div>
      
      <div className="grid grid-cols-1 gap-5">
        {rooms.map((room: Room) => (
          <div key={room.id} onClick={() => handleRoomClick(room)} className="flex gap-4 bg-white dark:bg-brandGray p-4 border-2 border-black dark:border-gray-500 hover:border-brandYellow dark:hover:border-brandYellow cursor-pointer transition-all hover:-translate-y-1 hover:shadow-neo group relative">
            {room.isExample && (
                <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider border-b-2 border-l-2 border-white">Example</div>
            )}
            <img src={room.images[0]} className="w-32 h-24 object-cover grayscale group-hover:grayscale-0 border-2 border-black dark:border-gray-400" />
            <div className="flex-1 flex flex-col justify-center">
              <h4 className="font-black text-xl dark:text-white uppercase tracking-tight line-clamp-1 group-hover:text-brandBlack dark:group-hover:text-brandYellow">{room.title}</h4>
              <p className="text-sm text-gray-500 font-bold uppercase mb-2 flex items-center gap-1"><MapPin size={12}/> {room.location}</p>
              <div className="flex justify-between items-center mt-auto">
                 <p className="text-black dark:text-white font-black text-lg bg-brandYellow px-2 -ml-1 transform -skew-x-12">NPR {room.price.toLocaleString()}</p>
                 <ChevronRight size={24} className="text-black dark:text-white group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        ))}
        {rooms.length === 0 && (
          <div className="text-center py-10 opacity-50">
            <Search size={48} className="mx-auto mb-2"/>
            <p className="font-bold uppercase">No rooms found</p>
          </div>
        )}
      </div>
    </div>
  );
};

const NotificationsView = ({ t, currentUser }: any) => (
    <div className="p-6 pb-24 max-w-2xl mx-auto">
      <h2 className="text-5xl font-black mb-8 dark:text-white uppercase tracking-tighter [text-shadow:4px_4px_0px_rgba(0,0,0,0.1)]">{t.notifications}</h2>
      <div className="space-y-6">
        <div className="bg-white dark:bg-brandGray p-6 border-2 border-black dark:border-white shadow-neo flex gap-5 hover:translate-x-1 transition-transform">
          <div className="bg-brandYellow border-2 border-black p-3 h-fit">
             <Bell className="text-black w-6 h-6" />
          </div>
          <div>
            <h4 className="font-black text-xl dark:text-white uppercase mb-1">System Welcome</h4>
            <p className="text-gray-600 dark:text-gray-300 font-bold text-sm">Welcome to eKotha! Find your dream room today.</p>
            <span className="text-xs text-gray-400 mt-2 block font-black uppercase tracking-widest">Just now</span>
          </div>
        </div>
        {currentUser?.kycStatus === 'VERIFIED' && (
            <div className="bg-white dark:bg-brandGray p-6 border-2 border-black dark:border-white shadow-neo flex gap-5 hover:translate-x-1 transition-transform">
                <div className="bg-green-500 border-2 border-black p-3 h-fit">
                    <CheckCircle className="text-white w-6 h-6" />
                </div>
                <div>
                    <h4 className="font-black text-xl dark:text-white uppercase mb-1">KYC Verified</h4>
                    <p className="text-gray-600 dark:text-gray-300 font-bold text-sm">You can now list and rent rooms without restriction.</p>
                     <span className="text-xs text-gray-400 mt-2 block font-black uppercase tracking-widest">Just now</span>
                </div>
            </div>
        )}
        {/* Placeholder for inbox/messages */}
        <div className="bg-white dark:bg-brandGray p-6 border-2 border-black dark:border-white shadow-neo flex gap-5 opacity-60">
             <div className="bg-blue-500 border-2 border-black p-3 h-fit">
                <MessageCircle className="text-white w-6 h-6" />
             </div>
             <div>
                <h4 className="font-black text-xl dark:text-white uppercase mb-1">No New Messages</h4>
                <p className="text-gray-600 dark:text-gray-300 font-bold text-sm">Your conversations with landlords will appear here.</p>
             </div>
        </div>
      </div>
    </div>
  );

const ProfileView = ({ currentUser, handleListRoom, setShowKYC, lang, setLang, setView }: any) => (
    <div className="p-6 pb-24 max-w-xl mx-auto">
       <div className="flex flex-col items-center mb-10 mt-6 relative">
          <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 border-4 border-black dark:border-white mb-5 flex items-center justify-center overflow-hidden shadow-neo">
             {currentUser?.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : <UserIcon size={64} className="text-gray-400"/>}
          </div>
          <h2 className="text-3xl font-black dark:text-white uppercase tracking-tighter [text-shadow:2px_2px_0px_gray]">{currentUser?.username}</h2>
          <p className="text-gray-500 font-bold mb-4">{currentUser?.email}</p>
          
          <div className={`px-6 py-2 border-2 border-black font-black text-xs uppercase tracking-[0.2em] shadow-neo-sm ${
              currentUser?.kycStatus === 'VERIFIED' 
              ? 'bg-green-400 text-black' 
              : 'bg-yellow-400 text-black'
          }`}>
            {currentUser?.kycStatus === 'VERIFIED' ? 'Verified Citizen' : 'Verification Pending'}
          </div>
       </div>

       <div className="space-y-4">
          <button 
             onClick={handleListRoom} 
             className="w-full p-5 bg-brandBlack dark:bg-white text-white dark:text-black font-black text-lg uppercase tracking-wide flex justify-between items-center hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all border-2 border-transparent hover:border-black shadow-neo"
          >
              <span className="flex items-center gap-4"><Plus size={24} strokeWidth={3}/> List a Room</span>
              <ChevronRight size={24} strokeWidth={3} />
          </button>

          {currentUser?.kycStatus !== 'VERIFIED' && (
             <button onClick={() => setShowKYC(true)} className="w-full p-5 bg-white dark:bg-brandGray border-2 border-black dark:border-white text-black dark:text-white font-bold uppercase tracking-wide flex justify-between items-center hover:bg-yellow-50 dark:hover:bg-gray-800 transition-colors shadow-neo hover:shadow-none hover:translate-x-1 hover:translate-y-1">
                <span className="flex items-center gap-4"><UploadCloud size={24}/> Verify KYC</span>
                <span className="text-xs bg-brandYellow border border-black text-black px-3 py-1 font-black">REQUIRED</span>
             </button>
          )}

          <div className="mt-10 border-t-4 border-black dark:border-white pt-8 space-y-3">
             <button onClick={() => setLang(lang === 'en' ? 'np' : 'en')} className="w-full p-4 bg-white dark:bg-brandGray border-2 border-black dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 text-left font-bold dark:text-white flex justify-between items-center shadow-sm">
                <span className="flex items-center gap-3"><Languages size={20}/> Language</span>
                <span className="text-sm font-black text-brandBlack dark:text-brandYellow uppercase tracking-widest">{lang === 'en' ? 'English' : 'नेपाली'}</span>
             </button>
             <button 
                onClick={() => {
                  document.documentElement.classList.toggle('dark');
                }} 
                className="w-full p-4 bg-white dark:bg-brandGray border-2 border-black dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 text-left font-bold dark:text-white flex justify-between items-center shadow-sm"
             >
                <span className="flex items-center gap-3"><Moon size={20}/> Appearance</span>
                <span className="text-sm font-black text-gray-500 uppercase tracking-widest">Toggle</span>
             </button>
             <button onClick={() => {
                db.logout();
                window.location.reload(); // Simple reload to clear state
             }} className="w-full p-4 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 font-bold flex justify-between items-center mt-6 border-2 border-red-100 hover:border-red-500 shadow-sm">
                 <span className="flex items-center gap-3"><LogOut size={20}/> Sign Out</span>
             </button>
          </div>
       </div>
    </div>
);

const RoomDetailModal = ({ room, user, t, onClose, onRent, onKYCRequired }: { room: Room, user: User, t: any, onClose: () => void, onRent: () => void, onKYCRequired: () => void }) => {
    
    const handlePaymentRequest = (provider: 'esewa' | 'khalti') => {
      if (user.kycStatus !== KYCStatus.VERIFIED) {
          onKYCRequired();
          return;
      }

      // Check if room has specific payment info
      const providerId = provider === 'esewa' ? room.paymentInfo?.esewaId : room.paymentInfo?.khaltiId;
      const url = provider === 'esewa' ? 'https://esewa.com.np' : 'https://khalti.com';

      if(providerId) {
          // In a real app we might construct a specific deep link, but for now we redirect
          alert(`Owner's ${provider} ID: ${providerId} copied! Redirecting to ${provider}...`);
          window.open(url, '_blank');
          onRent();
      } else {
          // Fallback if no specific ID is set by owner
          alert(`Redirecting to ${provider} for manual transfer...`);
          window.open(url, '_blank');
          onRent();
      }
    };
  
    return (
      <div className="fixed inset-0 z-50 bg-brandLight dark:bg-brandBlack overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300">
        <div className="relative h-[45vh]">
          <img src={room.images[0]} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/30"></div>
          
          <button onClick={onClose} className="absolute top-4 right-4 bg-white text-black p-2 rounded-full hover:scale-110 border-2 border-black shadow-neo transition-all z-20"><X size={24} /></button>
          
          {room.isExample && (
               <div className="absolute top-4 left-4 bg-red-600 text-white px-4 py-2 font-black uppercase tracking-widest border-2 border-white shadow-neo z-20">
                  Example Listing
               </div>
          )}
  
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent">
              <h1 className="text-3xl md:text-5xl font-black text-white uppercase leading-none mb-2 drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">{room.title}</h1>
              <p className="text-brandYellow flex items-center gap-2 font-black uppercase tracking-wider text-lg drop-shadow-md"><MapPin size={20} strokeWidth={3} /> {room.location}</p>
          </div>
        </div>
        
        <div className="p-6 pb-40 max-w-3xl mx-auto">
          {room.isExample && (
              <div className="mb-6 p-4 bg-red-100 border-4 border-black shadow-neo-sm flex gap-3 items-center">
                  <Info className="text-black shrink-0" strokeWidth={3} />
                  <p className="text-sm text-black font-bold">DEMO: Payment will redirect to the official sites.</p>
              </div>
          )}
  
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 border-b-4 border-black dark:border-white pb-6 gap-4">
              <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider mb-1">Monthly Rent</p>
                  <span className="text-5xl font-black text-brandBlack dark:text-brandYellow drop-shadow-sm">NPR {room.price.toLocaleString()}</span>
              </div>
              <div className="flex gap-2">
                 <button className="bg-blue-600 text-white px-6 py-3 font-bold text-sm uppercase tracking-widest border-2 border-black shadow-neo hover:translate-y-1 hover:shadow-none transition-all flex items-center gap-2">
                    <MessageCircle size={18} /> Chat
                 </button>
                 <div className="bg-black text-white px-4 py-3 font-bold text-sm uppercase tracking-widest border-2 border-black">
                    Verified Owner
                 </div>
              </div>
          </div>
          
          <h3 className="font-black text-3xl mb-4 dark:text-white uppercase tracking-tight decoration-brandYellow underline decoration-4 underline-offset-4">About this place</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-10 leading-relaxed text-xl font-medium">{room.description}</p>
  
          <h3 className="font-black text-3xl mb-4 dark:text-white uppercase tracking-tight decoration-brandYellow underline decoration-4 underline-offset-4">Amenities</h3>
          <div className="flex flex-wrap gap-3 mb-10">
            {room.features.map(f => (
              <span key={f} className="bg-white dark:bg-black border-2 border-black dark:border-gray-500 px-4 py-3 text-sm dark:text-gray-200 uppercase font-black tracking-wide shadow-neo-sm">{f.replace('_', ' ')}</span>
            ))}
          </div>

          <div className="bg-gray-100 dark:bg-black/20 p-6 border-2 border-dashed border-gray-400">
               <h3 className="font-black uppercase mb-3 flex items-center gap-2 dark:text-white"><DollarSign size={16}/> Payment Methods Accepted</h3>
               <div className="flex gap-4">
                   {room.paymentInfo?.esewaId && <span className="bg-[#60bb46] text-white px-3 py-1 text-xs font-bold uppercase">eSewa Available</span>}
                   {room.paymentInfo?.khaltiId && <span className="bg-[#5c2d91] text-white px-3 py-1 text-xs font-bold uppercase">Khalti Available</span>}
                   {!room.paymentInfo?.esewaId && !room.paymentInfo?.khaltiId && <span className="text-gray-500 text-xs font-bold uppercase">Cash on Delivery / Negotiable</span>}
               </div>
          </div>
        </div>
  
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-brandBlack border-t-4 border-black dark:border-white z-40">
          <div className="max-w-3xl mx-auto">
              <p className="text-center text-xs text-gray-500 mb-3 uppercase font-bold tracking-widest">Secure Payment via</p>
              <div className="flex gap-4">
                  <button onClick={() => handlePaymentRequest('esewa')} className="flex-1 bg-[#60bb46] hover:bg-[#54a33d] text-white py-4 font-black flex items-center justify-center gap-2 uppercase tracking-wide border-2 border-black shadow-neo active:translate-y-1 active:shadow-none transition-all">
                      eSewa
                  </button>
                  <button onClick={() => handlePaymentRequest('khalti')} className="flex-1 bg-[#5c2d91] hover:bg-[#4b2478] text-white py-4 font-black flex items-center justify-center gap-2 uppercase tracking-wide border-2 border-black shadow-neo active:translate-y-1 active:shadow-none transition-all">
                      Khalti
                  </button>
              </div>
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
  const [lang, setLang] = useState<'en' | 'np'>('en');
  
  // Search State hoisted to App to persist between tabs
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [rooms, setRooms] = useState<Room[]>(MOCK_ROOMS);
  
  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    priceRange: [0, 100000],
    features: []
  });

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    const user = db.getCurrentUser();
    if (user) setCurrentUser(user);
    
    const onboarded = localStorage.getItem('gharpeti_onboarded');
    if (onboarded) setIsOnboarded(true);

    setRooms(db.getRooms());
  }, []);

  const handleFinishOnboarding = () => {
    localStorage.setItem('gharpeti_onboarded', 'true');
    setIsOnboarded(true);
  };

  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room);
  };

  const handleListRoom = () => {
    if (currentUser?.kycStatus !== KYCStatus.VERIFIED) {
        setShowKYC(true);
    } else {
        setShowAddRoom(true);
    }
  }

  const handleAddRoom = (newRoom: Room) => {
      setRooms(prev => [newRoom, ...prev]);
  }

  const performSearch = async () => {
    setIsSearching(true);
    const allRooms = db.getRooms();
    
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

  if (!isOnboarded) return <Onboarding onFinish={handleFinishOnboarding} />;
  if (!currentUser) return <Auth onLogin={setCurrentUser} />;

  return (
    <div className="min-h-screen bg-brandLight dark:bg-black font-sans flex justify-center text-brandBlack dark:text-white">
      {/* Content */}
      <main className="w-full max-w-lg bg-brandLight dark:bg-brandBlack min-h-screen shadow-2xl relative border-x-2 border-gray-300 dark:border-gray-800">
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
        {view === 'notifs' && <NotificationsView t={t} currentUser={currentUser} />}
        {view === 'profile' && (
            <ProfileView 
                currentUser={currentUser} 
                handleListRoom={handleListRoom} 
                setShowKYC={setShowKYC} 
                lang={lang} 
                setLang={setLang}
                setView={setView}
            />
        )}
      </main>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-black border-t-4 border-black dark:border-brandYellow z-40 max-w-lg mx-auto shadow-[0px_-4px_0px_rgba(0,0,0,0.1)]">
        <div className="flex justify-around items-center h-20 pb-2">
          <button onClick={() => setView('explore')} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${view === 'explore' ? 'text-black dark:text-brandYellow bg-gray-100 dark:bg-white/10 border-t-4 border-brandYellow' : 'text-gray-400 border-t-4 border-transparent'}`}>
            <Home size={24} strokeWidth={view === 'explore' ? 3 : 2} className="mb-1" />
            <span className="text-[10px] font-black uppercase tracking-widest">Home</span>
          </button>
          <button onClick={() => setView('map')} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${view === 'map' ? 'text-black dark:text-brandYellow bg-gray-100 dark:bg-white/10 border-t-4 border-brandYellow' : 'text-gray-400 border-t-4 border-transparent'}`}>
            <MapIcon size={24} strokeWidth={view === 'map' ? 3 : 2} className="mb-1" />
            <span className="text-[10px] font-black uppercase tracking-widest">Map</span>
          </button>
          
          <div className="relative -top-10">
             <button onClick={() => setView('search')} className="bg-brandYellow text-black p-5 border-4 border-black dark:border-white shadow-neo hover:shadow-none hover:translate-y-1 transition-all group">
                <Search size={32} strokeWidth={3} className="group-hover:rotate-12 transition-transform duration-300" />
             </button>
          </div>

          <button onClick={() => setView('notifs')} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${view === 'notifs' ? 'text-black dark:text-brandYellow bg-gray-100 dark:bg-white/10 border-t-4 border-brandYellow' : 'text-gray-400 border-t-4 border-transparent'}`}>
            <Bell size={24} strokeWidth={view === 'notifs' ? 3 : 2} className="mb-1" />
            <span className="text-[10px] font-black uppercase tracking-widest">Inbox</span>
          </button>
          <button onClick={() => setView('profile')} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${view === 'profile' ? 'text-black dark:text-brandYellow bg-gray-100 dark:bg-white/10 border-t-4 border-brandYellow' : 'text-gray-400 border-t-4 border-transparent'}`}>
            <UserIcon size={24} strokeWidth={view === 'profile' ? 3 : 2} className="mb-1" />
             <span className="text-[10px] font-black uppercase tracking-widest">Profile</span>
          </button>
        </div>
      </div>

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
          <AddRoomModal 
            user={currentUser}
            onClose={() => setShowAddRoom(false)}
            onAdd={handleAddRoom}
          />
      )}

      {selectedRoom && (
        <RoomDetailModal 
          room={selectedRoom} 
          user={currentUser} 
          t={t}
          onClose={() => setSelectedRoom(null)} 
          onRent={() => setSelectedRoom(null)}
          onKYCRequired={() => setShowKYC(true)}
        />
      )}
    </div>
  );
};

export default App;
