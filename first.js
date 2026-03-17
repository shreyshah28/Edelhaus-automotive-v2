// ============================================================
//  EDELHAUS AUTOMOTIVE — first.js
// ============================================================

// ==================== GLOBAL VARIABLES ====================
let currentPage        = 1;
const itemsPerPage     = 6;
let currentBrandFilter = 'all';
let searchTerm         = '';
let carsData           = [];
let currentCurrency    = 'INR';
const exchangeRate     = 12000;
let currentStatusFilter= 'available';
let currentSortOrder   = 'recommended';
let currentViewMode    = 'carousel';

// ── New inventory state variables (F1rst Motors-style) ──
let invStatusFilter = 'available'; // 'available' | 'sold'
let invSortMode     = 'recommended'; // 'recommended'|'price_asc'|'price_desc'|'newest'|'power'
let invBodyFilter   = 'all';        // 'all'|'sports'|'luxury'|'suv'|'hypercar'
let recentlyViewed  = JSON.parse(sessionStorage.getItem('ehRecentlyViewed') || '[]');

// ==============================================================
//  AUTH — STORAGE KEYS
//  localStorage  → 'edelhausUsers'      : all registered accounts
//  localStorage  → 'edelhausActiveUser' : currently logged-in user (survives reload)
//  localStorage  → 'edelhausTestDrives' : all test drive bookings
// ==============================================================

function getUsers() {
    return JSON.parse(localStorage.getItem('edelhausUsers')) || [];
}
function saveUsers(u) {
    localStorage.setItem('edelhausUsers', JSON.stringify(u));
    // Also sync to admin-compatible key
    localStorage.setItem('edelhaus_users', JSON.stringify(u));
}
function getCurrentUser() {
    // Reads from localStorage so session survives page reload / re-run
    return JSON.parse(localStorage.getItem('edelhausActiveUser')) || null;
}
function setCurrentUser(user) {
    localStorage.setItem('edelhausActiveUser', JSON.stringify(user));
    // Also sync to admin-compatible key
    localStorage.setItem('currentUser', JSON.stringify(user));
}
function isLoggedIn() {
    return getCurrentUser() !== null;
}

// ==============================================================
//  SIGNUP
//  Collects: Name, Phone, Email, Password
//  Saves account to localStorage → 'edelhausUsers'
//  Logs user in immediately
//  Shows "Registration Successful" screen inside the same modal
// ==============================================================
function handleSignup(e) {
    e.preventDefault();
    const form = document.getElementById('authSignupForm');
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

    const name     = document.getElementById('regName').value.trim();
    const email    = document.getElementById('regEmail').value.trim().toLowerCase();
    const password = document.getElementById('regPass').value;
    const country  = document.getElementById('regCountry').value;

    // Check if email already exists
    const users = getUsers();
    if (users.find(u => u.email === email)) {
        const err = document.getElementById('signupEmailError');
        if (err) { err.textContent = '⚠️ This email is already registered. Please log in.'; err.style.display = 'block'; }
        return;
    }

    // Save new account (phone saved later when user books test drive)
    const newUser = { name, email, password, country, phone: '', createdAt: new Date().toISOString() };
    users.push(newUser);
    saveUsers(users);

    // Log in immediately
    setCurrentUser({ name, email, country, phone: '' });

    // Update navbar to show user info
    updateNavbarUser();

    // Show success screen inside the modal
    const pendingCarId = localStorage.getItem('pendingTestDriveCarId');
    showRegistrationSuccess(name, email, country, !!pendingCarId);
}

function showRegistrationSuccess(name, email, country, hasPendingCar) {
    // Hide the tab pills so only success screen shows
    const header = document.querySelector('#loginModal .modal-header');
    if (header) header.style.display = 'none';

    const btnLabel = hasPendingCar
        ? '<i class="bi bi-calendar-check me-2"></i>GO TO TEST DRIVE BOOKING'
        : '<i class="bi bi-arrow-right me-2"></i>CONTINUE TO SITE';

    const body = document.querySelector('#loginModal .modal-body');
    body.innerHTML = `
        <div class="text-center py-3">
            <div style="width:72px;height:72px;background:rgba(46,204,113,0.15);border:2px solid #2ecc71;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
                <i class="bi bi-check-lg" style="font-size:2rem;color:#2ecc71;"></i>
            </div>
            <h4 class="text-white fw-bold mb-1">Registration Successful!</h4>
            <p class="text-muted small mb-4">Your account is created and saved to your browser.</p>

            <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:16px;text-align:left;margin-bottom:20px;">
                <p class="text-muted mb-2" style="font-size:0.7rem;letter-spacing:2px;text-transform:uppercase;">Saved Account Details</p>
                <div class="d-flex align-items-center gap-3 mb-2">
                    <i class="bi bi-person-fill text-primary"></i>
                    <span class="text-white">${name}</span>
                </div>
                <div class="d-flex align-items-center gap-3 mb-2">
                    <i class="bi bi-envelope-fill text-primary"></i>
                    <span class="text-white">${email}</span>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <i class="bi bi-geo-alt-fill text-primary"></i>
                    <span class="text-white">${country}</span>
                </div>
            </div>

            ${hasPendingCar ? `
            <div style="background:rgba(52,152,219,0.08);border:1px solid rgba(52,152,219,0.25);border-radius:10px;padding:12px;margin-bottom:20px;">
                <p class="mb-0" style="font-size:0.82rem;color:#87ceeb;">
                    <i class="bi bi-info-circle me-2"></i>
                    Your <strong>Name & Email</strong> will be auto-filled in the booking form. You only need to enter your <strong>phone number, date and time</strong>.
                </p>
            </div>` : ''}

            <button class="btn btn-gradient w-100 py-2 fw-bold" onclick="afterRegistration()" style="letter-spacing:1.5px;">
                ${btnLabel}
            </button>
        </div>`;
}

// Called when user clicks the button on the success screen
function afterRegistration() {
    const pendingCarId = localStorage.getItem('pendingTestDriveCarId');

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();

    // After modal closes, restore its original HTML for next time
    document.getElementById('loginModal').addEventListener('hidden.bs.modal', function restoreModal() {
        restoreLoginModalHTML();
        document.getElementById('loginModal').removeEventListener('hidden.bs.modal', restoreModal);

        // If a car was pending, open its test drive form now
        if (pendingCarId) {
            localStorage.removeItem('pendingTestDriveCarId');
            setTimeout(() => openTestDriveModal(parseInt(pendingCarId)), 400);
        }
    });
}

// Restore modal to its original Login/Signup tab structure
function restoreLoginModalHTML() {
    const header = document.querySelector('#loginModal .modal-header');
    if (header) header.style.display = 'flex';

    const body = document.querySelector('#loginModal .modal-body');
    body.innerHTML = buildLoginModalBody();

    // Re-attach submit handlers
    document.getElementById('authLoginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('authSignupForm')?.addEventListener('submit', handleSignup);
}

// Returns the original tab-based HTML for the modal body
function buildLoginModalBody() {
    return `
    <div class="tab-content">
        <!-- LOGIN TAB -->
        <div class="tab-pane fade show active" id="content-login">
            <p class="text-muted small mb-3">Welcome back to Edelhaus</p>
            <div id="loginError" style="display:none;background:rgba(231,76,60,0.12);border:1px solid #e74c3c;border-radius:8px;padding:10px 14px;font-size:0.84rem;color:#e74c3c;margin-bottom:14px;">
                <i class="bi bi-exclamation-circle me-2"></i>Incorrect email or password.
            </div>
            <form id="authLoginForm" novalidate>
                <div class="mb-3">
                    <label class="form-label text-muted small" style="letter-spacing:1px;font-size:0.72rem;">EMAIL ADDRESS *</label>
                    <input type="email" class="form-control" id="loginEmail" placeholder="name@example.com" required>
                    <div class="invalid-feedback">Please enter a valid email.</div>
                </div>
                <div class="mb-4">
                    <label class="form-label text-muted small" style="letter-spacing:1px;font-size:0.72rem;">PASSWORD *</label>
                    <input type="password" class="form-control" id="loginPass" placeholder="Your password" required>
                    <div class="invalid-feedback">Please enter your password.</div>
                </div>
                <button type="submit" class="btn btn-gradient w-100 py-2 fw-bold" style="letter-spacing:1.5px;">ENTER SHOWROOM</button>
            </form>
            <p class="text-center text-muted small mt-3 mb-0">
                No account? <a href="#" onclick="document.getElementById('tab-signup').click()" class="text-primary text-decoration-none">Sign up free →</a>
            </p>
        </div>
        <!-- SIGNUP TAB -->
        <div class="tab-pane fade" id="content-signup">
            <p class="text-muted small mb-3">Create your Edelhaus account</p>
            <div id="signupEmailError" style="display:none;background:rgba(231,76,60,0.12);border:1px solid #e74c3c;border-radius:8px;padding:10px 14px;font-size:0.84rem;color:#e74c3c;margin-bottom:14px;"></div>
            <form id="authSignupForm" novalidate>
                <div class="mb-3">
                    <label class="form-label text-muted small" style="letter-spacing:1px;font-size:0.72rem;">FULL NAME *</label>
                    <input type="text" class="form-control" id="regName" placeholder="Your full name" required minlength="3">
                    <div class="invalid-feedback">Name must be at least 3 characters.</div>
                </div>
                <div class="mb-3">
                    <label class="form-label text-muted small" style="letter-spacing:1px;font-size:0.72rem;">EMAIL ADDRESS *</label>
                    <input type="email" class="form-control" id="regEmail" placeholder="name@example.com" required>
                    <div class="invalid-feedback">Please enter a valid email.</div>
                </div>
                <div class="mb-3">
                    <label class="form-label text-muted small" style="letter-spacing:1px;font-size:0.72rem;">CREATE PASSWORD * (min. 6 chars)</label>
                    <input type="password" class="form-control" id="regPass" placeholder="Create a strong password" required minlength="6">
                    <div class="invalid-feedback">Password must be at least 6 characters.</div>
                </div>
                <div class="mb-4">
                    <label class="form-label text-muted small" style="letter-spacing:1px;font-size:0.72rem;">COUNTRY *</label>
                    <select class="form-select" id="regCountry" required>
                        <option value="" disabled selected>Select your country</option>
                        <option>India</option>
                        <option>United States</option>
                        <option>United Kingdom</option>
                        <option>United Arab Emirates</option>
                        <option>Germany</option>
                        <option>France</option>
                        <option>Japan</option>
                        <option>Australia</option>
                        <option>Singapore</option>
                        <option>Canada</option>
                        <option>Other</option>
                    </select>
                    <div class="invalid-feedback">Please select your country.</div>
                </div>
                <button type="submit" class="btn btn-gradient w-100 py-2 fw-bold" style="letter-spacing:1.5px;">CREATE ACCOUNT</button>
            </form>
            <p class="text-center text-muted small mt-3 mb-0">
                Already have an account? <a href="#" onclick="document.getElementById('tab-login').click()" class="text-primary text-decoration-none">Log in →</a>
            </p>
        </div>
    </div>`;
}

// ==============================================================
//  LOGIN
// ==============================================================
function handleLogin(e) {
    e.preventDefault();
    const form = document.getElementById('authLoginForm');
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

    const email    = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPass').value;
    const users    = getUsers();
    const user     = users.find(u => u.email === email && u.password === password);

    if (!user) {
        const err = document.getElementById('loginError');
        if (err) err.style.display = 'block';
        return;
    }

    const errEl = document.getElementById('loginError');
    if (errEl) errEl.style.display = 'none';

    // Animate button
    const btn = form.querySelector('button[type="submit"]');
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Entering...`;
    btn.disabled  = true;

    setTimeout(() => {
        setCurrentUser({ name: user.name, phone: user.phone || '', email: user.email, country: user.country || '' });
        bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
        btn.innerHTML = 'ENTER SHOWROOM';
        btn.disabled  = false;
        form.reset();
        form.classList.remove('was-validated');
        updateNavbarUser();
        renderFeaturedCars();
        renderInventoryCars();
        showToast(`👋 Welcome back, <strong>${user.name.split(' ')[0]}</strong>!`, 'success', 4000);

        // If user had clicked Book Test Drive before logging in — open it now
        const pendingCarId = localStorage.getItem('pendingTestDriveCarId');
        if (pendingCarId) {
            localStorage.removeItem('pendingTestDriveCarId');
            setTimeout(() => openTestDriveModal(parseInt(pendingCarId)), 600);
        }
    }, 1000);
}

// ==============================================================
//  TEST DRIVE — AUTH GATE
//  Step 1: Not logged in → show toast telling user to go to navbar icon
//  Step 2: Logged in → open test drive form with pre-filled details
// ==============================================================
function requestTestDrive(carId) {
    if (!isLoggedIn()) {
        // Save which car they want — will auto-open after login/signup
        localStorage.setItem('pendingTestDriveCarId', carId);

        // Close car detail modal first
        const carModal = bootstrap.Modal.getInstance(document.getElementById('carModal'));
        if (carModal) carModal.hide();

        setTimeout(() => {
            showToast(
                `🔐 <strong>Login required</strong> — click the <i class="bi bi-person-circle mx-1"></i> icon in the top navbar to <strong>Register or Login</strong>. Your test drive will open automatically after.`,
                'warning',
                8000
            );
            // Also open the login modal directly for better UX
            setTimeout(() => {
                new bootstrap.Modal(document.getElementById('loginModal')).show();
            }, 500);
        }, 350);
        return;
    }
    openTestDriveModal(carId);
}

// ==============================================================
//  TEST DRIVE MODAL — pre-fill from localStorage user account
// ==============================================================
function openTestDriveModal(carId) {
    const car  = carsData.find(c => c.id === carId);
    if (!car)  return;

    const user  = getCurrentUser();
    const today = new Date().toISOString().split('T')[0];

    // Set car info
    document.getElementById('tdCarName').value = car.name;
    document.getElementById('tdCarId').value   = car.id;
    document.getElementById('tdDate').min       = today;

    // --- Auto-fill Name & Email from account (readonly) ---
    // --- Phone: editable, pre-filled from last booking or profile ---
    const nameEl  = document.getElementById('tdName');
    const emailEl = document.getElementById('tdEmail');
    const phoneEl = document.getElementById('tdPhone');

    // Reset styles first
    [nameEl, emailEl, phoneEl].forEach(el => {
        el.readOnly = false;
        el.style.cssText = '';
        el.value = '';
    });

    if (user) {
        // Name & Email locked — comes from registered account
        nameEl.value  = user.name;
        emailEl.value = user.email;
        nameEl.readOnly  = true;
        emailEl.readOnly = true;
        nameEl.style.cssText  = 'opacity:0.65;cursor:not-allowed;background:#1a1a1a;border-color:#333;';
        emailEl.style.cssText = 'opacity:0.65;cursor:not-allowed;background:#1a1a1a;border-color:#333;';

        // Add helper badge next to readonly fields (only if not already added)
        ['tdName', 'tdEmail'].forEach(id => {
            const wrapper = document.getElementById(id)?.closest('.mb-3');
            if (wrapper && !wrapper.querySelector('.auto-filled-badge')) {
                const badge = document.createElement('small');
                badge.className = 'auto-filled-badge text-success mt-1 d-block';
                badge.innerHTML = '<i class="bi bi-lock-fill me-1"></i>Auto-filled from your account';
                wrapper.appendChild(badge);
            }
        });

        // Phone: pre-fill from the saved profile phone (updated every booking) OR last booking
        phoneEl.value = user.phone || '';
    }

    // If user already booked this car → pre-fill date/time/notes/phone from that booking
    const bookings = JSON.parse(localStorage.getItem('edelhausTestDrives')) || [];
    const existing = user && bookings.find(b => b.carId === carId && b.userEmail === user.email);
    if (existing) {
        document.getElementById('tdDate').value  = existing.date  || '';
        document.getElementById('tdTime').value  = existing.time  || '';
        document.getElementById('tdNotes').value = existing.notes || '';
        if (existing.phone) phoneEl.value = existing.phone; // pre-fill phone from prior booking
    } else {
        document.getElementById('tdDate').value  = '';
        document.getElementById('tdTime').value  = '';
        document.getElementById('tdNotes').value = '';
    }

    // Close car detail modal first, then open test drive
    const carModal = bootstrap.Modal.getInstance(document.getElementById('carModal'));
    if (carModal) carModal.hide();
    setTimeout(() => { new bootstrap.Modal(document.getElementById('testDriveModal')).show(); }, 300);
}

// ==============================================================
//  SUBMIT TEST DRIVE
// ==============================================================
function submitTestDrive(e) {
    e.preventDefault();
    const form = document.getElementById('tdForm');
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

    const user  = getCurrentUser();
    const carId = parseInt(document.getElementById('tdCarId').value);
    const car   = carsData.find(c => c.id === carId);
    const name  = document.getElementById('tdName').value;
    const phone = document.getElementById('tdPhone').value;
    const email = document.getElementById('tdEmail').value;
    const date  = document.getElementById('tdDate').value;
    const time  = document.getElementById('tdTime').value;
    const notes = document.getElementById('tdNotes').value;

    // Save to localStorage — one booking per user per car
    let bookings = JSON.parse(localStorage.getItem('edelhausTestDrives')) || [];
    bookings     = bookings.filter(b => !(b.carId === carId && b.userEmail === email));
    const newBooking = {
        carId, carName: car.name, carImage: car.images[0],
        userEmail: email,
        name, phone, email, date, time, notes,
        bookedAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
    };
    bookings.push(newBooking);
    localStorage.setItem('edelhausTestDrives', JSON.stringify(bookings));

    // Also sync to admin-compatible key 'allTestDrives'
    let adminDrives = JSON.parse(localStorage.getItem('allTestDrives')) || [];
    adminDrives = adminDrives.filter(b => !(b.email === email && b.car === car.name));
    adminDrives.push({
        name, phone, email, date, time, notes,
        car: car.name,
        timestamp: newBooking.timestamp,
        bookedAt: newBooking.timestamp
    });
    localStorage.setItem('allTestDrives', JSON.stringify(adminDrives));

    // Save phone back to user profile so it pre-fills in future bookings
    if (user && phone) {
        const users = getUsers();
        const idx   = users.findIndex(u => u.email === user.email);
        if (idx !== -1) { users[idx].phone = phone; saveUsers(users); }
        const updatedUser = { ...getCurrentUser(), phone };
        setCurrentUser(updatedUser);
        updateNavbarUser();
    }

    sessionStorage.setItem('lastTestDrive', JSON.stringify({ carName: car.name, date, time }));

    bootstrap.Modal.getInstance(document.getElementById('testDriveModal')).hide();
    showToast(`🚗 Test drive for <strong>${car.name}</strong> booked for ${formatDateDisplay(date)} at ${time}!`, 'success', 5000);

    // Refresh cards so booking badge appears
    renderFeaturedCars();
    renderInventoryCars();
    updateTDNavBadge();

    form.classList.remove('was-validated');
    document.getElementById('tdDate').value  = '';
    document.getElementById('tdTime').value  = '';
    document.getElementById('tdNotes').value = '';
}

function cancelBooking(carId) {
    const user = getCurrentUser();
    if (!user || !confirm('Cancel this test drive booking?')) return;
    let bookings = JSON.parse(localStorage.getItem('edelhausTestDrives')) || [];
    bookings = bookings.filter(b => !(b.carId === carId && b.userEmail === user.email));
    localStorage.setItem('edelhausTestDrives', JSON.stringify(bookings));

    // Sync admin key
    let adminDrives = JSON.parse(localStorage.getItem('allTestDrives')) || [];
    adminDrives = adminDrives.filter(b => !(b.email === user.email && b.car === (carsData.find(c=>c.id===carId)?.name||'')));
    localStorage.setItem('allTestDrives', JSON.stringify(adminDrives));

    bootstrap.Modal.getInstance(document.getElementById('carModal'))?.hide();
    showToast('Booking cancelled.', 'info');
    renderFeaturedCars();
    renderInventoryCars();
    updateTDNavBadge();
}

// ==============================================================
//  CAR DETAIL MODAL
// ==============================================================
function openModal(carId) {
    const car = carsData.find(c => c.id === carId);
    if (!car) return;

    // Save car data to localStorage so detail page can load instantly without refetching
    localStorage.setItem('edelhausDetailCar', JSON.stringify(car));

    // Navigate to the dedicated car detail page
    window.location.href = `car-detail.html?id=${carId}`;
}

// Legacy swapModalImg kept in case it's referenced elsewhere
function swapModalImg(url, el) {
    const m = document.getElementById('modalMainImg');
    if (m) { m.style.opacity = 0; setTimeout(() => { m.src = url; m.style.opacity = 1; }, 150); }
    document.querySelectorAll('.modal-thumb').forEach(t => t.classList.remove('active-thumb'));
    if (el) el.classList.add('active-thumb');
}

// Handle return from detail page — check if a test drive action was requested
(function handleDetailPageReturn() {
    const raw = localStorage.getItem('edelhausDetailAction');
    if (!raw) return;
    try {
        const { action, carId } = JSON.parse(raw);
        localStorage.removeItem('edelhausDetailAction');
        if (action === 'testdrive') {
            // Delay to let the page render first
            window.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => requestTestDrive(parseInt(carId)), 600);
            });
        }
    } catch(e) {}
})();

// ==============================================================
//  TEST DRIVES PAGE — Full feature render
// ==============================================================
let tdPageFilter = 'all';

function renderTestDrivesPage() {
    const user = getCurrentUser();

    // Update hero stats
    const bookings = getUserBookings(user);
    const now = new Date();
    const upcoming  = bookings.filter(b => new Date(b.date) >= now).length;
    const completed = bookings.filter(b => new Date(b.date) <  now).length;
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('tdStatTotal', bookings.length);
    setEl('tdStatUpcoming', upcoming);
    setEl('tdStatCompleted', completed);

    // Update nav badge
    const nb = document.getElementById('tdNavBadge');
    if (nb) { nb.textContent = upcoming; nb.style.display = upcoming > 0 ? '' : 'none'; }

    // Show/hide sections
    const loginEl = document.getElementById('tdLoginRequired');
    const noneEl  = document.getElementById('tdNoBookings');
    const listEl  = document.getElementById('tdBookingsList');

    if (!user) {
        if (loginEl) loginEl.style.display = 'block';
        if (noneEl)  noneEl.style.display  = 'none';
        if (listEl)  listEl.style.display  = 'none';
        return;
    }

    if (loginEl) loginEl.style.display = 'none';

    if (bookings.length === 0) {
        if (noneEl) noneEl.style.display = 'block';
        if (listEl) listEl.style.display = 'none';
        renderTDQuickCars('tdQuickCars');
        return;
    }

    if (noneEl) noneEl.style.display = 'none';
    if (listEl) listEl.style.display = 'block';

    renderTDCards(bookings, user);
    renderTDQuickCars('tdQuickCarsBottom');
}

function getUserBookings(user) {
    if (!user) return [];
    const all = JSON.parse(localStorage.getItem('edelhausTestDrives')) || [];
    return all.filter(b => b.userEmail === user.email)
              .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function filterTDPage(filter, btn) {
    tdPageFilter = filter;
    document.querySelectorAll('.td-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const user = getCurrentUser();
    renderTDCards(getUserBookings(user), user);
}

function renderTDCards(bookings, user) {
    const grid = document.getElementById('tdCardsGrid');
    if (!grid) return;

    const now = new Date();
    let filtered = bookings;
    if (tdPageFilter === 'upcoming') filtered = bookings.filter(b => new Date(b.date) >= now);
    if (tdPageFilter === 'past')     filtered = bookings.filter(b => new Date(b.date) <  now);

    if (filtered.length === 0) {
        const msgs = { upcoming: 'No upcoming test drives.', past: 'No completed test drives yet.', all: 'No bookings found.' };
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:rgba(255,255,255,0.3);font-size:0.9rem;">${msgs[tdPageFilter]||''}</div>`;
        return;
    }

    // Read admin statuses from localStorage
    const adminStatuses = JSON.parse(localStorage.getItem('edelhaus_td_statuses')) || {};

    grid.innerHTML = filtered.map(b => {
        const car     = carsData.find(c => c.id === b.carId);
        const img     = b.carImage || (car && car.images && car.images[0]) || '';
        const isPast  = new Date(b.date) < now;

        // Admin status: look up by timestamp
        const adminStatus = adminStatuses[b.timestamp] || null;

        // Determine display status
        let displayStatus, stripeClass, badgeClass, badgeText;
        if (adminStatus === 'Confirmed') {
            displayStatus = 'confirmed'; stripeClass = 'td-stripe-confirmed';
            badgeClass = 'td-badge-confirmed'; badgeText = '✓ Confirmed';
        } else if (adminStatus === 'Cancelled') {
            displayStatus = 'cancelled'; stripeClass = 'td-stripe-cancelled';
            badgeClass = 'td-badge-cancelled'; badgeText = '✗ Cancelled';
        } else if (isPast) {
            displayStatus = 'completed'; stripeClass = 'td-stripe-past';
            badgeClass = 'td-badge-completed'; badgeText = 'Completed';
        } else {
            displayStatus = 'upcoming'; stripeClass = 'td-stripe-upcoming';
            badgeClass = 'td-badge-upcoming'; badgeText = '◉ Upcoming';
        }

        // Admin status banner inside card
        let adminBanner = '';
        if (adminStatus === 'Confirmed') {
            adminBanner = `<div class="td-admin-status-row confirmed"><i class="bi bi-shield-check"></i>Your test drive has been confirmed by Edelhaus</div>`;
        } else if (adminStatus === 'Cancelled') {
            adminBanner = `<div class="td-admin-status-row cancelled"><i class="bi bi-x-circle"></i>This appointment was cancelled. Please rebook.</div>`;
        } else {
            adminBanner = `<div class="td-admin-status-row pending"><i class="bi bi-clock-history"></i>Awaiting confirmation from our team</div>`;
        }

        // Action buttons
        let actions = '';
        if (!isPast && adminStatus !== 'Cancelled') {
            actions = `
            <div class="td-card-actions">
                <button class="td-btn-modify" onclick="tdModifyBooking(${b.carId})">
                    <i class="bi bi-pencil-square"></i>Modify
                </button>
                <button class="td-btn-cancel" onclick="tdCancelBooking('${b.timestamp}',${b.carId})">
                    <i class="bi bi-x-lg"></i>Cancel
                </button>
            </div>`;
        } else if (adminStatus === 'Cancelled' || isPast) {
            actions = `
            <div class="td-card-actions">
                <button class="td-btn-rebook" onclick="tdRebook(${b.carId})">
                    <i class="bi bi-arrow-repeat"></i>Rebook
                </button>
            </div>`;
        }

        return `
        <div class="td-booking-card" data-tdid="${b.timestamp}">
            <div class="td-card-stripe ${stripeClass}"></div>
            <div class="td-card-img-wrap">
                ${img
                    ? `<img class="td-card-img" src="${img}" alt="${b.carName}" loading="lazy">`
                    : `<div class="td-card-img-placeholder"><i class="bi bi-car-front"></i></div>`
                }
                <div class="td-card-status-badge ${badgeClass}">${badgeText}</div>
            </div>
            <div class="td-card-body">
                <div class="td-card-car-name">${b.carName || '—'}</div>
                ${adminBanner}
                <div class="td-card-info-grid">
                    <div class="td-card-info-item"><i class="bi bi-calendar3"></i><span>${formatDateDisplay(b.date)}</span></div>
                    <div class="td-card-info-item"><i class="bi bi-clock"></i><span>${b.time || '—'}</span></div>
                    <div class="td-card-info-item"><i class="bi bi-person"></i><span>${b.name || '—'}</span></div>
                    <div class="td-card-info-item"><i class="bi bi-telephone"></i><span>${b.phone || '—'}</span></div>
                    <div class="td-card-info-item"><i class="bi bi-envelope"></i><span>${b.email || '—'}</span></div>
                    <div class="td-card-info-item"><i class="bi bi-tag"></i><span>${b.carName || '—'}</span></div>
                </div>
                ${b.notes ? `<div class="td-card-notes"><i class="bi bi-chat-left-text me-1"></i>${b.notes}</div>` : ''}
                ${actions}
            </div>
        </div>`;
    }).join('');
}

function renderTDQuickCars(containerId) {
    const el = document.getElementById(containerId);
    if (!el || !carsData.length) return;
    // Show first 8 cars as quick-book chips
    el.innerHTML = carsData.slice(0, 8).map(car => {
        const img = car.images && car.images[0] ? car.images[0] : '';
        return `<button class="td-qb-car-chip" onclick="tdQuickBook(${car.id})">
            ${img ? `<img src="${img}" alt="${car.name}">` : '<i class="bi bi-car-front"></i>'}
            ${car.name}
        </button>`;
    }).join('');
}

function tdQuickBook(carId) {
    if (!isLoggedIn()) {
        localStorage.setItem('pendingTestDriveCarId', carId);
        new bootstrap.Modal(document.getElementById('loginModal')).show();
        return;
    }
    openTestDriveModal(carId);
}

function tdModifyBooking(carId) {
    openTestDriveModal(carId);
}

function tdRebook(carId) {
    openTestDriveModal(carId);
}

function tdCancelBooking(timestamp, carId) {
    const user = getCurrentUser();
    if (!user) return;

    // Custom confirm dialog instead of browser confirm for better UX
    if (!confirm('Cancel this test drive booking? This cannot be undone.')) return;

    // Remove from edelhausTestDrives
    let b = JSON.parse(localStorage.getItem('edelhausTestDrives')) || [];
    b = b.filter(x => x.timestamp !== timestamp);
    localStorage.setItem('edelhausTestDrives', JSON.stringify(b));

    // Remove from allTestDrives (admin key)
    let adminDrives = JSON.parse(localStorage.getItem('allTestDrives')) || [];
    adminDrives = adminDrives.filter(x => x.timestamp !== timestamp);
    localStorage.setItem('allTestDrives', JSON.stringify(adminDrives));

    showToast('✅ Booking cancelled successfully.', 'info', 3500);
    renderTestDrivesPage();
    renderFeaturedCars();
    renderInventoryCars();
    updateTDNavBadge();
}

function updateTDNavBadge() {
    const user = getCurrentUser();
    const bookings = getUserBookings(user);
    const now = new Date();
    const upcoming = bookings.filter(b => new Date(b.date) >= now && 
        (JSON.parse(localStorage.getItem('edelhaus_td_statuses'))||{})[b.timestamp] !== 'Cancelled').length;
    const nb = document.getElementById('tdNavBadge');
    if (nb) { nb.textContent = upcoming; nb.style.display = upcoming > 0 ? '' : 'none'; }
}


// ==============================================================
//  STATUS HELPERS (F1rst Motors style)
// ==============================================================
function isSoldCar(car) {
    return (car.status || '').toLowerCase() === 'sold';
}
function isAskForPrice(car) {
    const s = (car.status || '').toLowerCase();
    return s === 'by order' || s === 'exclusive';
}
function getStatusStyle(status) {
    const s = (status || '').toLowerCase();
    if (s === 'sold')      return { bg: 'rgba(231,76,60,0.15)',   border: '#e74c3c', color: '#e74c3c',  label: 'SOLD' };
    if (s === 'in stock')  return { bg: 'rgba(46,204,113,0.12)',  border: '#2ecc71', color: '#2ecc71',  label: 'IN STOCK' };
    if (s === 'available') return { bg: 'rgba(46,204,113,0.12)',  border: '#2ecc71', color: '#2ecc71',  label: 'AVAILABLE' };
    if (s === 'exclusive') return { bg: 'rgba(142,68,173,0.15)',  border: '#8e44ad', color: '#c39bd3',  label: 'EXCLUSIVE' };
    if (s === 'by order')  return { bg: 'rgba(52,152,219,0.12)',  border: '#3498db', color: '#3498db',  label: 'BY ORDER' };
    return                         { bg: 'rgba(52,152,219,0.12)', border: '#3498db', color: '#3498db',  label: status || 'AVAILABLE' };
}

// ==============================================================
//  BADGE COLOR MAP — category → gradient
// ==============================================================
const badgeColors = {
    'HYPERCAR'    : 'linear-gradient(135deg,#e74c3c,#c0392b)',
    'SPORTS'      : 'linear-gradient(135deg,#3498db,#2980b9)',
    'LUXURY'      : 'linear-gradient(135deg,#b8960c,#f0c040)',
    'ULTRA LUXURY': 'linear-gradient(135deg,#8e44ad,#6c3483)',
    'LUXURY SUV'  : 'linear-gradient(135deg,#27ae60,#1e8449)',
    'TRACK READY' : 'linear-gradient(135deg,#e74c3c,#c0392b)',
    'GRAND TOURER': 'linear-gradient(135deg,#2c3e50,#4ca1af)',
    'RALLY'       : 'linear-gradient(135deg,#3498db,#2980b9)',
    'BESPOKE'     : 'linear-gradient(135deg,#6c3483,#9b59b6)',
};
function getBadgeStyle(badge) {
    const bg = badgeColors[badge] || 'linear-gradient(135deg,#2980b9,#3498db)';
    const color = (badge === 'LUXURY') ? '#1a1a1a' : '#fff';
    return `background:${bg};color:${color};`;
}

// ==============================================================
//  GENERATE CAR CARD — F1rst Motors style
// ==============================================================
function generateCarCard(car, staggerIndex = 0) {
    const statusRaw  = (car.status || '').toLowerCase();
    const isSold     = statusRaw === 'sold';
    const isByOrder  = statusRaw === 'by order' || statusRaw === 'exclusive';
    const stockCount = getStockCount(car.name);

    // Status pill
    const statusStyle = isSold
        ? 'color:#e74c3c;border-color:#e74c3c44;background:#e74c3c11;'
        : isByOrder
            ? 'color:#3498db;border-color:#3498db44;background:#3498db11;'
            : 'color:#2ecc71;border-color:#2ecc7144;background:#2ecc7111;';
    const statusIcon  = isSold ? 'bi-x-circle-fill' : isByOrder ? 'bi-hourglass-split' : 'bi-check-circle-fill';
    const statusLabel = isSold ? 'SOLD' : isByOrder ? 'By Order' : stockCount > 1 ? `${stockCount} Units` : 'In Stock';

    // Image & colour dots
    let displayImage      = car.images?.[0] || '';
    let colorDotsHTML     = '';
    let selectedColorName = '';
    if (car.colors?.length) {
        displayImage      = car.colors[0].img;
        selectedColorName = car.colors[0].name;
        colorDotsHTML = `
        <div class="color-row">
            <div class="color-dots-wrap" id="color-dots-${car.id}">
                ${car.colors.map((col, i) => `
                    <div class="color-dot ${i===0?'active':''}"
                         style="background:${col.hex};" title="${col.name}"
                         onclick="changeCarImage(${car.id},'${col.img}',this,'${col.name}')"></div>
                `).join('')}
            </div>
            <span class="color-label" id="color-label-${car.id}">${selectedColorName}</span>
        </div>`;
    }

    // Wishlist state
    const garage   = JSON.parse(localStorage.getItem('edelhausGarage')) || [];
    const inGarage = garage.includes(car.id);

    // Booking badge
    const user     = getCurrentUser();
    const bookings = JSON.parse(localStorage.getItem('edelhausTestDrives')) || [];
    const booking  = user && bookings.find(b => b.carId === car.id && b.userEmail === user.email);
    const bookingBadge = booking
        ? `<div class="booking-pill"><i class="bi bi-calendar-check-fill me-1"></i>Test Drive: ${formatDateDisplay(booking.date)}</div>`
        : '';

    // Image count
    const imgCount = (() => {
        let all = car.images ? [...car.images] : [];
        if (car.colors) car.colors.forEach(c => { if (!all.includes(c.img)) all.push(c.img); });
        return all.length;
    })();
    const imgCountBadge = imgCount > 1 ? `<span class="img-count-badge"><i class="bi bi-images me-1"></i>${imgCount}</span>` : '';

    // 360° badge — show if model_url exists
    const badge360 = car.model_url
        ? `<span class="badge-360-pill" onclick="event.stopPropagation();open360View(${car.id})" title="360° View">
               <i class="bi bi-arrow-repeat me-1"></i>360°
           </span>`
        : '';

    // KM / mileage badge
    const kmBadge = car.mileage_km != null
        ? `<span class="km-badge"><i class="bi bi-speedometer me-1"></i>${car.mileage_km === 0 ? '0 km' : Number(car.mileage_km).toLocaleString() + ' km'}</span>`
        : '';

    // Body type pill
    const bodyTypeMap = { sports:'Sports Car', luxury:'Luxury Saloon', suv:'Luxury SUV', hypercar:'Hypercar' };
    const bodyPill = car.category
        ? `<span class="body-type-pill">${bodyTypeMap[car.category] || car.category}</span>`
        : '';

    // SOLD overlay
    const soldOverlay = isSold
        ? `<div class="sold-overlay"><div class="sold-stamp">SOLD</div></div>`
        : '';

    // Price
    const priceHTML = isByOrder
        ? `<div class="price-block mt-3">
               <span class="price-from-label">Price</span>
               <div class="car-price ask-price" onclick="openQuickInquiry(${car.id})">
                   <i class="bi bi-chat-dots me-1"></i>Ask For Price
               </div>
           </div>`
        : `<div class="price-block mt-3">
               <span class="price-from-label">Starting from</span>
               <div class="car-price">${formatPrice(car.price)}</div>
           </div>`;

    const delay = staggerIndex * 70;

    return `
    <div class="col-md-4" style="animation-delay:${delay}ms;">
        <div class="card car-card shadow h-100${isSold ? ' car-card-sold' : ''}">

            <div class="img-wrapper position-relative">
                <span class="car-badge" style="${getBadgeStyle(car.badge)}">${car.badge}</span>
                ${imgCountBadge}
                ${badge360}
                ${kmBadge}
                <img id="car-img-${car.id}" src="${displayImage}"
                     class="card-img-top" alt="${car.name}" loading="lazy"
                     style="height:270px;object-fit:cover;cursor:pointer;transition:transform 0.5s ease,opacity 0.4s ease;${isSold?'filter:grayscale(50%);':''}"
                     onclick="openGalleryModal(${car.id})">
                ${soldOverlay}
                <div class="img-bottom-overlay">
                    <span class="img-overlay-brand">${car.brand}</span>
                </div>
                <div class="card-hover-actions">
                    <button class="hover-action-btn ${inGarage?'active-wish':''}" onclick="toggleGarage(${car.id},this)" title="${inGarage?'Remove from Wishlist':'Save to Wishlist'}">
                        <i class="bi ${inGarage?'bi-heart-fill':'bi-heart'}"></i>
                    </button>
                    <button class="hover-action-btn" onclick="open360View(${car.id})" title="360° View">
                        <i class="bi bi-arrow-repeat"></i>
                    </button>
                    <button class="hover-action-btn" onclick="toggleCompare(${car.id},this)" title="Compare">
                        <i class="bi bi-arrow-left-right"></i>
                    </button>
                    <button class="hover-action-btn" onclick="shareCarLink(${car.id})" title="Share">
                        <i class="bi bi-share"></i>
                    </button>
                </div>
                <div class="gallery-hint" onclick="openGalleryModal(${car.id})">
                    <i class="bi bi-fullscreen me-1"></i> Open Gallery
                </div>
            </div>

            <div class="card-body d-flex flex-column">
                <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                    <div class="car-brand-label">${car.brand.toUpperCase()}</div>
                    ${bodyPill}
                </div>
                <h5 class="card-title mb-1">${car.name}</h5>
                <p class="car-subtitle mb-2">${car.subtitle}</p>
                ${colorDotsHTML}
                ${bookingBadge}
                <div class="car-specs mt-2">
                    <div class="spec-item"><i class="bi bi-speedometer2"></i><span>${car.power}</span></div>
                    <div class="spec-item"><i class="bi bi-lightning-charge"></i><span>${car.acceleration}</span></div>
                    <div class="spec-item"><i class="bi bi-calendar3"></i><span>${car.year}</span></div>
                </div>
                ${priceHTML}
                <div class="card-footer-info mt-2 mb-3">
                    <span class="info-badge" style="${statusStyle}">
                        <i class="bi ${statusIcon} me-1"></i>${statusLabel}
                    </span>
                    <button class="currency-toggle-btn" onclick="toggleGlobalCurrency()">
                        <i class="bi bi-currency-exchange me-1"></i>${currentCurrency==='INR'?'USD':'INR'}
                    </button>
                </div>
                <div class="d-flex gap-2 mt-auto">
                    <button class="btn btn-gradient flex-grow-1 view-details-btn" onclick="openModal(${car.id})">
                        <i class="bi bi-eye me-2"></i>VIEW DETAILS
                    </button>
                    <button class="compare-btn-sm" onclick="toggleCompare(${car.id},this)" title="Compare">
                        <i class="bi bi-arrow-left-right"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>`;
}

// ── Quick Inquiry (Ask For Price) ──────────────────────────────
function openQuickInquiry(carId) {
    const car  = carsData.find(c => c.id === carId);
    if (!car) return;
    const user = getCurrentUser();
    const el   = document.getElementById('quickInquiryModal');
    if (el) {
        document.getElementById('qiCarName').value  = car.name;
        document.getElementById('qiCarId').value    = car.id;
        document.getElementById('qiName').value     = user?.name  || '';
        document.getElementById('qiEmail').value    = user?.email || '';
        document.getElementById('qiMessage').value  =
            `I'm interested in the ${car.name} (${car.year}). Please contact me with pricing and availability.`;
        new bootstrap.Modal(el).show();
    } else {
        showToast(`📩 Contact us for pricing on <strong>${car.name}</strong>`, 'info', 4000);
        showPage('contact');
    }
}

// ── Share car link ────────────────────────────────────────────
function shareCarLink(carId) {
    const car = carsData.find(c => c.id === carId);
    if (!car) return;
    const url = `${window.location.origin}${window.location.pathname}?car=${carId}`;
    if (navigator.share) {
        navigator.share({ title: car.name, text: `Check out the ${car.name} at Edelhaus Automotive`, url });
    } else {
        navigator.clipboard?.writeText(url).then(() => {
            showToast(`🔗 Link copied for <strong>${car.name}</strong>!`, 'success', 3000);
        });
    }
}

// ==============================================================
//  DEBOUNCE UTILITY
// ==============================================================
function debounce(fn, delay = 280) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ==============================================================
//  IMAGE LAZY LOADING — Fade-in on load
// ==============================================================
function applyLazyLoading() {
    document.querySelectorAll('img:not([data-lazy-done])').forEach(img => {
        img.setAttribute('loading', 'lazy');
        img.setAttribute('data-lazy-done', '1');
        if (img.complete && img.naturalWidth > 0) {
            img.classList.add('img-loaded');
        } else {
            img.addEventListener('load',  () => img.classList.add('img-loaded'), { once: true });
            img.addEventListener('error', () => img.classList.add('img-loaded'), { once: true });
        }
    });
}

// ==============================================================
//  SKELETON LOADING — Show animated placeholders while cars load
// ==============================================================
function showSkeletons(containerId, count = 6) {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    grid.innerHTML = Array(count).fill(0).map(() => `
        <div class="inv-card-slot">
            <div class="skeleton-card"></div>
        </div>`).join('');
}

// ==============================================================
//  API LOAD
// ==============================================================
// ==============================================================
//  HOME BRANDS STRIP
// ==============================================================
function renderHomeBrands() {
    const strip = document.getElementById('homeBrandsStrip');
    if (!strip) return;
    const logos  = JSON.parse(localStorage.getItem('edelhausBrandLogos')) || {};
    const brands = [...new Set(carsData.map(c => c.brand))];
    strip.innerHTML = brands.map(b => `
        <div onclick="filterByBrandRedirect('${b}')"
             style="cursor:pointer;text-align:center;padding:18px 24px;min-width:130px;
                    background:#111;border:1px solid #2a2a2a;border-radius:14px;
                    transition:border-color 0.3s,transform 0.3s,box-shadow 0.3s;"
             onmouseover="this.style.borderColor='#3498db';this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 24px rgba(52,152,219,0.18)';"
             onmouseout="this.style.borderColor='#2a2a2a';this.style.transform='translateY(0)';this.style.boxShadow='none';">
            ${logos[b]
                ? `<img src="${logos[b]}" style="height:48px;width:auto;max-width:100px;object-fit:contain;filter:brightness(0.92);" alt="${b}">`
                : `<i class="bi bi-car-front" style="font-size:2rem;color:#3498db;"></i>`}
            <p style="color:#aaa;font-size:0.7rem;margin-top:8px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:0;">${b}</p>
        </div>`).join('');
}

async function loadCarsData() {
    showSkeletons('inventoryGrid', 3);

    // Try multiple path variants so it works whether opened via
    // file://, a local server, or a subfolder deployment
    const paths = [
        'cars.json',
        './cars.json',
        window.location.pathname.replace(/\/[^/]*$/, '/') + 'cars.json'
    ];

    let raw = null;
    let lastErr = null;

    for (const path of paths) {
        try {
            const res = await fetch(path);
            if (res.ok) { raw = await res.json(); break; }
        } catch (e) { lastErr = e; }
    }

    if (!raw) {
        console.error('Could not load cars.json. Tried:', paths, lastErr);
        const g = document.getElementById('inventoryGrid');
        if (g) g.innerHTML = `
            <div class="text-center py-5 w-100">
                <i class="bi bi-exclamation-triangle display-4 text-warning mb-3 d-block"></i>
                <p class="text-white fs-5 mb-2">Could not load <code>cars.json</code></p>
                <p class="text-muted small mb-3">
                    Make sure <strong>cars.json</strong> is in the same folder as <strong>help.html</strong>
                    and you are opening the site through a local server (not directly as a file://).
                </p>
                <button class="btn btn-gradient px-4" onclick="loadCarsData()">
                    <i class="bi bi-arrow-clockwise me-2"></i>Retry
                </button>
            </div>`;
        return;
    }

    try {
        carsData = raw;
        renderFeaturedCars();
        renderInventoryCars();
        renderHomeBrands();
        createBrandDropdown();
        updateStockDisplay();
        updateGarageUI();
        initServiceForm();
        setTimeout(applyLazyLoading, 100);

        // Handle shared ?car=ID link
        const urlParams   = new URLSearchParams(window.location.search);
        const sharedCarId = urlParams.get('car');
        if (sharedCarId) {
            const car = carsData.find(c => c.id === parseInt(sharedCarId));
            if (car) { showPage('inventory'); setTimeout(() => openModal(parseInt(sharedCarId)), 500); }
        }
    } catch (err) {
        console.error('Render error after loading cars.json:', err);
    }
}

// ==============================================================
//  PAGE NAVIGATION — Smooth fade transitions
// ==============================================================
function showPage(name) {
    // Remove active from all sections
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    // Stop inventory slider when navigating away
    if (name !== 'inventory') invStopAuto();

    // Alias 'mybookings' → 'testdrives'
    if (name === 'mybookings') name = 'testdrives';

    const t = document.getElementById(name);
    if (t) {
        requestAnimationFrame(() => {
            t.classList.add('active');
            if (name === 'garage')      renderGarage();
            if (name === 'testdrives')  renderTestDrivesPage();
            if (name === 'mybookings')  renderTestDrivesPage();
            if (name === 'brands')      initBrandsPage();
            if (name === 'sellmycar')   initSellMyCarForm();
            setTimeout(checkScroll, 120);
        });
    }

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('active');
        const oc = l.getAttribute('onclick') || '';
        if (oc.includes(`'${name}'`) || (name === 'testdrives' && oc.includes("'testdrives'"))) {
            l.classList.add('active');
        }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    const nav = document.getElementById('navbarNav');
    if (nav && nav.classList.contains('show')) bootstrap.Collapse.getInstance(nav)?.hide();
}

// ==============================================================
//  RENDER
// ==============================================================
// ==============================================================
//  PARSE PRICE — strips currency symbols and converts to number
// ==============================================================
function parsePriceValue(priceStr) {
    if (!priceStr) return 0;
    const clean = priceStr.replace(/[^\d.]/g, '');
    // Detect unit: Crore (Cr) = 1, Lakh (L) = 0.01 for sorting purposes
    const lower = priceStr.toLowerCase();
    const n = parseFloat(clean) || 0;
    if (lower.includes('crore') || lower.includes('cr')) return n * 1;
    if (lower.includes('lakh') || lower.includes('l')) return n * 0.01;
    return n;
}

// ==============================================================
//  RENDER FEATURED CARS
//  Shows the 3 rarest (stock = 1) + highest-priced cars.
//  Since every car in this showroom is unique (stock 1),
//  we rank purely by descending price → top 3 most exclusive.
// ==============================================================
function renderFeaturedCars() {
    const g = document.getElementById('featuredCarsGrid');
    if (!g) return;

    // Count stock per model name
    const stockCount = {};
    carsData.forEach(c => { stockCount[c.name] = (stockCount[c.name] || 0) + 1; });

    // Step 1: Keep only cars with stock = 1 (truly rare, 1-of-1 in showroom)
    const rareCars = carsData.filter(c => (stockCount[c.name] || 1) === 1);

    // Step 2: Sort by price descending — highest price = most exclusive
    const sorted = [...rareCars].sort((a, b) => parsePriceValue(b.price) - parsePriceValue(a.price));

    // Step 3: Take top 3
    const top3 = sorted.slice(0, 3);

    g.innerHTML = top3.map((c, i) => generateCarCard(c, i)).join('');
    setTimeout(applyLazyLoading, 50);
}

// ==============================================================
//  INVENTORY CONVEYOR SLIDER
//  - 3 cards visible at a time
//  - Every 3s the leftmost card slides out, next card enters from right
//  - Infinite loop via cloned cards at start/end
// ==============================================================
// ==============================================================
//  INVENTORY — Carousel (3 visible, auto-slide) + Pagination
//  Layout:
//    • Page 1 → carousel of the first 10 cars, 3 visible at once
//    • Page 2+ → static grid of next 10 cars each
//    • Dots below carousel show position inside the 10-car page
//    • Numbered pagination buttons at the bottom switch pages
// ==============================================================

let invAllCards   = [];   // full filtered + deduped list
let invPage       = 1;    // current pagination page  (1-based)
const INV_PER_PAGE = 10;  // cars per pagination page
const INV_VISIBLE  = 3;   // cards visible in carousel at once
const INV_INTERVAL = 3200; // ms between auto-slides

// carousel state (only used on page 1)
let invCarIndex   = 0;    // leftmost visible card index inside current page slice
let invAutoTimer  = null;
let invAnimating  = false;

// ── Main render entry point ───────────────────────────────────
function renderInventoryCars() {
    const noRes = document.getElementById('invNoResults');
    if (!document.getElementById('inventoryGrid')) return;
    invStopAuto();
    invAnimating = false;

    // 1. Status filter
    let filtered = invStatusFilter === 'sold'
        ? carsData.filter(c => (c.status||'').toLowerCase() === 'sold')
        : carsData.filter(c => (c.status||'').toLowerCase() !== 'sold');

    // 2. Brand filter
    if (currentBrandFilter !== 'all')
        filtered = filtered.filter(c => c.brand === currentBrandFilter || c.category === currentBrandFilter);

    // 3. Body/category filter
    if (invBodyFilter !== 'all')
        filtered = filtered.filter(c => c.category === invBodyFilter);

    // 4. Search (name + brand + engine + badge + subtitle)
    if (searchTerm)
        filtered = filtered.filter(c =>
            (c.name||'').toLowerCase().includes(searchTerm) ||
            (c.brand||'').toLowerCase().includes(searchTerm) ||
            (c.badge||'').toLowerCase().includes(searchTerm) ||
            (c.engine||'').toLowerCase().includes(searchTerm) ||
            (c.subtitle||'').toLowerCase().includes(searchTerm)
        );

    // 5. Sort
    switch (invSortMode) {
        case 'price_asc':  filtered = [...filtered].sort((a,b)=>parsePriceValue(a.price)-parsePriceValue(b.price)); break;
        case 'price_desc': filtered = [...filtered].sort((a,b)=>parsePriceValue(b.price)-parsePriceValue(a.price)); break;
        case 'newest':     filtered = [...filtered].sort((a,b)=>(+b.year||0)-(+a.year||0)); break;
        case 'power':      filtered = [...filtered].sort((a,b)=>(b.power_hp||0)-(a.power_hp||0)); break;
        default: break;
    }

    // 6. Deduplicate
    const seen = new Set();
    invAllCards = filtered.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });

    // Update live count label
    const countEl = document.getElementById('invLiveCount');
    if (countEl) countEl.textContent = invAllCards.length;

    // Sync brand pills
    _renderBrandPills();

    if (invAllCards.length === 0) {
        document.getElementById('inventoryGrid').innerHTML = '';
        if (noRes) {
            noRes.style.display = 'block';
            noRes.innerHTML = `
                <i class="bi bi-search display-4 text-muted mb-3 d-block"></i>
                <p class="fs-5 text-white">No vehicles match your search.</p>
                <div class="d-flex justify-content-center gap-2 flex-wrap mt-3">
                    <button class="btn btn-sm btn-outline-light px-4" onclick="resetAllFilters()">
                        <i class="bi bi-x-circle me-1"></i>Clear Filters
                    </button>
                </div>`;
        }
        _hideShowArrows(false);
        _renderPagination(0);
        _renderRecentlyViewed();
        return;
    }
    if (noRes) noRes.style.display = 'none';

    const totalPages = Math.ceil(invAllCards.length / INV_PER_PAGE);
    if (invPage > totalPages) invPage = 1;
    invCarIndex = 0;
    _renderCurrentPage();
    _renderPagination(totalPages);
    _renderRecentlyViewed();
    setTimeout(applyLazyLoading, 80);
}

// ── Render the active page ────────────────────────────────────
function _renderCurrentPage() {
    const start     = (invPage - 1) * INV_PER_PAGE;
    const pageSlice = invAllCards.slice(start, start + INV_PER_PAGE);
    // ALL pages use carousel
    _buildCarousel(pageSlice);
}

// ── Every page: Carousel ──────────────────────────────────────
function _buildCarousel(pageSlice) {
    // Clone wrap-around cards for infinite loop
    const clonesBefore = pageSlice.slice(-INV_VISIBLE);
    const clonesAfter  = pageSlice.slice(0, INV_VISIBLE);
    const all          = [...clonesBefore, ...pageSlice, ...clonesAfter];

    const track = document.getElementById('inventoryGrid');
    track.className    = 'inv-slider-track';
    track.style.transform  = 'none';
    track.style.transition = 'none';
    track.innerHTML = all.map((car, i) => `
        <div class="inv-card-slot">
            <div class="row g-0">${generateCarCard(car, i % INV_VISIBLE)}</div>
        </div>`).join('');

    // Reset to real start position (skip clones)
    _carouselSetPos(INV_VISIBLE, false);
    invCarIndex = 0;

    // Arrows — show when more than 3 cards
    _hideShowArrows(pageSlice.length > INV_VISIBLE);

    // Dots — one dot per card in this page
    _renderDots(pageSlice.length);

    // Auto-slide
    if (pageSlice.length > INV_VISIBLE) invStartAuto();
}

// ── Carousel helpers ──────────────────────────────────────────
function _carouselSetPos(idx, animate) {
    const track = document.getElementById('inventoryGrid');
    if (!track) return;
    const cardW = 100 / INV_VISIBLE;
    track.style.transition = animate ? 'transform 0.55s cubic-bezier(0.4,0,0.2,1)' : 'none';
    track.style.transform  = `translateX(-${idx * cardW}%)`;
}

function invMove(dir) {
    const track = document.getElementById('inventoryGrid');
    if (!track || invAnimating) return;

    const start     = (invPage - 1) * INV_PER_PAGE;
    const pageSlice = invAllCards.slice(start, start + INV_PER_PAGE);
    if (pageSlice.length <= INV_VISIBLE) return;

    invStopAuto();
    invAnimating = true;

    const domIdx = INV_VISIBLE + invCarIndex + dir;
    _carouselSetPos(domIdx, true);

    track.addEventListener('transitionend', function h() {
        track.removeEventListener('transitionend', h);
        invCarIndex = ((invCarIndex + dir) % pageSlice.length + pageSlice.length) % pageSlice.length;
        _carouselSetPos(INV_VISIBLE + invCarIndex, false);
        invAnimating = false;
        _updateDots(invCarIndex, pageSlice.length);
    });

    invStartAuto();
}

function invStartAuto() {
    invStopAuto();
    invAutoTimer = setInterval(() => invMove(1), INV_INTERVAL);
}

function invStopAuto() {
    if (invAutoTimer) { clearInterval(invAutoTimer); invAutoTimer = null; }
}

// ── Arrows ────────────────────────────────────────────────────
function _hideShowArrows(show) {
    const wrapper = document.getElementById('invSliderWrapper');
    if (!wrapper) return;
    wrapper.querySelector('.inv-arrow-prev').style.display = show ? 'flex' : 'none';
    wrapper.querySelector('.inv-arrow-next').style.display = show ? 'flex' : 'none';
}

// ── Carousel Dots ─────────────────────────────────────────────
function _renderDots(total) {
    let dotsEl = document.getElementById('invCarouselDots');
    if (!dotsEl) return;
    if (total <= INV_VISIBLE) { dotsEl.innerHTML = ''; return; }
    dotsEl.innerHTML = Array.from({length: total}, (_, i) =>
        `<button class="inv-dot ${i===0?'active':''}" onclick="invJumpTo(${i})" aria-label="Slide ${i+1}"></button>`
    ).join('');
}

function _updateDots(active, total) {
    const dotsEl = document.getElementById('invCarouselDots');
    if (!dotsEl) return;
    dotsEl.querySelectorAll('.inv-dot').forEach((d, i) => d.classList.toggle('active', i === active));
}

function invJumpTo(idx) {
    if (invAnimating) return;
    invStopAuto();
    const dir = idx - invCarIndex;
    if (dir === 0) return;
    invMove(dir > 0 ? 1 : -1);
}

// ── Pagination ────────────────────────────────────────────────
function _renderPagination(totalPages) {
    const pgEl = document.getElementById('invPagination');
    if (!pgEl) return;

    if (totalPages <= 1) { pgEl.innerHTML = ''; return; }

    const start = (invPage - 1) * INV_PER_PAGE + 1;
    const end   = Math.min(invPage * INV_PER_PAGE, invAllCards.length);

    // Build page number buttons
    let btns = '';
    for (let p = 1; p <= totalPages; p++) {
        if (totalPages > 7) {
            if (p === 1 || p === totalPages || (p >= invPage - 1 && p <= invPage + 1)) {
                btns += `<button class="pg-btn ${p === invPage ? 'active' : ''}" onclick="invGoPage(${p})">${p}</button>`;
            } else if (p === invPage - 2 || p === invPage + 2) {
                btns += `<span class="pg-dots">…</span>`;
            }
        } else {
            btns += `<button class="pg-btn ${p === invPage ? 'active' : ''}" onclick="invGoPage(${p})">${p}</button>`;
        }
    }

    pgEl.innerHTML = `
        <div class="pg-controls">
            <button class="pg-btn pg-nav" onclick="invGoPage(${invPage - 1})" ${invPage === 1 ? 'disabled' : ''} title="Previous page">
                <i class="bi bi-chevron-left"></i>
            </button>
            <div class="pg-numbers">${btns}</div>
            <button class="pg-btn pg-nav" onclick="invGoPage(${invPage + 1})" ${invPage === totalPages ? 'disabled' : ''} title="Next page">
                <i class="bi bi-chevron-right"></i>
            </button>
        </div>
        <div class="pg-info-row">
            <span class="pg-info-text">
                Page <strong>${invPage}</strong> of <strong>${totalPages}</strong>
                &nbsp;·&nbsp;
                Showing <strong>${start}–${end}</strong> of <strong>${invAllCards.length}</strong> vehicles
            </span>
        </div>`;
}

function invGoPage(p) {
    const totalPages = Math.ceil(invAllCards.length / INV_PER_PAGE);
    if (p < 1 || p > totalPages) return;
    invPage = p;
    invCarIndex = 0;
    invStopAuto();
    _renderCurrentPage();
    _renderPagination(totalPages);
    setTimeout(applyLazyLoading, 80);
    // Scroll to top of inventory section
    document.getElementById('invSliderWrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Pause on hover — handled in main DOMContentLoaded init block below

// ==============================================================
//  FILTER HELPERS — F1rst Motors-style
// ==============================================================

function setStatusFilter(status) {
    invStatusFilter = status;
    invPage = 1; invCarIndex = 0;
    document.querySelectorAll('.inv-status-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.status === status));
    renderInventoryCars();
}

function setSortMode(mode) {
    invSortMode = mode;
    invPage = 1; invCarIndex = 0;
    const labels = { recommended:'Recommended', price_asc:'Price: Low–High',
                     price_desc:'Price: High–Low', newest:'Newest First', power:'Most Powerful' };
    const el = document.getElementById('invSortLabel');
    if (el) el.textContent = labels[mode] || 'Sort';
    document.querySelectorAll('.inv-sort-item').forEach(i =>
        i.classList.toggle('active', i.dataset.sort === mode));
    // Close dropdown
    document.getElementById('invSortDropdown')?.classList.remove('open');
    renderInventoryCars();
}

function setBodyFilter(cat, btn) {
    invBodyFilter = cat; invPage = 1; invCarIndex = 0;
    document.querySelectorAll('.body-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderInventoryCars();
}

function filterCars(cat) {
    currentBrandFilter = cat; invPage = 1; invCarIndex = 0;
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active');
        if (b.textContent.toLowerCase().includes(cat) || (cat==='all' && b.textContent.includes('All')))
            b.classList.add('active');
    });
    renderInventoryCars();
}

function resetAllFilters() {
    currentBrandFilter = 'all'; invBodyFilter = 'all';
    invSortMode = 'recommended'; invStatusFilter = 'available';
    searchTerm = ''; invPage = 1; invCarIndex = 0;
    const s = document.getElementById('carSearch');
    if (s) s.value = '';
    const sl = document.getElementById('invSortLabel');
    if (sl) sl.textContent = 'Recommended';
    document.querySelectorAll('.body-filter-btn').forEach((b,i) => b.classList.toggle('active', i===0));
    document.querySelectorAll('.inv-status-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.status === 'available'));
    renderInventoryCars();
}

// Brand logo pill row
function _renderBrandPills() {
    const el = document.getElementById('invBrandPills');
    if (!el) return;
    const logos  = JSON.parse(localStorage.getItem('edelhausBrandLogos')) || {};
    const pool   = invStatusFilter === 'sold'
        ? carsData.filter(c => (c.status||'').toLowerCase() === 'sold')
        : carsData.filter(c => (c.status||'').toLowerCase() !== 'sold');
    const counts = {};
    pool.forEach(c => { counts[c.brand] = (counts[c.brand]||0)+1; });
    const brands = [...new Set(pool.map(c => c.brand))];
    el.innerHTML = `<button class="brand-pill ${currentBrandFilter==='all'?'active':''}" onclick="filterCars('all');updateStockDisplay('All Brands')">
        <i class="bi bi-grid-3x3-gap me-1" style="font-size:0.75rem;"></i>All
        <span class="brand-pill-count">${pool.length}</span>
    </button>` + brands.map(b => {
        const logo = logos[b]
            ? `<img src="${logos[b]}" class="brand-pill-img" alt="${b}">`
            : `<i class="bi bi-car-front me-1" style="font-size:0.75rem;"></i>`;
        const label = b.replace('Mercedes-Benz','Merc').replace('Range Rover','Range R.');
        return `<button class="brand-pill ${currentBrandFilter===b?'active':''}" onclick="filterCars('${b}');updateStockDisplay('${b}')">
            ${logo}${label}<span class="brand-pill-count">${counts[b]||0}</span>
        </button>`;
    }).join('');
}

// Recently Viewed strip
function _renderRecentlyViewed() {
    const strip = document.getElementById('recentlyViewedStrip');
    if (!strip) return;
    const cars = recentlyViewed.map(id => carsData.find(c => c.id===id)).filter(Boolean);
    if (!cars.length) { strip.style.display = 'none'; return; }
    strip.style.display = 'block';
    const grid = document.getElementById('recentlyViewedGrid');
    if (!grid) return;
    grid.innerHTML = cars.map(car => {
        const img   = car.colors?.[0]?.img || car.images?.[0] || '';
        const sold  = (car.status||'').toLowerCase() === 'sold';
        const price = sold ? 'SOLD'
            : (car.status||'').toLowerCase().includes('order') ? 'Ask For Price'
            : formatPrice(car.price);
        return `<div class="rv-card" onclick="openModal(${car.id})">
            <div class="rv-img-wrap">
                <img src="${img}" alt="${car.name}" loading="lazy" ${sold?'style="filter:grayscale(60%)"':''}>
                ${sold?'<span class="rv-sold-badge">SOLD</span>':''}
                ${car.model_url?'<span class="rv-360-badge"><i class="bi bi-arrow-repeat"></i> 360°</span>':''}
            </div>
            <div class="rv-info">
                <div class="rv-brand">${car.brand}</div>
                <div class="rv-name">${car.name}</div>
                <div class="rv-price">${price}</div>
            </div>
        </div>`;
    }).join('');
}

// ==============================================================
//  BRAND DROPDOWN
// ==============================================================
function getBrandInventoryCounts() {
    const c = {};
    carsData.forEach(car => { c[car.brand] = (c[car.brand] || 0) + 1; });
    return c;
}
function getUniqueBrands() { return ['All Brands', ...[...new Set(carsData.map(c => c.brand))]]; }
function updateStockDisplay(b = 'All Brands') {
    const btn = document.getElementById('brandDropdownBtn');
    if (!btn) return;
    const c = getBrandInventoryCounts();
    btn.innerHTML = (b.includes('All') || b === 'all')
        ? `<i class="bi bi-funnel me-1"></i>All Brands (${carsData.length}) <i class="bi bi-chevron-down ms-1"></i>`
        : `<i class="bi bi-car-front me-1"></i>${b} (${c[b] || 0}) <i class="bi bi-chevron-up ms-1"></i>`;
}
const brandLogoData = { "Bentley":"LOGOS/B_logo.jpg","Mercedes-Benz":"LOGOS/Mercedes_Benz-Logo.png","Porsche":"LOGOS/PORSCHE_LOGO.webp","Ferrari":"LOGOS/Ferrari_Logo.jpg","Rolls-Royce":"LOGOS/ROLLS_ROYCE_LOGO.webp","Range Rover":"LOGOS/RANGE_ROVER_LOGO.webp","BMW":"LOGOS/BMW_LOGO.webp","McLaren":"LOGOS/MCLAREN_LOGO.JPG" };
localStorage.setItem('edelhausBrandLogos', JSON.stringify(brandLogoData));
function createBrandDropdown() {
    const brands = getUniqueBrands(), counts = getBrandInventoryCounts();
    const list = document.getElementById('brandList');
    const logos = JSON.parse(localStorage.getItem('edelhausBrandLogos')) || {};
    if (!list) return;
    list.innerHTML = `<a href="#" class="dropdown-item brand-item active" data-brand="all"><i class="bi bi-grid-3x3-gap me-2"></i>All Brands (${carsData.length})</a>` +
        brands.slice(1).map(b => {
            const icon = logos[b] ? `<img src="${logos[b]}" class="dropdown-logo" alt="${b}">` : `<i class="bi bi-car-front me-2"></i>`;
            return `<a href="#" class="dropdown-item brand-item" data-brand="${b}">${icon}${b}<span class="badge bg-secondary ms-2" style="font-size:0.7em">${counts[b]||0}</span></a>`;
        }).join('');
    document.querySelectorAll('.brand-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const brand = item.dataset.brand;
            document.querySelectorAll('.brand-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            filterCars(brand);
            updateStockDisplay(brand === 'all' ? 'All Brands' : brand);
            document.getElementById('brandDropdownMenu').style.display = 'none';
        });
    });
}
// Brand dropdown events — handled in main DOMContentLoaded init block below

// ==============================================================
//  GALLERY MODAL — HD Cinematic
// ==============================================================
function openGalleryModal(carId) {
    const car = carsData.find(c => c.id === carId);
    if (!car) return;
    let imgs = car.images ? [...car.images] : [];
    if (car.colors) car.colors.forEach(c => { if (c.img && !imgs.includes(c.img)) imgs.push(c.img); });
    if (!imgs.length) return;

    let idx = 0;
    let isAnimating = false;

    const mainImg   = document.getElementById('galleryMainImage');
    const bgBlur    = document.getElementById('galBgBlur');
    const thumbsCon = document.getElementById('galleryThumbs');
    const counter   = document.getElementById('galleryCounter');
    const counter2  = document.getElementById('galleryCounter2');

    document.getElementById('galleryCarName').innerText = car.name;

    // ── Update both counters ──
    function setCounter(i) {
        const txt = `${i + 1} / ${imgs.length}`;
        if (counter)  counter.innerText  = txt;
        if (counter2) counter2.innerText = txt;
    }

    // ── Build bottom thumbnail strip ──
    function buildThumbs() {
        thumbsCon.innerHTML = imgs.map((im, j) => `
            <img src="${im}"
                 class="gal-hd-thumb ${j === 0 ? 'gal-active' : ''}"
                 alt="View ${j + 1}"
                 onerror="this.style.display='none'"
                 onclick="window._gNav(${j})">`
        ).join('');
    }

    // ── Scroll active thumb into view (horizontal) ──
    function updateThumbs() {
        thumbsCon.querySelectorAll('.gal-hd-thumb').forEach((t, j) => {
            t.classList.toggle('gal-active', j === idx);
        });
        const active = thumbsCon.querySelectorAll('.gal-hd-thumb')[idx];
        if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    // ── Cinematic directional navigation ──
    function navigateTo(newIdx, dir) {
        if (isAnimating) return;
        newIdx = ((newIdx % imgs.length) + imgs.length) % imgs.length;
        if (newIdx === idx) return;
        isAnimating = true;

        const exitClass  = dir === 'next' ? 'gal-exit-next' : 'gal-exit-prev';
        const enterClass = dir === 'next' ? 'gal-enter'     : 'gal-enter-prev';

        mainImg.classList.remove('gal-visible');
        mainImg.classList.add(exitClass);

        setTimeout(() => {
            idx = newIdx;
            mainImg.src = imgs[idx];
            bgBlur.style.backgroundImage = `url('${imgs[idx]}')`;
            setCounter(idx);
            updateThumbs();

            mainImg.classList.remove(exitClass);
            mainImg.classList.add(enterClass);
            void mainImg.offsetWidth;
            mainImg.classList.remove(enterClass);
            mainImg.classList.add('gal-visible');

            setTimeout(() => { isAnimating = false; }, 520);
        }, 300);
    }

    // ── Wire arrow buttons ──
    document.getElementById('galleryPrev').onclick = () => navigateTo(idx - 1, 'prev');
    document.getElementById('galleryNext').onclick = () => navigateTo(idx + 1, 'next');

    // Thumb click
    window._gNav = (newIdx) => navigateTo(newIdx, newIdx > idx ? 'next' : 'prev');

    // Keyboard
    document.onkeydown = e => {
        if (!document.getElementById('galleryModal').classList.contains('show')) return;
        if (e.key === 'ArrowRight') navigateTo(idx + 1, 'next');
        if (e.key === 'ArrowLeft')  navigateTo(idx - 1, 'prev');
        if (e.key === 'Escape') bootstrap.Modal.getInstance(document.getElementById('galleryModal'))?.hide();
    };

    // Touch swipe
    let touchStartX = 0;
    mainImg.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    mainImg.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 50) navigateTo(dx < 0 ? idx + 1 : idx - 1, dx < 0 ? 'next' : 'prev');
    });

    // ── Prepare (before modal opens) ──
    mainImg.classList.remove('gal-visible','gal-enter','gal-enter-prev','gal-exit-next','gal-exit-prev');
    mainImg.src = imgs[0];
    bgBlur.style.backgroundImage = `url('${imgs[0]}')`;
    setCounter(0);
    buildThumbs();

    // ── Open modal, trigger slide-in AFTER fully shown ──
    const modalEl   = document.getElementById('galleryModal');
    const modalInst = new bootstrap.Modal(modalEl);

    modalEl.addEventListener('shown.bs.modal', function onShown() {
        modalEl.removeEventListener('shown.bs.modal', onShown);
        mainImg.classList.add('gal-enter');
        void mainImg.offsetWidth;
        mainImg.classList.remove('gal-enter');
        mainImg.classList.add('gal-visible');
    });

    modalInst.show();
}

// ==============================================================
//  TOAST
// ==============================================================
function showToast(msg, type = 'success', dur = 3500) {
    const icons  = { success:'bi-check-circle-fill', error:'bi-x-circle-fill', info:'bi-info-circle-fill', warning:'bi-exclamation-triangle-fill' };
    const colors = { success:'#2ecc71', error:'#e74c3c', info:'#3498db', warning:'#3498db' };
    const cont = document.getElementById('toastContainer');
    if (!cont) return;
    const id = 'toast-' + Date.now();
    const el = document.createElement('div');
    el.id = id; el.className = 'edelhaus-toast';
    el.innerHTML = `<i class="bi ${icons[type]}" style="color:${colors[type]};font-size:1.2rem;flex-shrink:0;"></i><span class="toast-msg">${msg}</span><button class="toast-close" onclick="document.getElementById('${id}').remove()"><i class="bi bi-x"></i></button>`;
    cont.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('toast-show')));
    setTimeout(() => { el.classList.remove('toast-show'); el.classList.add('toast-hide'); setTimeout(() => el.remove(), 400); }, dur);
}

// ==============================================================
//  PDF BROCHURE
// ==============================================================
function downloadBrochure(carId) {
    const car = carsData.find(c => c.id === carId);
    if (!car) return;
    showToast(`Generating brochure for <strong>${car.name}</strong>...`, 'info', 2000);

    // Collect all image URLs for this car (main + color variants)
    let allImgUrls = [];
    if (car.images && car.images.length) allImgUrls.push(...car.images);
    if (car.colors) car.colors.forEach(c => { if (c.img && !allImgUrls.includes(c.img)) allImgUrls.push(c.img); });

    // Convert all images to base64 so they embed correctly in the blob HTML
    function toBase64(url) {
        return new Promise(resolve => {
            if (!url) return resolve('');
            // Already a data URL or external URL — use as-is
            if (url.startsWith('data:') || url.startsWith('http')) {
                // For external URLs fetch and convert; for local paths use canvas trick
                if (url.startsWith('http')) {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        const c = document.createElement('canvas');
                        c.width = img.naturalWidth; c.height = img.naturalHeight;
                        c.getContext('2d').drawImage(img, 0, 0);
                        try { resolve(c.toDataURL('image/jpeg', 0.85)); } catch(e) { resolve(url); }
                    };
                    img.onerror = () => resolve(url);
                    img.src = url;
                    return;
                }
                return resolve(url);
            }
            // Local relative path — load via Image + canvas
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth; c.height = img.naturalHeight;
                c.getContext('2d').drawImage(img, 0, 0);
                try { resolve(c.toDataURL('image/jpeg', 0.85)); } catch(e) { resolve(url); }
            };
            img.onerror = () => resolve(''); // image not found — skip
            img.src = url;
        });
    }

    Promise.all(allImgUrls.map(toBase64)).then(base64Imgs => {
        // Map original URLs → base64 data URLs
        const imgMap = {};
        allImgUrls.forEach((url, i) => { imgMap[url] = base64Imgs[i]; });

        const blob = new Blob([generateBrochureHTML(car, imgMap)], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const win  = window.open(url, '_blank');
        if (win) { win.onload = () => { win.focus(); win.print(); URL.revokeObjectURL(url); }; }

        let hist = JSON.parse(localStorage.getItem('edelhausBrochures')) || [];
        if (!hist.find(b => b.carId === carId)) {
            hist.push({ carId, carName: car.name, downloadedAt: new Date().toISOString() });
            localStorage.setItem('edelhausBrochures', JSON.stringify(hist));
        }
        showToast(`📄 <strong>${car.name}</strong> brochure ready!`, 'success', 4000);
    });
}

function generateBrochureHTML(car, imgMap) {
    imgMap = imgMap || {};
    const price = formatPrice(car.price);

    // Color swatches with embedded images
    const clrs = car.colors ? car.colors.map(c => `
        <div style="display:inline-flex;align-items:center;gap:8px;margin:0 18px 12px 0;">
            <div style="width:24px;height:24px;background:${c.hex};border-radius:50%;border:1px solid #444;flex-shrink:0;"></div>
            <span style="font-size:12px;color:#ccc;">${c.name}</span>
        </div>`).join('') : '';

    // Resolve main hero image → base64 or original URL
    const rawMain = car.images && car.images[0] ? car.images[0] : '';
    const heroImg = (imgMap[rawMain] || rawMain);

    // All gallery images (main + color variants), resolved to base64
    let galleryUrls = [];
    if (car.images) car.images.forEach(u => { const r = imgMap[u]||u; if (r && !galleryUrls.includes(r)) galleryUrls.push(r); });
    if (car.colors) car.colors.forEach(c => { const r = imgMap[c.img]||c.img; if (r && !galleryUrls.includes(r)) galleryUrls.push(r); });

    // Build gallery HTML (show up to 4 images in a 2x2 grid below the hero)
    const extraImgs = galleryUrls.slice(1, 5); // skip first (already shown as hero)
    const galleryHTML = extraImgs.length ? `
        <div style="display:grid;grid-template-columns:repeat(${Math.min(extraImgs.length,2)},1fr);gap:4px;margin-bottom:0;">
            ${extraImgs.map(src => `<img src="${src}" style="width:100%;height:200px;object-fit:cover;display:block;" alt="${car.name}">`).join('')}
        </div>` : '';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${car.name} — Edelhaus Automotive</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Montserrat:wght@300;400;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Montserrat',sans-serif;background:#0a0a0a;color:#f0f0f0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.w{max-width:900px;margin:0 auto;background:#111}
/* Header */
.hd{background:linear-gradient(135deg,#000,#1a1a2e);padding:40px;text-align:center;border-bottom:2px solid #3498db}
.br{font-family:'Cinzel',serif;font-size:11px;letter-spacing:6px;color:#3498db;text-transform:uppercase;margin-bottom:8px}
.tt{font-family:'Cinzel',serif;font-size:36px;font-weight:700;color:#fff;letter-spacing:2px}
.su{font-size:13px;color:#b0b0b0;letter-spacing:3px;margin-top:8px;text-transform:uppercase}
/* Hero image */
.hi{width:100%;height:420px;object-fit:cover;display:block}
/* Price bar */
.pb{background:linear-gradient(90deg,#0a0a0a,#1a252f,#0a0a0a);padding:24px 40px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #222}
.pr{font-size:30px;font-weight:700;color:#fff}
.bg{background:linear-gradient(135deg,#3498db,#2980b9);color:#fff;padding:8px 22px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:2px}
/* Body */
.bd{padding:40px}
.sh{font-family:'Cinzel',serif;font-size:10px;letter-spacing:5px;color:#3498db;text-transform:uppercase;margin-bottom:20px;padding-bottom:8px;border-bottom:1px solid #222}
.gr{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:40px}
.sp{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:18px 20px}
.sl{font-size:10px;letter-spacing:3px;color:#666;text-transform:uppercase;margin-bottom:4px}
.sv{font-size:18px;font-weight:700;color:#fff}
.ds{font-size:14px;line-height:1.9;color:#b0b0b0;margin-bottom:40px}
/* Footer */
.ft{background:#000;padding:28px 40px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #1a1a1a}
.fb{font-family:'Cinzel',serif;font-size:14px;color:#3498db;letter-spacing:4px}
.fc{font-size:11px;color:#666;text-align:right;line-height:1.8}
.wm{text-align:center;font-size:9px;color:#333;letter-spacing:2px;padding:16px}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<div class="w">

  <!-- Header -->
  <div class="hd">
    <div class="br">Edelhaus Automotive · Official Vehicle Brochure</div>
    <div class="tt">${car.name}</div>
    <div class="su">${car.subtitle}</div>
  </div>

  <!-- Hero Image -->
  ${heroImg ? `<img src="${heroImg}" class="hi" alt="${car.name}">` : ''}

  <!-- Additional Gallery Images -->
  ${galleryHTML}

  <!-- Price Bar -->
  <div class="pb">
    <div>
      <div style="font-size:10px;letter-spacing:3px;color:#666;margin-bottom:4px">STARTING PRICE</div>
      <div class="pr">${price}</div>
    </div>
    <div style="text-align:center">
      <div class="bg">${car.badge}</div>
      <div style="font-size:12px;color:#3498db;margin-top:8px;letter-spacing:2px">${car.status}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:10px;letter-spacing:3px;color:#666;margin-bottom:4px">MODEL YEAR</div>
      <div style="font-size:24px;font-weight:700;color:#fff">${car.year}</div>
    </div>
  </div>

  <!-- Body -->
  <div class="bd">
    <div class="sh">Performance Specifications</div>
    <div class="gr">
      <div class="sp"><div class="sl">Engine</div><div class="sv">${car.engine||'N/A'}</div></div>
      <div class="sp"><div class="sl">Power</div><div class="sv">${car.power}</div></div>
      <div class="sp"><div class="sl">0–100 km/h</div><div class="sv">${car.acceleration}</div></div>
      <div class="sp"><div class="sl">Category</div><div class="sv" style="text-transform:capitalize">${car.category}</div></div>
    </div>

    <div class="sh">About This Vehicle</div>
    <p class="ds">${car.description}</p>

    ${car.colors && car.colors.length ? `
    <div class="sh">Available Colours</div>
    <div style="margin-bottom:40px;display:flex;flex-wrap:wrap">${clrs}</div>` : ''}
  </div>

  <!-- Footer -->
  <div class="ft">
    <div class="fb">EDELHAUS AUTOMOTIVE</div>
    <div class="fc">SG Highway, Ahmedabad, Gujarat<br>+91 98765 43210 · info@edelhaus.in</div>
  </div>
  <div class="wm">CONFIDENTIAL · FOR PRIVATE USE ONLY · © 2026 EDELHAUS AUTOMOTIVE</div>

</div>
</body>
</html>`;
}

// ==============================================================
//  COMPARE
// ==============================================================
let compareList = [];
function toggleCompare(id, btn) {
    if (compareList.includes(id)) { compareList = compareList.filter(c => c !== id); btn.classList.remove('btn-check-active'); btn.innerHTML = '<i class="bi bi-arrow-left-right"></i>'; showToast('Removed from comparison.', 'info'); }
    else { if (compareList.length >= 3) { showToast('Max 3 cars.', 'warning'); return; } compareList.push(id); btn.classList.add('btn-check-active'); btn.innerHTML = '<i class="bi bi-check-lg"></i>'; showToast(`<strong>${carsData.find(c=>c.id===id)?.name}</strong> added.`,'success'); }
    updateCompareBar();
}
function updateCompareBar() { const bar=document.getElementById('compareBar'),cnt=document.getElementById('compareCount'); if(compareList.length>0){bar.style.display='block';cnt.innerText=compareList.length;}else bar.style.display='none'; }
function clearCompare() { compareList=[]; updateCompareBar(); document.querySelectorAll('[onclick^="toggleCompare"]').forEach(b=>{b.classList.remove('btn-check-active');b.innerHTML='<i class="bi bi-arrow-left-right"></i>';}); showToast('Comparison cleared.','info'); }
function showCompareModal() {
    if (compareList.length < 2) { showToast('Select at least 2 cars to compare.', 'warning'); return; }
    const cars = carsData.filter(c => compareList.includes(c.id));
    let hdr = '<tr><th class="compare-spec-col">Specification</th>';
    cars.forEach(c => {
        const img = c.colors?.[0]?.img || c.images?.[0] || '';
        hdr += `<th class="py-3 text-center">
            <img src="${img}" style="width:100%;height:90px;object-fit:cover;border-radius:10px;margin-bottom:8px;">
            <div style="font-size:0.62rem;letter-spacing:2px;color:#3498db;text-transform:uppercase;">${c.brand}</div>
            <div style="font-size:0.9rem;font-weight:700;color:#fff;margin-top:3px;">${c.name}</div>
            <div style="font-size:0.72rem;color:#666;">${c.year}</div>
        </th>`;
    });
    document.getElementById('compareHeader').innerHTML = hdr+'</tr>';

    const specs = [
        {l:'Price',        k:'price',        fmt: v => `<span style="color:#3498db;font-weight:700;">${formatPrice(v)}</span>`},
        {l:'Status',       k:'status',       fmt: v => {
            const s=(v||'').toLowerCase();
            const col=s==='sold'?'#e74c3c':s.includes('order')?'#3498db':'#2ecc71';
            return `<span style="color:${col};font-weight:600;">${v||'—'}</span>`;
        }},
        {l:'Engine',       k:'engine'},
        {l:'Power',        k:'power',        num:'power_hp',        dir:'max'},
        {l:'Torque',       k:'torque_nm',    fmt: v=>v?`${v} Nm`:'—', num:'torque_nm', dir:'max'},
        {l:'0–100 km/h',   k:'acceleration'},
        {l:'Top Speed',    k:'top_speed_kmh',fmt: v=>v?`${v} km/h`:'—', num:'top_speed_kmh', dir:'max'},
        {l:'Transmission', k:'transmission'},
        {l:'Drivetrain',   k:'drivetrain'},
        {l:'Fuel Type',    k:'fuel_type'},
        {l:'Weight',       k:'weight_kg',    fmt: v=>v?`${v.toLocaleString()} kg`:'—', num:'weight_kg', dir:'min'},
        {l:'Seats',        k:'seats',        num:'seats', dir:'max'},
        {l:'Origin',       k:'origin'},
    ];

    document.getElementById('compareBody').innerHTML = specs.map((s,si) => {
        let bestIdx = -1;
        if (s.num) {
            const nums = cars.map(c => parseFloat(c[s.num])||0);
            bestIdx = s.dir==='max'
                ? nums.indexOf(Math.max(...nums))
                : nums.indexOf(Math.min(...nums.filter(n=>n>0)));
        }
        let row = `<tr style="${si%2===0?'background:rgba(255,255,255,0.025)':''}">
            <td class="compare-spec-col">${s.l}</td>`;
        cars.forEach((c,i) => {
            const raw = c[s.k];
            const val = s.fmt ? s.fmt(raw) : (raw || '<span style="color:#444">—</span>');
            const best = bestIdx===i;
            row += `<td class="text-center text-white" style="font-size:0.88rem;padding:10px 12px;${best?'background:rgba(52,152,219,0.08);':''}" >
                ${best?'<i class="bi bi-trophy-fill me-1" style="color:#3498db;font-size:0.72rem;"></i>':''}${val}
            </td>`;
        });
        return row+'</tr>';
    }).join('');

    new bootstrap.Modal(document.getElementById('compareModal')).show();
}

// ==============================================================
//  GARAGE
// ==============================================================
function toggleGarage(carId, btn) {
    let g = JSON.parse(localStorage.getItem('edelhausGarage')) || [];
    const car = carsData.find(c => c.id === carId);
    if (g.includes(carId)) {
        g = g.filter(id => id !== carId);
        btn.innerHTML = '<i class="bi bi-heart"></i>';
        btn.classList.remove('active-wish');
        showToast(`<strong>${car?.name}</strong> removed from wishlist.`, 'info');
    } else {
        g.push(carId);
        btn.innerHTML = '<i class="bi bi-heart-fill"></i>';
        btn.classList.add('active-wish');
        showToast(`❤️ <strong>${car?.name}</strong> saved to wishlist!`, 'success');
    }
    localStorage.setItem('edelhausGarage', JSON.stringify(g));
    updateGarageUI();
}
function renderGarage() {
    const grid=document.getElementById('garageGrid'), empty=document.getElementById('garageEmpty');
    if (!grid) return;
    const g=JSON.parse(localStorage.getItem('edelhausGarage'))||[], cars=carsData.filter(c=>g.includes(c.id));
    if (cars.length===0){grid.innerHTML='';if(empty)empty.style.display='block';}
    else{if(empty)empty.style.display='none';grid.innerHTML=cars.map(generateCarCard).join('');}
}
function updateGarageUI() {
    const badge=document.getElementById('garageBadge');
    if(badge){const g=JSON.parse(localStorage.getItem('edelhausGarage'))||[];badge.innerText=g.length;badge.style.display=g.length>0?'inline':'none';}
}

// ==============================================================
//  CURRENCY
// ==============================================================
function toggleGlobalCurrency() {
    currentCurrency = currentCurrency==='INR'?'USD':'INR';
    renderFeaturedCars(); renderInventoryCars();
    if(document.getElementById('garage')?.classList.contains('active')) renderGarage();
    showToast(`Currency → <strong>${currentCurrency}</strong>`,'info',2000);
}
function formatPrice(str) {
    if (!str) return '—';
    // Normalize garbled UTF-8 rupee symbol (â‚¹ → ₹)
    const clean = str.replace(/â‚¹/g, '₹').replace(/â€™/g, "'");
    if (currentCurrency === 'INR') return clean;
    const n = parseFloat(clean.replace(/[^\d.]/g, ''));
    if (isNaN(n)) return clean;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n * exchangeRate);
}
function formatDateDisplay(d) {
    if(!d) return '';
    return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});
}

// ==============================================================
//  SCROLL & ANIMATIONS
// ==============================================================
function checkScroll() {
    // Stagger reveal: each .reveal element gets a slight delay based on order
    const reveals = document.querySelectorAll('.reveal:not(.active)');
    reveals.forEach((r, i) => {
        if (r.getBoundingClientRect().top < window.innerHeight - 80) {
            setTimeout(() => r.classList.add('active'), i * 90);
        }
    });

    const back = document.getElementById('backToTop');
    if (back) back.style.display = window.scrollY > 300 ? 'block' : 'none';

    const hdr = document.querySelector('.header-custom');
    if (hdr) hdr.classList.toggle('scrolled', window.scrollY > 50);
}
window.addEventListener('scroll', checkScroll, { passive: true });

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

let hasAnimated = false;

// Smooth eased counter animation (replaces linear tick)
function animateCounters() {
    document.querySelectorAll('.counter').forEach(el => {
        const target   = +el.getAttribute('data-target');
        const duration = 2000;
        const start    = performance.now();

        function update(now) {
            const elapsed  = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic for natural deceleration
            const eased    = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(eased * target);
            if (progress < 1) requestAnimationFrame(update);
            else el.textContent = target;
        }
        requestAnimationFrame(update);
    });
}

window.addEventListener('scroll', () => {
    const s = document.querySelector('.stat-card');
    if (s && s.getBoundingClientRect().top < window.innerHeight / 1.3 && !hasAnimated) {
        animateCounters();
        hasAnimated = true;
    }
}, { passive: true });
window.changeCarImage = function(carId, imgUrl, dot, colorName) {
    const img = document.getElementById(`car-img-${carId}`);
    if (img) {
        img.style.opacity = 0;
        img.style.transform = 'scale(1.04)';
        setTimeout(() => {
            img.src = imgUrl;
            img.style.opacity = 1;
            img.style.transform = 'scale(1)';
        }, 180);
    }
    // Update active dot
    const card = dot.closest('.car-card');
    if (card) {
        card.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
    }
    // Update color name label
    const label = document.getElementById(`color-label-${carId}`);
    if (label && colorName) label.textContent = colorName;
};
function getStockCount(name){return carsData.filter(c=>c.name===name).length;}

// ==============================================================
//  NAVBAR USER AREA — shows login icon OR logged-in user dropdown
// ==============================================================
function updateNavbarUser() {
    const area = document.getElementById('navUserArea');
    if (!area) return;
    const user = getCurrentUser();

    if (!user) {
        // Not logged in → show person icon that opens login modal
        area.innerHTML = `
            <a class="nav-link d-flex align-items-center gap-1" href="#"
               data-bs-toggle="modal" data-bs-target="#loginModal" title="Login / Register">
                <i class="bi bi-person-circle" style="font-size:1.8rem;"></i>
            </a>`;
    } else {
        // Logged in → show avatar with name + dropdown
        const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
        area.innerHTML = `
            <div class="dropdown">
                <button class="btn d-flex align-items-center gap-2 p-0 border-0 bg-transparent text-white nav-link"
                        type="button" id="userDropdownBtn" data-bs-toggle="dropdown" aria-expanded="false">
                    <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#3498db,#2ecc71);
                                display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;
                                flex-shrink:0;border:2px solid rgba(52,152,219,0.5);">
                        ${initials}
                    </div>
                    <div class="d-none d-lg-flex flex-column align-items-start" style="line-height:1.1;">
                        <span style="font-size:0.78rem;font-weight:600;letter-spacing:0.5px;">${user.name.split(' ')[0]}</span>
                        <span style="font-size:0.65rem;color:#888;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${user.email}</span>
                    </div>
                    <i class="bi bi-chevron-down d-none d-lg-block" style="font-size:0.65rem;color:#888;"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end"
                    style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;min-width:230px;padding:8px;">
                    <!-- User info header -->
                    <li>
                        <div style="padding:12px 14px 10px;border-bottom:1px solid #2a2a2a;margin-bottom:6px;">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#3498db,#2ecc71);
                                            display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0;">
                                    ${initials}
                                </div>
                                <div>
                                    <div style="color:#fff;font-weight:600;font-size:0.9rem;">${user.name}</div>
                                    <div style="color:#888;font-size:0.72rem;">${user.email}</div>
                                    ${user.country ? `<div style="color:#3498db;font-size:0.68rem;margin-top:2px;"><i class="bi bi-geo-alt-fill me-1"></i>${user.country}</div>` : ''}
                                </div>
                            </div>
                        </div>
                    </li>
                    <li>
                        <a class="dropdown-item d-flex align-items-center gap-2 rounded-2" href="#"
                           onclick="showPage('garage')" style="color:#ccc;font-size:0.85rem;padding:8px 12px;">
                            <i class="bi bi-heart-fill text-danger"></i> My Wishlist
                        </a>
                    </li>
                    <li>
                        <a class="dropdown-item d-flex align-items-center gap-2 rounded-2" href="#"
                           onclick="showPage('testdrives')" style="color:#ccc;font-size:0.85rem;padding:8px 12px;">
                            <i class="bi bi-calendar-check-fill text-primary"></i> My Test Drives
                        </a>
                    </li>
                    <li><hr style="border-color:#2a2a2a;margin:6px 0;"></li>
                    <li>
                        <a class="dropdown-item d-flex align-items-center gap-2 rounded-2" href="#"
                           onclick="logoutUser()" style="color:#e74c3c;font-size:0.85rem;padding:8px 12px;">
                            <i class="bi bi-box-arrow-right"></i> Logout
                        </a>
                    </li>
                </ul>
            </div>`;
    }
}

function logoutUser() {
    if (!confirm('Are you sure you want to logout?')) return;
    localStorage.removeItem('edelhausActiveUser');
    updateNavbarUser();
    updateGarageUI();
    renderFeaturedCars();
    renderInventoryCars();
    showToast('You have been logged out.', 'info', 3000);
    showPage('home');
}

function filterByBrandRedirect(b){showPage('inventory');setTimeout(()=>{filterCars(b);updateStockDisplay(b);document.getElementById('inventoryGrid')?.scrollIntoView({behavior:'smooth',block:'start'});},100);}

// ==============================================================
//  360° VIEW  — drag-to-spin using the car's image array
// ==============================================================
(function() {
    // Private state for the viewer
    let _frames   = [];
    let _frameIdx = 0;
    let _dragging = false;
    let _startX   = 0;
    let _lastX    = 0;
    let _autoTimer= null;
    let _hintGone = false;
    const DRAG_SENSITIVITY = 18; // px per frame step

    function setFrame(idx) {
        if (!_frames.length) return;
        _frameIdx = ((idx % _frames.length) + _frames.length) % _frames.length;
        const img = document.getElementById('viewer360Img');
        const bar = document.getElementById('viewer360Bar');
        const ctr = document.getElementById('viewer360Counter');
        if (img) img.src = _frames[_frameIdx];
        if (bar) bar.style.width = ((_frameIdx + 1) / _frames.length * 100) + '%';
        if (ctr) ctr.textContent = (_frameIdx + 1) + ' / ' + _frames.length;
    }

    function hideHint() {
        if (_hintGone) return;
        _hintGone = true;
        const hint = document.getElementById('viewer360Hint');
        if (hint) { hint.style.opacity = '0'; setTimeout(() => { if (hint) hint.style.display = 'none'; }, 500); }
    }

    function startAuto() {
        stopAuto();
        const btn = document.getElementById('btn360Play');
        if (btn) btn.innerHTML = '<i class="bi bi-stop-fill me-1"></i>STOP';
        _autoTimer = setInterval(() => setFrame(_frameIdx + 1), 150);
        hideHint();
    }

    function stopAuto() {
        if (_autoTimer) { clearInterval(_autoTimer); _autoTimer = null; }
        const btn = document.getElementById('btn360Play');
        if (btn) btn.innerHTML = '<i class="bi bi-play-fill me-1"></i>AUTO';
    }

    function onPointerDown(e) {
        _dragging = true;
        _startX   = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        _lastX    = _startX;
        stopAuto();
        hideHint();
        const wrap = document.getElementById('viewer360Container');
        if (wrap) wrap.style.cursor = 'grabbing';
    }

    function onPointerMove(e) {
        if (!_dragging) return;
        const x   = e.clientX ?? e.touches?.[0]?.clientX ?? _lastX;
        const dx  = x - _lastX;
        if (Math.abs(dx) >= DRAG_SENSITIVITY) {
            setFrame(_frameIdx + (dx > 0 ? -1 : 1));
            _lastX = x;
        }
    }

    function onPointerUp() {
        _dragging = false;
        const wrap = document.getElementById('viewer360Container');
        if (wrap) wrap.style.cursor = 'grab';
    }

    function initViewerEvents() {
        const wrap = document.getElementById('viewer360Container');
        if (!wrap || wrap._360_init) return;
        wrap._360_init = true;

        // Mouse
        wrap.addEventListener('mousedown',  onPointerDown);
        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup',   onPointerUp);

        // Touch
        wrap.addEventListener('touchstart', onPointerDown,  { passive:true });
        wrap.addEventListener('touchmove',  onPointerMove,  { passive:true });
        wrap.addEventListener('touchend',   onPointerUp);

        // Buttons
        document.getElementById('btn360Prev')?.addEventListener('click', () => { stopAuto(); setFrame(_frameIdx - 1); });
        document.getElementById('btn360Next')?.addEventListener('click', () => { stopAuto(); setFrame(_frameIdx + 1); });
        document.getElementById('btn360Play')?.addEventListener('click', () => {
            if (_autoTimer) stopAuto(); else startAuto();
        });

        // Clean up auto-play when modal closes
        document.getElementById('view360Modal')?.addEventListener('hidden.bs.modal', () => {
            stopAuto();
            _frames = []; _frameIdx = 0; _hintGone = false;
            const hint = document.getElementById('viewer360Hint');
            if (hint) { hint.style.opacity = '1'; hint.style.display = 'flex'; }
            wrap._360_init = false;
        }, { once: false });
    }

    // Expose the public open function
    window.open360View = function(carId) {
        const car = carsData.find(c => c.id === carId);
        if (!car) return;

        // Build frames list — use all available images
        _frames   = (car.images && car.images.length) ? [...car.images] : [];
        _frameIdx = 0;
        _hintGone = false;

        if (!_frames.length) {
            alert('No images available for 360° view on this vehicle.');
            return;
        }

        // Update modal title
        const title = document.getElementById('view360Title');
        if (title) title.innerHTML = `<i class="bi bi-arrow-repeat me-2 text-primary"></i>360° View — ${car.name}`;

        // Restore hint visibility for new car
        const hint = document.getElementById('viewer360Hint');
        if (hint) { hint.style.opacity = '1'; hint.style.display = 'flex'; }

        // Reset progress bar & counter
        const bar = document.getElementById('viewer360Bar');
        const ctr = document.getElementById('viewer360Counter');
        if (bar) bar.style.width = '0%';
        if (ctr) ctr.textContent = '1 / ' + _frames.length;

        // Set first frame immediately
        const img = document.getElementById('viewer360Img');
        if (img) img.src = _frames[0];

        // Show modal, then wire up events (elements exist in DOM now)
        const modal = new bootstrap.Modal(document.getElementById('view360Modal'));
        modal.show();

        // Init drag/button listeners after modal is visible
        document.getElementById('view360Modal').addEventListener('shown.bs.modal', () => {
            initViewerEvents();
            setFrame(0);
            // Auto-start a short preview spin so user sees it works
            let preview = 0;
            const spin = setInterval(() => {
                setFrame(_frameIdx + 1);
                if (++preview >= _frames.length) { clearInterval(spin); stopAuto(); }
            }, 120);
        }, { once: true });
    };
})();
function showComingSoon(brand){document.getElementById('carTitle').innerText=brand;document.getElementById('carBody').innerHTML=`<div class="text-center py-5"><i class="bi bi-cone-striped display-1 text-warning mb-4"></i><h3 class="text-white fw-bold">Stock Currently Unavailable</h3><p class="text-muted fs-5 mt-3">We are sourcing <span class="text-white fw-bold">${brand}</span> for our showroom.</p><div class="mt-4"><span class="badge bg-dark border border-secondary p-2">Status: Coming Soon</span></div><button class="btn btn-outline-light mt-4 px-4" data-bs-dismiss="modal">Close</button></div>`;new bootstrap.Modal(document.getElementById('carModal')).show();}

// ==============================================================
//  DOMContentLoaded
// ==============================================================
function handleNewsletterSubmit(e) {
    e.preventDefault();
    const input = e.target.querySelector('.about-nl-input');
    showToast(`✅ <strong>${input.value}</strong> subscribed successfully!`, 'success', 4000);
    input.value = '';
}





// ================================================================
//  BRANDS PAGE
// ================================================================
function filterBrandCards(cat, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.brand-filter-card').forEach(card => {
        const match = cat === 'all' || card.getAttribute('data-cat') === cat;
        card.classList.toggle('bcat-hidden', !match);
    });
}

function saveNotify(brand) {
    const input = document.getElementById('n-' + brand);
    const ok    = document.getElementById('nok-' + brand);
    if (!input || !ok) return;
    const email = input.value.trim();
    if (!email || !email.includes('@')) {
        input.style.borderColor = '#e74c3c';
        setTimeout(() => input.style.borderColor = '', 2000);
        return;
    }
    const list = JSON.parse(localStorage.getItem('edelhausNotify') || '[]');
    if (!list.find(i => i.brand === brand && i.email === email)) {
        list.push({ brand, email, at: new Date().toISOString() });
        localStorage.setItem('edelhausNotify', JSON.stringify(list));
    }
    input.value = '';
    ok.textContent = '✓ You\'re on the list!';
    showToast(`🔔 We\'ll notify you when <strong>${brand}</strong> arrives!`, 'success', 3500);
}

function initBrandsPage() {
    setTimeout(() => checkScroll(), 80);
}

// ==============================================================
//  INIT — Wire up everything on page load
// ==============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Load cars data (fetches cars.json, renders everything)
    loadCarsData();

    // Navbar user state
    updateNavbarUser();
    updateTDNavBadge();

    // Inventory slider hover pause
    const wrapper = document.getElementById('invSliderWrapper');
    if (wrapper) {
        wrapper.addEventListener('mouseenter', invStopAuto);
        wrapper.addEventListener('mouseleave', () => {
            if (invAllCards.length > INV_VISIBLE) invStartAuto();
        });
    }

    // Keyboard ← → for carousel
    document.addEventListener('keydown', e => {
        const inv = document.getElementById('inventory');
        if (!inv?.classList.contains('active')) return;
        if (e.key === 'ArrowLeft')  invMove(-1);
        if (e.key === 'ArrowRight') invMove(1);
    });

    // Sort dropdown toggle
    document.getElementById('invSortBtn')?.addEventListener('click', e => {
        e.stopPropagation();
        document.getElementById('invSortDropdown')?.classList.toggle('open');
    });
    document.addEventListener('click', () => {
        document.getElementById('invSortDropdown')?.classList.remove('open');
    });

    // Brand dropdown toggle
    document.getElementById('brandDropdownBtn')?.addEventListener('click', e => {
        e.stopPropagation();
        const dd = document.getElementById('brandDropdownMenu');
        if (dd) dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
    });

    // Close brand dropdown on outside click
    document.addEventListener('click', e => {
        const sc = document.querySelector('.search-brand-container');
        const dd = document.getElementById('brandDropdownMenu');
        if (dd && sc && !sc.contains(e.target)) dd.style.display = 'none';
    });

    // Search input
    const searchEl = document.getElementById('carSearch');
    if (searchEl) {
        searchEl.addEventListener('input', debounce(e => {
            searchTerm = e.target.value.toLowerCase().trim();
            invPage    = 1;
            invCarIndex = 0;
            renderInventoryCars();
        }, 280));
    }

    // Login / Signup form submit
    document.getElementById('authLoginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('authSignupForm')?.addEventListener('submit', handleSignup);

    // Test drive form submit
    document.getElementById('tdForm')?.addEventListener('submit', submitTestDrive);

    // Contact form
    document.getElementById('contactForm')?.addEventListener('submit', e => {
        e.preventDefault();
        const form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }
        // Save enquiry so admin can see it
        const nameEl  = form.querySelector('[name="name"], #contactName, #enqName');
        const emailEl = form.querySelector('[name="email"], #contactEmail, #enqEmail');
        const msgEl   = form.querySelector('[name="message"], #contactMessage, #enqMessage, textarea');
        const name  = nameEl?.value.trim()  || 'Customer';
        const email = emailEl?.value.trim() || '';
        const msg   = msgEl?.value.trim()   || '';
        if (name || email || msg) {
            const enqs = JSON.parse(localStorage.getItem('edelhaus_enquiries')) || [];
            enqs.push({ name, email, msg, date: new Date().toISOString().split('T')[0], status: 'Pending' });
            localStorage.setItem('edelhaus_enquiries', JSON.stringify(enqs));
        }
        showToast('✅ Enquiry sent! Our team will contact you shortly.', 'success', 4000);
        form.classList.remove('was-validated');
        form.reset();
    });

    // Service form — populate car dropdown + full validation
    initServiceForm();

    // Scroll check
    checkScroll();
});

// ==============================================================
//  SERVICE FORM — Init, Validation, Save
// ==============================================================
function initServiceForm() {
    const form    = document.getElementById('serviceForm');
    const carSel  = document.getElementById('svcCar');
    const ownWrap = document.getElementById('svcOwnCarWrap');
    const ownInp  = document.getElementById('svcOwnCar');
    const dateInp = document.getElementById('svcDate');
    const dateErr = document.getElementById('svcDateError');
    if (!form) return;

    // ── Set min date to today ──
    const today = new Date().toISOString().split('T')[0];
    if (dateInp) {
        dateInp.min = today;
        dateInp.value = '';
    }

    // ── Populate car dropdown from carsData (populated after loadCarsData) ──
    function populateSvcCarDropdown() {
        if (!carSel || !carsData.length) return;
        // Remove existing fleet options (keep "My own car" option)
        const ownOpt  = carSel.querySelector('option[value="__own__"]');
        const ownGrp  = carSel.querySelector('optgroup');
        carSel.innerHTML = '<option value="" disabled selected>Choose a car from our fleet…</option>';

        // Group cars by brand
        const brands = [...new Set(carsData.map(c => c.brand))];
        brands.forEach(brand => {
            const grp = document.createElement('optgroup');
            grp.label = brand;
            carsData.filter(c => c.brand === brand).forEach(car => {
                const opt = document.createElement('option');
                opt.value = car.name;
                opt.textContent = `${car.name} — ${car.price}`;
                grp.appendChild(opt);
            });
            carSel.appendChild(grp);
        });

        // Add "My own car" at the bottom
        const sep = document.createElement('optgroup');
        sep.label = '─────────────────';
        sep.disabled = true;
        carSel.appendChild(sep);
        const ownGrpNew = document.createElement('optgroup');
        ownGrpNew.label = 'Other';
        const ownOptNew = document.createElement('option');
        ownOptNew.value = '__own__';
        ownOptNew.textContent = 'My own / other car (enter below)';
        ownGrpNew.appendChild(ownOptNew);
        carSel.appendChild(ownGrpNew);
    }

    // Try now, and also after carsData loads (async)
    populateSvcCarDropdown();
    const _origLoad = window._svcDropdownInit || false;
    if (!_origLoad) {
        window._svcDropdownInit = true;
        // Retry after cars data is available (loadCarsData is async)
        const poll = setInterval(() => {
            if (carsData.length > 0) { populateSvcCarDropdown(); clearInterval(poll); }
        }, 300);
        setTimeout(() => clearInterval(poll), 8000);
    }

    // ── Toggle "own car" text field ──
    carSel?.addEventListener('change', () => {
        const isOwn = carSel.value === '__own__';
        if (ownWrap) ownWrap.style.display = isOwn ? 'block' : 'none';
        if (ownInp)  { ownInp.required = isOwn; if (!isOwn) { ownInp.value = ''; ownInp.classList.remove('is-invalid','is-valid'); } }
    });

    // ── Date live validation ──
    function validateSvcDate() {
        if (!dateInp || !dateErr) return true;
        const val = dateInp.value;
        if (!val) {
            dateInp.classList.add('is-invalid');
            dateInp.classList.remove('is-valid');
            dateErr.textContent = 'Please select a date.';
            return false;
        }
        const sel  = new Date(val + 'T00:00:00');
        const tod  = new Date(today + 'T00:00:00');
        const dow  = sel.getDay(); // 0=Sun

        if (sel < tod) {
            dateInp.classList.add('is-invalid');
            dateInp.classList.remove('is-valid');
            dateErr.textContent = 'Date cannot be in the past. Please choose a future date.';
            return false;
        }
        if (dow === 0) {
            // Sunday — still allowed but show note
            dateInp.classList.remove('is-invalid');
            dateInp.classList.add('is-valid');
            const hint = document.getElementById('svcDateHint');
            if (hint) hint.innerHTML = '<i class="bi bi-info-circle me-1 text-warning"></i><span style="color:#3498db">Sundays are by appointment only — our team will confirm availability.</span>';
            return true;
        }
        dateInp.classList.remove('is-invalid');
        dateInp.classList.add('is-valid');
        const hint = document.getElementById('svcDateHint');
        if (hint) hint.innerHTML = '<i class="bi bi-check-circle me-1 text-success"></i><span style="color:#2ecc71">Date available · Mon–Sat 10 AM – 7 PM</span>';
        return true;
    }

    dateInp?.addEventListener('change', validateSvcDate);
    dateInp?.addEventListener('input',  validateSvcDate);

    // ── Form submit ──
    form.addEventListener('submit', e => {
        e.preventDefault();

        // Run date validation explicitly
        const dateOk = validateSvcDate();

        // Mark own-car field if visible
        if (ownInp && ownInp.required && !ownInp.value.trim()) {
            ownInp.classList.add('is-invalid');
        }

        if (!form.checkValidity() || !dateOk) {
            form.classList.add('was-validated');
            // Scroll to first invalid field
            const first = form.querySelector(':invalid, .is-invalid');
            if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const name      = document.getElementById('svcName').value.trim();
        const phone     = document.getElementById('svcPhone').value.trim();
        const carVal    = carSel.value;
        const carName   = carVal === '__own__' ? (ownInp?.value.trim() || '') : carVal;
        const serviceType = document.getElementById('svcType').value;
        const date      = dateInp.value;
        const time      = document.getElementById('svcTime').value;
        const notes     = document.getElementById('svcNotes').value.trim();
        const timestamp = new Date().toISOString();

        // Save to localStorage (admin reads EdelhausServiceDB & localStorage)
        const appts = JSON.parse(localStorage.getItem('edelhaus_service_appointments')) || [];
        appts.push({ name, phone, car: carName, serviceType, date, time, notes, timestamp, status: 'Pending' });
        localStorage.setItem('edelhaus_service_appointments', JSON.stringify(appts));

        // Also save in format admin's IndexedDB section expects (via localStorage bridge)
        const svcAdmin = JSON.parse(localStorage.getItem('edelhaus_svc_appointments_admin')) || [];
        svcAdmin.push({ name, phone, car: carName, serviceType, date, time: time || '', notes, timestamp, status: 'Pending' });
        localStorage.setItem('edelhaus_svc_appointments_admin', JSON.stringify(svcAdmin));

        // Show success banner
        const banner = document.getElementById('svcSuccessBanner');
        const detail = document.getElementById('svcSuccessDetail');
        if (banner) banner.style.display = 'block';
        if (detail) detail.textContent   = `${carName} · ${serviceType} · ${formatDateDisplay(date)}${time ? ' at ' + time : ''}`;

        // Show toast
        showToast(`✅ Appointment booked for <strong>${carName}</strong> on ${formatDateDisplay(date)}!`, 'success', 5000);

        // Reset form
        form.classList.remove('was-validated');
        form.reset();
        if (ownWrap) ownWrap.style.display = 'none';
        if (ownInp)  { ownInp.required = false; ownInp.classList.remove('is-valid','is-invalid'); }
        dateInp?.classList.remove('is-valid','is-invalid');
        carSel?.classList.remove('is-valid','is-invalid');
        const hint = document.getElementById('svcDateHint');
        if (hint) hint.innerHTML = '<i class="bi bi-info-circle me-1"></i>Mon–Sat only · Sundays by appointment';
        dateInp.min = today;

        // Auto-hide success banner after 8s
        setTimeout(() => { if (banner) banner.style.display = 'none'; }, 8000);
    });
}
// ==============================================================
//  SELL MY CAR FORM
// ==============================================================
function initSellMyCarForm() {
    const form = document.getElementById('sellMyCarForm');
    if (!form) return;
    form.addEventListener('submit', e => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }
        const data = {
            name:        document.getElementById('smcName')?.value.trim(),
            email:       document.getElementById('smcEmail')?.value.trim(),
            phone:       document.getElementById('smcPhone')?.value.trim(),
            carMake:     document.getElementById('smcMake')?.value.trim(),
            carModel:    document.getElementById('smcModel')?.value.trim(),
            year:        document.getElementById('smcYear')?.value.trim(),
            mileage:     document.getElementById('smcMileage')?.value.trim(),
            askingPrice: document.getElementById('smcPrice')?.value.trim(),
            condition:   document.getElementById('smcCondition')?.value,
            notes:       document.getElementById('smcNotes')?.value.trim(),
            timestamp:   new Date().toISOString(),
            status:      'Pending Review'
        };
        const submissions = JSON.parse(localStorage.getItem('edelhaus_sell_submissions')||'[]');
        submissions.push(data);
        localStorage.setItem('edelhaus_sell_submissions', JSON.stringify(submissions));
        localStorage.setItem('edelhaus_sell_admin', JSON.stringify(submissions));
        showToast(`✅ <strong>${data.carMake} ${data.carModel}</strong> submitted! Our team will contact you within 24hrs.`, 'success', 6000);
        form.classList.remove('was-validated');
        form.reset();
        const banner = document.getElementById('smcSuccessBanner');
        if (banner) { banner.style.display='block'; setTimeout(()=>{banner.style.display='none';},8000); }
    });
}

// ==============================================================
//  QUICK INQUIRY FORM SUBMIT
// ==============================================================
function submitQuickInquiry(e) {
    e.preventDefault();
    const carName = document.getElementById('qiCarName')?.value || '';
    const name    = document.getElementById('qiName')?.value.trim() || '';
    const email   = document.getElementById('qiEmail')?.value.trim() || '';
    const message = document.getElementById('qiMessage')?.value.trim() || '';
    const enqs    = JSON.parse(localStorage.getItem('edelhaus_enquiries')||'[]');
    enqs.push({ name, email, msg:message, carName, date:new Date().toISOString().split('T')[0], status:'Pending', type:'price_inquiry' });
    localStorage.setItem('edelhaus_enquiries', JSON.stringify(enqs));
    bootstrap.Modal.getInstance(document.getElementById('quickInquiryModal'))?.hide();
    showToast(`📩 Inquiry sent for <strong>${carName}</strong>! We'll contact you shortly.`, 'success', 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    initSellMyCarForm();
    document.getElementById('qiForm')?.addEventListener('submit', submitQuickInquiry);
});