// ==========================================================================
// XORONIQ CAR CARE - ORDER MANAGEMENT & DISPATCH ENGINE
// Customer Live Tracking Timeline & Feature-Loaded Admin Order Fulfillment Hub
// ==========================================================================

import { 
  getOrderById, 
  searchOrders, 
  getOrders, 
  createOrder,
  createBulkOrders,
  updateOrderStatus, 
  updateOrderTracking, 
  deleteOrder, 
  deleteMultipleOrders,
  updateOrderAdminNote
} from './firebase.js';

import { 
  formatCurrency, 
  formatDate, 
  showToast, 
  getSourceBadgeHtml, 
  numberToWordsINR, 
  isKeralaAddress 
} from './utils.js';

import {
  exportOrdersToCSV,
  getGoogleSheetsWebhookUrl,
  setGoogleSheetsWebhookUrl,
  sendOrderToGoogleSheets
} from './sheets.js';
import { CONFIG } from './config.js';

// ==========================================================================
// CUSTOMER ORDER TRACKING PAGE (tracking.html)
// ==========================================================================

export function initTrackingPage() {
  const form = document.getElementById('tracking-search-form');
  const input = document.getElementById('tracking-search-input');
  const resultContainer = document.getElementById('tracking-result-container');

  // Check if orderId is in URL query
  const urlParams = new URLSearchParams(window.location.search);
  const paramOrderId = urlParams.get('orderId');
  if (paramOrderId && input) {
    input.value = paramOrderId;
    executeTrackingSearch(paramOrderId);
  }

  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const term = input.value.trim();
      if (!term) {
        showToast('Please enter an Order ID or Phone number.', 'warning');
        return;
      }
      executeTrackingSearch(term);
    });
  }

  async function executeTrackingSearch(term) {
    if (!resultContainer) return;

    resultContainer.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-accent mb-3"></div>
        <p class="font-heading small letter-spacing-wide text-muted-custom">LOCATING YOUR XORONIQ SHIPMENT...</p>
      </div>
    `;

    try {
      let order = null;
      const cleanTerm = term.trim();

      // 1. Try secure backend tracking API first
      try {
        const isPhone = /^\d{10}$/.test(cleanTerm.replace(/\D/g, ''));
        const queryParam = isPhone ? `phone=${encodeURIComponent(cleanTerm.replace(/\D/g, ''))}` : `orderId=${encodeURIComponent(cleanTerm)}`;
        const res = await fetch(`${CONFIG.API_BASE_URL}/track-order?${queryParam}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.order) {
            order = data.order;
          }
        }
      } catch (apiErr) {
        console.warn('Backend tracking API attempt note:', apiErr);
      }

      // 2. Fallback to direct targeted queries
      if (!order) {
        order = await getOrderById(cleanTerm);
      }
      if (!order) {
        const results = await searchOrders(cleanTerm);
        if (results.length > 0) order = results[0];
      }

      if (!order) {
        resultContainer.innerHTML = `
          <div class="admin-card p-4 p-md-5 text-center">
            <i class="bi bi-search text-muted-custom display-4 mb-3"></i>
            <h4 class="font-heading text-black fw-bold">ORDER NOT FOUND</h4>
            <p class="text-muted-custom small mb-4">No order matched "<strong>${cleanTerm}</strong>". Please verify your Order ID or mobile number.</p>
            <a href="contact.html" class="btn btn-x-outline-accent btn-sm">CONTACT CONCIERGE</a>
          </div>
        `;
        return;
      }

      renderOrderTimeline(order);
    } catch (e) {
      console.error('Error tracking order:', e);
      resultContainer.innerHTML = `<p class="text-danger text-center">Failed to fetch order tracking status.</p>`;
    }
  }

  function renderOrderTimeline(order) {
    const isCodOrder = order.payment?.method === 'COD' || (order.orderStatus && order.orderStatus.includes('COD'));
    const statuses = [
      isCodOrder ? 'Order Placed (COD)' : 'Payment Confirmed',
      'Processing',
      'Shipped',
      'Delivered'
    ];

    const currentStatus = order.orderStatus || (isCodOrder ? 'Order Placed (COD)' : 'Payment Confirmed');
    const currentIndex = statuses.indexOf(currentStatus) > -1 ? statuses.indexOf(currentStatus) : 0;
    const trackingUrl = order.trackingUrl || (order.trackingId ? `https://www.delhivery.com/track/package/${order.trackingId}` : null);

    resultContainer.innerHTML = `
      <div class="glass-panel-heavy p-4 p-md-5">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 border-bottom border-secondary border-opacity-25 pb-4 mb-4">
          <div>
            <span class="section-tag mb-1">LIVE DISPATCH TRACKER</span>
            <h3 class="font-heading text-black fw-bold mb-0">ORDER #${order.orderId}</h3>
            <div class="text-muted-custom small mt-1">Placed on ${formatDate(order.createdAt)}</div>
          </div>
          <div>
            <span class="badge-status status-shipped fs-6 py-2 px-3">
              <i class="bi bi-geo-alt-fill me-1"></i> STATUS: ${currentStatus.toUpperCase()}
            </span>
          </div>
        </div>

        <!-- Delhivery Live Shipping Tracker Card -->
        <div class="p-4 rounded-4 mb-4 ${order.trackingId ? 'bg-white border border-secondary border-opacity-25 shadow-sm' : 'bg-surface-custom border border-secondary border-opacity-25'}">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="badge bg-danger text-white px-2 py-1 small fw-bold">
                  <i class="bi bi-truck me-1"></i> DELHIVERY EXPRESS
                </span>
                <span class="text-muted-custom small">Official Shipping Partner</span>
              </div>
              ${order.trackingId ? `
                <div class="fs-5 text-black font-mono fw-bold mt-2 d-flex align-items-center gap-2 flex-wrap">
                  <span>AWB: <strong>${order.trackingId}</strong></span>
                  <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2 copy-awb-btn" data-awb="${order.trackingId}" title="Copy Delhivery AWB">
                    <i class="bi bi-clipboard me-1"></i> Copy AWB
                  </button>
                </div>
                <div class="text-muted-custom small mt-1">
                  Your shipment is registered with Delhivery. Real-time courier transit, dispatch hubs, and live out-for-delivery milestones can be viewed directly on Delhivery.
                </div>
              ` : `
                <div class="text-dark small mt-2">
                  <i class="bi bi-clock-history text-accent me-1"></i> <strong>Awaiting Dispatch:</strong> Your order is being packed. Your Delhivery tracking AWB number will appear here the moment it leaves our fulfillment hub.
                </div>
              `}
            </div>
            ${order.trackingId ? `
              <div>
                <a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-x-primary px-4 py-2 d-inline-flex align-items-center gap-2 shadow-sm">
                  <span>TRACK LIVE ON DELHIVERY</span>
                  <i class="bi bi-box-arrow-up-right"></i>
                </a>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Animated Steps Timeline -->
        <div class="py-4">
          <div class="position-relative">
            <div class="row text-center g-3">
              ${statuses.map((step, idx) => {
                const isDone = idx < currentIndex;
                const isCurrent = idx === currentIndex;
                return `
                  <div class="col-3">
                    <div class="d-flex flex-column align-items-center">
                      <div class="rounded-circle d-flex align-items-center justify-content-center mb-2 shadow-sm ${isCurrent ? 'bg-black text-white ring-accent' : isDone ? 'bg-success text-white' : 'bg-surface-custom text-muted-custom border border-secondary border-opacity-25'}" style="width: 48px; height: 48px; font-size: 1.25rem;">
                        ${isDone ? '<i class="bi bi-check-lg"></i>' : (idx + 1)}
                      </div>
                      <div class="font-heading fw-bold ${isCurrent ? 'text-black' : isDone ? 'text-success' : 'text-muted-custom'}" style="font-size: 0.85rem;">
                        ${step}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Shipping & Products Info -->
        <div class="row g-4 mt-2">
          <div class="col-md-6">
            <h5 class="font-heading text-black fw-bold mb-3">DESTINATION DETAILS</h5>
            <div class="p-3 bg-surface-custom rounded border border-secondary border-opacity-25 small">
              <div class="text-black fw-bold">${order.customer?.name || 'Customer'}</div>
              ${order.customer?.phone || order.customer?.email ? `<div class="text-muted-custom">${[order.customer?.phone, order.customer?.email].filter(Boolean).join(' • ')}</div>` : ''}
              ${order.shippingAddress?.address ? `<div class="mt-2 text-dark">${order.shippingAddress.address}</div>` : ''}
              <div class="text-dark">${[order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(', ')}${order.shippingAddress?.pincode ? ' - ' + order.shippingAddress.pincode : ''}</div>
            </div>
          </div>

          <div class="col-md-6">
            <h5 class="font-heading text-black fw-bold mb-3">ITEMS ORDERED</h5>
            <div class="p-3 bg-surface-custom rounded border border-secondary border-opacity-25 small">
              ${(order.items || []).map(item => `
                <div class="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                  <span class="text-black">${item.name} <span class="text-muted-custom">x${item.quantity}</span></span>
                  <span class="font-mono text-accent">${formatCurrency(item.price * item.quantity)}</span>
                </div>
              `).join('')}
              <div class="d-flex justify-content-between pt-2 fw-bold text-black font-heading">
                <span>TOTAL PAID</span>
                <span class="text-accent">${formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach copy AWB listener
    const copyBtn = resultContainer.querySelector('.copy-awb-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const awb = copyBtn.getAttribute('data-awb');
        if (awb) {
          try {
            await navigator.clipboard.writeText(awb);
            showToast(`Delhivery AWB ${awb} copied to clipboard!`, 'success');
          } catch (e) {
            showToast(`AWB: ${awb}`, 'info');
          }
        }
      });
    }
  }
}

// ==========================================================================
// ADMIN ORDERS MANAGEMENT & DISPATCH HUB (admin/orders.html)
// ==========================================================================

export async function initAdminOrdersPage() {
  const tableBody = document.getElementById('admin-orders-table-body');
  const searchInput = document.getElementById('admin-orders-search');
  const sourceFilter = document.getElementById('admin-orders-source-filter');
  const statusFilter = document.getElementById('admin-orders-filter');
  const paymentFilter = document.getElementById('admin-orders-payment-filter');
  const dateFilter = document.getElementById('admin-orders-date-filter');
  const regionFilter = document.getElementById('admin-orders-region-filter');
  const resetFiltersBtn = document.getElementById('reset-filters-btn');
  const refreshBtn = document.getElementById('refresh-orders-btn');
  const totalCountBadge = document.getElementById('admin-orders-count');
  const activeFilterBadge = document.getElementById('admin-orders-active-filter-badge');

  // KPI Stat counters
  const statAll = document.getElementById('stat-count-all');
  const statAwaiting = document.getElementById('stat-count-awaiting');
  const statShipped = document.getElementById('stat-count-shipped');
  const statDelivered = document.getElementById('stat-count-delivered');
  const statCancelled = document.getElementById('stat-count-cancelled');
  const statRevenue = document.getElementById('stat-total-revenue');

  // Bulk actions toolbar elements
  const bulkToolbar = document.getElementById('bulk-actions-toolbar');
  const bulkCountSpan = document.getElementById('bulk-selected-count');
  const selectAllCheckbox = document.getElementById('select-all-orders');
  const bulkToolbarToggle = document.getElementById('bulk-toolbar-toggle-all');
  const bulkStatusSelect = document.getElementById('bulk-status-select');
  const applyBulkStatusBtn = document.getElementById('apply-bulk-status-btn');
  const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
  const bulkExportBtn = document.getElementById('bulk-export-btn');

  if (!tableBody) return;

  let allOrders = [];
  let selectedOrderIds = new Set();
  let activeStatusChip = 'ALL';
  let pendingDeleteTarget = null; // { type: 'single' | 'bulk', order: Object, ids: Array }

  // ------------------------------------------------------------------------
  // Email Status Helper
  // ------------------------------------------------------------------------
  function renderEmailStatusBadge(order) {
    const isSent = order.emailStatus === 'SENT' || (order.partnerEmailStatus === 'SENT' && order.customerEmailStatus === 'SENT');
    const isFailed = order.emailStatus === 'FAILED' || order.partnerEmailStatus === 'FAILED' || order.customerEmailStatus === 'FAILED';
    const isPending = order.emailStatus === 'PENDING' || order.partnerEmailStatus === 'PENDING' || order.customerEmailStatus === 'PENDING';

    if (isSent) {
      return `<span class="badge bg-success bg-opacity-25 text-success border border-success" style="font-size: 0.68rem;" title="Order notifications successfully delivered to partners and customer"><i class="bi bi-envelope-check-fill me-1"></i>EMAIL SENT</span>`;
    }
    if (isFailed) {
      return `<span class="badge bg-danger bg-opacity-25 text-danger border border-danger" style="font-size: 0.68rem;" title="${order.emailError || 'Failed to dispatch email'}"><i class="bi bi-envelope-exclamation-fill me-1"></i>FAILED</span>`;
    }
    if (isPending) {
      return `<span class="badge bg-warning bg-opacity-25 text-dark border border-warning" style="font-size: 0.68rem;"><i class="bi bi-hourglass-split me-1"></i>PENDING</span>`;
    }
    return `<span class="badge bg-light text-muted-custom border" style="font-size: 0.68rem;">NOT SENT</span>`;
  }

  // ------------------------------------------------------------------------
  // Data Loading & KPI Calculation
  // ------------------------------------------------------------------------
  async function loadOrders() {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center py-5">
          <div class="spinner-border text-accent spinner-border-sm mb-2"></div>
          <div class="text-muted-custom small">Loading XORONIQ orders database...</div>
        </td>
      </tr>
    `;

    try {
      allOrders = await getOrders();
      // Sort newest first
      allOrders.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      selectedOrderIds.clear();
      updateBulkToolbarUI();
      updateKpiCounters();
      renderOrdersList();
      buildCustomerDirectory();
    } catch (e) {
      console.error('Error fetching admin orders:', e);
      tableBody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-danger">Failed to load orders from Firestore.</td></tr>`;
    }
  }

  function updateKpiCounters() {
    const total = allOrders.length;
    const awaiting = allOrders.filter(o => o.orderStatus === 'Payment Confirmed' || o.orderStatus === 'Processing' || o.orderStatus === 'Order Placed (COD)').length;
    const shipped = allOrders.filter(o => o.orderStatus === 'Shipped').length;
    const delivered = allOrders.filter(o => o.orderStatus === 'Delivered').length;
    const cancelled = allOrders.filter(o => o.orderStatus === 'Cancelled').length;
    const revenue = allOrders
      .filter(o => o.orderStatus !== 'Cancelled')
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    if (statAll) statAll.textContent = total;
    if (statAwaiting) statAwaiting.textContent = awaiting;
    if (statShipped) statShipped.textContent = shipped;
    if (statDelivered) statDelivered.textContent = delivered;
    if (statCancelled) statCancelled.textContent = cancelled;
    if (statRevenue) statRevenue.textContent = formatCurrency(revenue);
  }

  // ------------------------------------------------------------------------
  // Filter & Search Logic
  // ------------------------------------------------------------------------
  function getFilteredOrders() {
    let filtered = [...allOrders];
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const sourceVal = sourceFilter ? sourceFilter.value : 'ALL';
    const statusVal = statusFilter ? statusFilter.value : 'ALL';
    const paymentVal = paymentFilter ? paymentFilter.value : 'ALL';
    const dateVal = dateFilter ? dateFilter.value : 'ALL';
    const regionVal = regionFilter ? regionFilter.value : 'ALL';

    // 0. Source Filter
    if (sourceVal !== 'ALL') {
      filtered = filtered.filter(o => {
        const s = String(o.source || 'Website').toLowerCase();
        return s.includes(sourceVal.toLowerCase());
      });
    }

    // 1. Status Chip / Status Filter
    if (activeStatusChip === 'AWAITING_DISPATCH') {
      filtered = filtered.filter(o => o.orderStatus === 'Payment Confirmed' || o.orderStatus === 'Processing' || o.orderStatus === 'Order Placed (COD)');
    } else if (activeStatusChip !== 'ALL') {
      filtered = filtered.filter(o => o.orderStatus === activeStatusChip);
    } else if (statusVal !== 'ALL') {
      filtered = filtered.filter(o => o.orderStatus === statusVal);
    }

    // 2. Payment Method
    if (paymentVal === 'RAZORPAY') {
      filtered = filtered.filter(o => o.payment?.method !== 'COD' && (!o.orderStatus || !o.orderStatus.includes('COD')));
    } else if (paymentVal === 'COD') {
      filtered = filtered.filter(o => o.payment?.method === 'COD' || (o.orderStatus && o.orderStatus.includes('COD')));
    }

    // 3. Region Filter (Kerala vs Rest of India)
    if (regionVal === 'KERALA') {
      filtered = filtered.filter(o => {
        const state = (o.shippingAddress?.state || '').toLowerCase();
        const pin = String(o.shippingAddress?.pincode || '');
        return state.includes('kerala') || pin.startsWith('67') || pin.startsWith('68') || pin.startsWith('69');
      });
    } else if (regionVal === 'ROI') {
      filtered = filtered.filter(o => {
        const state = (o.shippingAddress?.state || '').toLowerCase();
        const pin = String(o.shippingAddress?.pincode || '');
        const isKerala = state.includes('kerala') || pin.startsWith('67') || pin.startsWith('68') || pin.startsWith('69');
        return !isKerala;
      });
    }

    // 4. Date Range Filter
    if (dateVal !== 'ALL') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfYesterday = startOfToday - 86400000;
      const sevenDaysAgo = now.getTime() - 7 * 86400000;
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      filtered = filtered.filter(o => {
        const orderTime = o.createdAt?.seconds ? o.createdAt.seconds * 1000 : new Date(o.createdAt || 0).getTime();
        if (dateVal === 'TODAY') return orderTime >= startOfToday;
        if (dateVal === 'YESTERDAY') return orderTime >= startOfYesterday && orderTime < startOfToday;
        if (dateVal === 'LAST_7_DAYS') return orderTime >= sevenDaysAgo;
        if (dateVal === 'THIS_MONTH') return orderTime >= startOfMonth;
        return true;
      });
    }

    // 5. Search text
    if (searchTerm) {
      filtered = filtered.filter(o => 
        (o.orderId || '').toLowerCase().includes(searchTerm) ||
        (o.customer?.name || '').toLowerCase().includes(searchTerm) ||
        (o.customer?.phone || '').includes(searchTerm) ||
        (o.customer?.email || '').toLowerCase().includes(searchTerm) ||
        (o.shippingAddress?.city || '').toLowerCase().includes(searchTerm) ||
        (o.shippingAddress?.state || '').toLowerCase().includes(searchTerm) ||
        (o.shippingAddress?.pincode || '').includes(searchTerm) ||
        (o.trackingId || '').toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  }

  // ------------------------------------------------------------------------
  // Render Orders Table
  // ------------------------------------------------------------------------
  function renderOrdersList() {
    const filtered = getFilteredOrders();

    if (totalCountBadge) totalCountBadge.textContent = `${filtered.length} Orders`;
    if (activeFilterBadge) {
      let label = 'Showing: All';
      if (activeStatusChip !== 'ALL') label = `Status: ${activeStatusChip}`;
      else if (statusFilter && statusFilter.value !== 'ALL') label = `Status: ${statusFilter.value}`;
      if (paymentFilter && paymentFilter.value !== 'ALL') label += ` • Payment: ${paymentFilter.value}`;
      if (dateFilter && dateFilter.value !== 'ALL') label += ` • Date: ${dateFilter.value}`;
      activeFilterBadge.textContent = label;
    }

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-5">
            <i class="bi bi-inbox fs-2 text-muted-custom d-block mb-2"></i>
            <div class="fw-bold text-dark">No orders matched the current filter criteria</div>
            <div class="text-muted-custom small mt-1">Try clearing search terms or changing status filter.</div>
          </td>
        </tr>
      `;
      updateBulkToolbarUI();
      return;
    }

    tableBody.innerHTML = filtered.map(order => {
      const isSelected = selectedOrderIds.has(order.id);
      const isCodOrder = order.payment?.method === 'COD' || (order.orderStatus && order.orderStatus.includes('COD'));
      const trackingUrl = order.trackingUrl || (order.trackingId ? `https://www.delhivery.com/track/package/${order.trackingId}` : null);
      const city = order.shippingAddress?.city || '';
      const state = order.shippingAddress?.state || '';
      const pincode = order.shippingAddress?.pincode || '';

      return `
        <tr data-id="${order.id}" class="${isSelected ? 'table-active' : ''}">
          <td class="text-center">
            <input type="checkbox" class="form-check-input order-select-checkbox" data-id="${order.id}" ${isSelected ? 'checked' : ''}>
          </td>
          <td>
            <div class="d-flex align-items-center gap-1">
              <span class="font-mono text-black fw-bold fs-6">#${order.orderId}</span>
              ${order.adminNote ? `<i class="bi bi-chat-left-text-fill text-accent" title="Note: ${order.adminNote}" style="font-size: 0.75rem;"></i>` : ''}
            </div>
            <div class="text-muted-custom small" style="font-size: 0.72rem;">${order.id}</div>
          </td>
          <td>
            ${getSourceBadgeHtml(order.source)}
            ${order.externalOrderId ? `<div class="font-mono text-muted small mt-1" style="font-size: 0.68rem;" title="External Reference">Ref: ${order.externalOrderId}</div>` : ''}
          </td>
          <td>
            <div class="d-flex align-items-center gap-2">
              <span class="text-black fw-semibold">${order.customer?.name || 'Customer'}</span>
              ${order.customer?.phone ? `
                <button type="button" class="btn btn-sm btn-whatsapp-action btn-action-icon quick-whatsapp-btn" data-id="${order.id}" title="Message customer on WhatsApp">
                  <i class="bi bi-whatsapp" style="font-size: 0.85rem;"></i>
                </button>
              ` : ''}
            </div>
            <div class="text-muted-custom small font-mono">${order.customer?.phone || 'No phone'}</div>
          </td>
          <td>
            <div class="text-dark small">${formatDate(order.createdAt)}</div>
            <div class="text-muted-custom" style="font-size: 0.72rem;">
              <i class="bi bi-geo-alt text-accent me-1"></i>${city ? `${city}, ` : ''}${state} ${pincode ? `(${pincode})` : ''}
            </div>
          </td>
          <td>
            <span class="badge bg-light text-dark border">
              ${(order.items || []).length} item${(order.items || []).length === 1 ? '' : 's'}
            </span>
          </td>
          <td>
            <div class="font-mono text-accent fw-bold">${formatCurrency(order.total)}</div>
            <div>
              ${isCodOrder ? `
                <span class="badge bg-warning bg-opacity-25 text-dark border border-warning" style="font-size: 0.65rem;">COD</span>
              ` : `
                <span class="badge bg-success bg-opacity-25 text-success" style="font-size: 0.65rem;">PREPAID</span>
              `}
            </div>
          </td>
          <td>
            <select class="form-select form-select-sm bg-white text-dark border order-status-select py-1 px-2" data-id="${order.id}" style="font-size: 0.78rem; min-width: 140px;">
              <option value="Payment Confirmed" ${order.orderStatus === 'Payment Confirmed' ? 'selected' : ''}>Payment Confirmed</option>
              <option value="Processing" ${order.orderStatus === 'Processing' ? 'selected' : ''}>Processing</option>
              <option value="Shipped" ${order.orderStatus === 'Shipped' ? 'selected' : ''}>Shipped</option>
              <option value="Delivered" ${order.orderStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Cancelled" ${order.orderStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
              <option value="Order Placed (COD)" ${order.orderStatus === 'Order Placed (COD)' ? 'selected' : ''}>Order Placed (COD)</option>
            </select>
          </td>
          <td>
            ${renderEmailStatusBadge(order)}
          </td>
          <td>
            ${order.trackingId ? `
              <div class="d-flex flex-column gap-1">
                <div class="d-flex align-items-center gap-1">
                  <span class="badge bg-danger text-white font-mono px-2 py-1" style="font-size: 0.72rem; letter-spacing: 0.5px;">
                    <i class="bi bi-truck me-1"></i>${order.trackingId}
                  </span>
                  <a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-secondary py-0 px-1" title="Track Live on Delhivery">
                    <i class="bi bi-box-arrow-up-right" style="font-size: 0.72rem;"></i>
                  </a>
                </div>
                <button type="button" class="btn btn-link btn-sm text-accent p-0 text-start open-tracking-modal-btn" data-id="${order.id}" style="font-size: 0.72rem; text-decoration: none;">
                  <i class="bi bi-pencil-square me-1"></i>Edit AWB
                </button>
              </div>
            ` : `
              <button type="button" class="btn btn-outline-danger btn-sm py-1 px-2 open-tracking-modal-btn" data-id="${order.id}" style="font-size: 0.75rem;">
                <i class="bi bi-truck me-1"></i> Add Delhivery AWB
              </button>
            `}
          </td>
          <td class="actions-cell text-end">
            <div class="d-inline-flex align-items-center gap-1 justify-content-end">
              <!-- View Details -->
              <button class="btn btn-light border btn-sm view-order-modal-btn py-1 px-2" data-id="${order.id}" title="View Order Details">
                <i class="bi bi-eye"></i>
              </button>
              <!-- Open in Invoice Studio -->
              <a href="invoice.html?orderId=${encodeURIComponent(order.orderId)}" target="_blank" class="btn btn-light border btn-sm py-1 px-2" title="Open in Invoice Studio">
                <i class="bi bi-receipt-cutoff text-dark"></i>
              </a>
              <!-- Delete Order -->
              <button class="btn btn-danger btn-sm delete-single-order-btn py-1 px-2 fw-semibold d-inline-flex align-items-center gap-1 shadow-sm text-white" data-id="${order.id}" title="Permanently Delete Order">
                <i class="bi bi-trash3-fill"></i>
                <span>Delete</span>
              </button>
              <!-- Print Packing Slip / Invoice -->
              <button class="btn btn-light border btn-sm print-order-slip-btn py-1 px-2" data-id="${order.id}" title="Print Packing Slip / Tax Invoice">
                <i class="bi bi-printer"></i>
              </button>
              <!-- WhatsApp Message -->
              <button class="btn btn-whatsapp-action btn-sm py-1 px-2 row-whatsapp-btn" data-id="${order.id}" title="Send WhatsApp Update to Customer">
                <i class="bi bi-whatsapp"></i>
              </button>
              <!-- Sync Sheet -->
              <button class="btn btn-light border btn-sm sync-order-sheet-btn py-1 px-2" data-id="${order.id}" title="Push to Google Sheet">
                <i class="bi bi-file-earmark-spreadsheet text-success"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    attachTableActionListeners();
    updateBulkToolbarUI();
  }

  // ------------------------------------------------------------------------
  // Table Action Listeners
  // ------------------------------------------------------------------------
  function attachTableActionListeners() {
    // Checkbox toggles
    tableBody.querySelectorAll('.order-select-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = chk.getAttribute('data-id');
        if (chk.checked) {
          selectedOrderIds.add(id);
        } else {
          selectedOrderIds.delete(id);
        }
        updateBulkToolbarUI();
      });
    });

    // Inline Status Change
    tableBody.querySelectorAll('.order-status-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = select.getAttribute('data-id');
        const newStatus = e.target.value;
        const order = allOrders.find(o => o.id === id);

        if (newStatus === 'Shipped' && (!order || !order.trackingId)) {
          if (order) openTrackingModal(order);
          return;
        }

        try {
          await updateOrderStatus(id, newStatus);
          if (order) {
            order.orderStatus = newStatus;
            sendOrderToGoogleSheets(order).catch(err => console.warn('Sheets sync note:', err));
          }
          updateKpiCounters();
          showToast(`Order status updated to ${newStatus}`, 'success');
        } catch (err) {
          showToast('Failed to update status', 'error');
        }
      });
    });

    // Delhivery Modal
    tableBody.querySelectorAll('.open-tracking-modal-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const order = allOrders.find(o => o.id === id);
        if (order) openTrackingModal(order);
      });
    });

    // Details Modal
    tableBody.querySelectorAll('.view-order-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const order = allOrders.find(o => o.id === id);
        if (order) openAdminOrderModal(order);
      });
    });

    // Print Invoice / Slip
    tableBody.querySelectorAll('.print-order-slip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const order = allOrders.find(o => o.id === id);
        if (order) openInvoiceModal(order);
      });
    });

    // WhatsApp Update
    tableBody.querySelectorAll('.quick-whatsapp-btn, .row-whatsapp-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const order = allOrders.find(o => o.id === id);
        if (order) sendCustomerWhatsApp(order);
      });
    });

    // Single Delete
    tableBody.querySelectorAll('.delete-single-order-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const order = allOrders.find(o => o.id === id);
        if (order) triggerDeleteConfirmation('single', order);
      });
    });

    // Push to Google Sheets
    tableBody.querySelectorAll('.sync-order-sheet-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const order = allOrders.find(o => o.id === id);
        if (!order) return;

        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

        try {
          const res = await sendOrderToGoogleSheets(order);
          if (res.queued) {
            showToast(`Order queued! Configure your Google Sheets Webhook URL to complete sync.`, 'warning');
          } else {
            showToast(`Order ${order.orderId} dispatched to Google Sheets!`, 'success');
          }
        } catch (err) {
          showToast('Failed to sync to Google Sheets: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
        }
      });
    });
  }

  // ------------------------------------------------------------------------
  // Bulk Actions Handling
  // ------------------------------------------------------------------------
  function updateBulkToolbarUI() {
    const count = selectedOrderIds.size;
    if (bulkCountSpan) bulkCountSpan.textContent = count;

    if (bulkToolbar) {
      bulkToolbar.style.display = count > 0 ? 'flex' : 'none';
    }

    if (selectAllCheckbox) {
      const visibleCheckboxes = tableBody.querySelectorAll('.order-select-checkbox');
      if (visibleCheckboxes.length > 0 && count >= visibleCheckboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else if (count > 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
      } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      }
    }

    if (bulkToolbarToggle) {
      bulkToolbarToggle.checked = count > 0;
    }
  }

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', () => {
      const filtered = getFilteredOrders();
      if (selectAllCheckbox.checked) {
        filtered.forEach(o => selectedOrderIds.add(o.id));
      } else {
        selectedOrderIds.clear();
      }
      renderOrdersList();
    });
  }

  if (bulkToolbarToggle) {
    bulkToolbarToggle.addEventListener('change', () => {
      if (!bulkToolbarToggle.checked) {
        selectedOrderIds.clear();
        renderOrdersList();
      }
    });
  }

  // Apply Bulk Status Change
  if (applyBulkStatusBtn && bulkStatusSelect) {
    applyBulkStatusBtn.addEventListener('click', async () => {
      const targetStatus = bulkStatusSelect.value;
      if (!targetStatus) {
        showToast('Please select a target status.', 'warning');
        return;
      }

      if (selectedOrderIds.size === 0) {
        showToast('No orders selected.', 'warning');
        return;
      }

      applyBulkStatusBtn.disabled = true;
      applyBulkStatusBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

      let updatedCount = 0;
      for (const id of Array.from(selectedOrderIds)) {
        try {
          await updateOrderStatus(id, targetStatus);
          const o = allOrders.find(item => item.id === id);
          if (o) {
            o.orderStatus = targetStatus;
            sendOrderToGoogleSheets(o).catch(e => console.warn(e));
          }
          updatedCount++;
        } catch (e) {
          console.warn('Bulk status item error:', e);
        }
      }

      applyBulkStatusBtn.disabled = false;
      applyBulkStatusBtn.innerHTML = 'Apply';
      bulkStatusSelect.value = '';
      selectedOrderIds.clear();

      updateKpiCounters();
      renderOrdersList();
      showToast(`Updated status for ${updatedCount} orders to "${targetStatus}"`, 'success');
    });
  }

  // Bulk Delete
  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', () => {
      if (selectedOrderIds.size === 0) {
        showToast('No orders selected for deletion.', 'warning');
        return;
      }
      triggerDeleteConfirmation('bulk', Array.from(selectedOrderIds));
    });
  }

  // Bulk Export Selected
  if (bulkExportBtn) {
    bulkExportBtn.addEventListener('click', () => {
      if (selectedOrderIds.size === 0) {
        showToast('No orders selected to export.', 'warning');
        return;
      }
      const selectedList = allOrders.filter(o => selectedOrderIds.has(o.id));
      exportOrdersToCSV(selectedList);
      showToast(`Exported ${selectedList.length} selected orders to CSV.`, 'success');
    });
  }

  // ------------------------------------------------------------------------
  // Delete Order Confirmation & Execution
  // ------------------------------------------------------------------------
  const deleteModalEl = document.getElementById('deleteOrderModal');
  const deleteModalMsg = document.getElementById('delete-modal-message');
  const deleteModalDetails = document.getElementById('delete-modal-details');
  const confirmDeleteBtn = document.getElementById('confirm-delete-order-btn');

  function triggerDeleteConfirmation(type, target) {
    pendingDeleteTarget = { type, target };
    if (!deleteModalEl) return;

    if (type === 'single') {
      const order = target;
      if (deleteModalMsg) deleteModalMsg.textContent = `Are you sure you want to permanently delete order #${order.orderId}?`;
      if (deleteModalDetails) {
        deleteModalDetails.innerHTML = `
          <div><strong>Order ID:</strong> #${order.orderId}</div>
          <div><strong>Customer:</strong> ${order.customer?.name || 'N/A'} (${order.customer?.phone || 'N/A'})</div>
          <div><strong>Amount:</strong> ${formatCurrency(order.total)}</div>
          <div><strong>Status:</strong> ${order.orderStatus}</div>
        `;
      }
    } else {
      const ids = target;
      if (deleteModalMsg) deleteModalMsg.textContent = `Are you sure you want to permanently delete all ${ids.length} selected orders?`;
      if (deleteModalDetails) {
        deleteModalDetails.innerHTML = `
          <div><strong>Total Selected:</strong> ${ids.length} orders</div>
          <div class="text-danger mt-1">This will purge all ${ids.length} selected order records.</div>
        `;
      }
    }

    const bsModal = window.bootstrap.Modal.getOrCreateInstance(deleteModalEl);
    bsModal.show();
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (!pendingDeleteTarget) return;

      const originalHtml = confirmDeleteBtn.innerHTML;
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Deleting...`;

      try {
        if (pendingDeleteTarget.type === 'single') {
          const order = pendingDeleteTarget.target;
          await deleteOrder(order.id);
          allOrders = allOrders.filter(o => o.id !== order.id);
          selectedOrderIds.delete(order.id);
          showToast(`Order #${order.orderId} deleted permanently.`, 'success');
        } else {
          const ids = pendingDeleteTarget.target;
          const res = await deleteMultipleOrders(ids);
          allOrders = allOrders.filter(o => !ids.includes(o.id));
          selectedOrderIds.clear();
          showToast(`Deleted ${res.success} orders successfully.`, 'success');
        }

        const bsModal = window.bootstrap.Modal.getInstance(deleteModalEl);
        if (bsModal) bsModal.hide();

        // Also close order details modal if open
        const adminOrderModalEl = document.getElementById('admin-order-modal');
        if (adminOrderModalEl) {
          const m = window.bootstrap.Modal.getInstance(adminOrderModalEl);
          if (m) m.hide();
        }

        updateKpiCounters();
        renderOrdersList();
        buildCustomerDirectory();
      } catch (err) {
        showToast('Error deleting orders: ' + err.message, 'error');
      } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerHTML = originalHtml;
        pendingDeleteTarget = null;
      }
    });
  }

  // ------------------------------------------------------------------------
  // Status Chip Filtering
  // ------------------------------------------------------------------------
  document.querySelectorAll('.order-stat-chip[data-status]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.order-stat-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeStatusChip = chip.getAttribute('data-status');
      if (statusFilter) statusFilter.value = 'ALL';
      renderOrdersList();
    });
  });

  // Filter input listeners
  if (searchInput) searchInput.addEventListener('input', renderOrdersList);
  if (sourceFilter) sourceFilter.addEventListener('change', renderOrdersList);
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      activeStatusChip = 'ALL';
      document.querySelectorAll('.order-stat-chip').forEach(c => c.classList.remove('active'));
      const chipAll = document.getElementById('chip-all-orders');
      if (chipAll) chipAll.classList.add('active');
      renderOrdersList();
    });
  }
  if (paymentFilter) paymentFilter.addEventListener('change', renderOrdersList);
  if (dateFilter) dateFilter.addEventListener('change', renderOrdersList);
  if (regionFilter) regionFilter.addEventListener('change', renderOrdersList);

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (sourceFilter) sourceFilter.value = 'ALL';
      if (statusFilter) statusFilter.value = 'ALL';
      if (paymentFilter) paymentFilter.value = 'ALL';
      if (dateFilter) dateFilter.value = 'ALL';
      if (regionFilter) regionFilter.value = 'ALL';
      activeStatusChip = 'ALL';
      document.querySelectorAll('.order-stat-chip').forEach(c => c.classList.remove('active'));
      const chipAll = document.getElementById('chip-all-orders');
      if (chipAll) chipAll.classList.add('active');
      renderOrdersList();
      showToast('Filters reset', 'info');
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadOrders();
      showToast('Refreshing orders...', 'info');
    });
  }

  // ------------------------------------------------------------------------
  // WhatsApp Customer Notification Dispatcher
  // ------------------------------------------------------------------------
  function sendCustomerWhatsApp(order) {
    const rawPhone = String(order.customer?.phone || '').replace(/\D/g, '');
    if (!rawPhone || rawPhone.length < 10) {
      showToast('No valid customer phone number found.', 'warning');
      return;
    }

    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const name = order.customer?.name || 'Customer';
    const orderId = order.orderId;
    const status = order.orderStatus || 'Payment Confirmed';
    const tracking = order.trackingId;
    const trackingLink = tracking ? `https://www.delhivery.com/track/package/${tracking}` : `https://xoroniq.com/tracking.html?orderId=${orderId}`;

    let msg = '';
    if (status === 'Shipped') {
      msg = `Hello ${name}! 👋\n\nYour XORONIQ Car Care order *#${orderId}* has been packed & dispatched via *Delhivery Express* 🚚\n\n📦 *Delhivery AWB:* ${tracking || 'N/A'}\n🔗 *Live Tracking:* ${trackingLink}\n\nThank you for choosing XORONIQ! Let us know if you need any detailing assistance. ✨`;
    } else if (status === 'Delivered') {
      msg = `Hello ${name}! 👋\n\nYour XORONIQ Car Care order *#${orderId}* has been delivered! 🎉\n\nWe hope your ride gets that mirror-glass gloss! Share your detailing photos with us on Instagram @xoroniq.\n\nThank you for choosing XORONIQ! ⭐`;
    } else if (order.payment?.method === 'COD' || status.includes('COD')) {
      msg = `Hello ${name}! 👋\n\nThank you for your interest in XORONIQ Car Care. We received your request for Cash on Delivery (COD) for order *#${orderId}* (Total: ${formatCurrency(order.total)}).\n\n📍 *Shipping Address:*\n${order.shippingAddress?.address}, ${order.shippingAddress?.city}, ${order.shippingAddress?.state} - ${order.shippingAddress?.pincode}\n\nPlease reply *CONFIRM* to verify your address so we can dispatch your parcel right away! 🏎️💨`;
    } else {
      msg = `Hello ${name}! 👋\n\nThank you for ordering with XORONIQ Car Care! 🏎️\n\nOrder *#${orderId}* is *${status}* (Total: ${formatCurrency(order.total)}).\n\nWe are preparing your premium automotive formulations for express dispatch. You will receive your Delhivery tracking AWB as soon as it leaves our hub!\n\nView details: ${trackingLink}`;
    }

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
  }

  // ------------------------------------------------------------------------
  // Printable Invoice & Packing Slip Generator
  // ------------------------------------------------------------------------
  const invoiceModalEl = document.getElementById('invoiceModal');
  const invoiceWrapper = document.getElementById('printable-invoice-wrapper');
  const printTriggerBtn = document.getElementById('trigger-print-btn');

  function openInvoiceModal(order) {
    if (!invoiceModalEl || !invoiceWrapper) return;

    const isCod = order.payment?.method === 'COD' || (order.orderStatus && order.orderStatus.includes('COD'));
    const items = order.items || [];

    invoiceWrapper.innerHTML = `
      <div class="invoice-print-sheet p-4 p-md-5" id="printable-invoice-sheet">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-start border-bottom border-dark pb-3 mb-4">
          <div>
            <h2 class="font-heading fw-bold text-black mb-1 letter-spacing-wide">XORONIQ CAR CARE</h2>
            <div class="small text-dark">High-Performance Automotive Aesthetics &amp; Detailing Solutions</div>
            <div class="small text-muted-custom mt-1">Pukayoor, Olakara PO, Malappuram, Kerala - 676306 • Phone: +91 9188510017 • Instagram: @xoroniq</div>
          </div>
          <div class="text-end">
            <span class="badge bg-black text-white px-3 py-2 font-heading fs-6">PACKING SLIP &amp; INVOICE</span>
            <div class="font-mono fw-bold fs-5 text-black mt-2">ORDER #${order.orderId}</div>
            <div class="small text-muted-custom">Date: ${formatDate(order.createdAt)}</div>
          </div>
        </div>

        <!-- Addresses & Tracking -->
        <div class="row g-4 mb-4">
          <div class="col-6">
            <div class="p-3 bg-light rounded border">
              <div class="fw-bold font-heading small text-black mb-2 text-uppercase">SHIPPING RECIPIENT</div>
              <div class="fw-bold text-dark fs-6">${order.customer?.name || 'Customer'}</div>
              <div class="text-dark small">${order.shippingAddress?.address || ''}</div>
              <div class="text-dark small">${order.shippingAddress?.city || ''}, ${order.shippingAddress?.state || ''} - ${order.shippingAddress?.pincode || ''}</div>
              <div class="text-dark small mt-2"><strong>Phone:</strong> ${order.customer?.phone || 'N/A'}</div>
              <div class="text-dark small"><strong>Email:</strong> ${order.customer?.email || 'N/A'}</div>
            </div>
          </div>
          <div class="col-6">
            <div class="p-3 bg-light rounded border">
              <div class="fw-bold font-heading small text-black mb-2 text-uppercase">SHIPMENT &amp; PAYMENT DETAILS</div>
              <div class="small mb-1"><strong>Carrier:</strong> Delhivery Express</div>
              <div class="small mb-1"><strong>AWB Number:</strong> <span class="font-mono fw-bold text-black">${order.trackingId || 'Pending Dispatch Assignment'}</span></div>
              <div class="small mb-1"><strong>Payment Method:</strong> ${isCod ? 'CASH ON DELIVERY (Collect from Customer)' : 'ONLINE PREPAID (Razorpay / UPI)'}</div>
              <div class="small"><strong>Payment Status:</strong> <span class="badge ${isCod ? 'bg-warning text-dark' : 'bg-success text-white'}">${isCod ? 'PENDING COD' : 'PAID & VERIFIED'}</span></div>
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <table class="table table-bordered mb-4">
          <thead class="table-light">
            <tr>
              <th style="width: 50px;">#</th>
              <th>Product Description</th>
              <th>SKU</th>
              <th class="text-center" style="width: 80px;">Qty</th>
              <th class="text-end" style="width: 120px;">Rate (MRP ₹)</th>
              <th class="text-end" style="width: 130px;">Amount (Sale ₹)</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => {
              const salePrice = Number(item.price) || 0;
              const mrp = Number(item.mrp) || Math.round(salePrice * 1.25) || salePrice;
              const lineTotal = salePrice * (Number(item.quantity) || 1);
              return `
              <tr>
                <td>${idx + 1}</td>
                <td class="fw-semibold text-dark">${item.name}</td>
                <td class="font-mono small text-muted-custom">${item.sku || 'XOR-KIT'}</td>
                <td class="text-center fw-bold">${item.quantity}</td>
                <td class="text-end font-mono">${formatCurrency(mrp)}</td>
                <td class="text-end font-mono fw-bold">${formatCurrency(lineTotal)}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" class="text-end fw-semibold">Subtotal:</td>
              <td class="text-end font-mono">${formatCurrency(order.subtotal || 0)}</td>
            </tr>
            <tr>
              <td colspan="5" class="text-end fw-semibold">Shipping / Delivery:</td>
              <td class="text-end font-mono">${Number(order.shipping) === 0 ? 'FREE' : formatCurrency(order.shipping)}</td>
            </tr>
            ${(order.codFee || isCod) ? `
              <tr>
                <td colspan="5" class="text-end fw-semibold">COD Handling Fee:</td>
                <td class="text-end font-mono">${formatCurrency(order.codFee || 20)}</td>
              </tr>
            ` : ''}
            <tr class="table-active fs-5">
              <td colspan="5" class="text-end fw-bold font-heading">GRAND TOTAL:</td>
              <td class="text-end font-mono fw-bold text-accent">${formatCurrency(order.total)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Footer Notice -->
        <div class="p-3 border rounded text-muted-custom small text-center" style="font-size: 0.75rem;">
          <div class="fw-bold text-danger mb-1">⚠️ Unboxing video is compulsory for any return or replacement claims.</div>
          Thank you for trusting XORONIQ Car Care. Genuine, laboratory batch-tested, and quality sealed automotive care.
          <br>Address: Pukayoor, Olakara PO, Malappuram, Kerala - 676306 | Phone / WhatsApp: +91 9188510017 | @xoroniq
        </div>
      </div>
    `;

    const studioLink = document.getElementById('modal-open-in-studio-btn');
    if (studioLink) {
      studioLink.href = `invoice.html?orderId=${encodeURIComponent(order.orderId)}`;
    }

    const bsModal = window.bootstrap.Modal.getOrCreateInstance(invoiceModalEl);
    bsModal.show();
  }

  if (printTriggerBtn) {
    printTriggerBtn.addEventListener('click', () => {
      const sheet = document.getElementById('printable-invoice-sheet');
      if (!sheet) {
        window.print();
        return;
      }
      let iframe = document.getElementById('xoroniq-slip-print-frame');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'xoroniq-slip-print-frame';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);
      }
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Packing Slip &amp; Invoice - XORONIQ</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 8mm 10mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #0f172a;
              background: #fff;
              margin: 0;
              padding: 0;
              font-size: 11px;
              line-height: 1.35;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .table th, .table td { padding: 5px 6px !important; }
            .badge { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          </style>
        </head>
        <body>
          <div style="padding: 10px;">
            ${sheet.innerHTML}
          </div>
        </body>
        </html>
      `);
      doc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          window.print();
        }
      }, 150);
    });
  }

  // ------------------------------------------------------------------------
  // Customer Directory Aggregator
  // ------------------------------------------------------------------------
  const customerTableBody = document.getElementById('customer-directory-table-body');
  const customerSearchInput = document.getElementById('customer-search-input');
  const customerCountBadge = document.getElementById('customer-directory-count');
  let customerList = [];

  function buildCustomerDirectory() {
    const customerMap = new Map();

    allOrders.forEach(order => {
      const key = (order.customer?.phone || order.customer?.email || order.customer?.name || '').toLowerCase().trim();
      if (!key) return;

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          name: order.customer?.name || 'Customer',
          phone: order.customer?.phone || '',
          email: order.customer?.email || '',
          city: order.shippingAddress?.city || '',
          state: order.shippingAddress?.state || '',
          orderCount: 0,
          totalSpend: 0,
          latestDate: order.createdAt
        });
      }

      const rec = customerMap.get(key);
      rec.orderCount += 1;
      if (order.orderStatus !== 'Cancelled') {
        rec.totalSpend += (Number(order.total) || 0);
      }
    });

    customerList = Array.from(customerMap.values());
    customerList.sort((a, b) => b.totalSpend - a.totalSpend);

    if (customerCountBadge) customerCountBadge.textContent = `${customerList.length} Unique Customers`;
    renderCustomerDirectory();
  }

  function renderCustomerDirectory() {
    if (!customerTableBody) return;
    const term = customerSearchInput ? customerSearchInput.value.toLowerCase().trim() : '';

    let filtered = customerList;
    if (term) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.city.toLowerCase().includes(term)
      );
    }

    if (filtered.length === 0) {
      customerTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted-custom">No customers found.</td></tr>`;
      return;
    }

    customerTableBody.innerHTML = filtered.map(c => {
      const cleanPhone = String(c.phone).replace(/\D/g, '');
      const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

      return `
        <tr>
          <td class="text-black fw-bold">${c.name}</td>
          <td class="font-mono">${c.phone || 'N/A'}</td>
          <td class="small text-muted-custom">${c.email || 'N/A'}</td>
          <td class="small text-dark">${c.city ? `${c.city}, ` : ''}${c.state || ''}</td>
          <td><span class="badge bg-light border text-dark">${c.orderCount} order${c.orderCount === 1 ? '' : 's'}</span></td>
          <td class="font-mono text-accent fw-bold">${formatCurrency(c.totalSpend)}</td>
          <td>
            ${cleanPhone ? `
              <a href="https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello ${c.name}, this is XORONIQ Car Care Concierge!`)}" target="_blank" class="btn btn-whatsapp-action btn-sm py-1 px-2 d-inline-flex align-items-center gap-1">
                <i class="bi bi-whatsapp"></i> Chat
              </a>
            ` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  }

  if (customerSearchInput) {
    customerSearchInput.addEventListener('input', renderCustomerDirectory);
  }

  // ------------------------------------------------------------------------
  // Delhivery Tracking Modal Handling
  // ------------------------------------------------------------------------
  const trackingModalEl = document.getElementById('trackingModal');
  const trackingForm = document.getElementById('delhivery-tracking-form');
  const trackingOrderIdInput = document.getElementById('modal-tracking-order-id');
  const trackingOrderDisplay = document.getElementById('modal-tracking-order-display');
  const trackingAwbInput = document.getElementById('modal-tracking-awb-input');

  function openTrackingModal(order) {
    if (!trackingModalEl) return;
    if (trackingOrderIdInput) trackingOrderIdInput.value = order.id || '';
    if (trackingOrderDisplay) trackingOrderDisplay.value = order.orderId ? `#${order.orderId}` : (order.id || '');
    if (trackingAwbInput) trackingAwbInput.value = order.trackingId || '';

    const bsModal = window.bootstrap.Modal.getOrCreateInstance(trackingModalEl);
    bsModal.show();
  }

  if (trackingForm) {
    trackingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const docId = trackingOrderIdInput.value;
      const awb = trackingAwbInput.value.trim();

      if (!docId || !awb) {
        showToast('Please enter a valid Delhivery AWB number', 'warning');
        return;
      }

      const saveBtn = document.getElementById('modal-tracking-save-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Updating...`;
      }

      try {
        const trackingUrl = `https://www.delhivery.com/track/package/${awb}`;
        await updateOrderTracking(docId, {
          trackingId: awb,
          courier: 'Delhivery Express',
          trackingUrl: trackingUrl,
          orderStatus: 'Shipped'
        });

        const order = allOrders.find(o => o.id === docId);
        if (order) {
          order.trackingId = awb;
          order.courier = 'Delhivery Express';
          order.trackingUrl = trackingUrl;
          order.orderStatus = 'Shipped';
          sendOrderToGoogleSheets(order).catch(sheetErr => console.warn('Sheets sync error:', sheetErr));
        }

        showToast(`Delhivery AWB ${awb} saved & order marked Shipped!`, 'success');
        updateKpiCounters();
        renderOrdersList();

        const bsModal = window.bootstrap.Modal.getInstance(trackingModalEl);
        if (bsModal) bsModal.hide();
      } catch (err) {
        showToast('Failed to save tracking: ' + err.message, 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `<i class="bi bi-check2-circle me-1"></i> Save & Mark Shipped`;
        }
      }
    });
  }

  // ------------------------------------------------------------------------
  // Order Details Modal Handling
  // ------------------------------------------------------------------------
  function openAdminOrderModal(order) {
    let modalEl = document.getElementById('admin-order-modal');
    if (!modalEl) {
      const modalHtml = `
        <div class="modal fade" id="admin-order-modal" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered modal-lg">
            <div class="modal-content modal-content-custom">
              <div class="modal-header border-secondary border-opacity-25 d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-2">
                  <h5 class="modal-title font-heading text-black fw-bold mb-0" id="admin-order-modal-title">ORDER DETAILS</h5>
                  <span class="badge bg-light text-muted-custom border font-mono" id="admin-order-modal-doc-id" style="font-size: 0.72rem;"></span>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <button type="button" class="btn btn-danger btn-sm fw-bold d-inline-flex align-items-center gap-1 shadow-sm modal-header-delete-btn" id="modal-header-delete-btn" title="Permanently delete this order">
                    <i class="bi bi-trash3-fill"></i> Delete Order
                  </button>
                  <button type="button" class="btn-close-custom" data-bs-dismiss="modal"><i class="bi bi-x-lg"></i></button>
                </div>
              </div>
              <div class="modal-body p-4" id="admin-order-modal-body"></div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      modalEl = document.getElementById('admin-order-modal');
    }

    const modalTitle = document.getElementById('admin-order-modal-title');
    if (modalTitle) modalTitle.textContent = `ORDER #${order.orderId}`;

    const modalDocId = document.getElementById('admin-order-modal-doc-id');
    if (modalDocId) modalDocId.textContent = order.id;

    const modalHeaderDeleteBtn = modalEl.querySelector('#modal-header-delete-btn');
    if (modalHeaderDeleteBtn) {
      modalHeaderDeleteBtn.onclick = () => {
        triggerDeleteConfirmation('single', order);
      };
    }

    const modalBody = document.getElementById('admin-order-modal-body');
    const isCod = order.payment?.method === 'COD' || (order.orderStatus && order.orderStatus.includes('COD'));

    modalBody.innerHTML = `
      <div class="row g-4 mb-4">
        <div class="col-md-6">
          <h6 class="font-heading text-black fw-bold mb-2">CUSTOMER CONTACT</h6>
          <div class="p-3 bg-surface-custom rounded border border-secondary border-opacity-25 small">
            <div><strong>Name:</strong> ${order.customer?.name}</div>
            <div><strong>Email:</strong> ${order.customer?.email}</div>
            <div class="d-flex align-items-center gap-2 mt-1">
              <strong>Phone:</strong> <span>${order.customer?.phone}</span>
              <button type="button" class="btn btn-whatsapp-action btn-sm py-0 px-2 modal-whatsapp-btn">
                <i class="bi bi-whatsapp me-1"></i> WhatsApp
              </button>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <h6 class="font-heading text-black fw-bold mb-2">SHIPPING ADDRESS</h6>
          <div class="p-3 bg-surface-custom rounded border border-secondary border-opacity-25 small">
            <div>${order.shippingAddress?.address}</div>
            <div>${order.shippingAddress?.city}, ${order.shippingAddress?.state} - ${order.shippingAddress?.pincode}</div>
            <div>${order.shippingAddress?.country || 'India'}</div>
          </div>
        </div>
      </div>

      <!-- Delhivery Courier & Tracking Status Card -->
      <div class="p-3 bg-surface-custom rounded border border-secondary border-opacity-25 mb-4">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="badge bg-danger text-white px-2 py-1 small fw-bold">
                <i class="bi bi-truck me-1"></i> DELHIVERY EXPRESS
              </span>
              <span class="text-muted-custom small">Fulfillment & Courier Partner</span>
            </div>
            ${order.trackingId ? `
              <div class="fs-6 font-mono fw-bold text-black mt-1">
                AWB: <span>${order.trackingId}</span>
              </div>
            ` : `
              <div class="text-dark small mt-1">
                <i class="bi bi-exclamation-circle text-warning me-1"></i> Awaiting dispatch. Enter Delhivery tracking AWB once parcel is packed.
              </div>
            `}
          </div>
          <div class="d-flex align-items-center gap-2">
            ${order.trackingId ? `
              <a href="https://www.delhivery.com/track/package/${order.trackingId}" target="_blank" rel="noopener noreferrer" class="btn btn-x-outline btn-sm">
                <i class="bi bi-box-arrow-up-right me-1"></i> Track on Delhivery
              </a>
            ` : ''}
            <button type="button" class="btn btn-x-primary btn-sm admin-modal-tracking-btn">
              <i class="bi bi-truck me-1"></i> ${order.trackingId ? 'Update AWB' : 'Enter Delhivery AWB'}
            </button>
          </div>
        </div>
      </div>

      <!-- Automated Email Notification Status & Manual Resend -->
      <div class="p-3 bg-surface-custom rounded border border-secondary border-opacity-25 mb-4">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h6 class="font-heading text-black fw-bold mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-envelope-at text-accent fs-5"></i> AUTOMATED EMAIL NOTIFICATIONS
            </h6>
            <div class="text-muted-custom small">Automated partner alert & customer order receipt triggered by verified payments</div>
          </div>
          <div>
            ${renderEmailStatusBadge(order)}
          </div>
        </div>

        <div class="row g-2 mb-3 small">
          <div class="col-sm-6">
            <div class="p-2 bg-white rounded border d-flex justify-content-between align-items-center">
              <span><strong>Partner Alert (3 Partners):</strong></span>
              <span>${order.partnerEmailStatus === 'SENT' ? '<span class="text-success fw-bold"><i class="bi bi-check-circle me-1"></i>SENT</span>' : (order.partnerEmailStatus === 'FAILED' ? '<span class="text-danger fw-bold"><i class="bi bi-x-circle me-1"></i>FAILED</span>' : '<span class="text-muted-custom">NOT SENT</span>')}</span>
            </div>
          </div>
          <div class="col-sm-6">
            <div class="p-2 bg-white rounded border d-flex justify-content-between align-items-center">
              <span><strong>Customer Confirmation:</strong></span>
              <span>${order.customerEmailStatus === 'SENT' ? '<span class="text-success fw-bold"><i class="bi bi-check-circle me-1"></i>SENT</span>' : (order.customerEmailStatus === 'FAILED' ? '<span class="text-danger fw-bold"><i class="bi bi-x-circle me-1"></i>FAILED</span>' : '<span class="text-muted-custom">NOT SENT</span>')}</span>
            </div>
          </div>
        </div>

        ${order.emailError ? `
          <div class="alert alert-danger py-2 px-3 small mb-3">
            <i class="bi bi-exclamation-triangle-fill me-1"></i><strong>Email Error Log:</strong> ${order.emailError}
          </div>
        ` : ''}

        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-x-outline btn-sm modal-resend-email-btn" data-target="partner" title="Resend notification to all 3 partners without changing payment">
            <i class="bi bi-send me-1 text-accent"></i> Resend Partner Notification
          </button>
          <button type="button" class="btn btn-x-outline btn-sm modal-resend-email-btn" data-target="customer" title="Resend order receipt to customer without changing payment">
            <i class="bi bi-send me-1 text-success"></i> Resend Customer Confirmation
          </button>
          <button type="button" class="btn btn-x-primary btn-sm modal-resend-email-btn" data-target="both" title="Resend to both partners and customer">
            <i class="bi bi-arrow-repeat me-1"></i> Resend All Emails
          </button>
        </div>
      </div>

      <!-- Internal Admin Note Section -->
      <div class="p-3 bg-surface-custom rounded border border-secondary border-opacity-25 mb-4">
        <label class="form-label font-heading text-black small fw-bold mb-1">
          <i class="bi bi-pencil-square text-accent me-1"></i> INTERNAL ADMIN NOTE (Verification & Status)
        </label>
        <div class="input-group">
          <input type="text" id="order-admin-note-input" class="form-control form-control-custom small" placeholder="e.g. Verified on call, address confirmed, customer requested fast dispatch..." value="${order.adminNote || ''}">
          <button class="btn btn-x-primary btn-sm px-3" id="save-order-admin-note-btn">
            Save Note
          </button>
        </div>
      </div>

      <h6 class="font-heading text-black fw-bold mb-2">ORDERED ITEMS</h6>
      <div class="table-responsive mb-4">
        <table class="table-custom-dark w-100">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Qty</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).map(item => `
              <tr>
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <img src="${item.image}" alt="${item.name}" class="rounded" style="width: 35px; height: 35px; object-fit: contain;">
                    <span class="text-black fw-semibold">${item.name}</span>
                  </div>
                </td>
                <td class="text-muted-custom font-mono small">${item.sku || 'N/A'}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${item.quantity}</td>
                <td class="font-mono text-accent fw-bold">${formatCurrency(item.price * item.quantity)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="p-3 bg-surface-custom rounded border border-secondary border-opacity-25 mb-3">
        <div class="d-flex justify-content-between text-silver small mb-1">
          <span>Subtotal</span>
          <span class="font-mono text-black fw-bold">${formatCurrency(order.subtotal || 0)}</span>
        </div>
        <div class="d-flex justify-content-between text-silver small mb-1">
          <span>Shipping Fee</span>
          <span class="font-mono text-black fw-bold">${Number(order.shipping) === 0 ? 'FREE' : formatCurrency(order.shipping)}</span>
        </div>
        ${(order.codFee || isCod) ? `
          <div class="d-flex justify-content-between text-silver small mb-1">
            <span>Cash on Delivery (COD) Extra Fee</span>
            <span class="font-mono text-accent fw-bold">+${formatCurrency(order.codFee || 20)}</span>
          </div>
        ` : ''}
      </div>

      <div class="d-flex flex-wrap justify-content-between align-items-center pt-3 border-top border-secondary border-opacity-25 font-heading gap-2">
        <div class="text-muted-custom small">
          Payment: ${isCod ? '<span class="badge bg-warning bg-opacity-25 text-dark border border-warning">CASH ON DELIVERY</span>' : '<span class="badge bg-success bg-opacity-25 text-success">PREPAID (RAZORPAY)</span>'}
          <span class="ms-2 font-mono">Ref: ${order.payment?.razorpayPaymentId || (isCod ? 'COD - Due on delivery' : 'N/A')}</span>
        </div>
        <div class="fs-5 text-black">Grand Total: <span class="text-accent font-bold">${formatCurrency(order.total)}</span></div>
      </div>

      <!-- Modal Action Buttons Bar -->
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3 mt-3 border-top border-secondary border-opacity-25">
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-x-outline btn-sm" id="modal-print-slip-btn">
            <i class="bi bi-printer me-1"></i> Print Packing Slip
          </button>
          <button class="btn btn-x-outline btn-sm" id="modal-push-sheet-btn">
            <i class="bi bi-file-earmark-spreadsheet text-success me-1"></i> Push to Google Sheet
          </button>
        </div>
        <button class="btn btn-danger btn-sm fw-bold d-inline-flex align-items-center gap-1 shadow-sm" id="modal-delete-order-btn">
          <i class="bi bi-trash3-fill me-1"></i> Delete Order Permanently
        </button>
      </div>
    `;

    // WhatsApp in modal
    const modalWaBtn = modalBody.querySelector('.modal-whatsapp-btn');
    if (modalWaBtn) {
      modalWaBtn.addEventListener('click', () => sendCustomerWhatsApp(order));
    }

    // Save Admin Note
    const saveNoteBtn = modalBody.querySelector('#save-order-admin-note-btn');
    const noteInput = modalBody.querySelector('#order-admin-note-input');
    if (saveNoteBtn && noteInput) {
      saveNoteBtn.addEventListener('click', async () => {
        const note = noteInput.value.trim();
        saveNoteBtn.disabled = true;
        saveNoteBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
        try {
          await updateOrderAdminNote(order.id, note);
          order.adminNote = note;
          renderOrdersList();
          showToast('Admin note saved!', 'success');
        } catch (e) {
          showToast('Failed to save note: ' + e.message, 'error');
        } finally {
          saveNoteBtn.disabled = false;
          saveNoteBtn.textContent = 'Save Note';
        }
      });
    }

    // Resend Email Notifications
    modalBody.querySelectorAll('.modal-resend-email-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetType = btn.getAttribute('data-target');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Dispatching...`;

        try {
          const res = await fetch(`${CONFIG.API_BASE_URL}/resend-emails`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: order.orderId,
              target: targetType
            })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            showToast(`Order emails successfully resent (${targetType})!`, 'success');
            if (targetType === 'partner' || targetType === 'both') order.partnerEmailStatus = 'SENT';
            if (targetType === 'customer' || targetType === 'both') order.customerEmailStatus = 'SENT';
            order.emailStatus = 'SENT';
            order.emailError = null;
            renderOrdersList();
            openAdminOrderModal(order);
          } else {
            showToast(`Failed to resend: ${data.error || 'Server error'}`, 'error');
          }
        } catch (err) {
          showToast(`Network error calling email server: ${err.message}`, 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
        }
      });
    });

    // Print slip from modal
    const modalPrintBtn = modalBody.querySelector('#modal-print-slip-btn');
    if (modalPrintBtn) {
      modalPrintBtn.addEventListener('click', () => {
        openInvoiceModal(order);
      });
    }

    // Push to Sheet from modal
    const pushSheetBtn = modalBody.querySelector('#modal-push-sheet-btn');
    if (pushSheetBtn) {
      pushSheetBtn.addEventListener('click', async () => {
        pushSheetBtn.disabled = true;
        pushSheetBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Syncing...`;
        try {
          await sendOrderToGoogleSheets(order);
          showToast(`Order #${order.orderId} pushed to Google Sheets!`, 'success');
        } catch (e) {
          showToast('Sync error: ' + e.message, 'error');
        } finally {
          pushSheetBtn.disabled = false;
          pushSheetBtn.innerHTML = `<i class="bi bi-file-earmark-spreadsheet text-success me-1"></i> Push to Google Sheet`;
        }
      });
    }

    // Delete from modal
    const modalDeleteBtn = modalBody.querySelector('#modal-delete-order-btn');
    if (modalDeleteBtn) {
      modalDeleteBtn.addEventListener('click', () => {
        triggerDeleteConfirmation('single', order);
      });
    }

    // Tracking from modal
    const modalTrackingBtn = modalBody.querySelector('.admin-modal-tracking-btn');
    if (modalTrackingBtn) {
      modalTrackingBtn.addEventListener('click', () => {
        const bsModalInstance = window.bootstrap.Modal.getInstance(modalEl);
        if (bsModalInstance) bsModalInstance.hide();
        setTimeout(() => {
          openTrackingModal(order);
        }, 350);
      });
    }

    const bsModal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }

  // ------------------------------------------------------------------------
  // CSV & Google Sheets Integration
  // ------------------------------------------------------------------------
  const exportCsvBtn = document.getElementById('export-orders-csv-btn');
  const exportCsvModalBtn = document.getElementById('download-orders-csv-modal-btn');
  const handleExportCsv = () => {
    if (!allOrders || allOrders.length === 0) {
      showToast('No orders available to export.', 'warning');
      return;
    }
    try {
      exportOrdersToCSV(allOrders);
      showToast(`Exported ${allOrders.length} orders to CSV successfully!`, 'success');
    } catch (err) {
      showToast(err.message || 'Export failed', 'error');
    }
  };
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', handleExportCsv);
  if (exportCsvModalBtn) exportCsvModalBtn.addEventListener('click', handleExportCsv);

  const urlInput = document.getElementById('sheets-webhook-url-input');
  const saveUrlBtn = document.getElementById('save-sheets-url-btn');
  const statusText = document.getElementById('sheets-url-status-text');
  const testConnBtn = document.getElementById('test-sheets-connection-btn');
  const syncAllBtn = document.getElementById('sync-all-orders-btn');
  const feedbackEl = document.getElementById('sheets-action-feedback');

  function updateSheetsStatusBadge() {
    const activeUrl = getGoogleSheetsWebhookUrl();
    if (urlInput) urlInput.value = activeUrl || '';
    if (statusText) {
      if (activeUrl) {
        statusText.innerHTML = `<span class="badge bg-success text-white"><i class="bi bi-check-circle-fill me-1"></i> Active Webhook Connected</span> <span class="text-muted-custom small ms-2">All incoming orders automatically append to your Google Sheet</span>`;
      } else {
        statusText.innerHTML = `<span class="badge bg-secondary"><i class="bi bi-exclamation-triangle-fill me-1"></i> Not Configured</span> <span class="text-muted-custom small ms-2">Paste your Google Apps Script Webhook URL above</span>`;
      }
    }
  }

  updateSheetsStatusBadge();

  if (saveUrlBtn && urlInput) {
    saveUrlBtn.addEventListener('click', () => {
      const val = urlInput.value.trim();
      if (val && !val.startsWith('https://script.google.com/')) {
        showToast('Please enter a valid Google Apps Script URL starting with https://script.google.com/', 'warning');
        return;
      }
      setGoogleSheetsWebhookUrl(val);
      updateSheetsStatusBadge();
      showToast(val ? 'Google Sheets Webhook URL saved successfully!' : 'Google Sheets Webhook URL cleared.', 'success');
    });
  }

  if (testConnBtn) {
    testConnBtn.addEventListener('click', async () => {
      const webhook = getGoogleSheetsWebhookUrl();
      if (!webhook) {
        showToast('Please enter and save a Webhook URL first.', 'warning');
        return;
      }
      testConnBtn.disabled = true;
      testConnBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Sending Test...`;
      try {
        const testOrder = {
          orderId: 'TEST-' + Math.floor(1000 + Math.random() * 9000),
          orderStatus: 'Test Verified',
          customer: { name: 'XORONIQ Test User', email: 'test@xoroniq.store', phone: '9188510017' },
          shippingAddress: { address: 'Test Detailing Bay, Near NH 66', city: 'Malappuram', state: 'Kerala', pincode: '676306', country: 'India' },
          items: [{ name: 'XORONIQ Essential Kit (Test)', quantity: 1, price: 1199, sku: 'XOR-KIT-ESS-TEST' }],
          subtotal: 1199,
          shipping: 0,
          total: 1199,
          payment: { method: 'TEST', razorpayPaymentId: 'test_pay_' + Date.now() }
        };
        await sendOrderToGoogleSheets(testOrder);
        showToast('Test order row dispatched to your Google Sheet!', 'success');
        if (feedbackEl) {
          feedbackEl.innerHTML = `<div class="alert alert-success py-2 px-3 small mb-0"><i class="bi bi-check-circle-fill me-1"></i> Test order row successfully dispatched! Check your Google Sheet.</div>`;
          feedbackEl.style.display = 'block';
        }
      } catch (err) {
        showToast('Error dispatching test order: ' + err.message, 'error');
      } finally {
        testConnBtn.disabled = false;
        testConnBtn.innerHTML = `<i class="bi bi-lightning-charge me-1"></i> Send Test Row`;
      }
    });
  }

  if (syncAllBtn) {
    syncAllBtn.addEventListener('click', async () => {
      const webhook = getGoogleSheetsWebhookUrl();
      if (!webhook) {
        showToast('Please enter and save a Webhook URL first.', 'warning');
        return;
      }
      if (!allOrders || allOrders.length === 0) {
        showToast('No orders found to sync.', 'warning');
        return;
      }
      syncAllBtn.disabled = true;
      syncAllBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Syncing Orders (0/${allOrders.length})...`;
      let count = 0;
      for (let i = 0; i < allOrders.length; i++) {
        try {
          await sendOrderToGoogleSheets(allOrders[i]);
          count++;
          syncAllBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Syncing Orders (${count}/${allOrders.length})...`;
        } catch (e) {
          console.warn('Sync order item error:', e);
        }
      }
      syncAllBtn.disabled = false;
      syncAllBtn.innerHTML = `<i class="bi bi-cloud-arrow-up me-1"></i> Sync All Existing Orders to Sheets`;
      showToast(`Successfully synced ${count} orders to Google Sheets!`, 'success');
      if (feedbackEl) {
        feedbackEl.innerHTML = `<div class="alert alert-success py-2 px-3 small mb-0"><i class="bi bi-check-circle-fill me-1"></i> Successfully synced ${count} orders into your Google Sheet!</div>`;
        feedbackEl.style.display = 'block';
      }
    });
  }

  // ------------------------------------------------------------------------
  // External Order Creation (WhatsApp, Amazon, Phone, In-Store, etc.)
  // ------------------------------------------------------------------------
  function initExternalOrderModal() {
    const form = document.getElementById('external-order-form');
    const modalEl = document.getElementById('newOrderModal');
    const productPicker = document.getElementById('modal-product-picker');
    const itemsListContainer = document.getElementById('modal-order-items-list');
    const shippingInput = document.getElementById('modal-order-shipping');
    const discountInput = document.getElementById('modal-order-discount');
    const totalDisplay = document.getElementById('modal-order-total-display');
    const saveAndInvoiceBtn = document.getElementById('save-and-invoice-btn');

    const PRESETS = {
      'xoroniq-essential-kit': { name: 'XORONIQ Essential Kit', price: 1199, sku: 'XOR-KIT-001', hsn: '34029099' },
      'shampoo-473ml': { name: 'Ultra Foam Car Shampoo 473ml', price: 449, sku: 'XOR-SHMP-473', hsn: '34029099' },
      'towel-1200gsm': { name: '1200 GSM Heavy Plush Towel', price: 399, sku: 'XOR-TWL-1200', hsn: '63071010' },
      'towel-350gsm': { name: '350 GSM Buffing Towel', price: 199, sku: 'XOR-TWL-350', hsn: '63071010' },
      'wash-mitt': { name: 'Premium Wash Mitt', price: 249, sku: 'XOR-MITT-01', hsn: '63079090' },
      'foam-sprayer': { name: 'Pump Foam Sprayer 2L', price: 499, sku: 'XOR-SPRY-2L', hsn: '84248990' }
    };

    let extItems = [{ ...PRESETS['xoroniq-essential-kit'], quantity: 1, id: 'ext_' + Date.now() }];

    function renderExtItems() {
      if (!itemsListContainer) return;
      itemsListContainer.innerHTML = extItems.map(item => `
        <div class="d-flex align-items-center justify-content-between p-2 mb-1 bg-white rounded border ext-item-row" data-id="${item.id}">
          <div class="flex-grow-1 me-2">
            <input type="text" class="form-control form-control-sm ext-item-name" value="${item.name}">
          </div>
          <div style="width: 70px;" class="me-2">
            <input type="number" class="form-control form-control-sm font-mono ext-item-qty" value="${item.quantity}" min="1" title="Quantity">
          </div>
          <div style="width: 90px;" class="me-2">
            <input type="number" class="form-control form-control-sm font-mono ext-item-price" value="${item.price}" min="0" title="Price">
          </div>
          <button type="button" class="btn btn-outline-danger btn-sm py-0 px-2 ext-item-remove" title="Remove Item">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      `).join('');

      itemsListContainer.querySelectorAll('.ext-item-row').forEach(row => {
        const id = row.getAttribute('data-id');
        const item = extItems.find(i => i.id === id);
        if (!item) return;

        row.querySelector('.ext-item-name').addEventListener('input', (e) => {
          item.name = e.target.value;
        });
        row.querySelector('.ext-item-qty').addEventListener('input', (e) => {
          item.quantity = Math.max(1, Number(e.target.value) || 1);
          calcTotals();
        });
        row.querySelector('.ext-item-price').addEventListener('input', (e) => {
          item.price = Math.max(0, Number(e.target.value) || 0);
          calcTotals();
        });
        row.querySelector('.ext-item-remove').addEventListener('click', () => {
          extItems = extItems.filter(i => i.id !== id);
          if (extItems.length === 0) {
            extItems = [{ ...PRESETS['xoroniq-essential-kit'], quantity: 1, id: 'ext_' + Date.now() }];
          }
          renderExtItems();
          calcTotals();
        });
      });

      calcTotals();
    }

    function calcTotals() {
      const subtotal = extItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
      const shipping = Math.max(0, Number(shippingInput?.value) || 0);
      const discount = Math.max(0, Number(discountInput?.value) || 0);
      const grandTotal = Math.max(0, subtotal + shipping - discount);

      if (totalDisplay) totalDisplay.textContent = formatCurrency(grandTotal);
      return { subtotal, shipping, discount, grandTotal };
    }

    if (shippingInput) shippingInput.addEventListener('input', calcTotals);
    if (discountInput) discountInput.addEventListener('input', calcTotals);

    if (productPicker) {
      productPicker.addEventListener('change', () => {
        const val = productPicker.value;
        if (!val) return;
        if (val === 'custom') {
          extItems.push({ name: 'Custom Product / Service', price: 500, sku: 'XOR-CUSTOM', hsn: '34029099', quantity: 1, id: 'ext_' + Date.now() });
        } else if (PRESETS[val]) {
          extItems.push({ ...PRESETS[val], quantity: 1, id: 'ext_' + Date.now() });
        }
        productPicker.value = '';
        renderExtItems();
      });
    }

    renderExtItems();

    async function handleSaveOrder(openInvoice = false) {
      const name = document.getElementById('modal-cust-name')?.value?.trim();
      const phone = document.getElementById('modal-cust-phone')?.value?.trim();
      const address = document.getElementById('modal-cust-address')?.value?.trim();
      const city = document.getElementById('modal-cust-city')?.value?.trim() || 'Kochi';
      const state = document.getElementById('modal-cust-state')?.value?.trim() || 'Kerala';
      const pincode = document.getElementById('modal-cust-pincode')?.value?.trim() || '';

      if (!name || !phone || !address || !pincode) {
        showToast('Please fill out customer name, phone, address and pincode.', 'warning');
        return;
      }

      const { subtotal, shipping, discount, grandTotal } = calcTotals();
      const source = document.getElementById('modal-order-source')?.value || 'WhatsApp';
      const extRef = document.getElementById('modal-external-ref')?.value?.trim() || '';
      const email = document.getElementById('modal-cust-email')?.value?.trim() || '';
      const gstin = document.getElementById('modal-cust-gstin')?.value?.trim() || '';
      const payMethod = document.getElementById('modal-order-payment-method')?.value || 'UPI';
      const orderStatus = document.getElementById('modal-order-status')?.value || 'Payment Confirmed';
      const courier = document.getElementById('modal-order-courier')?.value?.trim() || 'Delhivery Express';
      const awb = document.getElementById('modal-order-awb')?.value?.trim() || '';
      const note = document.getElementById('modal-order-note')?.value?.trim() || '';

      const submitBtn = document.getElementById('save-external-order-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Saving...`;
      }

      try {
        const orderData = {
          orderId: `XOR-${Math.floor(100000 + Math.random() * 900000)}`,
          source,
          externalOrderId: extRef,
          customer: { name, phone, email, gstin },
          shippingAddress: { address, city, state, pincode, country: 'India' },
          items: extItems.map(it => ({
            name: it.name,
            sku: it.sku || 'XOR-PROD',
            hsn: it.hsn || '34029099',
            price: it.price,
            quantity: it.quantity,
            total: it.price * it.quantity
          })),
          subtotal,
          shipping,
          discount,
          total: grandTotal,
          payment: {
            method: payMethod,
            status: payMethod === 'COD' ? 'PENDING' : 'PAID'
          },
          orderStatus,
          courier: awb ? courier : '',
          trackingId: awb,
          trackingUrl: awb ? `https://www.delhivery.com/track/package/${awb}` : '',
          adminNote: note ? `[${source}] ${note}` : `Recorded via External Orders (${source})`
        };

        const created = await createOrder(orderData);
        allOrders.unshift(created);

        // Sync with Google Sheets
        sendOrderToGoogleSheets(created).catch(e => console.warn(e));

        updateKpiCounters();
        renderOrdersList();
        buildCustomerDirectory();

        showToast(`Order #${created.orderId} created successfully from ${source}!`, 'success');

        if (modalEl) {
          const bs = window.bootstrap.Modal.getInstance(modalEl);
          if (bs) bs.hide();
        }

        form?.reset();
        extItems = [{ ...PRESETS['xoroniq-essential-kit'], quantity: 1, id: 'ext_' + Date.now() }];
        renderExtItems();

        if (openInvoice) {
          window.open(`invoice.html?orderId=${encodeURIComponent(created.orderId)}`, '_blank');
        }
      } catch (err) {
        console.error('Failed to create external order:', err);
        showToast('Error creating order: ' + err.message, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<i class="bi bi-check2-circle me-1"></i> Save Order`;
        }
      }
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSaveOrder(false);
      });
    }

    if (saveAndInvoiceBtn) {
      saveAndInvoiceBtn.addEventListener('click', () => {
        handleSaveOrder(true);
      });
    }
  }

  // ------------------------------------------------------------------------
  // CSV Bulk Order Import Handling
  // ------------------------------------------------------------------------
  function initCsvImportModal() {
    const downloadSampleBtn = document.getElementById('download-csv-sample-btn');
    const fileInput = document.getElementById('csv-file-input');
    const textarea = document.getElementById('csv-paste-textarea');
    const parseBtn = document.getElementById('parse-csv-btn');
    const badgeCount = document.getElementById('csv-parsed-count-badge');
    const previewContainer = document.getElementById('csv-preview-container');
    const previewTbody = document.getElementById('csv-preview-tbody');
    const confirmBtn = document.getElementById('confirm-import-csv-btn');
    const statusDiv = document.getElementById('csv-import-status');
    const defaultSourceSelect = document.getElementById('csv-default-source');

    let parsedOrdersList = [];

    // Download Sample CSV
    if (downloadSampleBtn) {
      downloadSampleBtn.addEventListener('click', () => {
        const sampleCsv = [
          'orderId,source,externalOrderId,customerName,phone,email,address,city,state,pincode,item,quantity,price,total,paymentMethod,status',
          'AMZ-402-91823,Amazon,402-91823,Rahul Sharma,9876543210,rahul@gmail.com,14 Lake View Rd,Kochi,Kerala,682001,XORONIQ Essential Kit,1,1199,1199,Prepaid,Processing',
          'WA-9012,WhatsApp,,Deepak Nair,9188510017,deepak@yahoo.com,Beach Road,Calicut,Kerala,673001,Ultra Foam Shampoo 473ml,2,449,898,COD,Order Placed (COD)',
          'FK-7821,Flipkart,OD19283719,Arun Varghese,9447123456,arun@outlook.com,Palayam MG Rd,Thiruvananthapuram,Kerala,695001,Microfiber 1200 GSM Heavy Plush Towel,1,399,399,Prepaid,Shipped'
        ].join('\n');

        const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'xoroniq_sample_orders_import.csv';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Sample CSV template downloaded.', 'info');
      });
    }

    // Parse CSV Text
    function parseCsvContent(content) {
      const defaultSource = defaultSourceSelect?.value || 'WhatsApp';
      const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length <= 1) {
        showToast('CSV file is empty or only contains headers.', 'warning');
        return [];
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
      const orders = [];

      for (let i = 1; i < lines.length; i++) {
        // Basic CSV regex split taking into account quoted strings
        const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
        if (row.length < 3) continue;

        const record = {};
        headers.forEach((h, idx) => {
          record[h] = row[idx] || '';
        });

        const customerName = record.customername || record.customer || record.name || 'External Customer';
        const phone = record.phone || record.mobile || record.contact || 'N/A';
        const orderId = record.orderid || `EXT-${Math.floor(100000 + Math.random() * 900000)}`;
        const source = record.source || defaultSource;
        const total = Number(record.total || record.price || 1199);
        const itemName = record.item || record.product || record.productname || 'XORONIQ Essential Kit';
        const qty = Number(record.quantity || record.qty || 1);

        orders.push({
          orderId,
          source,
          externalOrderId: record.externalorderid || record.ref || '',
          customer: {
            name: customerName,
            phone,
            email: record.email || ''
          },
          shippingAddress: {
            address: record.address || record.street || 'Standard Delivery',
            city: record.city || 'Kochi',
            state: record.state || 'Kerala',
            pincode: record.pincode || record.pin || '682001',
            country: 'India'
          },
          items: [{
            name: itemName,
            sku: 'XOR-EXT',
            quantity: qty,
            price: total / (qty || 1),
            total
          }],
          subtotal: total,
          shipping: 0,
          total,
          payment: {
            method: record.paymentmethod || record.payment || 'PREPAID',
            status: 'PAID'
          },
          orderStatus: record.status || 'Payment Confirmed',
          adminNote: `Bulk imported via CSV (${source})`
        });
      }

      return orders;
    }

    if (parseBtn) {
      parseBtn.addEventListener('click', () => {
        let rawContent = textarea ? textarea.value.trim() : '';

        if (!rawContent && fileInput && fileInput.files && fileInput.files[0]) {
          const reader = new FileReader();
          reader.onload = (e) => {
            parsedOrdersList = parseCsvContent(e.target.result);
            renderParsedPreview();
          };
          reader.readAsText(fileInput.files[0]);
          return;
        }

        if (!rawContent) {
          showToast('Please select a CSV file or paste CSV text above.', 'warning');
          return;
        }

        parsedOrdersList = parseCsvContent(rawContent);
        renderParsedPreview();
      });
    }

    function renderParsedPreview() {
      if (badgeCount) badgeCount.textContent = `${parsedOrdersList.length} rows parsed`;
      if (!parsedOrdersList || parsedOrdersList.length === 0) {
        if (previewContainer) previewContainer.style.display = 'none';
        if (confirmBtn) confirmBtn.disabled = true;
        return;
      }

      if (previewContainer) previewContainer.style.display = 'block';
      if (confirmBtn) confirmBtn.disabled = false;

      if (previewTbody) {
        previewTbody.innerHTML = parsedOrdersList.slice(0, 20).map(o => `
          <tr>
            <td class="font-mono">#${o.orderId}</td>
            <td>${getSourceBadgeHtml(o.source)}</td>
            <td>${o.customer.name} (${o.customer.phone})</td>
            <td>${o.shippingAddress.city}, ${o.shippingAddress.state}</td>
            <td>${o.items[0]?.name || ''}</td>
            <td class="font-mono fw-bold">${formatCurrency(o.total)}</td>
          </tr>
        `).join('');
      }
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (!parsedOrdersList || parsedOrdersList.length === 0) {
          showToast('No parsed orders to import.', 'warning');
          return;
        }

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Importing ${parsedOrdersList.length} orders...`;

        try {
          const res = await createBulkOrders(parsedOrdersList);
          showToast(`Successfully imported ${res.success} orders from external channels!`, 'success');

          if (statusDiv) {
            statusDiv.innerHTML = `<div class="alert alert-success py-2 px-3 small mb-0"><i class="bi bi-check-circle-fill me-1"></i> Imported ${res.success} orders successfully! (${res.failed} skipped/failed)</div>`;
            statusDiv.style.display = 'block';
          }

          // Reload orders table
          await loadOrders();

          setTimeout(() => {
            const modalEl = document.getElementById('importOrdersModal');
            if (modalEl) {
              const bs = window.bootstrap.Modal.getInstance(modalEl);
              if (bs) bs.hide();
            }
          }, 1200);
        } catch (e) {
          console.error('Bulk import error:', e);
          showToast('Failed to complete bulk import: ' + e.message, 'error');
        } finally {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = `<i class="bi bi-cloud-arrow-up-fill me-1"></i> Import Orders Now`;
        }
      });
    }
  }

  initExternalOrderModal();
  initCsvImportModal();

  loadOrders();
}

