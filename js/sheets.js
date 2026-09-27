// ==========================================================================
// XORONIQ CAR CARE - GOOGLE SHEETS INTEGRATION MODULE
// Automated order syncing, Webhook dispatch, offline retry queue & CSV export
// ==========================================================================

import { getStorage, setStorage } from './utils.js';

// Configuration keys
export const STORAGE_SHEETS_URL_KEY = 'xoroniq_sheets_webhook_url';
export const STORAGE_PENDING_ORDERS_KEY = 'xoroniq_pending_sheets_orders';

// Fallback / default webhook URL (can be set directly or via Admin Orders dashboard)
export const DEFAULT_SHEETS_WEBHOOK_URL = '';

/**
 * Retrieve the active Google Sheets Webhook URL
 */
export function getGoogleSheetsWebhookUrl() {
  const custom = getStorage(STORAGE_SHEETS_URL_KEY);
  if (custom && custom.trim().startsWith('https://script.google.com/')) {
    return custom.trim();
  }
  return DEFAULT_SHEETS_WEBHOOK_URL;
}

/**
 * Save custom Google Sheets Webhook URL
 */
export function setGoogleSheetsWebhookUrl(url) {
  const clean = (url || '').trim();
  setStorage(STORAGE_SHEETS_URL_KEY, clean);
  return clean;
}

/**
 * Convert order object to standardized payload for Google Sheets
 */
export function formatOrderForSheets(orderData) {
  const customer = orderData.customer || {};
  const shippingAddress = orderData.shippingAddress || {};
  const payment = orderData.payment || {};
  const items = Array.isArray(orderData.items) ? orderData.items : [];

  let itemsSummary = '';
  let totalItemsCount = 0;

  items.forEach((item, index) => {
    const qty = Number(item.quantity) || 1;
    totalItemsCount += qty;
    const itemDesc = `${item.name} (${qty}x ₹${item.price || 0})${item.sku ? ' [' + item.sku + ']' : ''}`;
    itemsSummary += (index === 0 ? '' : '; ') + itemDesc;
  });

  // IST formatted timestamp
  const now = new Date();
  const timestampStr = now.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return {
    timestamp: timestampStr,
    orderId: orderData.orderId || `XOR-${Date.now().toString().slice(-6)}`,
    status: orderData.orderStatus || (orderData.payment?.method === 'COD' ? 'Order Placed (COD)' : 'Payment Confirmed'),
    customerName: customer.name || '',
    customerPhone: customer.phone || '',
    customerEmail: customer.email || '',
    address: shippingAddress.address || '',
    city: shippingAddress.city || '',
    state: shippingAddress.state || '',
    pincode: shippingAddress.pincode || '',
    items: itemsSummary || 'Standard Order Items',
    itemsCount: totalItemsCount,
    subtotal: Number(orderData.subtotal) || 0,
    shipping: Number(orderData.shipping) || 0,
    codFee: Number(orderData.codFee || (orderData.payment?.method === 'COD' ? 20 : 0)),
    total: Number(orderData.total) || 0,
    paymentMethod: payment.method === 'COD' ? 'CASH ON DELIVERY' : (payment.method || 'RAZORPAY'),
    paymentId: payment.razorpayPaymentId || payment.paymentId || (payment.method === 'COD' ? `COD (Pay ₹${orderData.total})` : ''),
    courier: orderData.courier || (orderData.trackingId ? 'Delhivery' : ''),
    trackingId: orderData.trackingId || '',
    trackingUrl: orderData.trackingUrl || (orderData.trackingId ? `https://www.delhivery.com/track/package/${orderData.trackingId}` : ''),
    adSource: orderData.attribution?.source || '',
    adCampaign: orderData.attribution?.campaign || '',
    adMedium: orderData.attribution?.medium || ''
  };
}

/**
 * Send an order to Google Sheets Webhook
 * Uses text/plain and no-cors to avoid browser CORS / preflight blocks with Google Apps Script
 */
export async function sendOrderToGoogleSheets(orderData) {
  const webhookUrl = getGoogleSheetsWebhookUrl();
  const payload = formatOrderForSheets(orderData);

  // If no webhook URL is configured yet, enqueue the order for future sync
  if (!webhookUrl) {
    console.info('Google Sheets sync: No webhook URL configured yet. Storing order in pending queue.');
    queuePendingOrder(payload);
    return { success: false, queued: true, message: 'No webhook URL set' };
  }

  try {
    // Google Apps Script accepts text/plain JSON without triggering CORS preflight errors
    const response = await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    console.log(`✓ Order ${payload.orderId} successfully dispatched to Google Sheets.`);
    return { success: true, orderId: payload.orderId };
  } catch (err) {
    console.warn(`Could not immediately send order ${payload.orderId} to Google Sheets:`, err);
    queuePendingOrder(payload);
    return { success: false, queued: true, error: err.message };
  }
}

/**
 * Add an order payload to the offline/pending sync queue
 */
function queuePendingOrder(payload) {
  try {
    const pending = getStorage(STORAGE_PENDING_ORDERS_KEY) || [];
    // Prevent duplicate entries for the same orderId
    const exists = pending.some(o => o.orderId === payload.orderId);
    if (!exists) {
      pending.push(payload);
      setStorage(STORAGE_PENDING_ORDERS_KEY, pending);
    }
  } catch (e) {
    console.error('Error queuing order for Google Sheets:', e);
  }
}

/**
 * Get all pending orders awaiting sync
 */
export function getPendingOrders() {
  return getStorage(STORAGE_PENDING_ORDERS_KEY) || [];
}

/**
 * Sync all pending orders from the local queue to Google Sheets
 */
export async function flushPendingOrdersToSheets() {
  const webhookUrl = getGoogleSheetsWebhookUrl();
  if (!webhookUrl) {
    return { success: false, message: 'Google Sheets Webhook URL is not set.' };
  }

  const pending = getPendingOrders();
  if (pending.length === 0) {
    return { success: true, count: 0, message: 'No pending orders to sync.' };
  }

  let synced = 0;
  const remaining = [];

  for (const order of pending) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(order)
      });
      synced++;
    } catch (e) {
      remaining.push(order);
    }
  }

  setStorage(STORAGE_PENDING_ORDERS_KEY, remaining);
  return { success: true, count: synced, remaining: remaining.length };
}

/**
 * Export orders array directly to a formatted CSV file compatible with Excel and Google Sheets
 */
export function exportOrdersToCSV(orders = []) {
  if (!orders || orders.length === 0) {
    throw new Error('No orders available to export.');
  }

  const headers = [
    'Order ID',
    'Date & Time',
    'Status',
    'Customer Name',
    'Phone',
    'Email',
    'Address',
    'City',
    'State',
    'Pincode',
    'Items',
    'Subtotal (INR)',
    'Shipping (INR)',
    'Total (INR)',
    'Payment Method',
    'Payment ID',
    'Courier',
    'Tracking ID / AWB',
    'Ad Source',
    'Ad Campaign'
  ];

  const escapeCSV = (val) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = orders.map(order => {
    const customer = order.customer || {};
    const addr = order.shippingAddress || {};
    const pay = order.payment || {};
    const items = (order.items || []).map(i => `${i.name} (x${i.quantity || 1})`).join('; ');
    const attr = order.attribution || {};

    let dateStr = '—';
    if (order.createdAt) {
      const d = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      dateStr = d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    }

    return [
      escapeCSV(order.orderId || ''),
      escapeCSV(dateStr),
      escapeCSV(order.orderStatus || 'Payment Confirmed'),
      escapeCSV(customer.name || ''),
      escapeCSV(customer.phone ? `\t${customer.phone}` : ''), // tab prefix preserves leading zero
      escapeCSV(customer.email || ''),
      escapeCSV(addr.address || ''),
      escapeCSV(addr.city || ''),
      escapeCSV(addr.state || ''),
      escapeCSV(addr.pincode ? `\t${addr.pincode}` : ''),
      escapeCSV(items),
      escapeCSV(order.subtotal || 0),
      escapeCSV(order.shipping || 0),
      escapeCSV(order.total || 0),
      escapeCSV(pay.method || 'RAZORPAY'),
      escapeCSV(pay.razorpayPaymentId || ''),
      escapeCSV(order.courier || (order.trackingId ? 'Delhivery' : '')),
      escapeCSV(order.trackingId || ''),
      escapeCSV(attr.source || ''),
      escapeCSV(attr.campaign || '')
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const now = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `xoroniq_orders_${now}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
