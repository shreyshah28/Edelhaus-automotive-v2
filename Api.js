/* ============================================================
   EDELHAUS AUTOMOTIVE — Api.js (Flask Edition)
   All API calls go to Flask backend on port 5000.
   ============================================================ */

const API_BASE = (() => {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:5000';
    return window.location.origin; // same origin in production
})();

const EdelhausAPI = {

    // ── token management ──────────────────────────────────────
    _getToken()        { return sessionStorage.getItem('edelhausToken') || null; },
    _setToken(t)       { sessionStorage.setItem('edelhausToken', t); },
    _clearToken()      { sessionStorage.removeItem('edelhausToken'); },
    _getAdminToken()   { return sessionStorage.getItem('edelhausAdminToken') || null; },
    _setAdminToken(t)  { sessionStorage.setItem('edelhausAdminToken', t); },
    _clearAdminToken() { sessionStorage.removeItem('edelhausAdminToken'); },

    // ── generic fetch wrapper ─────────────────────────────────
    async _req(method, path, body = null, token = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const opts = { method, headers };
        if (body) opts.body = JSON.stringify(body);
        try {
            const res  = await fetch(API_BASE + path, opts);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.detail || `HTTP ${res.status}`);
            return json;
        } catch (err) {
            console.error(`[API] ${method} ${path} →`, err.message);
            throw err;
        }
    },

    /* ── CARS ── */
    async getCars(params = {}) {
        const qs = new URLSearchParams(
            Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''))
        ).toString();
        return this._req('GET', `/api/cars${qs ? '?' + qs : ''}`);
    },
    async getCar(id)        { return this._req('GET',    `/api/cars/${id}`); },
    async addCar(car)       { return this._req('POST',   '/api/cars', car, this._getAdminToken()); },
    async updateCar(id, car){ return this._req('PUT',    `/api/cars/${id}`, car, this._getAdminToken()); },
    async deleteCar(id)     { return this._req('DELETE', `/api/cars/${id}`, null, this._getAdminToken()); },
    async setCarStatus(id, status) {
        return this._req('PATCH', `/api/cars/${id}/status`, { status }, this._getAdminToken());
    },

    /* ── AUTH USER ── */
    async register(name, email, password, country = '', phone = '') {
        const data = await this._req('POST', '/api/auth/register', { name, email, password, country, phone });
        if (data.token) this._setToken(data.token);
        return data;
    },
    async login(email, password) {
        const data = await this._req('POST', '/api/auth/login', { email, password });
        if (data.token) this._setToken(data.token);
        return data;
    },
    logout()           { this._clearToken(); },
    async updatePhone(phone) {
        return this._req('PUT', '/api/users/me/phone', { phone }, this._getToken());
    },
    isUserLoggedIn()   { return !!this._getToken(); },

    /* ── AUTH ADMIN ── */
    async adminLogin(username, password) {
        const data = await this._req('POST', '/api/auth/admin/login', { username, password });
        if (data.token) this._setAdminToken(data.token);
        return data;
    },
    adminLogout()      { this._clearAdminToken(); },
    isAdminLoggedIn()  { return !!this._getAdminToken(); },

    /* ── USERS (admin) ── */
    async getUsers()         { return this._req('GET',    '/api/users', null, this._getAdminToken()); },
    async deleteUser(id)     { return this._req('DELETE', `/api/users/${id}`, null, this._getAdminToken()); },

    /* ── TEST DRIVES ── */
    async bookTestDrive(data)         { return this._req('POST',   '/api/testdrives', data); },
    async getTestDrives()             { return this._req('GET',    '/api/testdrives', null, this._getAdminToken()); },
    async getUserTestDrives(email)    { return this._req('GET',    `/api/testdrives/user/${encodeURIComponent(email)}`); },
    async updateTestDriveStatus(id, status) {
        return this._req('PUT', `/api/testdrives/${id}`, { status }, this._getAdminToken());
    },
    async deleteTestDrive(id) { return this._req('DELETE', `/api/testdrives/${id}`, null, this._getAdminToken()); },

    /* ── SERVICES ── */
    async bookService(data)           { return this._req('POST', '/api/services', data); },
    async getServices()               { return this._req('GET',  '/api/services', null, this._getAdminToken()); },
    async updateServiceStatus(id, status) {
        return this._req('PUT', `/api/services/${id}`, { status }, this._getAdminToken());
    },

    /* ── INQUIRIES ── */
    async submitInquiry(data)         { return this._req('POST',   '/api/inquiries', data); },
    async getInquiries()              { return this._req('GET',    '/api/inquiries', null, this._getAdminToken()); },
    async updateInquiryStatus(id, status) {
        return this._req('PUT', `/api/inquiries/${id}`, { status }, this._getAdminToken());
    },
    async deleteInquiry(id)           { return this._req('DELETE', `/api/inquiries/${id}`, null, this._getAdminToken()); },

    /* ── ANALYTICS ── */
    async getAnalytics()              { return this._req('GET',  '/api/analytics', null, this._getAdminToken()); },

    /* ── SEED ── */
    async reseedDatabase()            { return this._req('POST', '/api/seed', null, this._getAdminToken()); },

    /* ── HEALTH ── */
    async checkHealth() {
        try {
            const r = await fetch(API_BASE + '/api/health');
            return r.ok;
        } catch { return false; }
    },

    /* ── SESSION HELPERS ── */
    saveUserSession(user)  { sessionStorage.setItem('edelhausCurrentUser', JSON.stringify(user)); },
    getUserSession()       {
        try { return JSON.parse(sessionStorage.getItem('edelhausCurrentUser')); }
        catch { return null; }
    },
    clearUserSession()     { sessionStorage.removeItem('edelhausCurrentUser'); this._clearToken(); },

    showOfflineBanner(show = true) {
        let banner = document.getElementById('apiOfflineBanner');
        if (show) {
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'apiOfflineBanner';
                banner.style.cssText = `
                    position:fixed;top:0;left:0;right:0;z-index:99999;
                    background:rgba(231,76,60,0.95);color:#fff;
                    text-align:center;padding:10px 20px;font-size:0.82rem;
                    font-family:Montserrat,sans-serif;letter-spacing:1px;
                `;
                banner.innerHTML = `
                    ⚠️ <strong>Backend Offline</strong> — Start Flask server:
                    <code style="background:rgba(0,0,0,0.3);padding:2px 8px;border-radius:4px">
                    python app.py</code>
                    &nbsp;<button onclick="EdelhausAPI.retryConnection()"
                        style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);
                        color:#fff;padding:3px 12px;border-radius:6px;cursor:pointer">
                        Retry
                    </button>`;
                document.body.prepend(banner);
            }
        } else if (banner) {
            banner.remove();
        }
    },

    async retryConnection() {
        const ok = await this.checkHealth();
        if (ok) { this.showOfflineBanner(false); window.location.reload(); }
        else {
            const btn = document.querySelector('#apiOfflineBanner button');
            if (btn) { btn.textContent = 'Still offline…'; setTimeout(() => btn.textContent = 'Retry', 2000); }
        }
    }
};

window.addEventListener('DOMContentLoaded', async () => {
    const ok = await EdelhausAPI.checkHealth();
    if (!ok) {
        EdelhausAPI.showOfflineBanner(true);
        console.warn('[Edelhaus] Flask backend not reachable at', API_BASE);
    } else {
        console.info('[Edelhaus] ✅ Flask backend connected at', API_BASE);
        EdelhausAPI.showOfflineBanner(false);
    }
});