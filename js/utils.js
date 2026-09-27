// ==========================================================================
// XORONIQ CAR CARE - UTILITY FUNCTIONS
// ==========================================================================

import { CONFIG } from './config.js';

/**
 * Format number into Indian Rupee Currency string
 * @param {number} amount 
 * @returns {string} e.g. "₹2,499"
 */
export function formatCurrency(amount) {
  if (typeof amount !== 'number') {
    amount = parseFloat(amount) || 0;
  }
  return `${CONFIG.STORE.CURRENCY}${amount.toLocaleString('en-IN')}`;
}

/**
 * Calculate percentage discount
 */
export function calculateDiscount(price, comparePrice) {
  if (!comparePrice || comparePrice <= price) return 0;
  return Math.round(((comparePrice - price) / comparePrice) * 100);
}

/**
 * Check if a given address, state, or pincode belongs to Kerala.
 * All Kerala PIN codes start with 67, 68, or 69 (670001 - 695615).
 * @param {string|number} pincode 
 * @param {string} state 
 * @param {string} city 
 * @returns {boolean}
 */
export function isKeralaAddress(pincode = '', state = '', city = '') {
  if (state) {
    const s = String(state).trim().toLowerCase();
    if (s === 'kerala' || s === 'kl' || s.includes('kerala')) return true;
  }
  if (pincode) {
    const pinStr = String(pincode).trim().replace(/\D/g, '');
    if (pinStr.length >= 2) {
      const prefix = pinStr.substring(0, 2);
      if (prefix === '67' || prefix === '68' || prefix === '69') {
        return true;
      }
    }
  }
  if (city) {
    const c = String(city).trim().toLowerCase();
    const keralaCities = [
      'kochi', 'cochin', 'ernakulam', 'calicut', 'kozhikode', 'trivandrum',
      'thiruvananthapuram', 'thrissur', 'malappuram', 'kannur', 'kollam',
      'palakkad', 'alappuzha', 'alleppey', 'kottayam', 'wayanad', 'kasaragod',
      'idukki', 'pathanamthitta', 'tirurangadi', 'manjeri', 'perinthalmanna',
      'tirur', 'ponnani', 'guruvayur', 'aluva', 'kothamangalam', 'perumbavoor'
    ];
    if (keralaCities.some(k => c.includes(k))) return true;
  }
  return false;
}

/**
 * Check if a 6-digit pincode is near 676306 / in Kerala
 * @param {string|number} pincode 
 * @returns {boolean}
 */
export function isNearLocalPincode(pincode) {
  if (!pincode) return false;
  return isKeralaAddress(pincode);
}

/**
 * Format Firestore or JS timestamp to readable string
 */
export function formatDate(dateVal) {
  if (!dateVal) return 'N/A';
  let d;
  if (dateVal.toDate) {
    d = dateVal.toDate();
  } else if (dateVal.seconds) {
    d = new Date(dateVal.seconds * 1000);
  } else {
    d = new Date(dateVal);
  }
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Create a slug from product title
 */
export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

/**
 * Generate a unique XORONIQ order ID (e.g. XOR-83921)
 */
export function generateOrderId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `XRQ-${year}-${rand}`;
}

/**
 * Extract normalized array of categories from a product
 * @param {Object} product 
 * @returns {string[]}
 */
export function getProductCategories(product) {
  if (!product) return ['CAR CARE'];
  if (Array.isArray(product.categories) && product.categories.length > 0) {
    return product.categories.map(c => String(c).trim().toUpperCase()).filter(Boolean);
  }
  if (typeof product.category === 'string' && product.category.trim()) {
    const parts = product.category.split(/[,&/]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (parts.length > 0) return parts;
    return [product.category.trim().toUpperCase()];
  }
  return ['CAR CARE'];
}

/**
 * Format category badge string for display on cards & pages
 * @param {Object} product 
 * @returns {string}
 */
export function formatCategoryBadge(product) {
  const cats = getProductCategories(product);
  const hasCar = cats.some(c => c.includes('CAR'));
  const hasBike = cats.some(c => c.includes('BIKE'));
  const hasKit = cats.some(c => c.includes('KIT'));
  const hasAcc = cats.some(c => c.includes('ACCESSOR'));
  
  if (hasCar && hasBike) return 'CAR & BIKE';
  if (hasKit) return 'KITS';
  if (hasCar) return 'CAR CARE';
  if (hasBike) return 'BIKE CARE';
  if (hasAcc) return 'ACCESSORIES';
  return cats[0] || 'CAR CARE';
}

/**
 * Check if a product matches a target category filter
 * @param {Object} product 
 * @param {string} targetCategory 
 * @returns {boolean}
 */
export function matchesCategory(product, targetCategory) {
  if (!targetCategory || targetCategory === 'ALL') return true;
  const target = targetCategory.toUpperCase().trim();
  const cats = getProductCategories(product);
  
  return cats.some(c => {
    if (c === target) return true;
    if (target.includes('CAR') && c.includes('CAR')) return true;
    if (target.includes('BIKE') && c.includes('BIKE')) return true;
    if (target.includes('KIT') && c.includes('KIT')) return true;
    if (target.includes('ACCESSOR') && c.includes('ACCESSOR')) return true;
    if (c.includes(target) || target.includes(c)) return true;
    return false;
  });
}

/**
 * Generate an automated structured Product SKU (e.g. XOR-KIT-4921, XOR-CB-3891)
 */
export function generateSku(categories = 'KITS', name = '') {
  const catArray = Array.isArray(categories) 
    ? categories 
    : (typeof categories === 'string' ? categories.split(/[,&/]+/) : ['KITS']);
  
  const cleanCats = catArray.map(c => String(c).trim().toUpperCase());
  const hasCar = cleanCats.some(c => c.includes('CAR'));
  const hasBike = cleanCats.some(c => c.includes('BIKE'));
  const hasKit = cleanCats.some(c => c.includes('KIT'));
  const hasAcc = cleanCats.some(c => c.includes('ACCESSOR'));

  let prefix = 'GEN';
  if (hasKit) {
    prefix = 'KIT';
  } else if (hasCar && hasBike) {
    prefix = 'CB';
  } else if (hasCar) {
    prefix = 'CC';
  } else if (hasBike) {
    prefix = 'BC';
  } else if (hasAcc) {
    prefix = 'ACC';
  }

  const rand = Math.floor(1000 + Math.random() * 9000);
  return `XOR-${prefix}-${rand}`;
}

/**
 * Generate an automated Product ID / Slug
 */
export function generateProductId(name = '', category = 'KITS') {
  if (name && name.trim()) {
    const slug = slugify(name);
    return slug.startsWith('xoroniq-') ? slug : `xoroniq-${slug}`;
  }
  const sku = generateSku(category, name);
  return sku.toLowerCase();
}

/**
 * Debounce helper
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Display a luxury animated toast notification
 */
export function showToast(message, type = 'info') {
  let container = document.getElementById('xoroniq-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'xoroniq-toast-container';
    container.className = 'toast-container-custom';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'bi-check-circle-fill text-success',
    error: 'bi-exclamation-octagon-fill text-danger',
    warning: 'bi-exclamation-triangle-fill text-warning',
    info: 'bi-info-circle-fill text-accent',
  };

  const toast = document.createElement('div');
  toast.className = 'toast-custom';
  toast.innerHTML = `
    <i class="bi ${icons[type] || icons.info} fs-5"></i>
    <div class="toast-message font-heading fw-semibold small">${message}</div>
  `;

  container.appendChild(toast);

  // Trigger entrance animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto remove after 3.5s
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 3500);
}

/**
 * LocalStorage Helpers
 */
export function getStorage(key, fallback = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Error reading from localStorage: ${key}`, e);
    return fallback;
  }
}

export function setStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing to localStorage: ${key}`, e);
  }
}

/**
 * Capture UTM & Meta Ad click attribution parameters from URL
 * Persists source, campaign, medium, content & fbclid so conversions can be tracked to exact ads
 */
export function captureUtmAttribution() {
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    const utmContent = params.get('utm_content');
    const utmTerm = params.get('utm_term');
    const fbclid = params.get('fbclid');

    if (utmSource || utmCampaign || fbclid) {
      const attribution = {
        source: utmSource || (fbclid ? 'facebook' : ''),
        medium: utmMedium || (fbclid ? 'paid_social' : ''),
        campaign: utmCampaign || '',
        content: utmContent || '',
        term: utmTerm || '',
        fbclid: fbclid || '',
        capturedAt: new Date().toISOString(),
        landingPage: window.location.pathname + window.location.search
      };
      setStorage('xoroniq_attribution', attribution);
      console.info('✓ Meta Ad / UTM attribution captured:', attribution);
    }
  } catch (e) {
    console.warn('Could not capture UTM params:', e);
  }
}

/**
 * Get active UTM & Meta Ad attribution data
 */
export function getUtmAttribution() {
  return getStorage('xoroniq_attribution', null);
}

/**
 * Convert number to words in Indian numbering format (Lakhs, Crores)
 * e.g. 1199 -> "One Thousand One Hundred Ninety-Nine Rupees Only"
 */
export function numberToWordsINR(amount) {
  const num = Math.round(Number(amount) || 0);
  if (num === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n) {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
  }

  let words = '';
  let remainder = num;

  if (Math.floor(remainder / 10000000) > 0) {
    words += inWords(Math.floor(remainder / 10000000)) + ' Crore ';
    remainder %= 10000000;
  }
  if (Math.floor(remainder / 100000) > 0) {
    words += inWords(Math.floor(remainder / 100000)) + ' Lakh ';
    remainder %= 100000;
  }
  if (Math.floor(remainder / 1000) > 0) {
    words += inWords(Math.floor(remainder / 1000)) + ' Thousand ';
    remainder %= 1000;
  }
  if (Math.floor(remainder / 100) > 0) {
    words += inWords(Math.floor(remainder / 100)) + ' Hundred ';
    remainder %= 100;
  }
  if (remainder > 0) {
    if (words !== '') words += 'and ';
    words += inWords(remainder);
  }

  return `${words.trim()} Rupees Only`;
}

/**
 * Generate visual badge HTML for Order Source
 */
export function getSourceBadgeHtml(source = 'Website') {
  const s = String(source || 'Website').toLowerCase();

  if (s.includes('whatsapp')) {
    return `<span class="badge d-inline-flex align-items-center gap-1 shadow-xs" style="background-color: #25D366; color: #ffffff; font-size: 0.7rem; font-weight: 600;"><i class="bi bi-whatsapp"></i> WhatsApp</span>`;
  }
  if (s.includes('amazon')) {
    return `<span class="badge d-inline-flex align-items-center gap-1 shadow-xs" style="background-color: #FF9900; color: #111111; font-size: 0.7rem; font-weight: 700;"><i class="bi bi-box-seam"></i> Amazon</span>`;
  }
  if (s.includes('flipkart')) {
    return `<span class="badge d-inline-flex align-items-center gap-1 shadow-xs" style="background-color: #2874F0; color: #ffffff; font-size: 0.7rem; font-weight: 600;"><i class="bi bi-lightning-charge-fill"></i> Flipkart</span>`;
  }
  if (s.includes('instagram')) {
    return `<span class="badge d-inline-flex align-items-center gap-1 shadow-xs text-white" style="background: linear-gradient(45deg, #f09433, #dc2743, #bc1888); font-size: 0.7rem; font-weight: 600;"><i class="bi bi-instagram"></i> Instagram</span>`;
  }
  if (s.includes('phone') || s.includes('call') || s.includes('manual')) {
    return `<span class="badge bg-secondary text-white d-inline-flex align-items-center gap-1" style="font-size: 0.7rem;"><i class="bi bi-telephone-fill"></i> Phone / Manual</span>`;
  }
  if (s.includes('store') || s.includes('walk') || s.includes('offline')) {
    return `<span class="badge bg-dark text-white d-inline-flex align-items-center gap-1" style="font-size: 0.7rem;"><i class="bi bi-shop"></i> In-Store</span>`;
  }
  if (s.includes('shopify')) {
    return `<span class="badge d-inline-flex align-items-center gap-1 shadow-xs text-white" style="background-color: #5c7f1a; font-size: 0.7rem;"><i class="bi bi-bag-check-fill"></i> Shopify</span>`;
  }
  if (s.includes('b2b') || s.includes('wholesale') || s.includes('dealer')) {
    return `<span class="badge bg-warning text-dark d-inline-flex align-items-center gap-1" style="font-size: 0.7rem;"><i class="bi bi-buildings-fill"></i> B2B / Dealer</span>`;
  }
  return `<span class="badge bg-light text-dark border d-inline-flex align-items-center gap-1" style="font-size: 0.7rem;"><i class="bi bi-globe"></i> Website</span>`;
}


