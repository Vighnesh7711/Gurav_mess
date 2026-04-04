/* =============================================
   SMART MESS MANAGER — Frontend Application
   ============================================= */

const API = '';  // Same origin

// ─── State ───
let token = localStorage.getItem('token');
let currentUser = null;
let activeTab = 'menu';

// ─── Helpers ───
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API}${path}`, { ...opts, headers })
    .then(async res => {
      const data = res.headers.get('content-type')?.includes('json')
        ? await res.json()
        : await res.text();
      if (!res.ok) throw new Error(data.error || data || 'Request failed');
      return data;
    });
}

function todayISO() {
  // Return YYYY-MM-DD in IST
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split('T')[0];
}

function currentMonthISO() {
  const d = todayISO();
  return d.substring(0, 7);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Boot ───
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    tryAutoLogin();
  } else {
    showLogin();
  }

  // Event listeners
  $('#login-form').addEventListener('submit', handleLogin);
  $('#logout-btn').addEventListener('click', handleLogout);
  $('#menu-date').addEventListener('change', () => loadMenu($('#menu-date').value));
  $('#cutoff-time').textContent = '11';
});

// ─── AUTH ───
async function handleLogin(e) {
  e.preventDefault();
  const name = $('#login-name').value.trim();
  const password = $('#login-password').value;
  const errEl = $('#login-error');
  errEl.classList.add('hidden');

  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function tryAutoLogin() {
  try {
    const data = await api('/api/auth/me');
    currentUser = data.user;
    showApp();
  } catch {
    localStorage.removeItem('token');
    token = null;
    showLogin();
  }
}

function handleLogout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  showLogin();
}

// ─── SCREEN SWITCHING ───
function showLogin() {
  $('#login-screen').classList.add('active');
  $('#login-screen').classList.remove('hidden');
  $('#app-screen').classList.add('hidden');
}

function showApp() {
  $('#login-screen').classList.remove('active');
  $('#login-screen').classList.add('hidden');
  $('#app-screen').classList.remove('hidden');

  // Set user info
  const badge = currentUser.role === 'admin' ? '👑 Admin' : '👤 Student';
  $('#header-user').textContent = `${currentUser.name} — ${badge}`;

  // Build navigation tabs
  buildNav();

  // Set default dates
  $('#menu-date').value = todayISO();

  // Load first tab
  switchTab('menu');
}

// ─── NAVIGATION ───
function buildNav() {
  const nav = $('#app-nav');
  nav.innerHTML = '';

  const tabs = [
    { id: 'menu', label: '📋 Menu', roles: ['admin', 'user'] },
    { id: 'order', label: '🛒 Order', roles: ['user'] },
    { id: 'requests', label: '💡 Requests', roles: ['admin', 'user'] },
    { id: 'spending', label: '📊 Spending', roles: ['user'] },
    { id: 'all-orders', label: '📦 Orders', roles: ['admin'] },
    { id: 'billing', label: '💰 Billing', roles: ['admin'] },
  ];

  tabs.forEach(tab => {
    if (!tab.roles.includes(currentUser.role)) return;
    const btn = document.createElement('button');
    btn.className = 'nav-tab';
    btn.dataset.tab = tab.id;
    btn.textContent = tab.label;
    btn.addEventListener('click', () => switchTab(tab.id));
    nav.appendChild(btn);
  });
}

function switchTab(tabId) {
  activeTab = tabId;

  // Update nav
  $$('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));

  // Hide all panels, show selected
  $$('.tab-panel').forEach(p => p.classList.add('hidden'));
  const panel = $(`#tab-${tabId}`);
  if (panel) panel.classList.remove('hidden');

  // Load data for tab
  switch (tabId) {
    case 'menu': loadMenu($('#menu-date').value); break;
    case 'order': loadOrderTab(); break;
    case 'requests': loadRequests(); break;
    case 'spending': loadSpending(); break;
    case 'all-orders': loadAllOrders(); break;
    case 'billing': loadBilling(); break;
  }
}

// ─── MENU TAB ───
async function loadMenu(date) {
  if (!date) date = todayISO();

  try {
    const menu = await api(`/api/menu/${date}`);
    const statusEl = $('#menu-status');
    const listEl = $('#menu-items-list');
    const editorEl = $('#admin-menu-editor');

    // Status
    if (!menu.exists) {
      statusEl.className = 'status-chip closed';
      statusEl.textContent = '🚫 No menu set for this date';
    } else if (menu.isOpen) {
      statusEl.className = 'status-chip open';
      statusEl.textContent = '✅ Mess is OPEN';
    } else {
      statusEl.className = 'status-chip closed';
      statusEl.textContent = '🔒 Mess is CLOSED';
    }

    // Notifications
    showNotifications(menu);

    // Items
    if (menu.items && menu.items.length > 0) {
      listEl.innerHTML = menu.items.map(item => `
        <div class="menu-item-card">
          <span class="menu-item-name">${item.name}</span>
          <span class="menu-item-price">₹${item.price}</span>
        </div>
      `).join('');
    } else {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>No menu items for this date</p>
        </div>`;
    }

    // Admin editor
    if (currentUser.role === 'admin') {
      editorEl.classList.remove('hidden');
      populateEditor(menu.items || []);
      const toggleBtn = $('#toggle-mess-btn');
      toggleBtn.textContent = menu.isOpen ? '🔒 Close Mess' : '✅ Open Mess';
      toggleBtn.onclick = () => toggleMess(date);
      $('#save-menu-btn').onclick = () => saveMenu(date);
      $('#add-item-btn').onclick = addEditorRow;
    } else {
      editorEl.classList.add('hidden');
    }
  } catch (err) {
    console.error('Load menu error:', err);
  }
}

function showNotifications(menu) {
  const bar = $('#notification-bar');
  if (!menu.exists || !menu.isOpen) {
    bar.className = 'notification-bar warn';
    bar.textContent = menu.exists ? '⚠️ Mess is CLOSED for this date' : '⚠️ No menu available for this date';
    bar.classList.remove('hidden');
  } else {
    // Check cutoff
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const cutoff = 11;
    if (ist.getUTCHours() >= cutoff && $('#menu-date').value === todayISO()) {
      bar.className = 'notification-bar warn';
      bar.textContent = `⏰ Order cutoff (${cutoff}:00 AM IST) has passed for today`;
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }
  }
}

function populateEditor(items) {
  const el = $('#editor-items');
  el.innerHTML = '';
  if (items.length === 0) {
    addEditorRow();
    return;
  }
  items.forEach(item => addEditorRow(item.name, item.price));
}

function addEditorRow(name = '', price = '') {
  const row = document.createElement('div');
  row.className = 'editor-row';
  row.innerHTML = `
    <input type="text" placeholder="Item name" value="${name}">
    <input type="number" placeholder="₹ Price" value="${price}" min="0" step="1">
    <button class="btn-remove" title="Remove">✕</button>
  `;
  row.querySelector('.btn-remove').addEventListener('click', () => row.remove());
  $('#editor-items').appendChild(row);
}

async function saveMenu(date) {
  const rows = $$('#editor-items .editor-row');
  const items = [];
  rows.forEach(row => {
    const name = row.querySelector('input[type="text"]').value.trim();
    const price = parseFloat(row.querySelector('input[type="number"]').value);
    if (name && !isNaN(price)) {
      items.push({ name, price });
    }
  });

  if (items.length === 0) {
    alert('Add at least one item to the menu.');
    return;
  }

  try {
    await api('/api/menu', {
      method: 'POST',
      body: JSON.stringify({ date, items, isOpen: true }),
    });
    loadMenu(date);
  } catch (err) {
    alert(err.message);
  }
}

async function toggleMess(date) {
  try {
    await api(`/api/menu/${date}/toggle`, { method: 'PATCH' });
    loadMenu(date);
  } catch (err) {
    alert(err.message);
  }
}

// ─── ORDER TAB ───
async function loadOrderTab() {
  const date = todayISO();

  try {
    const menu = await api(`/api/menu/${date}`);
    const checklistEl = $('#order-items-checklist');
    const totalEl = $('#order-total-display');
    const msgEl = $('#order-message');
    const placeBtn = $('#place-order-btn');

    msgEl.classList.add('hidden');

    if (!menu.exists || !menu.isOpen || !menu.items || menu.items.length === 0) {
      checklistEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${!menu.isOpen ? '🔒' : '📭'}</div>
          <p>${!menu.exists ? 'No menu available for today' : (!menu.isOpen ? 'Mess is closed today' : 'No items on the menu')}</p>
        </div>`;
      totalEl.textContent = 'Total: ₹0';
      placeBtn.classList.add('hidden');
      return;
    }

    placeBtn.classList.remove('hidden');

    checklistEl.innerHTML = menu.items.map((item, i) => `
      <label class="checklist-item" data-name="${item.name}" data-price="${item.price}">
        <input type="checkbox" id="order-item-${i}">
        <div class="item-info">
          <span class="item-name">${item.name}</span>
          <span class="item-price">₹${item.price}</span>
        </div>
      </label>
    `).join('');

    // Recalculate total on change
    $$('.checklist-item input').forEach(cb => {
      cb.addEventListener('change', () => {
        cb.closest('.checklist-item').classList.toggle('selected', cb.checked);
        updateOrderTotal();
      });
    });

    totalEl.textContent = 'Total: ₹0';
    placeBtn.onclick = () => placeOrder(date);
  } catch (err) {
    console.error(err);
  }
}

function updateOrderTotal() {
  let total = 0;
  $$('.checklist-item input:checked').forEach(cb => {
    total += parseFloat(cb.closest('.checklist-item').dataset.price);
  });
  $('#order-total-display').textContent = `Total: ₹${total}`;
}

async function placeOrder(date) {
  const items = [];
  $$('.checklist-item input:checked').forEach(cb => {
    const el = cb.closest('.checklist-item');
    items.push({ name: el.dataset.name, price: parseFloat(el.dataset.price) });
  });

  if (items.length === 0) {
    alert('Select at least one item.');
    return;
  }

  const msgEl = $('#order-message');

  try {
    await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ date, items }),
    });
    msgEl.textContent = '✅ Order placed successfully!';
    msgEl.className = 'info-text success';
    msgEl.classList.remove('hidden');
    // Disable button
    $('#place-order-btn').classList.add('hidden');
  } catch (err) {
    msgEl.textContent = `❌ ${err.message}`;
    msgEl.className = 'info-text error';
    msgEl.classList.remove('hidden');
  }
}

// ─── REQUESTS TAB ───
async function loadRequests() {
  const listEl = $('#requests-list');
  const formSection = $('#request-form-section');

  // Show form for users
  if (currentUser.role === 'user') {
    formSection.classList.remove('hidden');
    $('#submit-request-btn').onclick = submitRequest;
  } else {
    formSection.classList.add('hidden');
  }

  try {
    const requests = await api('/api/requests');

    if (requests.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💭</div>
          <p>No food requests yet</p>
        </div>`;
      return;
    }

    listEl.innerHTML = requests.map(req => {
      const requester = req.requestedBy?.name || 'Unknown';
      const date = formatDate(req.date);
      let actionsHTML = '';

      if (currentUser.role === 'admin' && req.status === 'pending') {
        actionsHTML = `
          <div class="request-actions">
            <input type="number" placeholder="₹" min="0" id="price-${req._id}">
            <button class="btn btn-approve" onclick="approveRequest('${req._id}')">✓</button>
            <button class="btn btn-reject" onclick="rejectRequest('${req._id}')">✕</button>
          </div>`;
      } else {
        actionsHTML = `<span class="status-badge ${req.status}">${req.status}${req.status === 'approved' ? ` ₹${req.price}` : ''}</span>`;
      }

      return `
        <div class="request-card">
          <div class="request-info">
            <div class="req-item">${req.itemName}</div>
            <div class="req-meta">by ${requester} · ${date}</div>
          </div>
          ${actionsHTML}
        </div>`;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

async function submitRequest() {
  const name = $('#request-item-name').value.trim();
  if (!name) { alert('Enter an item name.'); return; }

  try {
    await api('/api/requests', {
      method: 'POST',
      body: JSON.stringify({ itemName: name, date: todayISO() }),
    });
    $('#request-item-name').value = '';
    loadRequests();
  } catch (err) {
    alert(err.message);
  }
}

async function approveRequest(id) {
  const priceEl = document.querySelector(`#price-${id}`);
  const price = parseFloat(priceEl?.value);
  if (isNaN(price) || price < 0) {
    alert('Enter a valid price.');
    return;
  }

  try {
    await api(`/api/requests/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ price }),
    });
    loadRequests();
    loadMenu($('#menu-date').value); // Refresh menu too
  } catch (err) {
    alert(err.message);
  }
}

async function rejectRequest(id) {
  try {
    await api(`/api/requests/${id}/reject`, { method: 'PATCH' });
    loadRequests();
  } catch (err) {
    alert(err.message);
  }
}

// Make functions accessible from inline onclick handlers
window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;

// ─── MY SPENDING TAB ───
async function loadSpending() {
  const monthInput = $('#spending-month');
  if (!monthInput.value) monthInput.value = currentMonthISO();

  monthInput.onchange = loadSpending;

  const month = monthInput.value;

  try {
    const data = await api(`/api/billing/monthly?month=${month}`);
    const summaryEl = $('#spending-summary');
    const listEl = $('#spending-orders-list');

    const mySummary = data.userSummaries[0];
    if (!mySummary) {
      summaryEl.innerHTML = '';
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <p>No orders for this month</p>
        </div>`;
      return;
    }

    summaryEl.innerHTML = `
      <div class="summary-card">
        <div class="sc-value">₹${mySummary.total}</div>
        <div class="sc-label">Total Spent</div>
      </div>
      <div class="summary-card">
        <div class="sc-value">${mySummary.orderCount}</div>
        <div class="sc-label">Orders</div>
      </div>
      <div class="summary-card">
        <div class="sc-value">₹${mySummary.orderCount > 0 ? Math.round(mySummary.total / mySummary.orderCount) : 0}</div>
        <div class="sc-label">Avg / Day</div>
      </div>
    `;

    listEl.innerHTML = mySummary.orders.map(o => `
      <div class="order-card">
        <div class="order-card-header">
          <span class="oc-date">${formatDate(o.date)}</span>
          <span class="oc-total">₹${o.totalAmount}</span>
        </div>
        <div class="order-card-items">
          ${o.items.map(i => `<span class="order-item-chip">${i.name} ₹${i.price}</span>`).join('')}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

// ─── ALL ORDERS TAB (Admin) ───
async function loadAllOrders() {
  const dateInput = $('#all-orders-date');
  if (!dateInput.value) dateInput.value = todayISO();

  dateInput.onchange = loadAllOrders;

  const date = dateInput.value;

  try {
    const orders = await api(`/api/orders?date=${date}`);
    const summaryEl = $('#all-orders-summary');
    const listEl = $('#all-orders-list');

    const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);

    summaryEl.innerHTML = `
      <div class="summary-card">
        <div class="sc-value">${orders.length}</div>
        <div class="sc-label">Orders</div>
      </div>
      <div class="summary-card">
        <div class="sc-value">₹${totalRevenue}</div>
        <div class="sc-label">Revenue</div>
      </div>
    `;

    if (orders.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <p>No orders for this date</p>
        </div>`;
      return;
    }

    listEl.innerHTML = orders.map(o => `
      <div class="order-card">
        <div class="order-card-header">
          <span class="oc-user">${o.userId?.name || 'Unknown'}</span>
          <span class="oc-total">₹${o.totalAmount}</span>
        </div>
        <div class="order-card-items">
          ${o.items.map(i => `<span class="order-item-chip">${i.name} ₹${i.price}</span>`).join('')}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

// ─── BILLING TAB (Admin) ───
async function loadBilling() {
  const monthInput = $('#billing-month');
  if (!monthInput.value) monthInput.value = currentMonthISO();

  monthInput.onchange = loadBilling;

  const month = monthInput.value;

  try {
    const data = await api(`/api/billing/monthly?month=${month}`);
    const grandEl = $('#billing-grand-total');
    const cardsEl = $('#billing-user-cards');
    const exportBtn = $('#export-bill-btn');

    grandEl.innerHTML = `
      <div class="gt-value">₹${data.grandTotal}</div>
      <div class="gt-label">Total Revenue — ${month}</div>
    `;

    if (data.userSummaries.length === 0) {
      cardsEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💰</div>
          <p>No billing data for this month</p>
        </div>`;
    } else {
      cardsEl.innerHTML = data.userSummaries.map(u => `
        <div class="billing-user-card">
          <div class="billing-user-header">
            <span class="bu-name">${u.name}</span>
            <span class="bu-total">₹${u.total}</span>
          </div>
          <div class="billing-user-orders">
            ${u.orderCount} orders · Avg ₹${u.orderCount > 0 ? Math.round(u.total / u.orderCount) : 0}/day
          </div>
        </div>
      `).join('');
    }

    // Export button
    exportBtn.onclick = () => {
      window.open(`/api/billing/export?month=${month}`, '_blank');
    };
  } catch (err) {
    console.error(err);
  }
}
