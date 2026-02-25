/* ============================================================
   EDELHAUS — first_api_patch.js
   
   DROP-IN PATCH for first.js — include AFTER api.js
   and AFTER first.js in your HTML like this:

   <script src="api.js"></script>
   <script src="first.js"></script>
   <script src="first_api_patch.js"></script>

   This file OVERRIDES the localStorage-based functions in
   first.js with API-backed versions. All UI rendering, 
   animations, and feature code remains unchanged.
   ============================================================ */

/* ============================================================
   1. AUTH — override localStorage-based auth functions
   ============================================================ */

/** Override: getCurrentUser — reads from sessionStorage via API bridge */
function getCurrentUser() {
    return EdelhausAPI.getUserSession();
}

/** Override: setCurrentUser — saves to sessionStorage via API bridge */
function setCurrentUser(user) {
    EdelhausAPI.saveUserSession(user);
    // Keep localStorage sync for any legacy code paths
    localStorage.setItem('edelhausActiveUser', JSON.stringify(user));
    localStorage.setItem('currentUser', JSON.stringify(user));
}

/** Override: isLoggedIn */
function isLoggedIn() {
    return EdelhausAPI.getUserSession() !== null;
}

/** Override: handleLogin — calls Python API instead of localStorage */
async function handleLogin(e) {
    e.preventDefault();
    const form  = document.getElementById('authLoginForm');
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

    const email    = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPass').value;

    const btn = form.querySelector('button[type="submit"]');
    const origText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Entering...`;
    btn.disabled  = true;

    try {
        const data = await EdelhausAPI.login(email, password);
        EdelhausAPI.saveUserSession(data.user);
        setCurrentUser(data.user);

        const errEl = document.getElementById('loginError');
        if (errEl) errEl.style.display = 'none';

        bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
        updateNavbarUser();
        renderFeaturedCars();
        renderInventoryCars();
        showToast(`👋 Welcome back, <strong>${data.user.name.split(' ')[0]}</strong>!`, 'success', 4000);

        const pendingCarId = localStorage.getItem('pendingTestDriveCarId');
        if (pendingCarId) {
            localStorage.removeItem('pendingTestDriveCarId');
            setTimeout(() => openTestDriveModal(parseInt(pendingCarId)), 600);
        }
    } catch (err) {
        const errEl = document.getElementById('loginError');
        if (errEl) {
            errEl.textContent = err.message.includes('401') || err.message.toLowerCase().includes('invalid')
                ? 'Incorrect email or password. Please try again.'
                : err.message;
            errEl.style.display = 'block';
        }
    } finally {
        btn.innerHTML = origText;
        btn.disabled  = false;
    }
}

/** Override: handleSignup — calls Python API instead of localStorage */
async function handleSignup(e) {
    e.preventDefault();
    const form = document.getElementById('authSignupForm');
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

    const name     = document.getElementById('regName').value.trim();
    const email    = document.getElementById('regEmail').value.trim().toLowerCase();
    const password = document.getElementById('regPass').value;
    const country  = document.getElementById('regCountry').value;

    try {
        const data = await EdelhausAPI.register(name, email, password, country);
        EdelhausAPI.saveUserSession(data.user);
        setCurrentUser(data.user);
        updateNavbarUser();

        const pendingCarId = localStorage.getItem('pendingTestDriveCarId');
        showRegistrationSuccess(name, email, country, !!pendingCarId);
    } catch (err) {
        const errEl = document.getElementById('signupEmailError');
        if (errEl) {
            errEl.textContent = err.message.includes('409') || err.message.toLowerCase().includes('already')
                ? '⚠️ This email is already registered. Please log in.'
                : `⚠️ ${err.message}`;
            errEl.style.display = 'block';
        }
    }
}

/* ============================================================
   2. CAR DATA — override loadCarsData to fetch from API
   ============================================================ */

/** Override: loadCarsData — fetches from Python API */
async function loadCarsData() {
    showSkeletons('inventoryGrid', 3);
    try {
        carsData = await EdelhausAPI.getCars();
        renderFeaturedCars();
        renderInventoryCars();
        renderHomeBrands();
        createBrandDropdown();
        updateStockDisplay();
        updateGarageUI();
        initServiceForm();
        setTimeout(applyLazyLoading, 100);
    } catch (err) {
        console.warn('[API] getCars failed, falling back to cars.json:', err.message);
        // Graceful fallback — try the local JSON file
        try {
            carsData = await (await fetch('cars.json')).json();
            renderFeaturedCars();
            renderInventoryCars();
            renderHomeBrands();
            createBrandDropdown();
            updateStockDisplay();
            updateGarageUI();
            initServiceForm();
            setTimeout(applyLazyLoading, 100);
        } catch (fallbackErr) {
            const g = document.getElementById('inventoryGrid');
            if (g) g.innerHTML = '<p class="text-white text-center py-5">Error loading cars. Please refresh.</p>';
        }
    }
}

/* ============================================================
   3. TEST DRIVES — override submitTestDrive + cancelBooking
   ============================================================ */

/** Override: submitTestDrive — posts to Python API */
async function submitTestDrive(e) {
    e.preventDefault();
    const form = document.getElementById('tdForm');
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

    const user   = getCurrentUser();
    const carId  = parseInt(document.getElementById('tdCarId').value);
    const car    = carsData.find(c => c.id === carId);
    const name   = document.getElementById('tdName').value;
    const phone  = document.getElementById('tdPhone').value;
    const email  = document.getElementById('tdEmail').value;
    const date   = document.getElementById('tdDate').value;
    const time   = document.getElementById('tdTime').value;
    const notes  = document.getElementById('tdNotes').value;

    // Show spinner on submit button
    const submitBtn = form.querySelector('button[type="submit"]');
    const origBtnHTML = submitBtn?.innerHTML;
    if (submitBtn) {
        submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Booking...`;
        submitBtn.disabled = true;
    }

    try {
        const result = await EdelhausAPI.bookTestDrive({
            user_name: name,
            user_email: email,
            user_phone: phone,
            car_id: carId,
            car_name: car?.name || '',
            date, time, notes
        });

        // Keep localStorage in sync for renderTestDrivesPage compatibility
        let bookings = JSON.parse(localStorage.getItem('edelhausTestDrives')) || [];
        bookings = bookings.filter(b => !(b.carId === carId && b.userEmail === email));
        bookings.push({
            id: result.id, carId, carName: car?.name, carImage: car?.images?.[0],
            userEmail: email, name, phone, email, date, time, notes,
            bookedAt: new Date().toISOString(), timestamp: new Date().toISOString(),
            status: 'Pending'
        });
        localStorage.setItem('edelhausTestDrives', JSON.stringify(bookings));

        // Update user phone in API
        if (user && phone) {
            EdelhausAPI.updatePhone(phone).catch(() => {});
            const updatedUser = { ...user, phone };
            setCurrentUser(updatedUser);
            updateNavbarUser();
        }

        bootstrap.Modal.getInstance(document.getElementById('testDriveModal')).hide();
        showToast(`🚗 Test drive for <strong>${car?.name}</strong> booked for ${formatDateDisplay(date)} at ${time}!`, 'success', 5000);

        renderFeaturedCars();
        renderInventoryCars();
        updateTDNavBadge();

        form.classList.remove('was-validated');
        document.getElementById('tdDate').value  = '';
        document.getElementById('tdTime').value  = '';
        document.getElementById('tdNotes').value = '';
    } catch (err) {
        showToast(`❌ Booking failed: ${err.message}`, 'danger', 5000);
    } finally {
        if (submitBtn) { submitBtn.innerHTML = origBtnHTML; submitBtn.disabled = false; }
    }
}

/** Override: cancelBooking — deletes via API */
async function cancelBooking(carId) {
    const user = getCurrentUser();
    if (!user || !confirm('Cancel this test drive booking?')) return;

    // Find the booking ID from localStorage
    const bookings = JSON.parse(localStorage.getItem('edelhausTestDrives')) || [];
    const booking  = bookings.find(b => b.carId === carId && b.userEmail === user.email);

    try {
        if (booking?.id) {
            await EdelhausAPI.deleteTestDrive(booking.id);
        }
        // Remove from localStorage cache
        const updated = bookings.filter(b => !(b.carId === carId && b.userEmail === user.email));
        localStorage.setItem('edelhausTestDrives', JSON.stringify(updated));

        bootstrap.Modal.getInstance(document.getElementById('carModal'))?.hide();
        showToast('Booking cancelled.', 'info');
        renderFeaturedCars();
        renderInventoryCars();
        updateTDNavBadge();
    } catch (err) {
        showToast(`❌ Could not cancel: ${err.message}`, 'danger');
    }
}

/** Override: renderTestDrivesPage — loads from API */
async function renderTestDrivesPage() {
    const user = getCurrentUser();
    const container = document.getElementById('testdrivesContent') || document.getElementById('myBookingsGrid');
    if (!container) return;

    if (!user) {
        container.innerHTML = `<div class="text-center text-muted py-5">
            <i class="bi bi-lock-fill fs-2 mb-3 d-block"></i>
            Please <a href="#" onclick="new bootstrap.Modal(document.getElementById('loginModal')).show()" class="text-primary">log in</a> to view your bookings.
        </div>`;
        return;
    }

    container.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;

    try {
        const drives = await EdelhausAPI.getUserTestDrives(user.email);

        if (!drives.length) {
            container.innerHTML = `<div class="text-center text-muted py-5">
                <i class="bi bi-calendar-x fs-2 mb-3 d-block opacity-50"></i>
                <p>No test drives booked yet.</p>
                <button class="btn btn-gradient btn-sm" onclick="showPage('inventory')">Browse Cars →</button>
            </div>`;
            return;
        }

        container.innerHTML = drives.map(td => {
            const car   = carsData.find(c => c.id === td.car_id || c.id === td.carId);
            const img   = car?.images?.[0] || '';
            const stCls = td.status === 'Confirmed' ? 'success' : td.status === 'Cancelled' ? 'sold' : 'pending';
            return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="admin-card h-100" style="border-radius:14px;">
                    ${img ? `<img src="${img}" style="width:100%;height:140px;object-fit:cover;border-radius:10px 10px 0 0" loading="lazy">` : ''}
                    <div class="p-3">
                        <div class="fw-bold text-white mb-1">${td.carName || td.car}</div>
                        <div class="text-muted small mb-2"><i class="bi bi-calendar3 me-1"></i>${td.date}${td.time ? ' at ' + td.time : ''}</div>
                        <span class="status-badge status-${stCls}">${td.status}</span>
                        ${td.status === 'Pending' ? `
                        <button class="btn btn-sm btn-outline-danger border-0 float-end py-0 mt-1"
                            onclick="cancelBookingById(${td.id}, ${td.car_id || td.carId})">
                            <i class="bi bi-x-circle me-1"></i>Cancel
                        </button>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch {
        // Fallback to localStorage cache
        const cached = JSON.parse(localStorage.getItem('edelhausTestDrives')) || [];
        const userDrives = cached.filter(b => b.userEmail === user.email);
        if (!userDrives.length) {
            container.innerHTML = `<div class="text-center text-muted py-5">No bookings found.</div>`;
        } else {
            container.innerHTML = userDrives.map(td => `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="admin-card h-100" style="border-radius:14px;">
                        <div class="p-3">
                            <div class="fw-bold text-white mb-1">${td.carName}</div>
                            <div class="text-muted small"><i class="bi bi-calendar3 me-1"></i>${td.date}</div>
                            <span class="status-badge status-pending mt-2 d-inline-block">Pending</span>
                        </div>
                    </div>
                </div>`).join('');
        }
    }
}

/** Cancel by booking API id */
async function cancelBookingById(bookingId, carId) {
    if (!confirm('Cancel this test drive booking?')) return;
    try {
        await EdelhausAPI.deleteTestDrive(bookingId);
        // Remove from localStorage cache
        const bookings = JSON.parse(localStorage.getItem('edelhausTestDrives')) || [];
        localStorage.setItem('edelhausTestDrives', JSON.stringify(bookings.filter(b => b.id !== bookingId)));
        showToast('Booking cancelled.', 'info');
        renderTestDrivesPage();
        updateTDNavBadge();
        renderFeaturedCars();
        renderInventoryCars();
    } catch (err) {
        showToast(`❌ Could not cancel: ${err.message}`, 'danger');
    }
}

/* ============================================================
   4. SERVICE FORM — override submit handler
   ============================================================ */

/** Override: initServiceForm — hooks API submit instead of localStorage */
const _origInitServiceForm = window.initServiceForm;
function initServiceForm() {
    if (typeof _origInitServiceForm === 'function') _origInitServiceForm();

    const form = document.getElementById('serviceForm');
    if (!form) return;

    // Remove old listeners by cloning
    const fresh = form.cloneNode(true);
    form.parentNode.replaceChild(fresh, form);

    // Set min date
    const today = new Date().toISOString().split('T')[0];
    const dateInp = fresh.querySelector('#svcDate') || fresh.querySelector('[id*="svcDate"]');
    if (dateInp) { dateInp.min = today; dateInp.value = ''; }

    fresh.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!fresh.checkValidity()) { fresh.classList.add('was-validated'); return; }

        const name         = (fresh.querySelector('#svcName')?.value || '').trim();
        const phone        = (fresh.querySelector('#svcPhone')?.value || '').trim();
        const carSel       = fresh.querySelector('#svcCar');
        const ownInp       = fresh.querySelector('#svcOwnCar');
        const carVal       = carSel?.value || '';
        const carName      = carVal === '__own__' ? (ownInp?.value.trim() || '') : carVal;
        const serviceType  = (fresh.querySelector('#svcType')?.value || '').trim();
        const date         = (fresh.querySelector('#svcDate')?.value || '').trim();
        const time         = (fresh.querySelector('#svcTime')?.value || '').trim();
        const notes        = (fresh.querySelector('#svcNotes')?.value || '').trim();

        const submitBtn = fresh.querySelector('button[type="submit"]');
        const origHTML  = submitBtn?.innerHTML;
        if (submitBtn) { submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Booking...`; submitBtn.disabled = true; }

        try {
            await EdelhausAPI.bookService({ name, phone, car: carName, service_type: serviceType, date, time, notes });

            const banner = document.getElementById('svcSuccessBanner');
            const detail = document.getElementById('svcSuccessDetail');
            if (banner) banner.style.display = 'block';
            if (detail) detail.textContent   = `${carName} · ${serviceType} · ${formatDateDisplay(date)}${time ? ' at ' + time : ''}`;

            showToast(`✅ Appointment booked for <strong>${carName}</strong> on ${formatDateDisplay(date)}!`, 'success', 5000);
            fresh.classList.remove('was-validated');
            fresh.reset();
            if (dateInp) { dateInp.min = today; dateInp.value = ''; }

            setTimeout(() => { if (banner) banner.style.display = 'none'; }, 8000);
        } catch (err) {
            showToast(`❌ Booking failed: ${err.message}`, 'danger');
        } finally {
            if (submitBtn) { submitBtn.innerHTML = origHTML; submitBtn.disabled = false; }
        }
    });
}

/* ============================================================
   5. INQUIRY / CONTACT FORM
   ============================================================ */

/** Attach API-backed submit to any contact/enquiry form */
function initInquiryForm() {
    const forms = document.querySelectorAll('#contactForm, #enquiryForm, #inquiryForm');
    forms.forEach(form => {
        const fresh = form.cloneNode(true);
        form.parentNode.replaceChild(fresh, form);
        fresh.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!fresh.checkValidity()) { fresh.classList.add('was-validated'); return; }

            const name    = (fresh.querySelector('[name="name"], #inqName, #contactName')?.value || '').trim();
            const email   = (fresh.querySelector('[name="email"], #inqEmail, #contactEmail')?.value || '').trim();
            const phone   = (fresh.querySelector('[name="phone"], #inqPhone, #contactPhone')?.value || '').trim();
            const message = (fresh.querySelector('[name="message"], #inqMessage, #contactMessage')?.value || '').trim();
            const carInt  = (fresh.querySelector('[name="car"], #inqCar, #contactCar')?.value || '').trim();

            try {
                await EdelhausAPI.submitInquiry({ name, email, phone, message, car_interest: carInt });
                showToast(`✅ Thank you <strong>${name}</strong>! We'll contact you shortly.`, 'success', 6000);
                fresh.reset();
                fresh.classList.remove('was-validated');
            } catch (err) {
                showToast(`❌ Submission failed: ${err.message}`, 'danger');
            }
        });
    });
}

/* ============================================================
   6. GARAGE — sync with API test drives
   ============================================================ */

/** Override: updateGarageUI — refreshes saved garage + booked drives from API */
async function updateGarageUI() {
    // Garage (saved/wishlisted cars) stays localStorage-based — no server needed
    // Test drive badge uses API
    await updateTDNavBadge();
}

/** Override: updateTDNavBadge — counts from API */
async function updateTDNavBadge() {
    const user = getCurrentUser();
    const badge = document.getElementById('tdNavBadge') || document.querySelector('.td-badge');
    if (!badge) return;

    if (!user) { badge.style.display = 'none'; return; }

    try {
        const drives = await EdelhausAPI.getUserTestDrives(user.email);
        const pending = drives.filter(d => d.status === 'Pending').length;
        badge.textContent = pending;
        badge.style.display = pending > 0 ? 'inline' : 'none';
    } catch {
        // Fallback to localStorage
        const cached  = JSON.parse(localStorage.getItem('edelhausTestDrives')) || [];
        const pending = cached.filter(b => b.userEmail === user?.email && b.status !== 'Cancelled').length;
        badge.textContent = pending;
        badge.style.display = pending > 0 ? 'inline' : 'none';
    }
}

/* ============================================================
   7. INIT HOOK — re-run after DOM ready
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    // Attach inquiry form handler
    initInquiryForm();

    // Restore user session if API token still valid
    const cached = EdelhausAPI.getUserSession();
    if (cached) {
        updateNavbarUser?.();
        updateTDNavBadge?.();
    }

    // Re-hook login/signup forms (may have been built dynamically)
    document.getElementById('authLoginForm')?.addEventListener('submit',  handleLogin);
    document.getElementById('authSignupForm')?.addEventListener('submit', handleSignup);

    console.info('[Edelhaus] ✅ API patch applied — all data operations now use Python backend');
});