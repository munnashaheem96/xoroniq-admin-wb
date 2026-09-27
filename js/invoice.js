// ==========================================================================
// XORONIQ CAR CARE - TAX INVOICE & BILLING STUDIO
// GST Compliant Invoice Generator, Live Preview & Multi-Channel Order Creator
// ==========================================================================

import { getOrders, createOrder, getOrderById, saveInvoiceRecord } from './firebase.js';
import { formatCurrency, formatDate, isKeralaAddress, numberToWordsINR, showToast, getSourceBadgeHtml } from './utils.js';
import { sendOrderToGoogleSheets } from './sheets.js';

export async function initInvoiceStudio() {
  // Elements
  const invNumberInput = document.getElementById('inv-number');
  const generateInvBtn = document.getElementById('generate-inv-no-btn');
  const invSourceSelect = document.getElementById('inv-source');
  const invDateInput = document.getElementById('inv-date');
  const invRefInput = document.getElementById('inv-ref-number');

  const custNameInput = document.getElementById('cust-name');
  const custPhoneInput = document.getElementById('cust-phone');
  const custEmailInput = document.getElementById('cust-email');
  const custGstinInput = document.getElementById('cust-gstin');
  const custAddressInput = document.getElementById('cust-address');
  const custCityInput = document.getElementById('cust-city');
  const custStateInput = document.getElementById('cust-state');
  const custPincodeInput = document.getElementById('cust-pincode');

  const catalogSelect = document.getElementById('catalog-quick-select');
  const lineItemsContainer = document.getElementById('line-items-container');
  const addCustomRowBtn = document.getElementById('add-custom-row-btn');

  const invTaxModeSelect = document.getElementById('inv-tax-mode');
  const invGstTypeSelect = document.getElementById('inv-gst-type');
  const invShippingInput = document.getElementById('inv-shipping');
  const invDiscountInput = document.getElementById('inv-discount');
  const invPaymentMethodSelect = document.getElementById('inv-payment-method');
  const invPaymentStatusSelect = document.getElementById('inv-payment-status');
  const invNotesTextarea = document.getElementById('inv-notes');

  const previewSheet = document.getElementById('printable-gst-invoice');
  const printBtn = document.getElementById('print-invoice-btn');
  const previewPrintBtn = document.getElementById('btn-print-preview');
  const saveAsOrderBtn = document.getElementById('save-as-order-btn');
  const downloadJsonBtn = document.getElementById('download-json-btn');
  const resetBtn = document.getElementById('new-invoice-btn');

  // Modal elements for loading orders
  const loadOrderModalTbody = document.getElementById('existing-orders-modal-tbody');
  const orderSearchInModal = document.getElementById('order-search-in-modal');

  // Standard Company Profile (Non-GST Retail Business)
  const SELLER_INFO = {
    name: 'XORONIQ CAR CARE',
    subtitle: 'High-Performance Automotive Aesthetics & Detailing Solutions',
    address: 'Pukayoor, Olakara PO, Malappuram',
    cityState: 'Kerala, India - 676306',
    gstin: '', // Non-GST business
    stateCode: '32 (Kerala)',
    phone: '+91 9188510017',
    email: 'xoroniq@gmail.com',
    website: 'https://xoroniq.store'
  };

  // Catalog item lookup presets (MRP / Retail Prices)
  const CATALOG_PRESETS = {
    'xoroniq-essential-kit': {
      name: 'XORONIQ Essential Kit (Flagship Detailing System)',
      sku: 'XOR-KIT-001',
      hsn: '',
      mrp: 1499,
      price: 1199,
      taxRate: 0,
      qty: 1
    },
    'shampoo-473ml': {
      name: 'XORONIQ Ultra Foam Car Shampoo 473ml',
      sku: 'XOR-SHMP-473',
      hsn: '',
      mrp: 599,
      price: 449,
      taxRate: 0,
      qty: 1
    },
    'towel-1200gsm': {
      name: 'Microfiber 1200 GSM Heavy Plush Drying Towel',
      sku: 'XOR-TWL-1200',
      hsn: '',
      mrp: 499,
      price: 399,
      taxRate: 0,
      qty: 1
    },
    'towel-350gsm': {
      name: 'Microfiber 350 GSM Edged Buffing Towel',
      sku: 'XOR-TWL-350',
      hsn: '',
      mrp: 299,
      price: 199,
      taxRate: 0,
      qty: 1
    },
    'wash-mitt': {
      name: 'Premium Scratch-Free Detailing Wash Mitt',
      sku: 'XOR-MITT-01',
      hsn: '',
      mrp: 349,
      price: 249,
      taxRate: 0,
      qty: 1
    },
    'foam-sprayer': {
      name: 'Precision Manual Pump Foam Sprayer 2L',
      sku: 'XOR-SPRY-2L',
      hsn: '',
      mrp: 699,
      price: 499,
      taxRate: 0,
      qty: 1
    }
  };

  // State
  let lineItems = [];
  let existingOrdersCache = [];
  let loadedOrderId = null;

  // Initialize dates and invoice number
  function generateInvoiceNumber() {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const yr = new Date().getFullYear();
    return `XOR-INV-${yr}-${randomDigits}`;
  }

  function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    if (invDateInput) invDateInput.value = today;
  }

  // Add Item to State
  function addLineItem(item) {
    const mrp = Number(item.mrp) || Number(item.price) || 0;
    const salePrice = Number(item.price) || mrp;
    const discountAmt = Math.max(0, mrp - salePrice);
    const discountPercent = mrp > 0 ? Math.round((discountAmt / mrp) * 100) : 0;

    lineItems.push({
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: item.name || 'New Detailing Product',
      sku: item.sku || 'XOR-PROD',
      hsn: item.hsn || '',
      qty: Number(item.qty) || 1,
      mrp: mrp, // MRP Rate
      price: salePrice, // Sale Price
      discountPercent: discountPercent,
      taxRate: 0 // Default 0 for non-GST
    });
    renderLineItemInputs();
    updatePreview();
  }

  function removeLineItem(id) {
    lineItems = lineItems.filter(i => i.id !== id);
    if (lineItems.length === 0) {
      // Keep at least 1 row
      addLineItem(CATALOG_PRESETS['xoroniq-essential-kit']);
      return;
    }
    renderLineItemInputs();
    updatePreview();
  }

  // Render input rows in Editor column
  function renderLineItemInputs() {
    if (!lineItemsContainer) return;

    lineItemsContainer.innerHTML = lineItems.map((item, index) => {
      const mrp = Number(item.mrp) || Number(item.price) || 0;
      const salePrice = Number(item.price) || 0;
      const totalSavings = Math.max(0, (mrp - salePrice) * item.qty);
      const discountPct = mrp > 0 && salePrice < mrp ? Math.round(((mrp - salePrice) / mrp) * 100) : 0;

      return `
      <div class="p-2 mb-2 bg-light rounded border line-item-row" data-id="${item.id}">
        <div class="d-flex align-items-center justify-content-between mb-1">
          <span class="fw-bold small text-dark">#${index + 1} Item</span>
          <button type="button" class="btn btn-sm btn-link text-danger p-0 text-decoration-none remove-item-btn" data-id="${item.id}" title="Remove Item">
            <i class="bi bi-trash"></i> Remove
          </button>
        </div>
        <div class="row g-1">
          <div class="col-12 col-md-7">
            <label class="small text-muted" style="font-size: 0.68rem;">Product Title / Description</label>
            <input type="text" class="form-control form-control-sm item-name-input" value="${escapeHtml(item.name)}" placeholder="Item Title / Description">
          </div>
          <div class="col-12 col-md-5">
            <label class="small text-muted" style="font-size: 0.68rem;">SKU / Code</label>
            <input type="text" class="form-control form-control-sm font-mono item-sku-input" value="${escapeHtml(item.sku || '')}" placeholder="SKU / Code">
          </div>
          <div class="col-3">
            <label class="small text-muted" style="font-size: 0.68rem;">Qty</label>
            <input type="number" class="form-control form-control-sm font-mono item-qty-input" value="${item.qty}" min="1">
          </div>
          <div class="col-3">
            <label class="small text-muted fw-bold text-dark" style="font-size: 0.68rem;">MRP Rate (₹)</label>
            <input type="number" class="form-control form-control-sm font-mono item-mrp-input" value="${mrp}" min="0">
          </div>
          <div class="col-3">
            <label class="small text-muted fw-bold text-dark" style="font-size: 0.68rem;">Sale Price (₹)</label>
            <input type="number" class="form-control form-control-sm font-mono item-price-input" value="${salePrice}" min="0">
          </div>
          <div class="col-3">
            <label class="small text-muted" style="font-size: 0.68rem;">Discount</label>
            <div class="form-control form-control-sm font-mono text-muted bg-white p-1 text-center" style="font-size: 0.72rem;">
              ${totalSavings > 0 ? `-₹${totalSavings} (${discountPct}%)` : '0%'}
            </div>
          </div>
        </div>
      </div>
      `;
    }).join('');

    // Attach row events
    lineItemsContainer.querySelectorAll('.line-item-row').forEach(row => {
      const id = row.getAttribute('data-id');
      const item = lineItems.find(i => i.id === id);
      if (!item) return;

      row.querySelector('.item-name-input')?.addEventListener('input', (e) => {
        item.name = e.target.value;
        updatePreview();
      });
      row.querySelector('.item-sku-input')?.addEventListener('input', (e) => {
        item.sku = e.target.value;
        updatePreview();
      });
      row.querySelector('.item-qty-input')?.addEventListener('input', (e) => {
        item.qty = Math.max(1, Number(e.target.value) || 1);
        renderLineItemInputs();
        updatePreview();
      });
      row.querySelector('.item-mrp-input')?.addEventListener('input', (e) => {
        item.mrp = Math.max(0, Number(e.target.value) || 0);
        updatePreview();
      });
      row.querySelector('.item-price-input')?.addEventListener('input', (e) => {
        item.price = Math.max(0, Number(e.target.value) || 0);
        updatePreview();
      });
      row.querySelector('.remove-item-btn')?.addEventListener('click', () => {
        removeLineItem(id);
      });
    });
  }

  // Calculate complete taxes and invoice metrics (MRP as Rate, Sale Price as Amount)
  function calculateInvoiceMetrics() {
    const taxMode = invTaxModeSelect ? invTaxModeSelect.value : 'NONE';
    const shipping = Math.max(0, Number(invShippingInput?.value) || 0);
    const extraDiscount = Math.max(0, Number(invDiscountInput?.value) || 0);

    let totalGrossMrp = 0;
    let totalDiscountSavings = 0;
    let subtotalSalePrice = 0;

    const itemDetails = lineItems.map((item, idx) => {
      const mrp = Number(item.mrp) || Number(item.price) || 0;
      const salePrice = Number(item.price) || mrp;
      const qty = Number(item.qty) || 1;

      const grossMrp = qty * mrp;
      const totalSaleAmount = qty * salePrice;
      const discountAmt = Math.max(0, grossMrp - totalSaleAmount);
      const discountPercent = grossMrp > 0 ? Math.round((discountAmt / grossMrp) * 100) : 0;

      totalGrossMrp += grossMrp;
      totalDiscountSavings += discountAmt;
      subtotalSalePrice += totalSaleAmount;

      return {
        ...item,
        index: idx + 1,
        qty,
        mrp,
        price: salePrice,
        grossMrp,
        discountAmt,
        discountPercent,
        total: totalSaleAmount
      };
    });

    const rawTotal = subtotalSalePrice + shipping - extraDiscount;
    const grandTotal = Math.max(0, Math.round(rawTotal));
    const roundOff = grandTotal - rawTotal;

    return {
      items: itemDetails,
      totalGrossMrp,
      totalDiscountSavings,
      subtotalSalePrice,
      subtotalTaxable: subtotalSalePrice,
      totalTax: 0,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      shipping,
      extraDiscount,
      roundOff,
      grandTotal,
      taxMode
    };
  }

  // Render the Live Invoice Preview (A4 formatted)
  function updatePreview() {
    if (!previewSheet) return;

    const metrics = calculateInvoiceMetrics();
    const invNumber = invNumberInput?.value || 'XOR-INV-DRAFT';
    const invDate = invDateInput?.value ? formatDate(invDateInput.value) : formatDate(new Date());
    const source = invSourceSelect?.value || 'Website';
    const refNo = invRefInput?.value || '';

    const custName = custNameInput?.value || 'Valued Customer';
    const custPhone = custPhoneInput?.value || 'N/A';
    const custEmail = custEmailInput?.value || '';
    const custGstin = custGstinInput?.value || '';
    const custAddress = custAddressInput?.value || 'Storefront Walk-in / Direct Order';
    const custCity = custCityInput?.value || '';
    const custState = custStateInput?.value || 'Kerala';
    const custPin = custPincodeInput?.value || '';

    const paymentMethod = invPaymentMethodSelect?.value || 'UPI';
    const paymentStatus = invPaymentStatusSelect?.value || 'PAID';
    const notes = invNotesTextarea?.value || 'Thank you for trusting XORONIQ Car Care. Premium Automotive Aesthetics.';

    const amountInWords = numberToWordsINR(metrics.grandTotal);
    const isNonGst = metrics.taxMode === 'NONE';

    previewSheet.innerHTML = `
      <!-- Top Title Bar -->
      <div class="d-flex justify-content-between align-items-start border-bottom border-2 border-dark pb-3 mb-3">
        <div class="d-flex align-items-center gap-3">
          <img src="./images/logo/logo.PNG" alt="XORONIQ" style="height: 48px; object-fit: contain;" onerror="this.style.display='none'">
          <div>
            <h3 class="gst-header-title mb-0">${SELLER_INFO.name}</h3>
            <div class="small fw-semibold text-dark">${SELLER_INFO.subtitle}</div>
            <div class="small text-muted" style="font-size: 0.75rem;">
              ${SELLER_INFO.address}, ${SELLER_INFO.cityState}
            </div>
            <div class="small text-dark mt-1" style="font-size: 0.75rem;">
              <strong>Phone / WhatsApp:</strong> ${SELLER_INFO.phone} &bull; <strong>Email:</strong> ${SELLER_INFO.email}
            </div>
          </div>
        </div>

        <div class="text-end">
          <span class="invoice-badge-type">${isNonGst ? 'RETAIL INVOICE' : 'TAX INVOICE'}</span>
          <div class="small text-muted mt-1" style="font-size: 0.7rem;">${isNonGst ? '(Bill of Supply / Cash Memo)' : '(Original for Recipient)'}</div>
          <div class="font-mono fw-bold text-dark fs-6 mt-1">${invNumber}</div>
          <div class="small text-dark"><strong>Date:</strong> ${invDate}</div>
          <div class="mt-1">${getSourceBadgeHtml(source)}</div>
          ${refNo ? `<div class="small text-muted font-mono" style="font-size: 0.72rem;">Ref/PO: <strong>${escapeHtml(refNo)}</strong></div>` : ''}
        </div>
      </div>

      <!-- Buyer & Dispatch Details Grid -->
      <div class="row g-2 mb-3">
        <div class="col-6">
          <div class="p-2 bg-light rounded border h-100" style="font-size: 0.78rem;">
            <div class="fw-bold text-uppercase text-dark mb-1" style="font-size: 0.72rem; letter-spacing: 0.05em; color: #475569;">BILLED TO / CUSTOMER DETAILS</div>
            <div class="fw-bold text-black fs-6">${escapeHtml(custName)}</div>
            <div>${escapeHtml(custAddress)}</div>
            <div>${custCity ? `${escapeHtml(custCity)}, ` : ''}${escapeHtml(custState)} ${custPin ? `- ${escapeHtml(custPin)}` : ''}</div>
            <div class="mt-1"><strong>Phone:</strong> <span class="font-mono">${escapeHtml(custPhone)}</span></div>
            ${custEmail ? `<div><strong>Email:</strong> ${escapeHtml(custEmail)}</div>` : ''}
            ${custGstin ? `<div class="text-accent fw-bold font-mono mt-1"><strong>Trade/Tax ID:</strong> ${escapeHtml(custGstin)}</div>` : ''}
          </div>
        </div>
        <div class="col-6">
          <div class="p-2 bg-light rounded border h-100" style="font-size: 0.78rem;">
            <div class="fw-bold text-uppercase text-dark mb-1" style="font-size: 0.72rem; letter-spacing: 0.05em; color: #475569;">DISPATCH &amp; PAYMENT DETAILS</div>
            <div><strong>Destination:</strong> ${escapeHtml(custState)}</div>
            <div><strong>Channel:</strong> ${source}</div>
            <div><strong>Payment Mode:</strong> ${paymentMethod}</div>
            <div><strong>Payment Status:</strong> 
              <span class="badge ${paymentStatus === 'PAID' ? 'bg-success text-white' : 'bg-warning text-dark'}" style="font-size: 0.68rem;">
                ${paymentStatus}
              </span>
            </div>
            ${loadedOrderId ? `<div class="mt-1 font-mono text-muted" style="font-size: 0.72rem;">Linked Order: <strong>#${loadedOrderId}</strong></div>` : ''}
          </div>
        </div>
      </div>

      <!-- Line Items Table -->
      ${isNonGst ? `
        <!-- Non-GST Retail Bill Table -->
        <table class="gst-table">
          <thead>
            <tr>
              <th style="width: 32px;" class="text-center">#</th>
              <th>Item Description</th>
              <th style="width: 110px;">SKU</th>
              <th class="text-center" style="width: 50px;">Qty</th>
              <th class="text-end" style="width: 105px;">Rate (MRP ₹)</th>
              <th class="text-end" style="width: 95px;">Discount</th>
              <th class="text-end" style="width: 115px;">Amount (Sale ₹)</th>
            </tr>
          </thead>
          <tbody>
            ${metrics.items.map(item => `
              <tr>
                <td class="text-center font-mono">${item.index}</td>
                <td>
                  <div class="fw-bold text-dark">${escapeHtml(item.name)}</div>
                </td>
                <td class="font-mono text-muted small">${escapeHtml(item.sku || '-')}</td>
                <td class="text-center font-mono fw-bold">${item.qty}</td>
                <td class="text-end font-mono">${formatCurrency(item.mrp)}</td>
                <td class="text-end font-mono text-success">${item.discountAmt > 0 ? `-${formatCurrency(item.discountAmt)}<div style="font-size: 0.65rem; color: #16a34a;">(${item.discountPercent}% OFF)</div>` : '-'}</td>
                <td class="text-end font-mono fw-bold">${formatCurrency(item.total)}${item.qty > 1 ? `<div class="text-muted small" style="font-size: 0.65rem; font-weight: normal;">(@ ${formatCurrency(item.price)}/ea)</div>` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="text-end fw-bold">Total MRP:</td>
              <td class="text-end font-mono fw-semibold text-muted text-decoration-line-through">${formatCurrency(metrics.totalGrossMrp)}</td>
              <td class="text-end font-mono fw-bold text-success">${metrics.totalDiscountSavings > 0 ? '-' + formatCurrency(metrics.totalDiscountSavings) : '-'}</td>
              <td class="text-end font-mono fw-bold">${formatCurrency(metrics.subtotalSalePrice)}</td>
            </tr>
          </tfoot>
        </table>
      ` : `
        <!-- Standard GST Table -->
        <table class="gst-table">
          <thead>
            <tr>
              <th style="width: 25px;">#</th>
              <th>Item Description</th>
              <th style="width: 75px;">HSN/SAC</th>
              <th class="text-center" style="width: 45px;">Qty</th>
              <th class="text-end" style="width: 85px;">Rate (MRP ₹)</th>
              <th class="text-end" style="width: 85px;">Taxable (₹)</th>
              ${metrics.isIntrastate ? `
                <th class="text-end" style="width: 70px;">CGST</th>
                <th class="text-end" style="width: 70px;">SGST</th>
              ` : `
                <th class="text-end" style="width: 85px;">IGST</th>
              `}
              <th class="text-end" style="width: 95px;">Amount (Sale ₹)</th>
            </tr>
          </thead>
          <tbody>
            ${metrics.items.map(item => `
              <tr>
                <td class="text-center font-mono">${item.index}</td>
                <td>
                  <div class="fw-bold text-dark">${escapeHtml(item.name)}</div>
                  ${item.discountAmt > 0 ? `<span class="badge bg-light text-success border font-mono" style="font-size: 0.65rem;">Disc: -${formatCurrency(item.discountAmt)} (${item.discountPercent}%)</span>` : ''}
                </td>
                <td class="font-mono text-center small">${item.hsn || '-'}</td>
                <td class="text-center font-mono fw-bold">${item.qty}</td>
                <td class="text-end font-mono">${formatCurrency(item.mrp)}</td>
                <td class="text-end font-mono">${formatCurrency(item.taxable)}</td>
                ${metrics.isIntrastate ? `
                  <td class="text-end font-mono small">${formatCurrency(item.cgst)}<br><span class="text-muted" style="font-size: 0.65rem;">(${item.taxRate / 2}%)</span></td>
                  <td class="text-end font-mono small">${formatCurrency(item.sgst)}<br><span class="text-muted" style="font-size: 0.65rem;">(${item.taxRate / 2}%)</span></td>
                ` : `
                  <td class="text-end font-mono small">${formatCurrency(item.igst)}<br><span class="text-muted" style="font-size: 0.65rem;">(${item.taxRate}%)</span></td>
                `}
                <td class="text-end font-mono fw-bold">${formatCurrency(item.total)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="${metrics.isIntrastate ? '5' : '4'}" class="text-end fw-bold">Taxable Subtotal:</td>
              <td class="text-end font-mono fw-bold">${formatCurrency(metrics.subtotalTaxable)}</td>
              ${metrics.isIntrastate ? `
                <td class="text-end font-mono fw-bold">${formatCurrency(metrics.totalCgst)}</td>
                <td class="text-end font-mono fw-bold">${formatCurrency(metrics.totalSgst)}</td>
              ` : `
                <td class="text-end font-mono fw-bold">${formatCurrency(metrics.totalIgst)}</td>
              `}
              <td class="text-end font-mono fw-bold">${formatCurrency(metrics.subtotalTaxable + metrics.totalTax)}</td>
            </tr>
          </tfoot>
        </table>
      `}

      <!-- Summary & Payment Info Section -->
      <div class="row g-3 mb-3">
        <!-- Amount in Words & Customer Support Info -->
        <div class="col-7">
          <div class="p-2 border rounded bg-light mb-2" style="font-size: 0.74rem;">
            <div class="fw-bold text-dark text-uppercase mb-1" style="font-size: 0.7rem;">Amount Chargeable (in words):</div>
            <div class="fw-bold text-black font-heading fst-italic">${amountInWords}</div>
          </div>

          <div class="p-2 border rounded bg-light" style="font-size: 0.74rem;">
            <div class="fw-bold text-dark text-uppercase mb-1" style="font-size: 0.7rem;">Customer Support &amp; Queries</div>
            <div>For assistance, dispatch updates, or questions:</div>
            <div class="mt-1">
              <strong>Phone / WhatsApp:</strong> <span class="font-mono fw-bold text-dark fs-6">+91 9188510017</span>
            </div>
            <div class="small text-muted mt-1">
              <strong>Email:</strong> ${SELLER_INFO.email} &bull; <strong>Website:</strong> ${SELLER_INFO.website}
            </div>
          </div>
        </div>

        <!-- Calculations Breakdown -->
        <div class="col-5">
          <div class="p-2 border rounded bg-light" style="font-size: 0.75rem;">
            <table class="w-100 gst-table-borderless">
              ${isNonGst ? `
                <tr>
                  <td class="text-muted">Total MRP Value:</td>
                  <td class="text-end font-mono text-muted text-decoration-line-through">${formatCurrency(metrics.totalGrossMrp)}</td>
                </tr>
                ${metrics.totalDiscountSavings > 0 ? `
                  <tr>
                    <td class="text-success fw-semibold">Retail Discount Savings:</td>
                    <td class="text-end font-mono text-success fw-semibold">-${formatCurrency(metrics.totalDiscountSavings)}</td>
                  </tr>
                ` : ''}
                <tr>
                  <td class="fw-semibold text-dark">Subtotal (Sale Amount):</td>
                  <td class="text-end font-mono fw-bold">${formatCurrency(metrics.subtotalSalePrice)}</td>
                </tr>
              ` : `
                <tr>
                  <td class="text-muted">Total MRP Value:</td>
                  <td class="text-end font-mono text-muted text-decoration-line-through">${formatCurrency(metrics.totalGrossMrp)}</td>
                </tr>
                <tr>
                  <td class="text-muted">Total Taxable Value:</td>
                  <td class="text-end font-mono">${formatCurrency(metrics.subtotalTaxable)}</td>
                </tr>
                ${metrics.isIntrastate ? `
                  <tr>
                    <td class="text-muted">Central GST (CGST):</td>
                    <td class="text-end font-mono">${formatCurrency(metrics.totalCgst)}</td>
                  </tr>
                  <tr>
                    <td class="text-muted">State GST (SGST):</td>
                    <td class="text-end font-mono">${formatCurrency(metrics.totalSgst)}</td>
                  </tr>
                ` : `
                  <tr>
                    <td class="text-muted">Integrated GST (IGST):</td>
                    <td class="text-end font-mono">${formatCurrency(metrics.totalIgst)}</td>
                  </tr>
                `}
              `}
              ${metrics.shipping > 0 ? `
                <tr>
                  <td class="text-muted">Shipping &amp; Delivery:</td>
                  <td class="text-end font-mono">${formatCurrency(metrics.shipping)}</td>
                </tr>
              ` : ''}
              ${metrics.extraDiscount > 0 ? `
                <tr>
                  <td class="text-danger">Special Discount:</td>
                  <td class="text-end font-mono text-danger">-${formatCurrency(metrics.extraDiscount)}</td>
                </tr>
              ` : ''}
              ${metrics.roundOff !== 0 ? `
                <tr>
                  <td class="text-muted">Round Off:</td>
                  <td class="text-end font-mono">${metrics.roundOff > 0 ? '+' : ''}${formatCurrency(metrics.roundOff)}</td>
                </tr>
              ` : ''}
              <tr class="border-top border-dark pt-1">
                <td class="fw-bold font-heading fs-6 text-black">${isNonGst ? 'TOTAL PAYABLE:' : 'GRAND TOTAL:'}</td>
                <td class="text-end font-mono fw-bold fs-6 text-accent">${formatCurrency(metrics.grandTotal)}</td>
              </tr>
              ${(metrics.totalDiscountSavings > 0 || metrics.extraDiscount > 0) ? `
                <tr>
                  <td colspan="2" class="pt-1 text-end">
                    <span class="badge bg-success text-white font-mono" style="font-size: 0.68rem; padding: 3px 6px;">
                      Total Customer Savings: ${formatCurrency(metrics.totalDiscountSavings + metrics.extraDiscount)}
                    </span>
                  </td>
                </tr>
              ` : ''}
            </table>
          </div>
        </div>
      </div>

      <!-- Terms & Signatures -->
      <div class="row g-3 pt-2 border-top border-secondary border-opacity-25" style="font-size: 0.72rem;">
        <div class="col-8">
          <div class="fw-bold text-dark mb-1">TERMS &amp; CONDITIONS</div>
          <ul class="ps-3 mb-0 text-dark" style="line-height: 1.5; font-size: 0.74rem;">
            <li class="fw-bold text-danger">⚠️ Unboxing video is compulsory for return and replacement claims.</li>
            <li>Return or replacement requests must be submitted within 7 days of delivery along with an uncut unboxing video proof.</li>
            <li>Products must remain unused and in their original packaging.</li>
            ${isNonGst ? `
              <li>Retail bill of supply / Non-GST unregistered supply. Not eligible to collect tax on supplies.</li>
            ` : `
              <li>Tax invoice issued in accordance with GST provisions.</li>
            `}
            <li>Subject to Malappuram / Kerala judicial jurisdiction only.</li>
          </ul>
          ${notes ? `<div class="mt-2 text-dark"><strong>Note:</strong> ${escapeHtml(notes)}</div>` : ''}
        </div>
        <div class="col-4 text-center">
          <div class="fw-bold text-dark mb-1">For XORONIQ CAR CARE</div>
          <div class="signatory-box mt-1">
            <span class="font-heading small">[Authorized Signatory]</span>
          </div>
          <div class="text-muted mt-1" style="font-size: 0.65rem;">${isNonGst ? 'Computer Generated Retail Bill of Supply' : 'Computer Generated Tax Invoice'}</div>
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Load order data into the invoice form
  function populateFromOrder(order) {
    if (!order) return;
    loadedOrderId = order.orderId;

    if (invNumberInput) invNumberInput.value = `XOR-INV-${order.orderId.replace(/[^0-9]/g, '') || Math.floor(1000 + Math.random() * 9000)}`;
    if (invSourceSelect) invSourceSelect.value = order.source || 'Website';
    if (invRefInput) invRefInput.value = order.externalOrderId || order.orderId || '';

    // Customer
    if (custNameInput) custNameInput.value = order.customer?.name || '';
    if (custPhoneInput) custPhoneInput.value = order.customer?.phone || '';
    if (custEmailInput) custEmailInput.value = order.customer?.email || '';
    if (custAddressInput) custAddressInput.value = order.shippingAddress?.address || '';
    if (custCityInput) custCityInput.value = order.shippingAddress?.city || '';
    if (custStateInput) custStateInput.value = order.shippingAddress?.state || 'Kerala';
    if (custPincodeInput) custPincodeInput.value = order.shippingAddress?.pincode || '';

    // Charges
    if (invShippingInput) invShippingInput.value = order.shipping || 0;
    if (invDiscountInput) invDiscountInput.value = order.discount || 0;
    if (invPaymentMethodSelect) invPaymentMethodSelect.value = order.payment?.method === 'COD' ? 'COD' : 'RAZORPAY';
    if (invPaymentStatusSelect) invPaymentStatusSelect.value = (order.payment?.status === 'PAID' || order.orderStatus === 'Delivered') ? 'PAID' : (order.payment?.method === 'COD' ? 'COD' : 'PENDING');

    // Items
    if (order.items && order.items.length > 0) {
      lineItems = order.items.map((it, idx) => {
        const salePrice = Number(it.price) || 0;
        const matchedPreset = Object.values(CATALOG_PRESETS).find(p => p.sku === it.sku || p.name === it.name);
        const mrp = Number(it.mrp) || (matchedPreset ? matchedPreset.mrp : Math.round(salePrice * 1.25)) || salePrice;
        return {
          id: 'item_' + idx + '_' + Date.now(),
          name: it.name || 'Detailing Product',
          sku: it.sku || (matchedPreset ? matchedPreset.sku : 'XOR-KIT'),
          hsn: it.hsn || '',
          qty: Number(it.quantity) || 1,
          mrp: mrp,
          price: salePrice,
          discountPercent: 0,
          taxRate: 0
        };
      });
    } else {
      lineItems = [{ ...CATALOG_PRESETS['xoroniq-essential-kit'], id: 'item_init' }];
    }

    renderLineItemInputs();
    updatePreview();
    showToast(`Order #${order.orderId} loaded into invoice studio!`, 'success');
  }

  // Load Order Modal Table Setup
  async function setupLoadOrderModal() {
    try {
      existingOrdersCache = await getOrders();
      renderModalOrdersList(existingOrdersCache);
    } catch (e) {
      console.warn('Could not preload orders for modal:', e);
    }
  }

  function renderModalOrdersList(orders) {
    if (!loadOrderModalTbody) return;
    if (orders.length === 0) {
      loadOrderModalTbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No orders found</td></tr>`;
      return;
    }

    loadOrderModalTbody.innerHTML = orders.slice(0, 50).map(order => `
      <tr>
        <td class="font-mono fw-bold">#${order.orderId}</td>
        <td>${getSourceBadgeHtml(order.source)}</td>
        <td>
          <div class="fw-semibold text-dark">${escapeHtml(order.customer?.name || 'Customer')}</div>
          <div class="small text-muted font-mono">${escapeHtml(order.customer?.phone || '')}</div>
        </td>
        <td class="small">${formatDate(order.createdAt)}</td>
        <td class="font-mono text-accent fw-bold">${formatCurrency(order.total)}</td>
        <td>
          <button type="button" class="btn btn-x-primary btn-sm py-1 px-2 select-modal-order-btn" data-id="${order.id}">
            Select
          </button>
        </td>
      </tr>
    `).join('');

    loadOrderModalTbody.querySelectorAll('.select-modal-order-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const order = existingOrdersCache.find(o => o.id === id);
        if (order) {
          populateFromOrder(order);
          const modalEl = document.getElementById('loadOrderModal');
          if (modalEl) {
            const bs = window.bootstrap.Modal.getInstance(modalEl);
            if (bs) bs.hide();
          }
        }
      });
    });
  }

  // Save Current Invoice as an Order in Firestore
  async function handleSaveAsOrder() {
    const custName = custNameInput?.value?.trim();
    const custPhone = custPhoneInput?.value?.trim();

    if (!custName || !custPhone) {
      showToast('Please enter Customer Name and Phone number.', 'warning');
      return;
    }

    const metrics = calculateInvoiceMetrics();
    saveAsOrderBtn.disabled = true;
    saveAsOrderBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Saving Order...`;

    try {
      const orderPayload = {
        orderId: loadedOrderId || `XOR-${Math.floor(100000 + Math.random() * 900000)}`,
        source: invSourceSelect?.value || 'WhatsApp',
        externalOrderId: invRefInput?.value || '',
        customer: {
          name: custName,
          phone: custPhone,
          email: custEmailInput?.value?.trim() || '',
          gstin: custGstinInput?.value?.trim() || ''
        },
        shippingAddress: {
          address: custAddressInput?.value?.trim() || '',
          city: custCityInput?.value?.trim() || '',
          state: custStateInput?.value?.trim() || 'Kerala',
          pincode: custPincodeInput?.value?.trim() || '',
          country: 'India'
        },
        items: metrics.items.map(it => ({
          name: it.name,
          sku: it.sku || 'XOR-PROD',
          hsn: it.hsn,
          price: it.price,
          quantity: it.qty,
          taxRate: it.taxRate,
          total: it.total
        })),
        subtotal: metrics.subtotalTaxable,
        discount: metrics.extraDiscount,
        shipping: metrics.shipping,
        tax: metrics.totalTax,
        total: metrics.grandTotal,
        payment: {
          method: invPaymentMethodSelect?.value || 'UPI',
          status: invPaymentStatusSelect?.value === 'PAID' ? 'PAID' : 'PENDING'
        },
        invoiceNumber: invNumberInput?.value || '',
        taxDetails: {
          isIntrastate: metrics.isIntrastate,
          cgst: metrics.totalCgst,
          sgst: metrics.totalSgst,
          igst: metrics.totalIgst,
          taxMode: metrics.taxMode
        },
        orderStatus: invPaymentStatusSelect?.value === 'PAID' ? 'Payment Confirmed' : (invPaymentMethodSelect?.value === 'COD' ? 'Order Placed (COD)' : 'Processing'),
        adminNote: `Invoice ${invNumberInput?.value || ''} generated via Invoice Studio.`
      };

      const created = await createOrder(orderPayload);
      loadedOrderId = created.orderId;

      // Also persist to Invoices collection
      await saveInvoiceRecord({
        invoiceNumber: invNumberInput?.value,
        orderId: created.orderId,
        customer: orderPayload.customer,
        seller: SELLER_INFO,
        items: metrics.items,
        subtotal: metrics.subtotalTaxable,
        discount: metrics.extraDiscount,
        shipping: metrics.shipping,
        taxBreakup: {
          cgst: metrics.totalCgst,
          sgst: metrics.totalSgst,
          igst: metrics.totalIgst
        },
        totalTax: metrics.totalTax,
        grandTotal: metrics.grandTotal,
        payment: orderPayload.payment,
        notes: invNotesTextarea?.value || ''
      }).catch(err => console.warn('Invoice collection note:', err));

      // Sync to Google Sheets
      sendOrderToGoogleSheets(created).catch(err => console.warn('Sheets sync note:', err));

      showToast(`Order #${created.orderId} created & linked to Invoice!`, 'success');
      updatePreview();
    } catch (err) {
      console.error('Save order error:', err);
      showToast('Failed to save order: ' + err.message, 'error');
    } finally {
      saveAsOrderBtn.disabled = false;
      saveAsOrderBtn.innerHTML = `<i class="bi bi-cloud-arrow-up-fill me-1"></i> Save as System Order`;
    }
  }

  // Export JSON
  function handleExportJson() {
    const metrics = calculateInvoiceMetrics();
    const data = {
      invoiceNumber: invNumberInput?.value,
      date: invDateInput?.value,
      source: invSourceSelect?.value,
      seller: SELLER_INFO,
      customer: {
        name: custNameInput?.value,
        phone: custPhoneInput?.value,
        email: custEmailInput?.value,
        address: custAddressInput?.value,
        city: custCityInput?.value,
        state: custStateInput?.value,
        pincode: custPincodeInput?.value,
        gstin: custGstinInput?.value
      },
      metrics
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invNumberInput?.value || 'invoice'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Invoice JSON downloaded', 'info');
  }

  // Reset to clean template
  function handleReset() {
    loadedOrderId = null;
    if (invNumberInput) invNumberInput.value = generateInvoiceNumber();
    setTodayDate();
    if (invRefInput) invRefInput.value = '';
    if (custNameInput) custNameInput.value = '';
    if (custPhoneInput) custPhoneInput.value = '';
    if (custEmailInput) custEmailInput.value = '';
    if (custGstinInput) custGstinInput.value = '';
    if (custAddressInput) custAddressInput.value = '';
    if (custCityInput) custCityInput.value = '';
    if (custStateInput) custStateInput.value = 'Kerala';
    if (custPincodeInput) custPincodeInput.value = '';
    if (invShippingInput) invShippingInput.value = 0;
    if (invDiscountInput) invDiscountInput.value = 0;

    lineItems = [{ ...CATALOG_PRESETS['xoroniq-essential-kit'], id: 'item_' + Date.now() }];
    renderLineItemInputs();
    updatePreview();
    showToast('Invoice Studio reset to blank draft.', 'info');
  }

  // Event Listeners setup
  function attachEventListeners() {
    // Generate new invoice number
    if (generateInvBtn) {
      generateInvBtn.addEventListener('click', () => {
        if (invNumberInput) {
          invNumberInput.value = generateInvoiceNumber();
          updatePreview();
        }
      });
    }

    // Input listeners for real-time recalculation
    const inputElements = [
      invNumberInput, invSourceSelect, invDateInput, invRefInput,
      custNameInput, custPhoneInput, custEmailInput, custGstinInput,
      custAddressInput, custCityInput, custStateInput, custPincodeInput,
      invTaxModeSelect, invGstTypeSelect, invShippingInput, invDiscountInput,
      invPaymentMethodSelect, invPaymentStatusSelect, invNotesTextarea
    ];

    inputElements.forEach(el => {
      if (el) {
        el.addEventListener('input', updatePreview);
        el.addEventListener('change', updatePreview);
      }
    });

    if (invTaxModeSelect) {
      invTaxModeSelect.addEventListener('change', () => {
        const gstTypeCol = document.getElementById('gst-type-col');
        if (gstTypeCol) {
          gstTypeCol.style.display = invTaxModeSelect.value === 'NONE' ? 'none' : 'block';
        }
        renderLineItemInputs();
        updatePreview();
      });
    }

    // Add Preset Catalog item
    if (catalogSelect) {
      catalogSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (!val) return;
        if (val === 'custom') {
          addLineItem({
            name: 'Custom Product / Service',
            sku: 'XOR-GENERIC',
            hsn: '',
            mrp: 699,
            price: 499,
            taxRate: 0,
            qty: 1
          });
        } else if (CATALOG_PRESETS[val]) {
          addLineItem(CATALOG_PRESETS[val]);
        }
        catalogSelect.value = '';
      });
    }

    // Add Custom Row
    if (addCustomRowBtn) {
      addCustomRowBtn.addEventListener('click', () => {
        addLineItem({
          name: 'Custom Product / Service',
          sku: 'XOR-CUST',
          hsn: '',
          mrp: 699,
          price: 499,
          taxRate: 0,
          qty: 1
        });
      });
    }

    // Rock-solid isolated A4 Print Function (Guaranteed never blank)
    function printInvoiceDocument() {
      const sheetEl = document.getElementById('printable-gst-invoice');
      if (!sheetEl) {
        window.print();
        return;
      }

      const invoiceHtml = sheetEl.innerHTML;

      // Use a clean, isolated hidden iframe to eliminate any page layout / sidebar interference
      let iframe = document.getElementById('xoroniq-invoice-print-frame');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'xoroniq-invoice-print-frame';
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
          <title>Invoice - XORONIQ Car Care</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 10mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 0;
              font-size: 11px;
              line-height: 1.35;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .gst-header-title {
              font-weight: 800;
              letter-spacing: 0.05em;
              color: #090d16;
              font-size: 18px;
              margin-bottom: 2px;
            }
            .gst-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
              margin-bottom: 6px;
              font-size: 10.5px;
            }
            .gst-table th, .gst-table td {
              border: 1px solid #94a3b8;
              padding: 5px 6px;
              vertical-align: middle;
            }
            .gst-table th {
              background-color: #f1f5f9 !important;
              font-weight: 700;
              color: #0f172a;
              text-transform: uppercase;
              font-size: 9.5px;
              letter-spacing: 0.03em;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .gst-table tfoot td {
              border: 1px solid #475569;
              font-weight: bold;
              padding: 5px 6px;
            }
            .gst-table-borderless td {
              border: none !important;
              padding: 2px 4px;
            }
            .invoice-badge-type {
              background: #090d16 !important;
              color: #ffffff !important;
              padding: 3px 8px;
              font-size: 9px;
              font-weight: 700;
              letter-spacing: 0.08em;
              border-radius: 3px;
              display: inline-block;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .signatory-box {
              border: 1px dashed #64748b;
              height: 48px;
              border-radius: 4px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #f8fafc !important;
              color: #64748b;
              font-size: 10px;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .bg-light {
              background-color: #f8fafc !important;
              border: 1px solid #cbd5e1 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .row {
              margin-left: -4px;
              margin-right: -4px;
            }
            .col-6, .col-7, .col-5, .col-8, .col-4 {
              padding-left: 4px;
              padding-right: 4px;
            }
            .mb-3 { margin-bottom: 6px !important; }
            .mb-2 { margin-bottom: 4px !important; }
            .pb-3 { padding-bottom: 5px !important; }
            .pt-2 { padding-top: 4px !important; }
            .font-mono {
              font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
            }
          </style>
        </head>
        <body>
          ${invoiceHtml}
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
    }

    // Print Buttons
    if (printBtn) {
      printBtn.addEventListener('click', printInvoiceDocument);
    }
    if (previewPrintBtn) {
      previewPrintBtn.addEventListener('click', printInvoiceDocument);
    }

    // Save as order
    if (saveAsOrderBtn) {
      saveAsOrderBtn.addEventListener('click', handleSaveAsOrder);
    }

    // Export JSON
    if (downloadJsonBtn) {
      downloadJsonBtn.addEventListener('click', handleExportJson);
    }

    // Reset
    if (resetBtn) {
      resetBtn.addEventListener('click', handleReset);
    }

    // Modal search
    if (orderSearchInModal) {
      orderSearchInModal.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = existingOrdersCache.filter(o => 
          (o.orderId || '').toLowerCase().includes(term) ||
          (o.customer?.name || '').toLowerCase().includes(term) ||
          (o.customer?.phone || '').includes(term)
        );
        renderModalOrdersList(filtered);
      });
    }

    // Quick fill customer modal
    const quickCustBtn = document.getElementById('quick-fill-customer-btn');
    if (quickCustBtn) {
      quickCustBtn.addEventListener('click', () => {
        const modalEl = document.getElementById('loadOrderModal');
        if (modalEl) {
          const bs = window.bootstrap.Modal.getOrCreateInstance(modalEl);
          bs.show();
        }
      });
    }
  }

  // Check URL query for orderId (e.g. invoice.html?orderId=XOR-83910)
  async function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const paramOrderId = params.get('orderId');
    if (paramOrderId) {
      try {
        const order = await getOrderById(paramOrderId);
        if (order) {
          populateFromOrder(order);
          return;
        }
      } catch (e) {
        console.warn('Could not load orderId from URL:', e);
      }
    }

    // Default initial row
    lineItems = [{ ...CATALOG_PRESETS['xoroniq-essential-kit'], id: 'item_initial' }];
    renderLineItemInputs();
    updatePreview();
  }

  // Kickoff
  if (invNumberInput) invNumberInput.value = generateInvoiceNumber();
  setTodayDate();
  attachEventListeners();
  setupLoadOrderModal();
  checkUrlParams();
}
