// ============================================================
// AVÈNE PLATFORM - app.js
// Auth côté client via Supabase JS SDK + token JWT → API
// ============================================================

const SUPABASE_URL  = 'https://iobmqmgmqezolivkmtxq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvYm1xbWdtcWV6b2xpdmttdHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMTUyNDMsImV4cCI6MjA5NDU5MTI0M30.sZHqhrkOB_ZHUaJNkvEUwoGD3GFP94CoMWxzWGA3gAw';

// ── Auth (Supabase client-side) ───────────────────────────────
const Auth = {
  user: null,
  session: null,
  _supabase: null,

  // Lazy-load Supabase SDK from CDN
  async _getClient() {
    if (this._supabase) return this._supabase;
    // Already loaded via <script> tag in each page
    this._supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    return this._supabase;
  },

  // Returns the current access token (for API calls)
  async getToken() {
    const sb = await this._getClient();
    const { data } = await sb.auth.getSession();
    return data?.session?.access_token || null;
  },

  // Called on every protected page
  async init() {
    try {
      const sb = await this._getClient();
      const { data: { session } } = await sb.auth.getSession();

      if (!session) {
        window.location.href = '/login.html';
        return null;
      }

      this.session = session;

      // Get profile from backend (includes role & nom)
      const profile = await API.get('/api/auth/profile');
      if (!profile) return null;

      this.user = {
        id: session.user.id,
        email: session.user.email,
        nom: profile.nom,
        role: profile.role
      };

      this._renderUserUI();
      return this.user;
    } catch (err) {
      console.error('Auth init error:', err);
      window.location.href = '/login.html';
      return null;
    }
  },

  _renderUserUI() {
    const nameEl   = document.getElementById('userName');
    const roleEl   = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl)   nameEl.textContent   = this.user.nom;
    if (roleEl)   roleEl.textContent   = this.user.role.charAt(0).toUpperCase() + this.user.role.slice(1);
    if (avatarEl) avatarEl.textContent = this.user.nom.charAt(0).toUpperCase();

    if (this.user.role !== 'admin') {
      document.querySelectorAll('[data-admin-only]').forEach(el => el.remove());
    }
  },

  isAdmin() { return this.user?.role === 'admin'; },

  async logout() {
    const sb = await this._getClient();
    await sb.auth.signOut();
    window.location.href = '/login.html';
  },

  // Sign in (called from login.html)
  async signIn(email, password) {
    const sb = await this._getClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    this.session = data.session;
    return data;
  }
};

// ── API Helper (always sends Bearer token) ────────────────────
const API = {
  async _headers() {
    const token = await Auth.getToken();
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  },

  async get(url) {
    const res = await fetch(url, { headers: await this._headers() });
    if (res.status === 401) { window.location.href = '/login.html'; return null; }
    if (!res.ok) {
      let err;
      try { err = await res.json(); } catch { err = {}; }
      throw new Error(err.error || `Erreur ${res.status}`);
    }
    return res.json();
  },

  async post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: await this._headers(),
      body: JSON.stringify(body)
    });
    if (res.status === 401) { window.location.href = '/login.html'; return null; }
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  },

  async put(url, body) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: await this._headers(),
      body: JSON.stringify(body)
    });
    if (res.status === 401) { window.location.href = '/login.html'; return null; }
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  },

  async delete(url) {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: await this._headers()
    });
    if (res.status === 401) { window.location.href = '/login.html'; return null; }
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  }
};

// ── Toast Notifications ───────────────────────────────────────
const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toastContainer');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.id = 'toastContainer';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 3500) {
    if (!this.container) this.init();
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: '💧' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || '💧'}</span><span>${message}</span>`;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'error'),
  warning: (msg) => Toast.show(msg, 'warning'),
  info:    (msg) => Toast.show(msg, 'info'),
};

// ── Modal Manager ─────────────────────────────────────────────
const Modal = {
  open(id)  { document.getElementById(id)?.classList.add('open'); },
  close(id) { document.getElementById(id)?.classList.remove('open'); },
  closeAll() { document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); }
};

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) Modal.closeAll();
});

// ── Sidebar ───────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebarOverlay')?.classList.toggle('open');
}

// ── Logout ────────────────────────────────────────────────────
async function handleLogout() {
  await Auth.logout();
}

// ── Confirm ───────────────────────────────────────────────────
function confirmAction(message, callback) {
  if (confirm(message)) callback();
}

// ── Date Formatters ───────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ── Chips Input ───────────────────────────────────────────────
class ChipsInput {
  constructor(containerId, type = 'correct') {
    this.container = document.getElementById(containerId);
    this.type = type;
    this.values = [];
    this._setupInput();
  }

  _setupInput() {
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = this.type === 'correct' ? 'Ajouter un bloc… (Entrée)' : 'Ajouter un piège… (Entrée)';
    this.input.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = this.input.value.trim();
        if (val) { this.add(val); this.input.value = ''; }
      }
      if (e.key === 'Backspace' && !this.input.value && this.values.length) {
        this.remove(this.values[this.values.length - 1]);
      }
    });
    this.container.appendChild(this.input);
    this.container.addEventListener('click', () => this.input.focus());
  }

  add(value) {
    if (this.values.includes(value)) {
      // Allow duplicates in correct blocks (same word twice)
    }
    this.values.push(value);
    const chip = document.createElement('span');
    chip.className = `chip-tag${this.type === 'piege' ? ' piege' : ''}`;
    chip.innerHTML = `${value}<span class="remove">×</span>`;
    chip.querySelector('.remove').addEventListener('click', e => {
      e.stopPropagation();
      const idx = this.values.lastIndexOf(value);
      if (idx !== -1) this.values.splice(idx, 1);
      chip.remove();
    });
    this.container.insertBefore(chip, this.input);
  }

  remove(value) {
    const idx = this.values.lastIndexOf(value);
    if (idx !== -1) this.values.splice(idx, 1);
    const chips = [...this.container.querySelectorAll('.chip-tag')];
    const found = chips.find(c => c.textContent.replace('×','').trim() === value);
    if (found) found.remove();
  }

  setValues(arr) {
    this.values = [];
    this.container.querySelectorAll('.chip-tag').forEach(c => c.remove());
    arr.forEach(v => this.add(v));
  }

  getValues() { return [...this.values]; }
  clear() { this.setValues([]); }
}

// ── DOMContentLoaded ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Toast.init();
});
