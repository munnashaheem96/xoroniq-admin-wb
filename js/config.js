// ==========================================================================
// XORONIQ CAR CARE - ENVIRONMENT & CONFIGURATION
// ==========================================================================

export const CONFIG = {
  RAZORPAY_KEY_ID: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_Tgwv2bPRil40BG',
  API_BASE_URL: (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) ? 'http://localhost:5001/api' : (import.meta.env.VITE_API_URL || 'https://us-central1-marketing-website-45737.cloudfunctions.net/api'),
  FIREBASE: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAIeLh3I9tPRtHCPCFszon4yaJAxrbLetE',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'marketing-website-45737.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'marketing-website-45737',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'marketing-website-45737.firebasestorage.app',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1042908231312',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1042908231312:web:de65221312f1673e328a15',
  },
  META_PIXEL_ID: import.meta.env.VITE_META_PIXEL_ID || '1588128035519008',
  STORE: {
    NAME: 'XORONIQ Car Care',
    TAGLINE: 'Premium care. Powerful results.',
    CURRENCY: '₹',
    FREE_SHIPPING_THRESHOLD: 2500,
    STANDARD_SHIPPING_FEE: 80,
    KERALA_SHIPPING_FEE: 60,
    LOCAL_SHIPPING_FEE: 60,
    COD_FEE: 20,
    LOCAL_PINCODE_BASE: '676306',
    ADDRESS: 'Pukayoor, Olakara PO, Malappuram, Kerala - 676306',
    LOCATION: {
      PLACE: 'Pukayoor',
      POST_OFFICE: 'Olakara PO',
      DISTRICT: 'Malappuram',
      STATE: 'Kerala',
      STATE_CODE: '32',
      PINCODE: '676306',
    },
    EMAIL: 'xoroniq@gmail.com',
    PHONES: ['9188510017'],
    PHONE_FORMATTED: '+91 9188510017',
    INSTAGRAM: 'https://instagram.com/xoroniq',
    INSTAGRAM_HANDLE: '@xoroniq',
  },
};
