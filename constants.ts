
import { Room } from "./types";

export const MOCK_ROOMS: Room[] = [
  {
    id: '1',
    ownerId: 'owner1',
    title: 'Cozy Room in Lazimpat',
    description: 'A beautiful single room with attached bathroom near embassies. Perfect for diplomats or expats.',
    price: 15000,
    location: 'Lazimpat, Kathmandu',
    lat: 27.7172,
    lng: 85.3240,
    features: ['wifi', 'attached_bathroom', 'parking'],
    images: ['https://picsum.photos/600/400?random=1', 'https://picsum.photos/600/400?random=2'],
    isAvailable: true,
    isExample: true,
    paymentInfo: {
        esewaId: '9841000000',
        khaltiId: '9841000000'
    }
  },
  {
    id: '2',
    ownerId: 'owner2',
    title: 'Budget Flat in Koteshwor',
    description: 'Two bedroom flat, sunny side, water available 24/7. Close to Bhatbhateni supermarket.',
    price: 25000,
    location: 'Koteshwor, Kathmandu',
    lat: 27.6756,
    lng: 85.3459,
    features: ['kitchen', 'balcony', 'water_24h'],
    images: ['https://picsum.photos/600/400?random=3'],
    isAvailable: true,
    isExample: true,
    paymentInfo: {
        esewaId: '9851000000'
    }
  },
  {
    id: '3',
    ownerId: 'owner3',
    title: 'Modern Apartment in Jhamsikhel',
    description: 'Fully furnished apartment suitable for expats. Includes gym access and 24h security.',
    price: 45000,
    location: 'Jhamsikhel, Lalitpur',
    lat: 27.6710,
    lng: 85.3120,
    features: ['wifi', 'kitchen', 'parking', 'ac', 'furnished'],
    images: ['https://picsum.photos/600/400?random=4'],
    isAvailable: true,
    isExample: true,
    paymentInfo: {
        khaltiId: '9803000000'
    }
  },
  {
    id: '4',
    ownerId: 'owner4',
    title: 'Student Room near TU',
    description: 'Cheap room for students, shared kitchen. Walking distance to Tribhuvan University.',
    price: 8000,
    location: 'Kirtipur, Kathmandu',
    lat: 27.6630,
    lng: 85.2774,
    features: ['wifi', 'kitchen'],
    images: ['https://picsum.photos/600/400?random=5'],
    isAvailable: true,
    isExample: true,
  }
];

export const TRANSLATIONS = {
  en: {
    welcome: "Welcome to eKotha",
    explore: "Explore",
    map: "Map",
    search: "Search",
    notifications: "Inbox",
    profile: "Profile",
    login: "Login",
    signup: "Sign Up",
    rent: "Rent Now",
    price_month: "/ month",
    kyc_required: "KYC Verification Required",
    kyc_desc: "To rent or list rooms, we need to verify your identity.",
    take_selfie: "Take Selfie",
    upload_id: "Upload Govt ID",
    verify: "Verify Identity",
    search_placeholder: "Locality, landmark, or feature...",
    filter: "Filters",
    esewa: "Pay with eSewa",
    khalti: "Pay with Khalti",
  },
  np: {
    welcome: "eKotha मा स्वागत छ",
    explore: "खोज्नुहोस्",
    map: "नक्सा",
    search: "खोज",
    notifications: "इनबक्स",
    profile: "प्रोफाइल",
    login: "लग इन",
    signup: "दर्ता गर्नुहोस",
    rent: "भाडामा लिनुहोस्",
    price_month: "/ महिना",
    kyc_required: "KYC प्रमाणीकरण आवश्यक छ",
    kyc_desc: "कोठा भाडामा लिन वा राख्न, तपाईंको परिचय प्रमाणीकरण गर्न आवश्यक छ।",
    take_selfie: "सेल्फी लिनुहोस्",
    upload_id: "परिचय पत्र अपलोड",
    verify: "प्रमाणित गर्नुहोस्",
    search_placeholder: "स्थान, वा सुविधाहरू खोज्नुहोस्...",
    filter: "फिल्टर",
    esewa: "eSewa बाट तिर्नुहोस्",
    khalti: "Khalti बाट तिर्नुहोस्",
  }
};
