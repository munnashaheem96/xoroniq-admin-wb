// ==========================================================================
// XORONIQ CAR CARE - FIREBASE SERVICE MODULE
// Modular Firebase v10+ Architecture: Auth, Firestore & Cloud Storage
// ==========================================================================

import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';

import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';

import { CONFIG } from './config.js';
import { slugify, calculateDiscount, matchesCategory, getProductCategories, formatCategoryBadge } from './utils.js';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(CONFIG.FIREBASE) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initial Products Catalog (Multi-category: Suitable for both Car and Bike)
export const INITIAL_ESSENTIAL_KIT = {
  id: 'xoroniq-essential-kit',
  name: 'XORONIQ Essential Kit',
  slug: 'xoroniq-essential-kit',
  category: 'CAR & BIKE CARE',
  categories: ['CAR CARE', 'BIKE CARE', 'KITS'],
  price: 1199,
  compareAtPrice: 1499,
  discount: 20,
  deliveryFee: 80,
  stock: 50,
  sku: 'XOR-KIT-001',
  featured: true,
  active: true,
  isComingSoon: false,
  launchStatus: 'AVAILABLE NOW',
  shortDescription: 'Everything you need for a premium clean. Professional-grade automotive & bike detailing complete system.',
  description: 'The XORONIQ Essential Kit is our flagship detailing collection engineered for high-performance automotive and motorcycle enthusiasts. Formulated with laboratory-tested hydrophobic polymers and ultra-pure surfactants, this kit delivers extreme gloss, deep paint decontamination, streak-free glass clarity, and long-lasting protective shielding across all vehicle surfaces.',
  images: [
    'images/product/essentials.png'
  ],
  contents: [
    'Xoroniq Ultra Foam Car Shampoo 473 ml',
    'Microfiber 350 GSM Buffing Towel',
    'Microfiber 1200 GSM Heavy Plush Drying Towel',
    'Premium Detailing Wash Mitt',
    'Manual Pump Foam Sprayer',
    'Precision Detailing Brushes (2x Pack)'
  ],
  specs: [
    { label: 'Kit Contents', value: '6-Piece Complete Detailing Arsenal' },
    { label: 'Surface Compatibility', value: 'Paint, Glass, Chrome, Wheels, Plastics' },
    { label: 'Formulation', value: 'pH-Balanced, High Lubricity Ultra Foam' },
    { label: 'Durability', value: 'Extreme Scratch-Free Foam Protection' },
    { label: 'Origin', value: 'Engineered & Bottled for XORONIQ' }
  ],
  features: [
    'Xoroniq Ultra Foam Car Shampoo (473 ml) lifts heavy road dirt with extreme lubricity',
    'Heavy-Duty Manual Foam Sprayer for thick, clinging snow foam without pressure washer',
    'Ultra-soft scratch-free wash mitt for gentle paint contact',
    'Microfiber 350 GSM for effortless wipe-down and buffing',
    'Microfiber 1200 GSM heavy plush towel for streak-free paint drying',
    '2x Precision Detailing Brushes for emblems, lug nuts, and interior AC vents'
  ],
  rating: 4.9,
  reviewsCount: 128,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z')
};

export const INITIAL_PRO_KIT = {
  id: 'xoroniq-pro-kit',
  name: 'XORONIQ Pro Kit',
  slug: 'xoroniq-pro-kit',
  category: 'CAR & BIKE CARE',
  categories: ['CAR CARE', 'BIKE CARE', 'KITS'],
  price: 0,
  compareAtPrice: 0,
  discount: 0,
  deliveryFee: 80,
  stock: 0,
  sku: 'XOR-KIT-PRO',
  featured: true,
  active: true,
  isComingSoon: true,
  launchStatus: 'LAUNCHING SOON',
  shortDescription: 'Advanced multi-stage detailing arsenal with ceramic coating, iron fallout remover, leather conditioner & pro accessories.',
  description: 'The XORONIQ Pro Kit is crafted for seasoned detailers and enthusiasts demanding professional-grade paint correction, intense hydrophobic gloss, and complete cockpit restoration. Features high-concentration iron fallout decontaminator, ultra-slick ceramic booster, and interior leather shield.',
  images: [
    'images/product/anonymous-teaser.jpg'
  ],
  specs: [
    { label: 'Surface Compatibility', value: 'All Automotive & Motorcycle Surfaces' },
    { label: 'Protection Tier', value: 'Pro Ceramic Polymer Matrix' },
    { label: 'Durability', value: 'Up to 6 months hydrophobic barrier' },
    { label: 'Status', value: 'Launching Soon' }
  ],
  features: [
    'Heavy-duty pH-neutral iron fallout decontaminator',
    'Advanced SiO2 ceramic gloss enhancer & repellent',
    'Matte-finish interior detailer & UV shield',
    'Complete set of 4x plush microfiber towels & applicator pads'
  ],
  rating: 5.0,
  reviewsCount: 0,
  createdAt: new Date('2026-02-01T00:00:00Z'),
  updatedAt: new Date('2026-02-01T00:00:00Z')
};

export const INITIAL_ULTRA_KIT = {
  id: 'xoroniq-ultra-kit',
  name: 'XORONIQ Ultra Kit',
  slug: 'xoroniq-ultra-kit',
  category: 'CAR & BIKE CARE',
  categories: ['CAR CARE', 'BIKE CARE', 'KITS'],
  price: 0,
  compareAtPrice: 0,
  discount: 0,
  deliveryFee: 100,
  stock: 0,
  sku: 'XOR-KIT-ULTRA',
  featured: true,
  active: true,
  isComingSoon: true,
  launchStatus: 'LAUNCHING SOON',
  shortDescription: 'The ultimate flagship detailing vault with 9H ceramic graphene coat, dual-action buffer set, engine bay protectant & comprehensive accessory set.',
  description: 'The pinnacle of automotive perfection. The XORONIQ Ultra Kit delivers laboratory-grade graphene protection, high-durability hydrophobic ceramic barriers, deep leather nourishment, engine bay degreasing, and precision detailing brushes in a luxury collector case.',
  images: [
    'images/product/anonymous-teaser.jpg'
  ],
  specs: [
    { label: 'Surface Compatibility', value: 'Full Vehicle Exterior, Interior & Engine Bay' },
    { label: 'Protection Tier', value: '9H Graphene Ceramic Shield' },
    { label: 'Durability', value: 'Up to 12 months extreme protection' },
    { label: 'Status', value: 'Launching Soon' }
  ],
  features: [
    'Flagship 9H Graphene & SiO2 Ceramic Nanocoat',
    'Complete multi-stage wheel, glass, and engine bay formulas',
    'Leather conditioner & hydrophobic fabric sealant',
    'Luxury heavy-duty detailing bag, horsehair brushes & drying towel'
  ],
  rating: 5.0,
  reviewsCount: 0,
  createdAt: new Date('2026-03-01T00:00:00Z'),
  updatedAt: new Date('2026-03-01T00:00:00Z')
};

export const INITIAL_CATALOG = [INITIAL_ESSENTIAL_KIT, INITIAL_PRO_KIT, INITIAL_ULTRA_KIT];

// ==========================================================================
// FIRESTORE: PRODUCT SERVICES (CLOUD + LOCAL PERSISTENCE SYNC)
// ==========================================================================

const LOCAL_PRODUCTS_KEY = 'xoroniq_custom_products';

function getLocalCustomProducts() {
  try {
    const raw = localStorage.getItem(LOCAL_PRODUCTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalCustomProducts(products) {
  try {
    localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(products));
  } catch (e) {
    console.warn('Failed to save products locally:', e);
  }
}

/**
 * Fetch products from Firestore with fallback to local & initial catalog
 */
export async function getProducts({ activeOnly = true, category = null } = {}) {
  let combinedList = [];
  const localCustom = getLocalCustomProducts();

  try {
    const productsRef = collection(db, 'products');
    const q = activeOnly 
      ? query(productsRef, where('active', '==', true))
      : query(productsRef);

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      snapshot.forEach(docSnap => {
        combinedList.push({ id: docSnap.id, ...docSnap.data() });
      });
    }
  } catch (error) {
    console.warn('Firestore products fetch returned warning/offline, local active:', error);
  }

  // Include INITIAL_CATALOG items if not already present in Firestore
  INITIAL_CATALOG.forEach(initialProd => {
    if (!combinedList.some(p => p.id === initialProd.id || p.slug === initialProd.slug)) {
      combinedList.push(initialProd);
    }
  });

  // Merge locally created custom products so added items are never lost
  localCustom.forEach(customProd => {
    const existingIndex = combinedList.findIndex(p => p.id === customProd.id || (p.sku && p.sku === customProd.sku));
    if (existingIndex >= 0) {
      combinedList[existingIndex] = { ...combinedList[existingIndex], ...customProd };
    } else {
      combinedList.push(customProd);
    }
  });

  if (activeOnly) {
    combinedList = combinedList.filter(p => p.active !== false);
  }

  if (category && category !== 'ALL') {
    combinedList = combinedList.filter(p => matchesCategory(p, category));
  }

  return combinedList;
}

/**
 * Get single product by ID or Slug
 */
export async function getProductById(id) {
  const all = await getProducts({ activeOnly: false });
  const found = all.find(p => p.id === id || p.slug === id);
  if (found) return found;

  try {
    const docRef = doc(db, 'products', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
  } catch (error) {
    console.warn('Error fetching product by ID:', error);
  }
  return INITIAL_ESSENTIAL_KIT;
}

/**
 * Get single product by slug
 */
export async function getProductBySlug(slug) {
  const all = await getProducts({ activeOnly: false });
  const found = all.find(p => p.slug === slug);
  if (found) return found;

  if (slug === INITIAL_ESSENTIAL_KIT.slug) {
    return INITIAL_ESSENTIAL_KIT;
  }
  try {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('slug', '==', slug));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }
  } catch (error) {
    console.warn('Error fetching product by slug:', error);
  }
  return null;
}

/**
 * Add a new product (Admin - Stores locally & syncs to Firestore)
 */
export async function addProduct(productData) {
  const slug = productData.slug || slugify(productData.name);
  const discount = calculateDiscount(productData.price, productData.compareAtPrice);
  const categories = getProductCategories(productData);
  const category = productData.category || formatCategoryBadge(productData);
  const tempId = `xoroniq-prod-${Date.now()}`;
  
  const docData = {
    id: tempId,
    name: productData.name,
    slug: slug,
    category: category,
    categories: categories,
    price: Number(productData.price) || 0,
    compareAtPrice: Number(productData.compareAtPrice) || 0,
    discount: discount,
    stock: Number(productData.stock) || 0,
    sku: productData.sku || `XOR-${Math.floor(1000 + Math.random() * 9000)}`,
    featured: Boolean(productData.featured),
    active: productData.active !== undefined ? Boolean(productData.active) : true,
    shortDescription: productData.shortDescription || '',
    description: productData.description || '',
    images: Array.isArray(productData.images) && productData.images.length > 0 
      ? productData.images 
      : ['images/product/essentials.png'],
    specs: productData.specs || [],
    rating: 5.0,
    reviewsCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Always save to local store immediately (Zero-Data-Loss guarantee)
  const localCustom = getLocalCustomProducts();
  localCustom.push(docData);
  saveLocalCustomProducts(localCustom);

  // Attempt Firestore sync
  try {
    const firestoreData = { ...docData };
    delete firestoreData.id;
    firestoreData.createdAt = serverTimestamp();
    firestoreData.updatedAt = serverTimestamp();

    const docRef = await addDoc(collection(db, 'products'), firestoreData);
    docData.id = docRef.id;

    // Update ID in local store
    const updatedLocal = localCustom.map(p => p.id === tempId ? { ...p, id: docRef.id } : p);
    saveLocalCustomProducts(updatedLocal);

    return { id: docRef.id, ...docData };
  } catch (error) {
    console.warn('Firestore cloud write warning (persisted in browser catalog):', error);
    return docData;
  }
}

/**
 * Update an existing product (Admin)
 */
export async function updateProduct(id, productData) {
  const localCustom = getLocalCustomProducts();
  const existingIdx = localCustom.findIndex(p => p.id === id);
  const updatedData = { ...productData, updatedAt: new Date().toISOString() };

  if (productData.categories || productData.category) {
    updatedData.categories = getProductCategories(productData);
    updatedData.category = productData.category || formatCategoryBadge(productData);
  }
  if (productData.price !== undefined || productData.compareAtPrice !== undefined) {
    updatedData.discount = calculateDiscount(productData.price, productData.compareAtPrice);
  }

  if (existingIdx >= 0) {
    localCustom[existingIdx] = { ...localCustom[existingIdx], ...updatedData };
    saveLocalCustomProducts(localCustom);
  } else {
    localCustom.push({ id, ...updatedData });
    saveLocalCustomProducts(localCustom);
  }

  try {
    const docRef = doc(db, 'products', id);
    const firestorePayload = { ...updatedData, updatedAt: serverTimestamp() };
    await updateDoc(docRef, firestorePayload);
  } catch (error) {
    console.warn('Firestore updateDoc warning (persisted locally):', error);
  }
  return true;
}

/**
 * Delete a product (Admin)
 */
export async function deleteProduct(id) {
  const localCustom = getLocalCustomProducts();
  const filtered = localCustom.filter(p => p.id !== id);
  saveLocalCustomProducts(filtered);

  try {
    const docRef = doc(db, 'products', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn('Firestore deleteDoc warning (deleted locally):', error);
  }
  return true;
}

/**
 * Upload product image to Firebase Storage
 */
export async function uploadProductImage(file, path) {
  try {
    const storageRef = ref(storage, path || `products/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.warn('Firebase Storage upload notice:', error);
    throw error;
  }
}

// ==========================================================================
// FIRESTORE: ORDER SERVICES
/**
 * Sanitizes any data payload before sending to Firestore
 * Recursively converts undefined to null or omits undefined keys to prevent Firestore addDoc errors
 */
export function cleanFirestorePayload(obj) {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date || (obj && typeof obj.toMillis === 'function')) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanFirestorePayload(item)).filter(item => item !== undefined);
  }
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = cleanFirestorePayload(value);
    }
  }
  return clean;
}

/**
 * Save customer order into Firestore (Supports both Website and External Channels like WhatsApp, Amazon, Phone, etc.)
 */
export async function createOrder(orderData) {
  try {
    const rawTaxDetails = orderData.taxDetails ? {
      isIntrastate: Boolean(orderData.taxDetails.isIntrastate),
      cgst: Number(orderData.taxDetails.cgst) || 0,
      sgst: Number(orderData.taxDetails.sgst) || 0,
      igst: Number(orderData.taxDetails.igst) || 0,
      taxMode: orderData.taxDetails.taxMode || 'NONE'
    } : null;

    const orderPayload = {
      orderId: orderData.orderId || `XOR-${Math.floor(100000 + Math.random() * 900000)}`,
      source: orderData.source || 'Website', // 'Website', 'WhatsApp', 'Phone / Manual', 'Amazon', 'Flipkart', 'Instagram', 'In-Store', 'Shopify', 'B2B'
      externalOrderId: orderData.externalOrderId || '',
      customer: {
        name: orderData.customer?.name || 'Customer',
        email: orderData.customer?.email || '',
        phone: orderData.customer?.phone || '',
        gstin: orderData.customer?.gstin || ''
      },
      shippingAddress: {
        address: orderData.shippingAddress?.address || '',
        city: orderData.shippingAddress?.city || '',
        state: orderData.shippingAddress?.state || '',
        pincode: orderData.shippingAddress?.pincode || '',
        country: orderData.shippingAddress?.country || 'India'
      },
      items: orderData.items || [],
      subtotal: Number(orderData.subtotal) || 0,
      discount: Number(orderData.discount) || 0,
      shipping: Number(orderData.shipping) || 0,
      tax: Number(orderData.tax) || 0,
      total: Number(orderData.total) || 0,
      payment: {
        method: orderData.payment?.method || 'RAZORPAY',
        razorpayPaymentId: orderData.payment?.razorpayPaymentId || '',
        razorpayOrderId: orderData.payment?.razorpayOrderId || '',
        status: orderData.payment?.status || 'PAID'
      },
      trackingId: orderData.trackingId || '',
      courier: orderData.courier || (orderData.trackingId ? 'Delhivery Express' : ''),
      trackingUrl: orderData.trackingUrl || (orderData.trackingId ? `https://www.delhivery.com/track/package/${orderData.trackingId}` : ''),
      adminNote: orderData.adminNote || '',
      invoiceNumber: orderData.invoiceNumber || '',
      taxDetails: rawTaxDetails,
      orderStatus: orderData.orderStatus || (orderData.payment?.method === 'COD' ? 'Order Placed (COD)' : 'Payment Confirmed'),
      createdAt: orderData.createdAt ? orderData.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const sanitizedPayload = cleanFirestorePayload(orderPayload);
    const docRef = await addDoc(collection(db, 'orders'), sanitizedPayload);
    return { id: docRef.id, ...sanitizedPayload };
  } catch (error) {
    console.error('Error creating order in Firestore:', error);
    throw error;
  }
}

/**
 * Bulk import multiple orders (e.g. from Amazon/Flipkart/CSV/Excel)
 */
export async function createBulkOrders(ordersList = []) {
  if (!ordersList || !ordersList.length) return { success: 0, failed: 0, items: [] };
  let success = 0;
  let failed = 0;
  const items = [];

  for (const rawOrder of ordersList) {
    try {
      const res = await createOrder(rawOrder);
      success++;
      items.push(res);
    } catch (e) {
      console.warn('Failed bulk order insertion:', rawOrder, e);
      failed++;
    }
  }

  return { success, failed, items };
}

/**
 * Save Invoice Record
 */
export async function saveInvoiceRecord(invoiceData) {
  try {
    const payload = {
      invoiceNumber: invoiceData.invoiceNumber,
      orderId: invoiceData.orderId || '',
      customer: invoiceData.customer || {},
      seller: invoiceData.seller || {},
      items: invoiceData.items || [],
      subtotal: Number(invoiceData.subtotal) || 0,
      discount: Number(invoiceData.discount) || 0,
      shipping: Number(invoiceData.shipping) || 0,
      taxBreakup: invoiceData.taxBreakup || {},
      totalTax: Number(invoiceData.totalTax) || 0,
      grandTotal: Number(invoiceData.grandTotal) || 0,
      payment: invoiceData.payment || {},
      notes: invoiceData.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, 'invoices'), payload);
    return { id: docRef.id, ...payload };
  } catch (err) {
    console.error('Error saving invoice record:', err);
    throw err;
  }
}

/**
 * Fetch saved invoices
 */
export async function getInvoices() {
  try {
    const snap = await getDocs(query(collection(db, 'invoices'), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('Could not fetch invoices collection:', e);
    return [];
  }
}


/**
 * Get Order by Order ID (e.g. XOR-83921)
 */
export async function getOrderById(orderId) {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('orderId', '==', orderId.trim()));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }
  } catch (error) {
    console.error('Error fetching order by ID:', error);
  }
  return null;
}

/**
 * Search orders securely by Order ID or customer phone
 * Only queries matching records to prevent data exposure
 */
export async function searchOrders(searchTerm) {
  if (!searchTerm) return [];
  const term = searchTerm.trim();

  // 1. Try exact orderId match
  try {
    const qOrder = query(collection(db, 'orders'), where('orderId', '==', term));
    const snap = await getDocs(qOrder);
    if (!snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (error) {
    // Continue to phone search
  }

  // 2. Try 10-digit mobile number match
  const cleanPhone = term.replace(/\D/g, '');
  if (cleanPhone.length >= 10) {
    try {
      const qPhone = query(collection(db, 'orders'), where('customer.phone', '==', cleanPhone));
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) {
        return snapPhone.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (error) {
      // Return empty
    }
  }

  return [];
}

/**
 * Fetch all orders (Admin)
 */
export async function getOrders({ status = null } = {}) {
  try {
    const ordersRef = collection(db, 'orders');
    let q = query(ordersRef);
    if (status && status !== 'ALL') {
      q = query(ordersRef, where('orderStatus', '==', status));
    }
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    return list;
  } catch (error) {
    console.error('Error fetching orders list:', error);
    return [];
  }
}

/**
 * Update order status (Admin)
 */
export async function updateOrderStatus(docId, newStatus) {
  try {
    const docRef = doc(db, 'orders', docId);
    await updateDoc(docRef, {
      orderStatus: newStatus,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
}

/**
 * Update order tracking / dispatch details (Admin)
 * @param {string} docId
 * @param {Object} trackingData - { trackingId, courier, trackingUrl, orderStatus, ... }
 */
export async function updateOrderTracking(docId, trackingData) {
  try {
    const docRef = doc(db, 'orders', docId);
    await updateDoc(docRef, {
      ...trackingData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating order tracking:', error);
    throw error;
  }
}

/**
 * Delete single order from Firestore (Admin)
 * @param {string} docId 
 */
export async function deleteOrder(docId) {
  try {
    const docRef = doc(db, 'orders', docId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Error deleting order from Firestore:', error);
    throw error;
  }
}

/**
 * Delete multiple orders in batch from Firestore (Admin)
 * @param {Array<string>} docIds 
 */
export async function deleteMultipleOrders(docIds = []) {
  if (!docIds || !docIds.length) return { success: 0, failed: 0 };
  let successCount = 0;
  let failedCount = 0;
  for (const id of docIds) {
    try {
      const docRef = doc(db, 'orders', id);
      await deleteDoc(docRef);
      successCount++;
    } catch (err) {
      console.warn(`Failed to delete order ${id}:`, err);
      failedCount++;
    }
  }
  return { success: successCount, failed: failedCount };
}

/**
 * Update internal admin note for an order
 * @param {string} docId 
 * @param {string} note 
 */
export async function updateOrderAdminNote(docId, note = '') {
  try {
    const docRef = doc(db, 'orders', docId);
    await updateDoc(docRef, {
      adminNote: note,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating admin note:', error);
    throw error;
  }
}

/**
 * Get metrics for Admin Dashboard
 */
export async function getDashboardMetrics() {
  try {
    const products = await getProducts({ activeOnly: false });
    const orders = await getOrders();

    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.active !== false).length;
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.orderStatus === 'Payment Confirmed' || o.orderStatus === 'Processing').length;
    const completedOrders = orders.filter(o => o.orderStatus === 'Delivered').length;
    const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    return {
      totalProducts,
      activeProducts,
      totalOrders,
      pendingOrders,
      completedOrders,
      totalSales
    };
  } catch (e) {
    console.error('Error calculating metrics:', e);
    return {
      totalProducts: 1,
      activeProducts: 1,
      totalOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      totalSales: 0
    };
  }
}

// ==========================================================================
// AUTHENTICATION SERVICES
// ==========================================================================

export async function adminSignIn(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function adminSignOut() {
  return await signOut(auth);
}

export function onAdminAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function sendAdminResetPassword(email) {
  return await sendPasswordResetEmail(auth, email);
}

// ==========================================================================
// CUSTOMER AUTH & PROFILE SERVICES
// ==========================================================================

export function onUserAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function userSignIn(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function userGoogleSignIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return await signInWithPopup(auth, provider);
}

export async function userSignOut() {
  return await signOut(auth);
}

export async function sendUserPasswordReset(email) {
  return await sendPasswordResetEmail(auth, email);
}

export async function userSignUp(name, email, password, phone, city, vehicleType) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // Set display name
  await updateProfile(cred.user, { displayName: name });
  // Save profile to Firestore
  await setDoc(doc(db, 'users', cred.user.uid), {
    name,
    email,
    phone: phone || '',
    city: city || '',
    vehicleType: vehicleType || 'Car',
    vehicleModel: '',
    uid: cred.user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return cred;
}

export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('getUserProfile:', e);
    return null;
  }
}

export async function saveUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

export async function getUserOrders(email) {
  if (!email) return [];
  const cleanEmail = email.toLowerCase().trim();

  // Query by customer.email
  try {
    const q1 = query(
      collection(db, 'orders'),
      where('customer.email', '==', cleanEmail)
    );
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      const list = snap1.docs.map(d => ({ id: d.id, ...d.data() }));
      return list.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });
    }
  } catch (e) {
    // Continue to customerEmail query
  }

  // Query by customerEmail
  try {
    const q2 = query(
      collection(db, 'orders'),
      where('customerEmail', '==', cleanEmail)
    );
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
      const list = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      return list.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });
    }
  } catch (e) {
    // Failed to query
  }

  return [];
}
