/**
 * InsightCart AI — Core App Module
 * API client, auth state management, toast notifications, utilities
 */

const API_BASE = 'http://localhost:5000/api';

// ── Auth State ─────────────────────────────────────────────────────────────────
const Auth = {
  getToken: () => localStorage.getItem('ic_token'),
  getUser:  () => { try { return JSON.parse(localStorage.getItem('ic_user')); } catch { return null; } },
  isLoggedIn: () => !!Auth.getToken(),
  isAdmin:    () => Auth.getUser()?.role === 'admin',

  setSession(token, user) {
    localStorage.setItem('ic_token', token);
    localStorage.setItem('ic_user', JSON.stringify(user));
    updateNavAuth();
  },

  clearSession() {
    localStorage.removeItem('ic_token');
    localStorage.removeItem('ic_user');
    updateNavAuth();
  },
};

// ── API Client ─────────────────────────────────────────────────────────────────
const api = {
  async request(method, path, body = null, authRequired = false) {
    const headers = { 'Content-Type': 'application/json' };
    const token = Auth.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    try {
      const res = await fetch(`${API_BASE}${path}`, opts);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          Auth.clearSession();
          showToast('Session expired. Please log in again.', 'warning');
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      if (!(err instanceof TypeError)) throw err; // network error
      throw new Error('Network error — is the server running?');
    }
  },

  get:    (path)        => api.request('GET',    path),
  post:   (path, body)  => api.request('POST',   path, body),
  put:    (path, body)  => api.request('PUT',    path, body),
  patch:  (path, body)  => api.request('PATCH',  path, body),
  delete: (path)        => api.request('DELETE', path),
};

// ── Toast Notification System ──────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container') || createToastContainer();
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span style="font-size:16px">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function createToastContainer() {
  const el = document.createElement('div');
  el.id = 'toast-container';
  document.body.appendChild(el);
  return el;
}

// ── Cart Badge Update ──────────────────────────────────────────────────────────
async function updateCartBadge() {
  if (!Auth.isLoggedIn()) return;
  try {
    const { items } = await api.get('/cart');
    const count = items.reduce((s, i) => s + i.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  } catch (_) {}
}

// ── Nav Auth State ─────────────────────────────────────────────────────────────
function updateNavAuth() {
  const user = Auth.getUser();
  const guestEl   = document.getElementById('nav-guest');
  const authedEl  = document.getElementById('nav-authed');
  const adminEl   = document.getElementById('nav-admin-link');
  const userNameEl= document.getElementById('nav-user-name');

  if (user) {
    if (guestEl)   guestEl.style.display   = 'none';
    if (authedEl)  authedEl.style.display  = 'flex';
    if (adminEl)   adminEl.style.display   = user.role === 'admin' ? 'block' : 'none';
    if (userNameEl) userNameEl.textContent  = user.name.split(' ')[0];
  } else {
    if (guestEl)   guestEl.style.display   = 'flex';
    if (authedEl)  authedEl.style.display  = 'none';
  }
}

// ── Auth Functions ─────────────────────────────────────────────────────────────
async function logout() {
  Auth.clearSession();
  showToast('Logged out successfully', 'success');
  setTimeout(() => window.location.href = '/index.html', 500);
}

// ── Currency Formatter ─────────────────────────────────────────────────────────
const fmt = {
  currency: (n) => '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
  date:     (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
  number:   (n) => Number(n).toLocaleString(),
};

// ── Star Rating Renderer ───────────────────────────────────────────────────────
function renderStars(rating) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

// ── Product Card Builder ───────────────────────────────────────────────────────
function buildProductCard(product, options = {}) {
  const { showReason = true, onClick } = options;
  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.id = product._id;

  card.innerHTML = `
    <div class="product-card-image">
      <img src="${product.imageUrl || 'https://via.placeholder.com/400x300'}" alt="${product.name}" loading="lazy"
           onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'">
      ${product.trendScore > 80 ? '<span class="product-card-badge">🔥 Trending</span>' : ''}
    </div>
    <div class="product-card-body">
      <div class="product-card-category">${product.category}</div>
      <div class="product-card-name">${product.name}</div>
      <div class="product-card-rating">
        <span class="stars">${renderStars(product.rating || 0)}</span>
        <span>(${fmt.number(product.reviewCount || 0)})</span>
      </div>
      ${showReason && product.recommendReason
        ? `<div class="recommend-reason">✨ ${product.recommendReason}</div>` : ''}
      <div class="product-card-footer">
        <div>
          <div class="product-price">${fmt.currency(product.price)}</div>
          ${product.stock < 10 && product.stock > 0
            ? `<div class="product-price-sub" style="color:var(--warning)">Only ${product.stock} left!</div>` : ''}
          ${product.stock === 0 ? `<div class="product-price-sub" style="color:var(--error)">Out of stock</div>` : ''}
        </div>
        <button class="btn btn-primary btn-sm add-to-cart-btn"
          data-id="${product._id}"
          ${product.stock === 0 ? 'disabled' : ''}>
          ${product.stock === 0 ? 'Sold Out' : '+ Cart'}
        </button>
      </div>
    </div>
  `;

  // Click card → product detail
  card.addEventListener('click', (e) => {
    if (e.target.closest('.add-to-cart-btn')) return;
    if (onClick) onClick(product);
    else window.location.href = `/product.html?id=${product._id}`;
    // Track view behavior
    Tracker.track('view', { productId: product._id, category: product.category });
  });

  // Add to cart button
  card.querySelector('.add-to-cart-btn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await addToCart(product._id, product.name);
  });

  return card;
}

// ── Add to Cart ────────────────────────────────────────────────────────────────
async function addToCart(productId, productName) {
  if (!Auth.isLoggedIn()) {
    showToast('Please log in to add items to cart', 'warning');
    setTimeout(() => window.location.href = '/login.html', 1000);
    return;
  }
  try {
    await api.post('/cart', { productId, quantity: 1 });
    Tracker.track('add_to_cart', { productId });
    showToast(`"${productName}" added to cart 🛒`, 'success');
    updateCartBadge();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Modal ──────────────────────────────────────────────────────────────────────
function openModal(titleText, contentHtml) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'app-modal';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">${titleText}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">${contentHtml}</div>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function closeModal() {
  document.getElementById('app-modal')?.remove();
}

// ── Init on DOM Ready ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateNavAuth();
  updateCartBadge();
});

// Export to global scope for use in HTML pages
window.Auth    = Auth;
window.api     = api;
window.showToast  = showToast;
window.addToCart  = addToCart;
window.openModal  = openModal;
window.closeModal = closeModal;
window.logout     = logout;
window.fmt        = fmt;
window.buildProductCard = buildProductCard;
window.updateCartBadge  = updateCartBadge;
window.renderStars      = renderStars;
