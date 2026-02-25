/* ============================================================
   EDELHAUS ADMIN PANEL — admin.js (Backend Edition)
   All data served from Python FastAPI backend via api.js
   ============================================================ */

let adminInventory = [], adminEnquiries = [], allTestDriveRows = [];
let enquiryChartInst, brandChartInst, visitorsChartInst;

/* ── LOGIN ─────────────────────────────────────────────────── */
document.getElementById('adminLoginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    const err = document.getElementById('loginError');
    const btnTxt = document.getElementById('loginBtnText');
    const spin = document.getElementById('loginSpinner');
    err.classList.add('d-none'); btnTxt.classList.add('d-none'); spin.classList.remove('d-none');
    try {
        await EdelhausAPI.adminLogin(username, password);
        document.getElementById('adminLoginScreen').classList.add('d-none');
        document.getElementById('adminDashboard').classList.remove('d-none');
        initDashboard();
    } catch {
        err.textContent = 'Invalid username or password.';
        err.classList.remove('d-none');
    } finally { btnTxt.classList.remove('d-none'); spin.classList.add('d-none'); }
});

document.getElementById('togglePassword')?.addEventListener('click', function() {
    const inp = document.getElementById('adminPassword');
    const icon = this.querySelector('i');
    if (inp.type === 'password') { inp.type = 'text'; icon.className = 'bi bi-eye-slash text-white-50'; }
    else { inp.type = 'password'; icon.className = 'bi bi-eye text-white-50'; }
});

window.addEventListener('DOMContentLoaded', () => {
    if (EdelhausAPI.isAdminLoggedIn()) {
        document.getElementById('adminLoginScreen')?.classList.add('d-none');
        document.getElementById('adminDashboard')?.classList.remove('d-none');
        initDashboard();
    }
    startClock();
});

function adminLogout() { EdelhausAPI.adminLogout(); location.reload(); }

/* ── INIT ──────────────────────────────────────────────────── */
async function initDashboard() {
    showSection('dashboard');
    await Promise.all([loadInventory(), loadEnquiries(), loadTestDrives(), loadServices(), loadAnalytics()]);
    initCharts();
}

/* ── DATA LOADERS ──────────────────────────────────────────── */
async function loadInventory() {
    try {
        adminInventory = await EdelhausAPI.getCars();
        populateBrandFilters(); renderInventoryTable(); updateStatCards(); refreshBrandChart();
    } catch(err) { showToast('Could not load inventory from server.', 'danger'); }
}

async function loadEnquiries() {
    try { adminEnquiries = await EdelhausAPI.getInquiries(); renderEnquiriesTable(); updateStatCards(); }
    catch(err) { console.error('loadEnquiries:', err); }
}

async function loadTestDrives() {
    try { allTestDriveRows = await EdelhausAPI.getTestDrives(); renderTestDrivesTable(); updateStatCards(); }
    catch(err) { console.error('loadTestDrives:', err); }
}

async function loadServices() {
    try { const s = await EdelhausAPI.getServices(); renderServiceTable(s); }
    catch(err) { console.error('loadServices:', err); }
}

async function loadAnalytics() {
    try { const d = await EdelhausAPI.getAnalytics(); renderAnalytics(d); }
    catch(err) { console.error('loadAnalytics:', err); }
}

/* ── SECTION NAV ───────────────────────────────────────────── */
function showSection(name) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const sec = document.getElementById('section-' + name);
    if (sec) sec.classList.add('active');
    document.querySelectorAll('.sidebar-link').forEach(l => {
        if (l.getAttribute('onclick')?.includes(`'${name}'`)) l.classList.add('active');
    });
    const titles = { dashboard:'Dashboard', inventory:'Inventory Management', users:'User Management',
        enquiries:'Enquiries', testdrives:'Test Drive Bookings', services:'Service Appointments',
        analytics:'Analytics', settings:'Settings' };
    const titleEl = document.getElementById('sectionTitle');
    if (titleEl) titleEl.textContent = titles[name] || name;
    if (window.innerWidth <= 768) document.getElementById('adminSidebar')?.classList.remove('mobile-open');
    if (name === 'users') loadUsers();
    if (name === 'analytics') loadAnalytics();
    if (name === 'inventory') loadInventory();
    if (name === 'enquiries') loadEnquiries();
    if (name === 'testdrives') loadTestDrives();
    if (name === 'services') loadServices();
}

function toggleSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    const main = document.querySelector('.admin-main');
    if (window.innerWidth <= 768) sidebar.classList.toggle('mobile-open');
    else { sidebar.classList.toggle('collapsed'); main.classList.toggle('expanded'); }
}

function startClock() {
    const tick = () => {
        const el = document.getElementById('currentDateTime');
        if (el) el.textContent = new Date().toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' });
    };
    tick(); setInterval(tick, 60000);
}

/* ── STAT CARDS ────────────────────────────────────────────── */
function updateStatCards() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('statTotalCars', adminInventory.length);
    set('statEnquiries', adminEnquiries.length);
    set('statTestDrives', allTestDriveRows.length);
    const pending = adminEnquiries.filter(e => e.status === 'Pending').length;
    const badge = document.getElementById('enquiryBadge');
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'inline' : 'none'; }
}

/* ── INVENTORY TABLE ───────────────────────────────────────── */
function renderInventoryTable() { filterInventoryTable(); }

function filterInventoryTable() {
    const search = (document.getElementById('invSearch')?.value || '').toLowerCase();
    const brand  = document.getElementById('invBrandFilter')?.value || '';
    const status = document.getElementById('invStatusFilter')?.value || '';
    const filtered = adminInventory.filter(car => {
        const mS = !search || car.name.toLowerCase().includes(search) || (car.brand||'').toLowerCase().includes(search) || (car.engine||'').toLowerCase().includes(search);
        const mB = !brand  || car.brand === brand;
        const mSt= !status || car.status === status;
        return mS && mB && mSt;
    });
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    tbody.innerHTML = filtered.length === 0
        ? `<tr><td colspan="9" class="text-center text-muted py-4">No cars match filters.</td></tr>`
        : filtered.map((car, i) => {
            const stCls = car.status === 'Available' || car.status === 'In Stock' ? 'available'
                : car.status === 'Sold' ? 'sold' : car.status === 'Reserved' ? 'reserved' : 'pending';
            const fuelIcon = car.fuel_type === 'Electric' ? '⚡' : car.fuel_type?.includes('Hybrid') ? '🔋' : '⛽';
            const investBadge = car.investment_grade
                ? `<span class="badge ms-1" style="background:rgba(241,196,15,0.15);color:#f1c40f;border:1px solid rgba(241,196,15,0.3);font-size:0.6rem">📈 INVEST</span>` : '';
            return `<tr>
                <td class="text-muted">${i+1}</td>
                <td><div class="fw-semibold text-white">${car.name}${investBadge}</div>
                    <small class="text-muted d-block">${(car.subtitle||car.description||'').substring(0,55)}</small>
                    ${car.featured ? `<span class="badge bg-primary" style="font-size:0.6rem">FEATURED</span>` : ''}</td>
                <td><div class="text-white">${car.brand}</div><small class="text-muted">${car.origin||''}</small></td>
                <td><div class="text-white fw-semibold">${car.price||'—'}</div>
                    ${car.price_usd ? `<small class="text-muted">$${(car.price_usd/1000).toFixed(0)}K</small>` : ''}</td>
                <td><div class="text-white">${car.power||'—'}</div>
                    ${car.torque_nm ? `<small class="text-muted">${car.torque_nm} Nm</small>` : ''}</td>
                <td><div class="text-white">${car.acceleration||'—'}</div>
                    ${car.top_speed_kmh ? `<small class="text-muted">${car.top_speed_kmh} km/h</small>` : ''}</td>
                <td><div>${fuelIcon} <small class="text-white">${car.fuel_type||'—'}</small></div>
                    <small class="text-muted">${car.drivetrain||''}</small></td>
                <td><span class="status-badge status-${stCls}">${car.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-secondary border-0 me-1 py-0" onclick="editCar(${car.id})" title="Edit"><i class="bi bi-pencil text-info"></i></button>
                    <button class="btn btn-sm btn-outline-secondary border-0 py-0" onclick="confirmDelete('car',${car.id})" title="Delete"><i class="bi bi-trash text-danger"></i></button>
                </td>
            </tr>`;
        }).join('');
    const cnt = document.getElementById('inventoryCount');
    if (cnt) cnt.textContent = `Showing ${filtered.length} of ${adminInventory.length} vehicles`;
}

function populateBrandFilters() {
    const sel = document.getElementById('invBrandFilter');
    if (!sel) return;
    const brands = [...new Set(adminInventory.map(c => c.brand))].sort();
    const current = sel.value;
    sel.innerHTML = '<option value="">All Brands</option>' +
        brands.map(b => `<option value="${b}"${b===current?' selected':''}>${b}</option>`).join('');
}

/* ── ADD/EDIT CAR ──────────────────────────────────────────── */
async function saveCarEntry() {
    const getVal = id => document.getElementById(id)?.value.trim() || '';
    const name       = getVal('carName');
    const brand      = getVal('carBrand');
    const price      = getVal('carPrice');
    const category   = getVal('carCategory');
    const status     = getVal('carStatus');
    const featured   = document.getElementById('carFeatured')?.value === 'true';
    const desc       = getVal('carDescription');
    const engine     = getVal('carEngine');
    const power      = getVal('carPower');
    const fuelType   = getVal('carFuelType') || 'Gasoline';
    const drivetrain = getVal('carDrivetrain') || 'RWD';
    const year       = getVal('carYear') || '2024';
    const origin     = getVal('carOrigin');
    const editId     = document.getElementById('editCarIndex')?.value;

    if (!name || !brand || !category) { showToast('Please fill all required fields.', 'danger'); return; }
    const carObj = { name, brand, price: price||'—', category, status: status||'Available',
        featured, description: desc, engine, power, fuel_type: fuelType, drivetrain, year, origin };
    try {
        if (editId && editId !== '') { await EdelhausAPI.updateCar(parseInt(editId), carObj); showToast('Car updated!', 'success'); }
        else { await EdelhausAPI.addCar(carObj); showToast('Car added!', 'success'); }
        bootstrap.Modal.getInstance(document.getElementById('addCarModal'))?.hide();
        document.getElementById('addCarForm')?.reset();
        if (document.getElementById('editCarIndex')) document.getElementById('editCarIndex').value = '';
        if (document.getElementById('carModalLabel')) document.getElementById('carModalLabel').textContent = 'Add New Car';
        await loadInventory();
    } catch(err) { showToast(`Error: ${err.message}`, 'danger'); }
}

function editCar(id) {
    const car = adminInventory.find(c => c.id === id);
    if (!car) return;
    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val||''; };
    set('carName', car.name); set('carBrand', car.brand); set('carPrice', car.price);
    set('carCategory', car.category); set('carStatus', car.status); set('carDescription', car.description);
    set('carEngine', car.engine); set('carPower', car.power); set('carFuelType', car.fuel_type);
    set('carDrivetrain', car.drivetrain); set('carYear', car.year); set('carOrigin', car.origin);
    if (document.getElementById('carFeatured')) document.getElementById('carFeatured').value = car.featured ? 'true' : 'false';
    if (document.getElementById('editCarIndex')) document.getElementById('editCarIndex').value = car.id;
    if (document.getElementById('carModalLabel')) document.getElementById('carModalLabel').textContent = 'Edit Car';
    new bootstrap.Modal(document.getElementById('addCarModal')).show();
}

/* ── USERS ─────────────────────────────────────────────────── */
async function loadUsers() {
    try {
        const users = await EdelhausAPI.getUsers();
        renderUsersTable(users);
        const el = document.getElementById('statTotalUsers');
        if (el) el.textContent = users.length;
    } catch(err) { console.error('loadUsers:', err); }
}

function renderUsersTable(users = []) {
    const search = (document.getElementById('userSearch')?.value || '').toLowerCase();
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    const filtered = users.filter(u => !search || u.email.toLowerCase().includes(search) || (u.name||'').toLowerCase().includes(search));
    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No users yet. Users who register on the main site appear here.</td></tr>`;
        return;
    }
    tbody.innerHTML = filtered.map((u, i) => `<tr>
        <td class="text-muted">${i+1}</td>
        <td class="text-white fw-semibold">${u.name||'—'}</td>
        <td>${u.email}</td>
        <td>${u.phone||'—'}</td>
        <td>${u.country||'—'}</td>
        <td><small class="text-muted">${(u.created_at||'—').split('T')[0]}</small></td>
        <td><button class="btn btn-sm btn-outline-secondary border-0 py-0" onclick="confirmDelete('user',${u.id})"><i class="bi bi-trash text-danger"></i></button></td>
    </tr>`).join('');
    const cnt = document.getElementById('usersCount');
    if (cnt) cnt.textContent = `${filtered.length} of ${users.length} user(s)`;
}

/* ── ENQUIRIES ─────────────────────────────────────────────── */
function renderEnquiriesTable() {
    const tbody = document.getElementById('enquiriesTableBody');
    if (!tbody) return;
    if (!adminEnquiries.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No enquiries yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = adminEnquiries.map((enq, i) => `<tr>
        <td class="text-muted">${i+1}</td>
        <td class="text-white">${enq.name}</td>
        <td>${enq.email}</td>
        <td><small class="text-muted">${(enq.message||'').substring(0,60)}${(enq.message||'').length>60?'…':''}</small></td>
        <td><small>${enq.date||enq.created_at?.split('T')[0]||'—'}</small></td>
        <td><span class="status-badge status-${(enq.status||'pending').toLowerCase()}">${enq.status}</span></td>
        <td>
            ${enq.status==='Pending'?`<button class="btn btn-sm btn-outline-secondary border-0 py-0 me-1" onclick="markEnquiryRead(${enq.id})" title="Mark Read"><i class="bi bi-check2 text-success"></i></button>`:''}
            <button class="btn btn-sm btn-outline-secondary border-0 py-0" onclick="confirmDelete('enquiry',${enq.id})"><i class="bi bi-trash text-danger"></i></button>
        </td>
    </tr>`).join('');
}

async function markEnquiryRead(id) {
    try { await EdelhausAPI.updateInquiryStatus(id, 'Read'); await loadEnquiries(); showToast('Marked as read.', 'success'); }
    catch(err) { showToast(err.message, 'danger'); }
}

/* ── TEST DRIVES ───────────────────────────────────────────── */
function renderTestDrivesTable() {
    const tbody = document.getElementById('testDrivesTableBody');
    if (!tbody) return;
    if (!allTestDriveRows.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No test drives yet. Bookings from the main site appear here automatically.</td></tr>`;
        return;
    }
    tbody.innerHTML = allTestDriveRows.map((td, i) => {
        const stCls = td.status==='Confirmed'?'available': td.status==='Cancelled'?'sold':'pending';
        return `<tr>
            <td class="text-muted">${i+1}</td>
            <td class="text-white">${td.name||td.user_name}</td>
            <td>${td.car||td.car_name}</td>
            <td>${td.date}</td>
            <td><small>${td.email||td.user_email}</small><br><small class="text-muted">${td.phone||td.user_phone}</small></td>
            <td><span class="status-badge status-${stCls}">${td.status}</span></td>
            <td>
                ${td.status==='Pending'
                    ?`<button class="btn btn-sm btn-outline-secondary border-0 py-0 me-1" onclick="setTDStatus(${td.id},'Confirmed')" title="Confirm"><i class="bi bi-check-lg text-success"></i></button>
                      <button class="btn btn-sm btn-outline-secondary border-0 py-0" onclick="setTDStatus(${td.id},'Cancelled')" title="Cancel"><i class="bi bi-x-lg text-danger"></i></button>`
                    :`<button class="btn btn-sm btn-outline-secondary border-0 py-0" onclick="setTDStatus(${td.id},'Pending')" title="Reset"><i class="bi bi-arrow-counterclockwise text-warning"></i></button>`}
            </td>
        </tr>`;
    }).join('');
}

async function setTDStatus(id, status) {
    try { await EdelhausAPI.updateTestDriveStatus(id, status); await loadTestDrives(); showToast(`Test drive ${status.toLowerCase()}.`, status==='Confirmed'?'success':'danger'); }
    catch(err) { showToast(err.message, 'danger'); }
}

/* ── SERVICE ───────────────────────────────────────────────── */
function renderServiceTable(rows = []) {
    const tbody = document.getElementById('serviceTableBody');
    if (!tbody) return;
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No service appointments yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = rows.map((svc, i) => {
        const stCls = svc.status==='Confirmed'?'available':'pending';
        return `<tr>
            <td class="text-muted">${i+1}</td>
            <td class="text-white">${svc.name||'—'}</td>
            <td>${svc.car||'—'}</td>
            <td><small class="text-muted">${svc.serviceType||svc.service_type||'—'}</small></td>
            <td>${svc.date||'—'}</td>
            <td>${svc.phone||'—'}</td>
            <td><small class="text-muted">${(svc.notes||'').substring(0,40)}${(svc.notes||'').length>40?'…':''}</small></td>
            <td><span class="status-badge status-${stCls}">${svc.status}</span></td>
            <td>
                ${svc.status==='Pending'?`<button class="btn btn-sm btn-outline-secondary border-0 py-0 me-1" onclick="setSvcStatus(${svc.id},'Confirmed')"><i class="bi bi-check-lg text-success"></i></button>`:''}
                <button class="btn btn-sm btn-outline-secondary border-0 py-0" onclick="setSvcStatus(${svc.id},'Pending')"><i class="bi bi-arrow-counterclockwise text-warning"></i></button>
            </td>
        </tr>`;
    }).join('');
}

async function setSvcStatus(id, status) {
    try { await EdelhausAPI.updateServiceStatus(id, status); await loadServices(); showToast(`Appointment ${status.toLowerCase()}.`, 'success'); }
    catch(err) { showToast(err.message, 'danger'); }
}

/* ── ANALYTICS ─────────────────────────────────────────────── */
function renderAnalytics(data = {}) {
    const { totals={}, brands=[], fuelTypes=[], investmentGradeCars=[], topPricedCars=[], avgPriceUsd=0 } = data;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('kpiUsers', totals.users||0); set('kpiTD', totals.testDrives||0); set('kpiEnq', totals.inquiries||0);
    set('statTotalCars', totals.cars||0); set('statTotalUsers', totals.users||0);
    set('statEnquiries', totals.inquiries||0); set('statTestDrives', totals.testDrives||0);

    const topViewedList = document.getElementById('topViewedList');
    if (topViewedList && topPricedCars.length) {
        const maxUsd = topPricedCars[0]?.price_usd || 1;
        topViewedList.innerHTML = topPricedCars.map(car => {
            const barW = Math.round((car.price_usd||0)/maxUsd*100);
            return `<div class="top-viewed-item">
                <div style="flex:1;min-width:0">
                    <div class="text-white small text-truncate">${car.name}</div>
                    <div class="top-viewed-bar mt-1" style="width:${barW}%"></div>
                </div>
                <span class="text-muted ms-3 small fw-semibold">${car.price||'—'}</span>
            </div>`;
        }).join('');
    }

    const summaryEl = document.getElementById('datasetSummary');
    if (!summaryEl) return;
    summaryEl.innerHTML = `
        <div class="row g-3 mb-3">
            <div class="col-6 col-md-3"><div class="admin-card text-center h-100">
                <div style="font-size:1.8rem;font-weight:700;color:#3498db">${totals.cars||0}</div>
                <div class="text-muted small">Total Vehicles</div>
            </div></div>
            <div class="col-6 col-md-3"><div class="admin-card text-center h-100">
                <div style="font-size:1.8rem;font-weight:700;color:#2ecc71">${brands.length}</div>
                <div class="text-muted small">Brands</div>
            </div></div>
            <div class="col-6 col-md-3"><div class="admin-card text-center h-100">
                <div style="font-size:1.8rem;font-weight:700;color:#f1c40f">${totals.availableCars||0}</div>
                <div class="text-muted small">Available</div>
            </div></div>
            <div class="col-6 col-md-3"><div class="admin-card text-center h-100">
                <div style="font-size:1.8rem;font-weight:700;color:#9b59b6">${totals.investmentCars||0}</div>
                <div class="text-muted small">Investment Grade</div>
            </div></div>
        </div>
        <div class="row g-3 mb-3">
            <div class="col-md-6"><div class="admin-card h-100">
                <div class="admin-card-header">📊 Dataset Insights</div>
                <div class="small">
                    ${[['Avg Price (USD)', '$'+avgPriceUsd.toLocaleString()],['Pending Inquiries',totals.pendingInquiries||0],['Total Test Drives',totals.testDrives||0],['Registered Users',totals.users||0]].map(([k,v])=>`
                    <div class="d-flex justify-content-between py-1 border-bottom" style="border-color:rgba(255,255,255,0.05)!important">
                        <span class="text-muted">${k}</span><span class="text-white fw-semibold">${v}</span>
                    </div>`).join('')}
                </div>
            </div></div>
            <div class="col-md-6"><div class="admin-card h-100">
                <div class="admin-card-header">⛽ Fuel Type Breakdown</div>
                ${fuelTypes.map(ft => {
                    const total = fuelTypes.reduce((s,f)=>s+f.count,0)||1;
                    const pct = Math.round(ft.count/total*100);
                    const colors = {Gasoline:'#e74c3c',Hybrid:'#2ecc71',Electric:'#3498db','Plug-in Hybrid':'#27ae60','Mild Hybrid':'#1abc9c'};
                    const col = colors[ft.fuel_type]||'#999';
                    return `<div class="mb-2">
                        <div class="d-flex justify-content-between small mb-1">
                            <span class="text-white">${ft.fuel_type}</span><span class="text-muted">${ft.count} (${pct}%)</span>
                        </div>
                        <div style="height:6px;background:rgba(255,255,255,0.07);border-radius:3px">
                            <div style="height:100%;width:${pct}%;background:${col};border-radius:3px;transition:width 0.8s"></div>
                        </div>
                    </div>`;
                }).join('')}
            </div></div>
        </div>
        ${investmentGradeCars.length ? `<div class="admin-card">
            <div class="admin-card-header">📈 Investment Grade Fleet</div>
            <div class="table-responsive"><table class="table admin-table mb-0"><thead><tr>
                <th>Car</th><th>Brand</th><th>Price</th><th>Appreciation</th><th>Units</th><th>Segment</th>
            </tr></thead><tbody>${investmentGradeCars.map(c=>`<tr>
                <td class="text-white fw-semibold">${c.name}</td><td>${c.brand}</td><td>${c.price||'—'}</td>
                <td><span class="text-success fw-bold">${c.appreciation}</span></td>
                <td>${c.production_units?c.production_units.toLocaleString():'Unlimited'}</td>
                <td><small class="text-muted">${c.market_segment||'—'}</small></td>
            </tr>`).join('')}</tbody></table></div>
        </div>` : ''}`;
}

/* ── CHARTS ────────────────────────────────────────────────── */
function initCharts() {
    const gridColor='rgba(255,255,255,0.05)', tickColor='#777';
    const fontOpts={family:'Montserrat',size:11};
    const scaleOpts={x:{ticks:{color:tickColor,font:fontOpts},grid:{color:gridColor}},y:{ticks:{color:tickColor,font:fontOpts},grid:{color:gridColor}}};
    const legendOpts={labels:{color:'#aaa',font:fontOpts}};
    const eCtx = document.getElementById('enquiryChart');
    if (eCtx) {
        if (enquiryChartInst) enquiryChartInst.destroy();
        enquiryChartInst = new Chart(eCtx, { type:'bar', data:{ labels:['Sep','Oct','Nov','Dec','Jan','Feb'],
            datasets:[{label:'Enquiries',data:[2,5,3,8,6,adminEnquiries.length],backgroundColor:'rgba(52,152,219,0.5)',borderColor:'#3498db',borderWidth:1,borderRadius:6}]},
            options:{responsive:true,plugins:{legend:legendOpts},scales:scaleOpts}});
    }
    const vCtx = document.getElementById('visitorsChart');
    if (vCtx) {
        if (visitorsChartInst) visitorsChartInst.destroy();
        visitorsChartInst = new Chart(vCtx, { type:'line', data:{ labels:['Sep','Oct','Nov','Dec','Jan','Feb'],
            datasets:[{label:'Unique Visitors',data:[320,580,410,720,650,480],borderColor:'#2ecc71',backgroundColor:'rgba(46,204,113,0.08)',tension:0.4,fill:true,pointBackgroundColor:'#2ecc71'}]},
            options:{responsive:true,plugins:{legend:legendOpts},scales:scaleOpts}});
    }
    refreshBrandChart();
}

function refreshBrandChart() {
    const bCtx = document.getElementById('brandChart');
    if (!bCtx || !adminInventory.length) return;
    if (brandChartInst) brandChartInst.destroy();
    const brandCounts = {};
    adminInventory.forEach(c => { brandCounts[c.brand]=(brandCounts[c.brand]||0)+1; });
    const palette=['#3498db','#e74c3c','#2ecc71','#f1c40f','#9b59b6','#e67e22','#1abc9c','#e91e63','#00bcd4','#ff5722','#607d8b','#795548'];
    brandChartInst = new Chart(bCtx, { type:'doughnut',
        data:{ labels:Object.keys(brandCounts),
            datasets:[{data:Object.values(brandCounts),backgroundColor:Object.keys(brandCounts).map((_,i)=>palette[i%palette.length]),borderWidth:0}]},
        options:{responsive:true,plugins:{legend:{labels:{color:'#aaa',font:{family:'Montserrat',size:10}}}}}});
}

/* ── DELETE ────────────────────────────────────────────────── */
let pendingDelete = null;

function confirmDelete(type, id) {
    pendingDelete = {type, id};
    const msgs = {car:'Remove this car from inventory?', user:'Delete this user account?', enquiry:'Delete this enquiry?'};
    const msgEl = document.getElementById('confirmDeleteMsg');
    if (msgEl) msgEl.textContent = msgs[type]||'Delete this item?';
    new bootstrap.Modal(document.getElementById('confirmDeleteModal')).show();
}

document.getElementById('confirmDeleteBtn')?.addEventListener('click', async function() {
    if (!pendingDelete) return;
    const {type, id} = pendingDelete;
    try {
        if (type==='car')     { await EdelhausAPI.deleteCar(id);     await loadInventory(); }
        if (type==='user')    { await EdelhausAPI.deleteUser(id);    await loadUsers(); }
        if (type==='enquiry') { await EdelhausAPI.deleteInquiry(id); await loadEnquiries(); }
        updateStatCards();
        bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal'))?.hide();
        showToast('Deleted successfully.', 'danger');
    } catch(err) { showToast(`Delete failed: ${err.message}`, 'danger'); }
    pendingDelete = null;
});

/* ── SETTINGS ──────────────────────────────────────────────── */
async function reseedDatabase() {
    if (!confirm('Reload all 50 vehicles from cars.json into the database?')) return;
    try { const r = await EdelhausAPI.reseedDatabase(); showToast(r.message, 'success'); await loadInventory(); }
    catch(err) { showToast(`Reseed failed: ${err.message}`, 'danger'); }
}

async function clearAllUsers() {
    if (!confirm('Delete ALL users permanently?')) return;
    try {
        const users = await EdelhausAPI.getUsers();
        await Promise.all(users.map(u => EdelhausAPI.deleteUser(u.id)));
        await loadUsers(); updateStatCards(); showToast('All users deleted.', 'danger');
    } catch(err) { showToast(err.message, 'danger'); }
}

/* ── TOAST ─────────────────────────────────────────────────── */
function showToast(message, type='success') {
    const toastEl = document.getElementById('adminToast');
    const msgEl = document.getElementById('adminToastMsg');
    if (!toastEl||!msgEl) return;
    const icons={success:'<i class="bi bi-check-circle-fill text-success me-2"></i>',danger:'<i class="bi bi-x-circle-fill text-danger me-2"></i>',warning:'<i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>'};
    msgEl.innerHTML=(icons[type]||'')+message;
    bootstrap.Toast.getOrCreateInstance(toastEl,{delay:3500}).show();
}

function goToWebsite() { window.location.href='help.html'; }