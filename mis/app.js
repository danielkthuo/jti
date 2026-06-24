const GAS_URL = 'https://script.google.com/macros/s/AKfycbxGq2qZoqpDzEvWXydUIx0aoPbTy7gSvOWSmX5AOkVQTGV-HKBG3Lb32WUfN7K8zsk/exec';

// ════════════════════════════════════════════════
//  BRANDING / CONTACT INFO
// ════════════════════════════════════════════════
const BRAND = {
  name:    'Joshcab Training Institute',
  branch:  'Mwiki Branch',
  phone1:  '0734 080 808',
  phone2:  '0722 699 212',
  email:   'jckmwiki@gmail.com',
  logoUrl: 'images/JTI logo.jpg',
};

// ════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════
let state = {
  students: [], payments: [], courses: [], feeStructures: [],
  invoiceRecords: [],
  services: [], serviceTypes: [], reconciliations: [],
  attendance: [],
  smsLog: [],
  currentPage: 'dashboard', editMode: false, editRegNo: null,
  user: null,
  users: [],
};

// ════════════════════════════════════════════════
//  ROLE PERMISSIONS
// ════════════════════════════════════════════════
const ROLES = {
  Admin:  { register: true,  payment: true,  delete: true,  courses: true,  users: true,  sms: true,  charge: true,  services: true,  servicesManage: true,  reconcile: true  },
  Staff:  { register: true,  payment: true,  delete: false, courses: false, users: false, sms: true,  charge: true,  services: true,  servicesManage: false, reconcile: false },
  Viewer: { register: false, payment: false, delete: false, courses: false, users: false, sms: false, charge: false, services: false, servicesManage: false, reconcile: false },
};

function can(action) {
  if (!state.user) return false;
  return !!ROLES[state.user.role]?.[action];
}

// ════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════
function showLoginPage() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('app-wrapper').style.display = 'none';
  document.getElementById('login-error').textContent = '';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-username').focus();
}

function showAppPage() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app-wrapper').style.display = 'flex';
}

async function submitLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');
  const errEl    = document.getElementById('login-error');

  if (!username || !password) { errEl.textContent = 'Enter username and password.'; return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Signing in&hellip;';
  errEl.textContent = '';

  try {
    const res = await apiPost('login', { username, password });
    if (res.success) {
      state.user = { username: res.username, fullName: res.fullName, role: res.role };
      sessionStorage.setItem('jti_user', JSON.stringify(state.user));
      applyRoleUI();
      showAppPage();
      await loadAll();
    } else {
      errEl.textContent = res.error || 'Login failed.';
    }
  } catch (e) {
    errEl.textContent = 'Connection error. Try again.';
  }

  btn.disabled = false;
  btn.innerHTML = 'Sign In';
}

function logout() {
  state.user = null;
  sessionStorage.removeItem('jti_user');
  showLoginPage();
}

function applyRoleUI() {
  const r = state.user?.role || 'Viewer';

  // Topbar user info
  document.getElementById('topbar-user-name').textContent = state.user?.fullName || '';
  document.getElementById('topbar-user-role').textContent = r;
  document.getElementById('topbar-user-role').className =
    'role-badge role-' + r.toLowerCase();

  // Sidebar items — hide based on role
  document.getElementById('nav-register').style.display  = can('register') ? '' : 'none';
  document.getElementById('nav-users').style.display     = can('users')    ? '' : 'none';
  const svcNav = document.getElementById('nav-services-section');
  if (svcNav) svcNav.style.display = can('services') ? '' : 'none';

  // Hide write buttons across pages (set after render via CSS class on body)
  document.body.setAttribute('data-role', r.toLowerCase());
}

// ════════════════════════════════════════════════
//  USER MANAGEMENT (Admin only)
// ════════════════════════════════════════════════


async function saveUser() {
  if (!can('users')) return;
  const username = document.getElementById('user-username').value.trim();
  const password = document.getElementById('user-password').value.trim();
  const fullName = document.getElementById('user-fullname').value.trim();
  const role     = document.getElementById('user-role').value;
  const status   = document.getElementById('user-status').value;
  const editMode = document.getElementById('user-edit-mode').value === 'true';

  if (!username || (!editMode && !password) || !role) {
    toast('Username, password and role are required.', 'error'); return;
  }

  const payload = { username, role, fullName, status };
  if (password) payload.password = password;

  const action = editMode ? 'updateUser' : 'addUser';
  const res = await apiPost(action, payload);
  if (res.success) {
    toast(editMode ? 'User updated!' : 'User added!', 'success');
    clearUserForm();
    await loadUsersTable();
  } else {
    toast('Error: ' + res.error, 'error');
  }
}

async function deleteUser(username) {
  if (!can('users')) return;
  if (!confirm('Delete user "' + username + '"?')) return;
  const res = await apiPost('deleteUser', { username });
  if (res.success) { toast('User deleted.', 'success'); await loadUsersTable(); }
  else toast('Error: ' + res.error, 'error');
}

function editUserRow(username) {
  const u = state.users.find(x => x.username === username);
  if (!u) return;
  document.getElementById('user-username').value  = u.username;
  document.getElementById('user-fullname').value  = u.fullName;
  document.getElementById('user-role').value      = u.role;
  document.getElementById('user-status').value    = u.status;
  document.getElementById('user-password').value  = '';
  document.getElementById('user-edit-mode').value = 'true';
  document.getElementById('user-form-title').textContent = 'Edit User — ' + u.username;
  document.getElementById('user-password').placeholder = 'Leave blank to keep current';
  document.getElementById('user-save-btn').textContent = 'Update User';
  document.getElementById('user-username').readOnly = true;
}

function clearUserForm() {
  ['user-username','user-password','user-fullname'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('user-role').value   = 'Staff';
  document.getElementById('user-status').value = 'Active';
  document.getElementById('user-edit-mode').value = 'false';
  document.getElementById('user-form-title').textContent = 'Add User';
  document.getElementById('user-password').placeholder = 'Password';
  document.getElementById('user-save-btn').textContent  = 'Add User';
  document.getElementById('user-username').readOnly = false;
}

async function loadUsersTable() {
  const res = await apiPost('getUsers', {});
  state.users = res.data || [];
  renderUsersTable();
}

function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');
  if (!state.users.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted);">No users yet</td></tr>';
    return;
  }
  tbody.innerHTML = state.users.map(u => `
    <tr>
      <td><strong>${u.username}</strong></td>
      <td>${u.fullName || '&mdash;'}</td>
      <td><span class="role-badge role-${u.role.toLowerCase()}">${u.role}</span></td>
      <td><span class="badge ${u.status === 'Active' ? 'badge-success' : 'badge-neutral'}">${u.status}</span></td>
      <td><div class="actions-cell">
        <button class="btn btn-outline btn-sm" onclick="editUserRow('${u.username}')">&#9999; Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.username}')">&#128465;</button>
      </div></td>
    </tr>`).join('');
}

// ════════════════════════════════════════════════
//  API HELPERS
// ════════════════════════════════════════════════
async function api(action, data = {}) {
  const url = new URL(GAS_URL);
  url.searchParams.set('action', action);
  Object.entries(data).forEach(([k, v]) => url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Network error: ' + res.status);
  return res.json();
}

async function apiPost(action, payload) {
  const formData = new FormData();
  formData.append('action', action);
  formData.append('data', JSON.stringify(payload));
  const res = await fetch(GAS_URL, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Network error: ' + res.status);
  return res.json();
}

// ════════════════════════════════════════════════
//  SMS
// ════════════════════════════════════════════════
/**
 * Sends an SMS and asks the backend to log the attempt for the SMS Log.
 * `purpose` is a short tag (e.g. 'welcome', 'receipt', 'defaulter', 'manual')
 * and `context` carries optional regNo/studentName so the log can be
 * traced back to a specific student even after the fact.
 */
async function sendSms(phones, message, purpose, context) {
  const phoneList = Array.isArray(phones) ? phones : [phones];
  const normalised = phoneList
    .map(p => normalizePhone(p))
    .filter(p => p.length >= 9);
  if (!normalised.length) return { success: false, sent: 0, failed: 0 };
  return apiPost('sendSms', {
    phones: normalised,
    message,
    purpose: purpose || 'manual',
    regNo: context?.regNo || '',
    studentName: context?.studentName || '',
    sentBy: state.user?.fullName || state.user?.username || 'System',
  });
}

/**
 * Normalises any common Kenyan phone format into 254XXXXXXXXX:
 * - Strips spaces, dashes, dots, parentheses, and any other non-digit
 *   characters except a leading "+" (handles "0722 123 445", "0722-123-445",
 *   "0722.123.445", "(0722) 123 445", etc.)
 * - Converts a leading 0 to 254 (e.g. 0722123445 -> 254722123445)
 * - Converts a leading 7 or 1 (9-digit, no leading 0) to 254-prefixed
 *   (e.g. 722123445 -> 254722123445)
 * - Leaves an already-254-prefixed or +254-prefixed number as-is
 */
function normalizePhone(p) {
  let digits = String(p).trim().replace(/^\+/, '').replace(/[^\d]/g, '');
  if (digits.startsWith('0')) {
    digits = '254' + digits.slice(1);
  } else if (/^(7|1)\d{8}$/.test(digits)) {
    // 9-digit local number with no leading 0, e.g. "722123445"
    digits = '254' + digits;
  }
  return digits;
}

function buildPaymentSms(payload, receiptNo) {
  return `JTI RECEIPT\nDear ${payload.studentName}, payment of KES ${fmt(payload.amount)} received on ${fmtDate(payload.date).replace(/&mdash;/,'')}.` +
    ` Ref: ${receiptNo}. Balance: KES ${fmt(payload.newBalance)}. -Joshcab Training Institute`;
}
function buildWelcomeSms(student) {
  return `Welcome to Joshcab Training Institute, ${student.fullName.split(' ')[0]}!` +
    ` Reg No: ${student.regNo}. Program: ${student.program || 'N/A'}. We look forward to your success. -JTI Mwiki`;
}
function buildDefaulterSms(student) {
  return `Dear ${student.fullName.split(' ')[0]}, your JTI fee balance is KES ${fmt(student.feeBalance)}.` +
    ` Kindly clear at the earliest. Contact us: ${BRAND.phone1}. -Joshcab Training Institute`;
}

function openSmsModal(regNo) {
  if (!can('sms')) { toast('SMS access not permitted for your role.', 'error'); return; }
  const s = state.students.find(x => x.regNo === regNo);
  if (!s) return;
  document.getElementById('sms-modal-name').textContent = s.fullName;
  document.getElementById('sms-modal-phone').textContent = s.phone || 'No phone';
  document.getElementById('sms-to').value = s.phone || '';
  document.getElementById('sms-body').value = '';
  document.getElementById('sms-char-count').textContent = '0 / 160';
  document.getElementById('sms-send-btn').dataset.regNo = regNo;
  openModal('modal-sms');
}

function updateSmsCharCount() {
  const len = document.getElementById('sms-body').value.length;
  document.getElementById('sms-char-count').textContent = len + ' / 160';
}

function fillSmsTemplate(type) {
  const regNo = document.getElementById('sms-send-btn').dataset.regNo;
  const s = state.students.find(x => x.regNo === regNo);
  if (!s) return;
  let msg = '';
  if (type === 'balance') msg = buildDefaulterSms(s);
  if (type === 'welcome') msg = buildWelcomeSms(s);
  document.getElementById('sms-body').value = msg;
  updateSmsCharCount();
}

async function sendManualSms() {
  const btn     = document.getElementById('sms-send-btn');
  const phone   = document.getElementById('sms-to').value.trim();
  const message = document.getElementById('sms-body').value.trim();
  const regNo   = document.getElementById('sms-send-btn').dataset.regNo || '';
  const student = state.students.find(x => x.regNo === regNo);
  if (!phone || !message) { toast('Phone and message are required.', 'error'); return; }
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Sending&hellip;';
  try {
    const res = await sendSms(phone, message, 'manual', { regNo, studentName: student?.fullName || '' });
    if (res.success) { toast('SMS sent!', 'success'); closeModal('modal-sms'); }
    else toast('SMS failed: ' + (res.error || 'Unknown error'), 'error');
  } catch(e) { toast('SMS error: ' + e.message, 'error'); }
  btn.disabled = false;
  btn.innerHTML = '&#128241; Send SMS';
}

async function sendBulkDefaultersSms() {
  if (!can('sms')) { toast('SMS access not permitted for your role.', 'error'); return; }
  const defaulters = state.students.filter(x => (+x.feeBalance || 0) > 0 && x.phone);
  if (!defaulters.length) { toast('No defaulters with phone numbers found.', 'error'); return; }
  document.getElementById('bulk-sms-count').textContent = defaulters.length;
  document.getElementById('bulk-sms-preview').textContent = buildDefaulterSms(defaulters[0]);
  openModal('modal-bulk-sms');
}

async function confirmBulkSms() {
  const defaulters = state.students.filter(x => (+x.feeBalance || 0) > 0 && x.phone);
  const btn = document.getElementById('bulk-sms-confirm-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Sending to ' + defaulters.length + '&hellip;';
  let sent = 0, failed = 0;
  const batchSize = 10;
  for (let i = 0; i < defaulters.length; i += batchSize) {
    const batch = defaulters.slice(i, i + batchSize);
    await Promise.all(batch.map(async s => {
      try {
        const res = await sendSms(s.phone, buildDefaulterSms(s), 'defaulter', { regNo: s.regNo, studentName: s.fullName });
        res.success ? sent++ : failed++;
      } catch { failed++; }
    }));
  }
  closeModal('modal-bulk-sms');
  toast(`Bulk SMS: ${sent} sent, ${failed} failed.`, sent > 0 ? 'success' : 'error');
  btn.disabled = false;
  btn.innerHTML = '&#128241; Confirm &amp; Send';
}

// ════════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════════
const pageTitles = {
  dashboard:'Dashboard', students:'Students', register:'Register Student',
  fees:'Fee Management', payments:'Payments', invoices:'Invoices',
  courses:'Courses & Programs', services:'Office Services & Reconciliation',
  attendance:'Staff Attendance Register',
  reports:'Reports', users:'User Management',
};

function navigate(page) {
  // Guard role-restricted pages
  if (page === 'register' && !can('register')) { toast('Access denied.', 'error'); return; }
  if (page === 'users'    && !can('users'))    { toast('Access denied.', 'error'); return; }
  if (page === 'services' && !can('services')) { toast('Access denied.', 'error'); return; }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'" + page + "'")) n.classList.add('active');
  });
  document.getElementById('page-title').textContent = pageTitles[page] || page;
  state.currentPage = page;
  if (page === 'register' && !state.editMode) prepRegisterForm();
  if (page === 'fees')       renderFeeOverview();
  if (page === 'payments')   renderPayments();
  if (page === 'invoices')   renderInvoices();
  if (page === 'reports')    renderReports();
  if (page === 'users')      loadUsersTable();
  if (page === 'services')   initServicesPage();
  if (page === 'attendance') initAttendancePage();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

function switchTab(tabId, page) {
  document.querySelectorAll('[id^="tab-fee-"]').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.tabs .tab-btn').forEach(b => { if (b.closest('#page-fees')) b.classList.remove('active'); });
  document.getElementById('tab-' + tabId).style.display = 'block';
  event.target.classList.add('active');
}

// ════════════════════════════════════════════════
//  DATA LOAD  —  fast path + cache
// ════════════════════════════════════════════════

const CACHE_KEY     = 'jti_cache_v2';
const CACHE_TTL_MS  = 5 * 60 * 1000;   // 5 minutes
let   _refreshTimer = null;

/** Apply a data bundle to state and re-render the active page */
function applyData(bundle, renderMode) {
  state.students        = bundle.students || [];
  state.payments        = bundle.payments || [];
  state.courses         = bundle.courses  || [];
  state.invoiceRecords  = bundle.invoices || [];
  state.services        = bundle.services || [];
  state.serviceTypes    = bundle.serviceTypes || [];
  state.reconciliations = bundle.reconciliations || [];
  state.attendance      = bundle.attendance || [];
  populateProgramDropdowns();
  // renderMode 'current' = only active page (background refresh)
  // renderMode 'all'     = every page (first load)
  if (renderMode === 'current') renderCurrentPage();
  else renderAll();
}

/** Render every visible section */
function renderAll() {
  renderDashboard();
  renderStudentsTable();
  renderPayments();
  renderFeeOverview();
  renderInvoices();
  renderReports();
  renderCourses();
  if (state.currentPage === 'services') initServicesPage();
}

/** Render only the currently active page (used on background refresh) */
function renderCurrentPage() {
  const p = state.currentPage;
  if (p === 'dashboard') renderDashboard();
  else if (p === 'students') renderStudentsTable();
  else if (p === 'fees')     renderFeeOverview();
  else if (p === 'payments') renderPayments();
  else if (p === 'invoices') renderInvoices();
  else if (p === 'reports')  renderReports();
  else if (p === 'courses')    renderCourses();
  else if (p === 'services')   { renderServiceTypeGrid(); renderServiceTypesTable(); filterServiceLog(); renderReconciliation(); }
  else if (p === 'attendance') initAttendancePage();
  // Always keep dashboard stats fresh too
  if (p !== 'dashboard') renderDashboard();
}

/** Save bundle to localStorage with timestamp */
function saveCache(bundle) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), bundle }));
  } catch(_) {}
}

/** Load bundle from localStorage; returns null if missing or expired */
function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, bundle } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return bundle;
  } catch(_) { return null; }
}

/** Fetch fresh data from GAS — single round-trip via getAll */
async function fetchFresh(silent = false) {
  if (!silent) setStatus('&#128260; Syncing&hellip;');
  const res = await api('getAll');
  if (!res.success) throw new Error(res.error || 'getAll failed');
  const bundle = {
    students:        res.students        || [],
    payments:        res.payments        || [],
    courses:         res.courses         || [],
    invoices:        res.invoices        || [],
    services:        res.services        || [],
    serviceTypes:    res.serviceTypes    || [],
    reconciliations: res.reconciliations || [],
    attendance:      res.attendance      || [],
  };
  saveCache(bundle);
  return bundle;
}

/** Primary load — show cached data instantly, then refresh from network */
async function loadAll(forceFull = false) {
  const cached = loadCache();

  if (cached && !forceFull) {
    // ① Render cached data immediately — zero wait
    applyData(cached);
    setStatus('&#128993; Cached');

    // ② Fetch fresh in background without blocking UI
    fetchFresh(true)
      .then(bundle => {
        applyData(bundle, 'current');
        setStatus('&#128994; Connected');
        scheduleAutoRefresh();
      })
      .catch(e => {
        setStatus('&#128308; Offline (cached)');
        console.warn('Background refresh failed:', e);
      });
  } else {
    // No cache — must wait for network
    setStatus('&#128260; Loading&hellip;');
    try {
      const bundle = await fetchFresh(false);
      applyData(bundle, 'all');
      setStatus('&#128994; Connected');
      scheduleAutoRefresh();
    } catch(e) {
      setStatus('&#128308; Offline');
      toast('Failed to connect. Check your Apps Script URL.', 'error');
      console.error(e);
    }
  }
}

/** Silent background refresh — only re-renders active page */
async function silentRefresh() {
  try {
    const bundle = await fetchFresh(true);
    applyData(bundle, 'current');
    setStatus('&#128994; Connected');
  } catch(e) {
    setStatus('&#128308; Offline');
  }
}

/** Auto-refresh every 5 minutes while app is open */
function scheduleAutoRefresh() {
  clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(async () => {
    await silentRefresh();
    scheduleAutoRefresh();
  }, CACHE_TTL_MS);
}

/** Call after any write operation — clears cache and reloads */
let _reloadDebounce = null;
function reloadAfterWrite() {
  clearTimeout(_reloadDebounce);
  _reloadDebounce = setTimeout(() => {
    try { localStorage.removeItem(CACHE_KEY); } catch(_) {}
    loadAll(true).then(() => renderAll());  // full render after write
  }, 300);
}

function setStatus(msg) { document.getElementById('sync-status').innerHTML = msg; }

// ════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════
function renderDashboard() {
  const s = state.students;
  const active    = s.filter(x => x.status === 'Active').length;
  const totalPaid = s.reduce((a, x) => a + (+x.amountPaid || 0), 0);
  const totalBal  = s.reduce((a, x) => a + (+x.feeBalance || 0), 0);
  document.getElementById('stat-total').textContent       = s.length;
  document.getElementById('stat-active').textContent      = active;
  document.getElementById('stat-collected').textContent   = 'KES ' + fmt(totalPaid);
  document.getElementById('stat-outstanding').textContent = 'KES ' + fmt(totalBal);

  const now = new Date(), curYear = now.getFullYear(), curMonth = now.getMonth();
  const isThisMonth = d => { if (!d) return false; const dt = new Date(d); return !isNaN(dt) && dt.getFullYear() === curYear && dt.getMonth() === curMonth; };
  const todayKey = dateKey(now);

  // ── Today's combined revenue (fees + office services) ──
  document.getElementById('dash-today-label').textContent =
    now.toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' });

  const todayPayments = state.payments.filter(p => dateKey(p.date) === todayKey);
  const todayServices = state.services.filter(sv => dateKey(sv.date) === todayKey);
  const todayFeesTotal     = todayPayments.reduce((a, p) => a + (+p.amount || 0), 0);
  const todayServicesTotal = todayServices.reduce((a, sv) => a + (+sv.amount || 0), 0);
  const todayCombinedTotal = todayFeesTotal + todayServicesTotal;

  document.getElementById('stat-today-total').textContent    = 'KES ' + fmt(todayCombinedTotal);
  document.getElementById('stat-today-fees').textContent     = 'KES ' + fmt(todayFeesTotal);
  document.getElementById('stat-today-services').textContent = 'KES ' + fmt(todayServicesTotal);
  document.getElementById('stat-today-txcount').textContent  = todayPayments.length + todayServices.length;

  document.getElementById('dash-month-label').textContent =
    now.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });

  const monthEnrollments = s.filter(x => isThisMonth(x.enrollDate));
  document.getElementById('stat-month-enrollments').textContent = monthEnrollments.length;

  const monthPayments  = state.payments.filter(p => isThisMonth(p.date));
  const monthCollected = monthPayments.reduce((a, p) => a + (+p.amount || 0), 0);
  document.getElementById('stat-month-collected').textContent = 'KES ' + fmt(monthCollected);
  const avgPayment = monthPayments.length ? monthCollected / monthPayments.length : 0;
  document.getElementById('stat-month-avg').textContent = 'KES ' + fmt(Math.round(avgPayment));

  const monthServices      = state.services.filter(sv => isThisMonth(sv.date));
  const monthServicesTotal = monthServices.reduce((a, sv) => a + (+sv.amount || 0), 0);
  document.getElementById('stat-month-services').textContent = 'KES ' + fmt(monthServicesTotal);

  const rec = [...monthEnrollments].sort((a,b) => new Date(b.enrollDate) - new Date(a.enrollDate)).slice(0,5);
  document.getElementById('recent-enrollments').innerHTML = rec.length
    ? `<table style="width:100%;font-size:13px;">${rec.map(s=>`<tr>
        <td style="padding:10px 14px;border-bottom:1px solid var(--cream-dk);">
          <div style="font-weight:600;">${s.fullName}</div>
          <div style="font-size:11.5px;color:var(--muted);">${s.program||''}</div>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid var(--cream-dk);text-align:right;">
          <span class="badge ${s.status==='Active'?'badge-success':'badge-neutral'}">${s.status}</span>
        </td></tr>`).join('')}</table>`
    : '<div class="empty-state"><div class="empty-icon">&#127891;</div><p>No new enrollments this month</p></div>';

  const rp = [...monthPayments].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,5);
  document.getElementById('recent-payments').innerHTML = rp.length
    ? `<table style="width:100%;font-size:13px;">${rp.map(p=>`<tr>
        <td style="padding:10px 14px;border-bottom:1px solid var(--cream-dk);">
          <div style="font-weight:600;">${p.studentName}</div>
          <div style="font-size:11.5px;color:var(--muted);">${fmtDate(p.date)} &middot; ${p.method}</div>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid var(--cream-dk);text-align:right;font-weight:700;color:var(--success);">
          + KES ${fmt(p.amount)}
        </td></tr>`).join('')}</table>`
    : '<div class="empty-state"><div class="empty-icon">&#128179;</div><p>No payments recorded this month</p></div>';

  const rs = [...monthServices].sort((a,b) => new Date(b.createdAt||b.date) - new Date(a.createdAt||a.date)).slice(0,5);
  const recentServicesEl = document.getElementById('recent-services');
  if (recentServicesEl) {
    recentServicesEl.innerHTML = rs.length
      ? `<table style="width:100%;font-size:13px;">${rs.map(sv=>`<tr>
          <td style="padding:10px 14px;border-bottom:1px solid var(--cream-dk);">
            <div style="font-weight:600;">${sv.serviceType}${sv.customer ? ' &middot; ' + sv.customer : ''}</div>
            <div style="font-size:11.5px;color:var(--muted);">${fmtDate(sv.date)} &middot; ${sv.method} &middot; ${sv.recordedBy||''}</div>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid var(--cream-dk);text-align:right;font-weight:700;color:var(--info);">
            + KES ${fmt(sv.amount)}
          </td></tr>`).join('')}</table>`
      : '<div class="empty-state"><div class="empty-icon">&#128424;</div><p>No office services recorded this month</p></div>';
  }
}

// ════════════════════════════════════════════════
//  STUDENTS
// ════════════════════════════════════════════════
function renderStudentsTable(filtered) {
  const data  = filtered || state.students;
  const tbody = document.getElementById('students-tbody');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);">No students found</td></tr>'; return; }
  tbody.innerHTML = data.map(s => `
    <tr>
      <td><strong>${s.regNo}</strong></td>
      <td>${s.fullName}</td>
      <td>${s.program||'&mdash;'}</td>
      <td>${fmtIntake(s.intake)}</td>
      <td>${s.phone||'&mdash;'}</td>
      <td><span class="badge ${statusBadge(s.status)}">${s.status||'Active'}</span></td>
      <td style="font-weight:600;color:${+s.feeBalance>0?'var(--danger)':'var(--success)'};">KES ${fmt(s.feeBalance)}</td>
      <td><div class="actions-cell">
        <button class="btn btn-outline btn-sm" onclick="viewStudent('${s.regNo}')">&#128065; View</button>
        ${can('register') ? `<button class="btn btn-primary btn-sm" onclick="editStudent('${s.regNo}')">&#9999;</button>` : ''}
        ${can('payment')  ? `<button class="btn btn-gold btn-sm" onclick="quickPay('${s.regNo}')">&#128176;</button>` : ''}
        ${can('sms')      ? `<button class="btn btn-sms btn-sm" onclick="openSmsModal('${s.regNo}')" title="SMS">&#128241;</button>` : ''}
        ${can('delete')   ? `<button class="btn btn-danger btn-sm" onclick="deleteStudentRecord('${s.regNo}')" title="Delete">&#128465;</button>` : ''}
      </div></td>
    </tr>`).join('');
}

function filterStudents() {
  const q    = document.getElementById('student-search').value.toLowerCase();
  const prog = document.getElementById('filter-program').value;
  const stat = document.getElementById('filter-status').value;
  const filtered = state.students.filter(s => {
    const mq = !q || [s.fullName,s.regNo,s.phone,s.email].some(v=>v&&v.toLowerCase().includes(q));
    return mq && (!prog || s.program === prog) && (!stat || s.status === stat);
  });
  renderStudentsTable(filtered);
}

function prepRegisterForm() {
  state.editMode = false; state.editRegNo = null;
  document.getElementById('reg-form-title').textContent = 'Register New Student';
  document.getElementById('reg-submit-btn').innerHTML   = '<span>&#128190;</span> Register Student';
  clearRegForm();
  document.getElementById('enroll-date').value = new Date().toISOString().split('T')[0];
  generateRegNo();
}

function generateRegNo() {
  const yr    = new Date().getFullYear().toString().slice(-2);
  // Use max numeric suffix from existing regNos to avoid collision after deletions
  const nums  = state.students
    .map(s => { const m = s.regNo.match(/\/(\d+)$/); return m ? +m[1] : 0; })
    .filter(n => !isNaN(n));
  const next  = nums.length ? Math.max(...nums) + 1 : 1;
  document.getElementById('reg-no').value = `JTI/${yr}/${String(next).padStart(4,'0')}`;
}

function clearRegForm() {
  ['full-name','national-id','dob','phone','email','county','intake','notes','guardian','total-fee','amount-paid','fee-balance']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('gender').value  = '';
  document.getElementById('program').value = '';
  document.getElementById('status').value  = 'Active';
}

function updateFeeBalance() {
  const total = +document.getElementById('total-fee').value || 0;
  const paid  = +document.getElementById('amount-paid').value || 0;
  document.getElementById('fee-balance').value = Math.max(0, total - paid);
}

async function submitStudent() {
  if (!can('register')) { toast('Access denied.', 'error'); return; }
  const btn = document.getElementById('reg-submit-btn');
  const payload = {
    regNo:      state.editMode ? state.editRegNo : document.getElementById('reg-no').value,
    fullName:   document.getElementById('full-name').value.trim(),
    nationalId: document.getElementById('national-id').value.trim(),
    dob:        document.getElementById('dob').value,
    gender:     document.getElementById('gender').value,
    phone:      document.getElementById('phone').value.trim(),
    email:      document.getElementById('email').value.trim(),
    county:     document.getElementById('county').value.trim(),
    program:    document.getElementById('program').value,
    intake:     document.getElementById('intake').value.trim(),
    enrollDate: document.getElementById('enroll-date').value,
    status:     document.getElementById('status').value,
    totalFee:   +document.getElementById('total-fee').value || 0,
    amountPaid: +document.getElementById('amount-paid').value || 0,
    feeBalance: +document.getElementById('fee-balance').value || 0,
    guardian:   document.getElementById('guardian').value.trim(),
    notes:      document.getElementById('notes').value.trim(),
  };
  if (!payload.fullName || !payload.phone) { toast('Full Name and Phone are required.', 'error'); return; }
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Saving&hellip;';
  try {
    const res = await apiPost(state.editMode ? 'updateStudent' : 'addStudent', payload);
    if (res.success) {
      toast(state.editMode ? 'Student updated!' : 'Student registered!', 'success');
      if (!state.editMode && payload.phone && can('sms')) {
        sendSms(payload.phone, buildWelcomeSms(payload), 'welcome', { regNo: payload.regNo, studentName: payload.fullName })
          .then(r => r.success ? toast('Welcome SMS sent.', 'success') : null)
          .catch(() => {});
      }
      reloadAfterWrite(); clearRegForm();
      if (!state.editMode) generateRegNo();
      if (state.editMode) navigate('students');
    } else toast('Error: ' + (res.error||'Unknown error'), 'error');
  } catch(e) { toast('Failed to save: ' + e.message, 'error'); }
  btn.disabled = false;
  btn.innerHTML = '<span>&#128190;</span> ' + (state.editMode ? 'Update Student' : 'Register Student');
}

function viewStudent(regNo) {
  const s = state.students.find(x => x.regNo === regNo);
  if (!s) return;
  const pct = s.totalFee > 0 ? Math.min(100, Math.round((s.amountPaid/s.totalFee)*100)) : 0;
  document.getElementById('modal-student-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
      ${infoRow('Reg No.',s.regNo)} ${infoRow('Full Name',s.fullName)}
      ${infoRow('National ID',s.nationalId||'&mdash;')} ${infoRow('Date of Birth',fmtDate(s.dob))}
      ${infoRow('Gender',s.gender||'&mdash;')} ${infoRow('Phone',s.phone||'&mdash;')}
      ${infoRow('Email',s.email||'&mdash;')} ${infoRow('County',s.county||'&mdash;')}
      ${infoRow('Program',s.program||'&mdash;')} ${infoRow('Intake',fmtIntake(s.intake))}
      ${infoRow('Enroll Date',fmtDate(s.enrollDate))} ${infoRow('Status',`<span class="badge ${statusBadge(s.status)}">${s.status}</span>`)}
    </div>
    <div style="background:var(--cream);border-radius:8px;padding:16px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
        <div><div style="font-size:12px;color:var(--muted);">Total Fee</div><div style="font-family:var(--font-h);font-size:18px;font-weight:700;">KES ${fmt(s.totalFee)}</div></div>
        <div><div style="font-size:12px;color:var(--muted);">Amount Paid</div><div style="font-family:var(--font-h);font-size:18px;font-weight:700;color:var(--success);">KES ${fmt(s.amountPaid)}</div></div>
        <div><div style="font-size:12px;color:var(--muted);">Balance</div><div style="font-family:var(--font-h);font-size:18px;font-weight:700;color:${+s.feeBalance>0?'var(--danger)':'var(--success)'};">KES ${fmt(s.feeBalance)}</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="progress-bar" style="flex:1;"><div class="progress-fill ${pct===100?'success':pct<50?'danger':''}" style="width:${pct}%;"></div></div>
        <span style="font-weight:700;font-size:13px;">${pct}%</span>
      </div>
    </div>
    ${s.guardian?`<div style="font-size:13px;"><strong>Guardian:</strong> ${s.guardian}</div>`:''}
    ${s.notes?`<div style="margin-top:8px;font-size:13px;color:var(--muted);">${s.notes}</div>`:''}`;
  document.getElementById('modal-edit-btn').style.display         = can('register') ? '' : 'none';
  document.getElementById('modal-sms-student-btn').style.display  = can('sms')      ? '' : 'none';
  document.getElementById('modal-charge-student-btn').style.display = can('charge') ? '' : 'none';
  document.getElementById('modal-delete-student-btn').style.display = can('delete') ? '' : 'none';
  document.getElementById('modal-edit-btn').onclick = () => { closeModal('modal-student'); editStudent(regNo); };
  document.getElementById('modal-sms-student-btn').onclick = () => { closeModal('modal-student'); openSmsModal(regNo); };
  document.getElementById('modal-charge-student-btn').onclick = () => { closeModal('modal-student'); openChargeModal(regNo); };
  document.getElementById('modal-delete-student-btn').onclick = () => { deleteStudentRecord(regNo); };
  openModal('modal-student');
}

function infoRow(label, value) {
  return `<div><div style="font-size:11.5px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px;">${label}</div><div style="font-size:13.5px;margin-top:3px;">${value}</div></div>`;
}

function editStudent(regNo) {
  if (!can('register')) { toast('Access denied.', 'error'); return; }
  const s = state.students.find(x => x.regNo === regNo);
  if (!s) return;
  state.editMode = true; state.editRegNo = regNo;
  navigate('register');
  document.getElementById('reg-form-title').innerHTML = 'Edit Student &mdash; ' + s.regNo;
  document.getElementById('reg-submit-btn').innerHTML = '<span>&#128190;</span> Update Student';
  document.getElementById('reg-no').value      = s.regNo;
  document.getElementById('full-name').value   = s.fullName||'';
  document.getElementById('national-id').value = s.nationalId||'';
  document.getElementById('dob').value         = toDateInputValue(s.dob);
  document.getElementById('gender').value      = s.gender||'';
  document.getElementById('phone').value       = s.phone||'';
  document.getElementById('email').value       = s.email||'';
  document.getElementById('county').value      = s.county||'';
  document.getElementById('program').value     = s.program||'';
  document.getElementById('intake').value      = (function(){ const dt=new Date(s.intake); return isNaN(dt) ? (s.intake||'') : fmtIntake(s.intake).replace(/&mdash;/,''); })();
  document.getElementById('enroll-date').value = toDateInputValue(s.enrollDate);
  document.getElementById('status').value      = s.status||'Active';
  document.getElementById('total-fee').value   = s.totalFee||'';
  document.getElementById('amount-paid').value = s.amountPaid||'';
  document.getElementById('fee-balance').value = s.feeBalance||'';
  document.getElementById('guardian').value    = s.guardian||'';
  document.getElementById('notes').value       = s.notes||'';
}

// ── Admin: Delete student record (duty segregation) ───────
// Staff can register and edit students but cannot delete them — only
// Admin (the existing `delete` permission). Because deleting a student
// can orphan their payment/invoice/service history, the prompt clearly
// surfaces how much history exists before asking for a reason. The full
// record is archived to DeletedStudents before removal, matching the
// pattern already used for Payments and Services.

function deleteStudentRecord(regNo) {
  if (!can('delete')) { toast('Only an Admin can delete student records.', 'error'); return; }
  const s = state.students.find(x => x.regNo === regNo);
  if (!s) return;

  const paymentCount = state.payments.filter(p => p.regNo === regNo).length;
  const serviceTxCount = 0; // services are not linked to students by regNo
  const invoiceCount = state.invoiceRecords.filter(i => i.regNo === regNo).length;
  const balance = +s.feeBalance || 0;

  let warningLines = [`Delete student ${s.fullName} (${regNo})?`, ''];
  if (paymentCount > 0) warningLines.push(`\u26A0\uFE0F This student has ${paymentCount} payment record(s) on file.`);
  if (invoiceCount > 0) warningLines.push(`\u26A0\uFE0F This student has ${invoiceCount} invoice/charge record(s) on file.`);
  if (balance > 0) warningLines.push(`\u26A0\uFE0F This student has an outstanding balance of KES ${fmt(balance)}.`);
  warningLines.push('');
  warningLines.push('The student record will be archived (not permanently erased) and removed from active lists.');
  warningLines.push('');
  warningLines.push('Enter a reason for this deletion (required for audit log):');

  const reason = prompt(warningLines.join('\n'));
  if (reason === null) return; // cancelled
  if (!reason.trim()) { toast('A reason is required to delete a student record.', 'error'); return; }

  deleteStudentConfirmed(regNo, reason.trim());
}

async function deleteStudentConfirmed(regNo, reason) {
  try {
    const res = await apiPost('deleteStudent', {
      regNo,
      deletedBy: state.user?.fullName || state.user?.username || 'Admin',
      deleteReason: reason,
    });
    if (res.success) {
      toast('Student record deleted and archived.', 'success');
      closeModal('modal-student');
      reloadAfterWrite();
    } else toast('Error: ' + (res.error || 'Unknown'), 'error');
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
}

// ════════════════════════════════════════════════
//  FEE MANAGEMENT
// ════════════════════════════════════════════════
function renderFeeOverview(filtered) {
  const data = filtered || state.students;
  const totalPaid = data.reduce((a,x)=>a+(+x.amountPaid||0),0);
  const totalBal  = data.reduce((a,x)=>a+(+x.feeBalance||0),0);
  const fullyPaid = data.filter(x=>(+x.feeBalance||0)===0&&(+x.totalFee||0)>0).length;
  const withBal   = data.filter(x=>(+x.feeBalance||0)>0).length;
  document.getElementById('fee-total-collected').textContent   = 'KES ' + fmt(totalPaid);
  document.getElementById('fee-total-outstanding').textContent = 'KES ' + fmt(totalBal);
  document.getElementById('fee-fully-paid').textContent        = fullyPaid;
  document.getElementById('fee-with-balance').textContent      = withBal;
  const tbody = document.getElementById('fee-overview-tbody');
  if (!data.length) { tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted);">No students</td></tr>'; return; }
  tbody.innerHTML = data.map(s => {
    const pct = s.totalFee>0?Math.min(100,Math.round((s.amountPaid/s.totalFee)*100)):0;
    const feeStatus = pct===100?'paid':pct===0?'unpaid':'partial';
    const badge     = pct===100?'badge-success':pct===0?'badge-danger':'badge-warning';
    return `<tr>
      <td><strong>${s.regNo}</strong></td><td>${s.fullName}</td><td>${s.program||'&mdash;'}</td>
      <td>KES ${fmt(s.totalFee)}</td>
      <td style="color:var(--success);font-weight:600;">KES ${fmt(s.amountPaid)}</td>
      <td style="color:${+s.feeBalance>0?'var(--danger)':'var(--success)'};font-weight:600;">KES ${fmt(s.feeBalance)}</td>
      <td style="min-width:120px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div class="progress-bar" style="flex:1;"><div class="progress-fill ${pct===100?'success':pct<40?'danger':''}" style="width:${pct}%;"></div></div>
          <span style="font-size:11px;font-weight:600;">${pct}%</span>
        </div>
      </td>
      <td><span class="badge ${badge}">${feeStatus}</span></td>
      <td><div class="actions-cell">
        ${can('payment') ? `<button class="btn btn-gold btn-sm" onclick="quickPay('${s.regNo}')">&#128176; Pay</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="printStudentInvoice('${s.regNo}')">&#128196;</button>
        ${can('sms') ? `<button class="btn btn-sms btn-sm" onclick="openSmsModal('${s.regNo}')">&#128241;</button>` : ''}
      </div></td></tr>`;
  }).join('');
}

function filterFeeTable() {
  const prog = document.getElementById('fee-filter-program').value;
  const stat = document.getElementById('fee-filter-status').value;
  const filtered = state.students.filter(s => {
    const mp  = !prog || s.program === prog;
    const pct = s.totalFee>0?Math.round((s.amountPaid/s.totalFee)*100):0;
    const fs  = pct===100?'paid':pct===0?'unpaid':'partial';
    return mp && (!stat || fs === stat);
  });
  renderFeeOverview(filtered);
}

function populatePayStudentDropdown() {
  const sel = document.getElementById('pay-student');
  if (!sel) return;
  sel.innerHTML = '<option value="">Choose student&hellip;</option>' +
    state.students.map(s=>`<option value="${s.regNo}">${s.regNo} — ${s.fullName}</option>`).join('');
}

function onStudentSelect() {
  const regNo = document.getElementById('pay-student').value;
  const s     = state.students.find(x=>x.regNo===regNo);
  const box   = document.getElementById('student-fee-info');
  if (!s) { box.style.display='none'; return; }
  box.style.display='block';
  document.getElementById('pay-avatar').textContent       = s.fullName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('pay-student-name').textContent = s.fullName;
  document.getElementById('pay-program-name').textContent = (s.program||'') + ' · ' + fmtIntake(s.intake).replace('&mdash;','—');
  document.getElementById('pay-balance').textContent      = 'KES ' + fmt(s.feeBalance);
  calcNewBalance();
}

function calcNewBalance() {
  const regNo = document.getElementById('pay-student').value;
  const s     = state.students.find(x=>x.regNo===regNo);
  if (!s) return;
  const paying = +document.getElementById('pay-amount').value || 0;
  document.getElementById('pay-new-balance').value = Math.max(0,(+s.feeBalance||0)-paying);
}

function quickPay(regNo) {
  if (!can('payment')) { toast('Access denied.', 'error'); return; }
  navigate('fees');
  switchTabById('tab-fee-record');
  setTimeout(() => {
    document.getElementById('pay-student').value = regNo;
    onStudentSelect();
    document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];
  }, 100);
}

function switchTabById(tabId) {
  document.querySelectorAll('[id^="tab-fee-"]').forEach(t=>t.style.display='none');
  document.getElementById(tabId).style.display='block';
  document.querySelectorAll('#page-fees .tab-btn').forEach((b,i)=>{
    b.classList.toggle('active',(tabId==='tab-fee-overview'&&i===0)||(tabId==='tab-fee-record'&&i===1)||(tabId==='tab-fee-structures'&&i===2));
  });
}

async function submitPayment() {
  if (!can('payment')) { toast('Access denied.', 'error'); return; }
  const btn    = document.getElementById('submit-payment-btn');
  const regNo  = document.getElementById('pay-student').value;
  const amount = +document.getElementById('pay-amount').value;
  if (!regNo||!amount) { toast('Select student and enter amount.','error'); return; }
  const s = state.students.find(x=>x.regNo===regNo);
  const payload = {
    regNo, amount,
    date:        document.getElementById('pay-date').value || new Date().toISOString().split('T')[0],
    method:      document.getElementById('pay-method').value,
    ref:         document.getElementById('pay-ref').value.trim(),
    remarks:     document.getElementById('pay-remarks').value.trim(),
    newBalance:  Math.max(0,(+s.feeBalance||0)-amount),
    studentName: s.fullName, program: s.program,
  };
  btn.disabled=true; btn.innerHTML='<span class="loader"></span> Processing&hellip;';
  try {
    const res = await apiPost('recordPayment', payload);
    if (res.success) {
      toast('Payment recorded!','success');
      const receiptNo = res.receiptNo || ('RCP'+Date.now().toString().slice(-6));
      if (s.phone && can('sms')) {
        sendSms(s.phone, buildPaymentSms(payload, receiptNo), 'receipt', { regNo: s.regNo, studentName: s.fullName })
          .then(r => r.success ? toast('Receipt SMS sent.', 'success') : null)
          .catch(() => {});
      }
      reloadAfterWrite();
      showReceipt(payload, receiptNo);
      clearPayForm();
    } else toast('Error: '+(res.error||'Unknown'),'error');
  } catch(e) { toast('Failed: '+e.message,'error'); }
  btn.disabled=false;
  btn.innerHTML='&#128176; Record Payment &amp; Print Receipt';
}

function clearPayForm() {
  ['pay-student','pay-amount','pay-new-balance','pay-ref','pay-remarks'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('student-fee-info').style.display='none';
}

// ════════════════════════════════════════════════
//  PAYMENTS
// ════════════════════════════════════════════════
function renderPayments(filtered) {
  const data  = filtered || state.payments;
  document.getElementById('payments-count').textContent = data.length + ' records';
  const tbody = document.getElementById('payments-tbody');
  if (!data.length) { tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted);">No payments recorded yet</td></tr>'; return; }
  tbody.innerHTML = [...data].sort((a,b)=>new Date(b.date)-new Date(a.date)).map((p,i)=>`
    <tr>
      <td>${data.length-i}</td>
      <td>${fmtDate(p.date)}</td>
      <td><strong>${p.studentName}</strong><br><small style="color:var(--muted);">${p.regNo}</small></td>
      <td>${p.program||'&mdash;'}</td>
      <td style="font-weight:700;color:var(--success);">KES ${fmt(p.amount)}${p.editedAt ? '<br><span class="badge badge-warning" style="margin-top:3px;" title="Edited by '+(p.editedBy||'Admin')+' on '+fmtDate(p.editedAt)+'">&#9999; Edited</span>' : ''}</td>
      <td><span class="badge badge-info">${p.method}</span></td>
      <td style="font-size:12px;color:var(--muted);">${p.ref||'&mdash;'}</td>
      <td style="color:${+p.newBalance>0?'var(--warning)':'var(--success)'};">KES ${fmt(p.newBalance)}</td>
      <td><div class="actions-cell">
        <button class="btn btn-outline btn-sm" onclick="showReceiptById('${p.receiptNo||p.regNo+p.date}')">&#129534;</button>
        ${can('delete') ? `<button class="btn btn-primary btn-sm" onclick="openEditPaymentModal('${p.receiptNo}')">&#9999;</button>` : ''}
        ${can('delete') ? `<button class="btn btn-danger btn-sm" onclick="deletePaymentTransaction('${p.receiptNo}')">&#128465;</button>` : ''}
      </div></td>
    </tr>`).join('');
}

function filterPayments() {
  const q   = document.getElementById('pay-search').value.toLowerCase();
  const mon = document.getElementById('pay-month-filter').value;
  renderPayments(state.payments.filter(p=>{
    const mq=!q||[p.studentName,p.regNo,p.ref,p.method].some(v=>v&&v.toLowerCase().includes(q));
    return mq && (!mon||(p.date&&p.date.startsWith(mon)));
  }));
}


/** Look up a payment from state by receiptNo and show it */
function showReceiptById(key) {
  const p = state.payments.find(x => (x.receiptNo || x.regNo + x.date) === key);
  if (!p) { toast('Receipt not found.', 'error'); return; }
  showReceipt(p, p.receiptNo || '');
}

// ── Admin: Edit / Delete payments (duty segregation) ──────
// Staff can record payments but cannot edit or delete them once saved —
// only Admin (the existing `delete` permission) can correct or remove a
// payment, and every change is logged with who/when/why. Because a
// payment's amount feeds the student's running balance, the backend
// reverses the old amount and re-applies the new one rather than just
// overwriting the row.

function openEditPaymentModal(receiptNo) {
  if (!can('delete')) { toast('Only an Admin can edit payments.', 'error'); return; }
  const p = state.payments.find(x => x.receiptNo === receiptNo);
  if (!p) { toast('Payment not found.', 'error'); return; }

  document.getElementById('epay-receipt-no').value      = p.receiptNo;
  document.getElementById('epay-receipt-display').value = p.receiptNo;
  document.getElementById('epay-student-display').value = p.studentName + ' (' + p.regNo + ')';
  document.getElementById('epay-amount').value           = p.amount || '';
  document.getElementById('epay-method').value            = p.method || 'Cash';
  document.getElementById('epay-date').value               = toDateInputValue(p.date) || p.date;
  document.getElementById('epay-ref').value                 = p.ref || '';
  document.getElementById('epay-remarks').value             = p.remarks || '';
  document.getElementById('epay-reason').value              = '';
  openModal('modal-edit-payment');
}

async function saveEditedPayment() {
  if (!can('delete')) { toast('Only an Admin can edit payments.', 'error'); return; }

  const receiptNo = document.getElementById('epay-receipt-no').value;
  const amount    = +document.getElementById('epay-amount').value;
  const reason    = document.getElementById('epay-reason').value.trim();

  if (!amount || amount <= 0) { toast('Enter a valid amount.', 'error'); return; }
  if (!reason) { toast('A reason for the edit is required (audit log).', 'error'); return; }

  const payload = {
    receiptNo,
    amount,
    method:     document.getElementById('epay-method').value,
    date:       document.getElementById('epay-date').value,
    ref:        document.getElementById('epay-ref').value.trim(),
    remarks:    document.getElementById('epay-remarks').value.trim(),
    editReason: reason,
    editedBy:   state.user?.fullName || state.user?.username || 'Admin',
  };

  const btn = document.getElementById('epay-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Saving&hellip;';
  try {
    const res = await apiPost('updatePayment', payload);
    if (res.success) {
      toast('Payment updated and logged. Student balance adjusted.', 'success');
      closeModal('modal-edit-payment');
      reloadAfterWrite();
    } else toast('Error: ' + (res.error || 'Unknown'), 'error');
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
  btn.disabled = false;
  btn.innerHTML = '&#128190; Save Changes';
}

async function deletePaymentTransaction(receiptNo) {
  if (!can('delete')) { toast('Only an Admin can delete payments.', 'error'); return; }
  const p = state.payments.find(x => x.receiptNo === receiptNo);
  if (!p) return;
  const reason = prompt(`Delete payment ${receiptNo} (KES ${fmt(p.amount)} from ${p.studentName})?\n\nThis will reverse the amount from the student's balance. Enter a reason for this deletion (required for audit log):`);
  if (reason === null) return; // cancelled
  if (!reason.trim()) { toast('A reason is required to delete a payment.', 'error'); return; }

  try {
    const res = await apiPost('deletePayment', {
      receiptNo,
      deletedBy: state.user?.fullName || state.user?.username || 'Admin',
      deleteReason: reason.trim(),
    });
    if (res.success) { toast('Payment deleted. Student balance reversed.', 'success'); reloadAfterWrite(); }
    else toast('Error: ' + (res.error || 'Unknown'), 'error');
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
}

function showReceipt(p, rcpNo) {
  document.getElementById('modal-receipt-body').innerHTML = `
    <div class="receipt-wrap" id="receipt-print-area">
      ${receiptBrandHeaderHtml('Official Payment Receipt')}
      <hr class="receipt-divider">
      <div class="receipt-row"><span class="rl">Receipt No.</span><span class="rr">${rcpNo||'&mdash;'}</span></div>
      <div class="receipt-row"><span class="rl">Date</span><span class="rr">${fmtDate(p.date)}</span></div>
      <hr class="receipt-divider">
      <div class="receipt-row"><span class="rl">Student</span><span class="rr">${p.studentName}</span></div>
      <div class="receipt-row"><span class="rl">Reg. No.</span><span class="rr">${p.regNo}</span></div>
      <div class="receipt-row"><span class="rl">Program</span><span class="rr">${p.program||'&mdash;'}</span></div>
      <hr class="receipt-divider">
      <div class="receipt-row"><span class="rl">Payment Method</span><span class="rr">${p.method}</span></div>
      <div class="receipt-row"><span class="rl">Reference</span><span class="rr">${p.ref||'&mdash;'}</span></div>
      ${p.remarks?`<div class="receipt-row"><span class="rl">Remarks</span><span class="rr">${p.remarks}</span></div>`:''}
      <div class="receipt-total"><span>Amount Received</span><span>KES ${fmt(p.amount)}</span></div>
      <div class="receipt-row" style="margin-top:10px;"><span class="rl">Balance Remaining</span><span class="rr" style="color:${+p.newBalance>0?'var(--danger)':'var(--success)'};">KES ${fmt(p.newBalance)}</span></div>
      <div class="receipt-stamp">This is an official receipt from ${BRAND.name}<br>Printed: ${new Date().toLocaleDateString('en-KE',{day:'2-digit',month:'long',year:'numeric'})}</div>
      ${receiptContactFooterHtml()}
    </div>`;
  openModal('modal-receipt');
}

// ════════════════════════════════════════════════
//  BRANDING HELPERS — logo + contact info for
//  receipts / invoices (on-screen HTML)
// ════════════════════════════════════════════════

function receiptBrandHeaderHtml(subtitle) {
  return `
    <div class="receipt-header">
      <img src="${BRAND.logoUrl}" alt="${BRAND.name} Logo" class="receipt-logo-img"
           onerror="this.style.display='none';">
      <div style="font-size:24px;font-weight:800;color:var(--navy);font-family:var(--font-h);">JTI</div>
      <div class="receipt-title">${BRAND.name}</div>
      <div class="receipt-subtitle">${BRAND.branch} &middot; ${subtitle}</div>
      <div class="receipt-contact-line">&#128222; ${BRAND.phone1} / ${BRAND.phone2} &nbsp;&middot;&nbsp; &#9993; ${BRAND.email}</div>
    </div>`;
}

function receiptContactFooterHtml() {
  return `
    <div class="receipt-contact-footer">
      <strong>${BRAND.name}</strong> &middot; ${BRAND.branch}<br>
      &#128222; ${BRAND.phone1} &nbsp;|&nbsp; ${BRAND.phone2} &nbsp;|&nbsp; &#9993; ${BRAND.email}
    </div>`;
}

// ════════════════════════════════════════════════
//  PDF ENGINE  —  Professional receipts & invoices
//  Uses jsPDF (loaded from CDN in index.html)
// ════════════════════════════════════════════════

const PDF = {
  navy:     [10,  22,  40],
  navySoft: [27,  48,  87],
  gold:     [201, 146, 42],
  goldLt:   [232, 179, 84],
  success:  [26,  122, 74],
  danger:   [192, 57,  43],
  muted:    [107, 122, 153],
  border:   [210, 205, 195],
  creamDk:  [237, 233, 223],
  cream:    [247, 244, 238],
  white:    [255, 255, 255],
  text:     [26,  26,  46],
  W:   105,   // page width mm
  PAD:  10,   // left/right margin
};

function _newDoc() {
  const { jsPDF } = window.jspdf;
  return new jsPDF({ unit: 'mm', format: [PDF.W, 200], orientation: 'portrait' });
}

function _font(doc, weight, size, color) {
  doc.setFont('helvetica', weight || 'normal');
  doc.setFontSize(size || 9);
  doc.setTextColor(...(color || PDF.text));
}

function _line(doc, y, dashed) {
  doc.setDrawColor(...PDF.border);
  doc.setLineDash(dashed !== false ? [1, 1.8] : [], 0);
  doc.setLineWidth(0.25);
  doc.line(PDF.PAD, y, PDF.W - PDF.PAD, y);
  doc.setLineDash([], 0);
}

/**
 * Loads the JTI logo image (cached after first call) so it can be embedded
 * in generated PDFs. Falls back gracefully (returns null) if unavailable —
 * the gold "JTI" badge is drawn instead, so PDF generation never breaks.
 */
let _logoImgCache = null;
let _logoImgTried = false;
function _getLogoImageSync() {
  // jsPDF addImage needs a loaded <img> or data URL synchronously at draw time.
  // We pre-warm this on app init via preloadLogoForPdf(); if it's not ready yet,
  // we simply skip embedding and use the gold monogram badge instead.
  return _logoImgCache;
}
function preloadLogoForPdf() {
  if (_logoImgTried) return;
  _logoImgTried = true;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => { _logoImgCache = img; };
    img.onerror = () => { _logoImgCache = null; };
    img.src = BRAND.logoUrl;
  } catch (_) { _logoImgCache = null; }
}

function _drawHeader(doc, docType) {
  const W = PDF.W;

  // Full-width navy bar
  doc.setFillColor(...PDF.navy);
  doc.rect(0, 0, W, 32, 'F');

  // Gold bottom accent
  doc.setFillColor(...PDF.gold);
  doc.rect(0, 32, W, 2, 'F');

  // Logo: try embedded image first, fall back to gold monogram badge
  const logoImg = _getLogoImageSync();
  if (logoImg) {
    try { doc.addImage(logoImg, 'JPEG', PDF.PAD, 8, 15, 15, undefined, 'FAST'); }
    catch (_) { _drawLogoBadge(doc); }
  } else {
    _drawLogoBadge(doc);
  }

  // Institute name & branch
  _font(doc, 'bold', 12, PDF.white);
  doc.text(BRAND.name, 29, 14.5);
  _font(doc, 'normal', 8.5, [180, 200, 235]);
  doc.text(BRAND.branch, 29, 20);
  _font(doc, 'normal', 6.8, [150, 175, 215]);
  doc.text(BRAND.phone1 + ' / ' + BRAND.phone2, 29, 24.5);
  doc.text(BRAND.email, 29, 28.5);

  // Document type pill (top right)
  const pill = docType.toUpperCase();
  const pillW = 38, pillH = 8;
  const pillX = W - PDF.PAD - pillW;
  doc.setFillColor(...PDF.navySoft);
  doc.roundedRect(pillX, 4, pillW, pillH, 2, 2, 'F');
  doc.setDrawColor(...PDF.gold);
  doc.setLineWidth(0.4);
  doc.roundedRect(pillX, 4, pillW, pillH, 2, 2, 'S');
  _font(doc, 'bold', 7.5, PDF.goldLt);
  doc.text(pill, pillX + pillW / 2, 9.5, { align: 'center' });

  return 42; // y after header + spacing
}

function _drawLogoBadge(doc) {
  doc.setFillColor(...PDF.gold);
  doc.roundedRect(PDF.PAD, 8, 15, 15, 2.5, 2.5, 'F');
  _font(doc, 'bold', 13, PDF.navy);
  doc.text('JTI', PDF.PAD + 2.8, 18.5);
}

function _sectionLabel(doc, y, text) {
  // Label + underline
  _font(doc, 'bold', 7, PDF.muted);
  doc.text(text.toUpperCase(), PDF.PAD, y);
  doc.setDrawColor(...PDF.gold);
  doc.setLineWidth(0.4);
  doc.line(PDF.PAD, y + 1, PDF.PAD + doc.getTextWidth(text.toUpperCase()) + 2, y + 1);
  return y + 5;
}

function _row(doc, y, label, value, opts) {
  opts = opts || {};
  const R  = PDF.W - PDF.PAD;
  const lH = 6.5;

  if (opts.shade) {
    doc.setFillColor(...PDF.cream);
    doc.rect(PDF.PAD - 1, y - 4, PDF.W - PDF.PAD * 2 + 2, lH + 0.5, 'F');
  }

  _font(doc, 'normal', 8.5, PDF.muted);
  doc.text(String(label), PDF.PAD + 1, y);

  _font(doc, 'bold', 8.5, opts.color || PDF.text);
  const maxW = R - PDF.PAD - 30;
  const lines = doc.splitTextToSize(String(value || '—'), maxW);
  doc.text(lines, R - 1, y, { align: 'right' });

  return y + (lines.length > 1 ? lines.length * 4.8 + 1 : lH);
}

function _divider(doc, y, dashed) {
  _line(doc, y, dashed !== false);
  return y + 5;
}

function _totalBar(doc, y, label, value, barColor) {
  const barH = 12;
  doc.setFillColor(...(barColor || PDF.navy));
  doc.roundedRect(PDF.PAD, y, PDF.W - PDF.PAD * 2, barH, 2.5, 2.5, 'F');
  // Gold left accent on bar
  doc.setFillColor(...PDF.gold);
  doc.roundedRect(PDF.PAD, y, 3, barH, 1, 1, 'F');
  _font(doc, 'bold', 10.5, PDF.white);
  doc.text(label, PDF.PAD + 6, y + 8);
  doc.text(value, PDF.W - PDF.PAD - 2, y + 8, { align: 'right' });
  return y + barH + 5;
}

function _footer(doc, y, lines) {
  // Separator
  doc.setDrawColor(...PDF.border);
  doc.setLineWidth(0.3);
  doc.setLineDash([], 0);
  doc.line(PDF.PAD, y, PDF.W - PDF.PAD, y);
  y += 5;

  _font(doc, 'normal', 7.5, PDF.muted);
  lines.forEach(line => {
    if (line.trim()) {
      doc.text(line.trim(), PDF.W / 2, y, { align: 'center' });
      y += 4;
    }
  });

  y += 1;
  // Contact strip
  _font(doc, 'bold', 7.5, PDF.navy);
  doc.text(BRAND.phone1 + '  |  ' + BRAND.phone2 + '  |  ' + BRAND.email, PDF.W / 2, y, { align: 'center' });
  y += 6;

  // Bottom gold strip
  doc.setFillColor(...PDF.gold);
  doc.rect(0, 196, PDF.W, 4, 'F');
  // Bottom navy strip
  doc.setFillColor(...PDF.navy);
  doc.rect(0, 196.5, PDF.W, 3.5, 'F');
}

function _save(doc, filename) {
  doc.save(filename);
  toast('PDF downloaded!', 'success');
}

// ════════════════════════════════════════════════
//  PAYMENT RECEIPT PDF
// ════════════════════════════════════════════════

function downloadReceiptPdf() {
  const area = document.getElementById('receipt-print-area');
  if (!area) { toast('No receipt open.', 'error'); return; }

  // Build data map from rendered DOM
  const data = {};
  area.querySelectorAll('.receipt-row').forEach(row => {
    const spans = row.querySelectorAll('span');
    if (spans.length >= 2) data[spans[0].textContent.trim()] = spans[1].textContent.trim();
  });
  const totalSpans = area.querySelectorAll('.receipt-total span');
  const totalLabel = totalSpans[0]?.textContent.trim() || 'Amount Received';
  const totalValue = totalSpans[1]?.textContent.trim() || '';
  const stampLines = (area.querySelector('.receipt-stamp')?.innerText || '').split('\n').filter(Boolean);

  const doc = _newDoc();
  let y = _drawHeader(doc, 'Payment Receipt');

  y = _sectionLabel(doc, y, 'Receipt Details');
  y = _row(doc, y, 'Receipt No.',   data['Receipt No.']    || '—', { shade: true });
  y = _row(doc, y, 'Date',          data['Date']           || '—');
  y += 3;

  y = _divider(doc, y);

  y = _sectionLabel(doc, y, 'Student Information');
  y = _row(doc, y, 'Student Name',  data['Student']        || '—', { shade: true });
  y = _row(doc, y, 'Reg. No.',      data['Reg. No.']       || '—');
  y = _row(doc, y, 'Program',       data['Program']        || '—');
  y += 3;

  y = _divider(doc, y);

  y = _sectionLabel(doc, y, 'Payment Details');
  y = _row(doc, y, 'Method',        data['Payment Method'] || '—', { shade: true });
  y = _row(doc, y, 'Reference',     data['Reference']      || '—');
  if (data['Remarks']) y = _row(doc, y, 'Remarks', data['Remarks']);
  y += 3;

  y = _divider(doc, y, false);

  y = _totalBar(doc, y, totalLabel, totalValue);

  const bal = data['Balance Remaining'] || '';
  const balZero = bal === 'KES 0' || bal === '—' || bal === '';
  y = _row(doc, y, 'Balance Remaining', bal, { color: balZero ? PDF.success : PDF.danger, shade: true });
  y += 6;

  _footer(doc, y, [
    ...stampLines,
    'Generated: ' + new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' }),
  ]);

  const rcpNo = (data['Receipt No.'] || 'receipt').replace(/[/\\]/g, '-');
  _save(doc, 'JTI_Receipt_' + rcpNo + '.pdf');
}

// ════════════════════════════════════════════════
//  FEE / CHARGE INVOICE PDF
// ════════════════════════════════════════════════

function downloadInvoicePdf() {
  const area = document.getElementById('invoice-print-area');
  if (!area) { toast('No invoice open.', 'error'); return; }

  const data = {};
  area.querySelectorAll('.receipt-row').forEach(row => {
    const spans = row.querySelectorAll('span');
    if (spans.length >= 2) data[spans[0].textContent.trim()] = spans[1].textContent.trim();
  });
  const totalSpans = area.querySelectorAll('.receipt-total span');
  const totalLabel = totalSpans[0]?.textContent.trim() || 'Balance Due';
  const totalValue = totalSpans[1]?.textContent.trim() || '';
  const stampLines = (area.querySelector('.receipt-stamp')?.innerText || '').split('\n').filter(Boolean);
  const subtitle   = area.querySelector('.receipt-subtitle')?.textContent || '';
  const isCharge   = subtitle.toLowerCase().includes('charge');
  const docType    = isCharge ? 'Charge Invoice' : 'Fee Invoice';

  const doc = _newDoc();
  let y = _drawHeader(doc, docType);

  y = _sectionLabel(doc, y, 'Invoice Details');
  const invNo = data['Invoice No.'] || '';
  if (invNo) y = _row(doc, y, 'Invoice No.', invNo, { shade: true });
  y = _row(doc, y, 'Date',       data['Invoice Date'] || data['Date'] || '—');
  if (data['Charged By']) y = _row(doc, y, 'Charged By', data['Charged By']);
  y += 3;

  y = _divider(doc, y);

  y = _sectionLabel(doc, y, 'Student Information');
  y = _row(doc, y, 'Name',    data['Invoice To'] || data['Student'] || '—', { shade: true });
  y = _row(doc, y, 'Reg. No.', data['Reg. No.'] || '—');
  y = _row(doc, y, 'Program',  data['Program']  || '—');
  if (data['Intake']) y = _row(doc, y, 'Intake', data['Intake']);
  if (data['Phone'])  y = _row(doc, y, 'Phone',  data['Phone']);
  y += 3;

  y = _divider(doc, y);

  y = _sectionLabel(doc, y, isCharge ? 'Charge Details' : 'Fee Summary');
  if (isCharge) {
    if (data['Description'])       y = _row(doc, y, 'Description',      data['Description'],       { shade: true });
    if (data['Updated Total Fee'])  y = _row(doc, y, 'Updated Total Fee', data['Updated Total Fee']);
    if (data['New Balance Due'])    y = _row(doc, y, 'New Balance Due',   data['New Balance Due'],   { color: PDF.danger });
  } else {
    if (data['Program Fee'])  y = _row(doc, y, 'Program Fee',  data['Program Fee'],  { shade: true });
    if (data['Amount Paid'])  y = _row(doc, y, 'Amount Paid',  data['Amount Paid'],  { color: PDF.success });
  }
  y += 3;

  y = _divider(doc, y, false);

  y = _totalBar(doc, y, totalLabel, totalValue, isCharge ? PDF.navySoft : PDF.navy);
  y += 2;

  _footer(doc, y, [
    ...stampLines,
    'Generated: ' + new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' }),
  ]);

  const regNo = (data['Reg. No.'] || 'invoice').replace(/[/\\]/g, '-');
  const date  = new Date().toISOString().split('T')[0];
  _save(doc, 'JTI_' + (isCharge ? 'ChargeInvoice' : 'Invoice') + '_' + regNo + '_' + date + '.pdf');
}

/** Legacy aliases */
function printReceipt() { downloadReceiptPdf(); }
function printInvoice() { downloadInvoicePdf(); }


// ════════════════════════════════════════════════
//  CHARGE INVOICE
// ════════════════════════════════════════════════
function openChargeModal(regNo) {
  if (!can('charge')) { toast('Access denied.', 'error'); return; }
  const sel = document.getElementById('charge-student');
  // Populate dropdown
  sel.innerHTML = '<option value="">Choose student&hellip;</option>' +
    state.students.map(s => `<option value="${s.regNo}">${s.regNo} — ${s.fullName}</option>`).join('');
  if (regNo) {
    sel.value = regNo;
    onChargeStudentSelect();
  } else {
    document.getElementById('charge-student-info').style.display = 'none';
  }
  document.getElementById('charge-amount').value      = '';
  document.getElementById('charge-desc').value        = '';
  document.getElementById('charge-date').value        = new Date().toISOString().split('T')[0];
  document.getElementById('charge-category').value    = 'Tuition Fee';
  openModal('modal-charge');
}

function onChargeStudentSelect() {
  const regNo = document.getElementById('charge-student').value;
  const s     = state.students.find(x => x.regNo === regNo);
  const box   = document.getElementById('charge-student-info');
  if (!s) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  document.getElementById('charge-avatar').textContent       = s.fullName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('charge-student-name').textContent = s.fullName;
  document.getElementById('charge-program').textContent      = s.program || '—';
  document.getElementById('charge-current-total').textContent = 'KES ' + fmt(s.totalFee);
  document.getElementById('charge-current-bal').textContent   = 'KES ' + fmt(s.feeBalance);
  updateChargePreview();
}

function updateChargePreview() {
  const regNo  = document.getElementById('charge-student').value;
  const s      = state.students.find(x => x.regNo === regNo);
  const amount = +document.getElementById('charge-amount').value || 0;
  if (!s) return;
  document.getElementById('charge-new-total').textContent = 'KES ' + fmt((+s.totalFee || 0) + amount);
  document.getElementById('charge-new-bal').textContent   = 'KES ' + fmt((+s.feeBalance || 0) + amount);
}

async function submitCharge() {
  if (!can('charge')) { toast('Access denied.', 'error'); return; }
  const regNo  = document.getElementById('charge-student').value;
  const amount = +document.getElementById('charge-amount').value;
  const desc   = document.getElementById('charge-desc').value.trim();
  const cat    = document.getElementById('charge-category').value;

  if (!regNo)   { toast('Select a student.', 'error'); return; }
  if (!amount || amount <= 0) { toast('Enter a valid charge amount.', 'error'); return; }
  if (!desc)    { toast('Enter a description.', 'error'); return; }

  const fullDesc = cat ? `[${cat}] ${desc}` : desc;
  const payload  = {
    regNo,
    amount,
    description: fullDesc,
    date:       document.getElementById('charge-date').value,
    chargedBy:  state.user?.fullName || state.user?.username || 'System',
  };

  const btn = document.getElementById('charge-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Charging&hellip;';

  try {
    const res = await apiPost('chargeInvoice', payload);
    if (res.success) {
      toast(`Invoice ${res.invoiceNo} raised — KES ${fmt(amount)} charged.`, 'success');
      closeModal('modal-charge');
      reloadAfterWrite();
      // Show printable invoice
      showChargeInvoice(res, payload, state.students.find(x => x.regNo === regNo));
    } else {
      toast('Error: ' + (res.error || 'Unknown'), 'error');
    }
  } catch(e) { toast('Failed: ' + e.message, 'error'); }

  btn.disabled = false;
  btn.innerHTML = '&#129534; Raise Invoice';
}

function showChargeInvoice(res, payload, student) {
  if (!student) return;
  document.getElementById('modal-invoice-body').innerHTML = `
    <div class="receipt-wrap" id="invoice-print-area">
      ${receiptBrandHeaderHtml('Charge Invoice')}
      <hr class="receipt-divider">
      <div class="receipt-row"><span class="rl">Invoice No.</span><span class="rr">${res.invoiceNo}</span></div>
      <div class="receipt-row"><span class="rl">Date</span><span class="rr">${fmtDate(payload.date)}</span></div>
      <div class="receipt-row"><span class="rl">Charged By</span><span class="rr">${payload.chargedBy}</span></div>
      <hr class="receipt-divider">
      <div class="receipt-row"><span class="rl">Student</span><span class="rr">${student.fullName}</span></div>
      <div class="receipt-row"><span class="rl">Reg. No.</span><span class="rr">${student.regNo}</span></div>
      <div class="receipt-row"><span class="rl">Program</span><span class="rr">${student.program || '—'}</span></div>
      <hr class="receipt-divider">
      <div class="receipt-row"><span class="rl">Description</span><span class="rr" style="max-width:200px;text-align:right;">${payload.description}</span></div>
      <div class="receipt-total"><span>Amount Charged</span><span>KES ${fmt(payload.amount)}</span></div>
      <div class="receipt-row" style="margin-top:10px;"><span class="rl">Updated Total Fee</span><span class="rr">KES ${fmt(res.newTotalFee)}</span></div>
      <div class="receipt-row"><span class="rl">New Balance Due</span><span class="rr" style="color:var(--danger);font-weight:700;">KES ${fmt(res.newBalance)}</span></div>
      <div class="receipt-stamp">This charge has been applied to the student's account.<br>${BRAND.name} &middot; ${BRAND.branch}</div>
      ${receiptContactFooterHtml()}
    </div>`;
  openModal('modal-invoice');
}

// ════════════════════════════════════════════════
//  INVOICES PAGE (charge history + summary)
// ════════════════════════════════════════════════
function generateInvoices() { renderInvoices(); }

function renderInvoices(filtered) {
  // Tab 1: Fee summary per student
  const data  = filtered || state.students;
  const tbody = document.getElementById('invoices-tbody');
  if (!data.length) { tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:32px;">No data</td></tr>'; return; }
  tbody.innerHTML = data.map((s,i)=>{
    const bal=+s.feeBalance||0, paid=+s.amountPaid||0, total=+s.totalFee||0;
    const pct=total>0?Math.min(100,Math.round((paid/total)*100)):0;
    const invStatus=pct===100?'Paid':pct===0?'Unpaid':'Partial';
    const badge=pct===100?'badge-success':pct===0?'badge-danger':'badge-warning';
    return `<tr>
      <td><strong>${s.regNo}</strong></td>
      <td>${s.fullName}</td><td>${s.program||'&mdash;'}</td>
      <td>KES ${fmt(total)}</td>
      <td style="color:var(--success);font-weight:600;">KES ${fmt(paid)}</td>
      <td style="color:${bal>0?'var(--danger)':'var(--success)'};font-weight:600;">KES ${fmt(bal)}</td>
      <td><span class="badge ${badge}">${invStatus}</span></td>
      <td><div class="actions-cell">
        <button class="btn btn-outline btn-sm" onclick="printStudentInvoice('${s.regNo}')">&#128196; Invoice</button>
        ${can('charge') ? `<button class="btn btn-primary btn-sm" onclick="openChargeModal('${s.regNo}')">+ Charge</button>` : ''}
      </div></td>
    </tr>`;
  }).join('');

  // Tab 2: Charge history
  renderChargeHistory();
}

function renderChargeHistory(filtered) {
  const data  = filtered || state.invoiceRecords;
  const tbody = document.getElementById('charge-history-tbody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);">No charges recorded yet</td></tr>';
    return;
  }
  tbody.innerHTML = [...data].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(inv => `
    <tr>
      <td><strong>${inv.invoiceNo}</strong></td>
      <td>${fmtDate(inv.date)}</td>
      <td><strong>${inv.studentName}</strong><br><small style="color:var(--muted);">${inv.regNo}</small></td>
      <td>${inv.program||'&mdash;'}</td>
      <td style="font-size:12.5px;">${inv.description}</td>
      <td style="font-weight:700;color:var(--danger);">KES ${fmt(inv.amount)}</td>
      <td style="font-size:12px;color:var(--muted);">${inv.chargedBy||'&mdash;'}</td>
      <td>KES ${fmt(inv.newBalance)}</td>
    </tr>`).join('');
}

function filterInvoices() {
  const q   = document.getElementById('inv-search').value.toLowerCase();
  const tab = document.getElementById('inv-tab-summary').style.display !== 'none' ? 'summary' : 'history';
  if (tab === 'summary') {
    renderInvoices(state.students.filter(s => !q || s.fullName.toLowerCase().includes(q) || s.regNo.toLowerCase().includes(q)));
  } else {
    renderChargeHistory(state.invoiceRecords.filter(i =>
      !q || i.studentName.toLowerCase().includes(q) || i.regNo.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
    ));
  }
}

function switchInvTab(tab) {
  document.getElementById('inv-tab-summary').style.display = tab === 'summary' ? '' : 'none';
  document.getElementById('inv-tab-history').style.display = tab === 'history' ? '' : 'none';
  document.querySelectorAll('.inv-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('inv-btn-' + tab).classList.add('active');
  if (tab === 'history') renderChargeHistory();
}

function printStudentInvoice(regNo) {
  const s = state.students.find(x=>x.regNo===regNo);
  if (!s) return;
  document.getElementById('modal-invoice-body').innerHTML = `
    <div class="receipt-wrap" id="invoice-print-area">
      ${receiptBrandHeaderHtml('Fee Invoice')}
      <hr class="receipt-divider">
      <div class="receipt-row"><span class="rl">Invoice Date</span><span class="rr">${new Date().toLocaleDateString('en-KE')}</span></div>
      <div class="receipt-row"><span class="rl">Invoice To</span><span class="rr">${s.fullName}</span></div>
      <div class="receipt-row"><span class="rl">Reg. No.</span><span class="rr">${s.regNo}</span></div>
      <div class="receipt-row"><span class="rl">Program</span><span class="rr">${s.program||'&mdash;'}</span></div>
      <div class="receipt-row"><span class="rl">Intake</span><span class="rr">${fmtIntake(s.intake)}</span></div>
      <div class="receipt-row"><span class="rl">Phone</span><span class="rr">${s.phone||'&mdash;'}</span></div>
      <hr class="receipt-divider">
      <div class="receipt-row"><span class="rl">Program Fee</span><span class="rr">KES ${fmt(s.totalFee)}</span></div>
      <div class="receipt-row"><span class="rl">Amount Paid</span><span class="rr" style="color:var(--success);">KES ${fmt(s.amountPaid)}</span></div>
      <div class="receipt-total"><span>Balance Due</span><span>KES ${fmt(s.feeBalance)}</span></div>
      <div class="receipt-stamp">Please make payments via M-Pesa or Bank Transfer<br>${BRAND.name} &middot; ${BRAND.branch}</div>
      ${receiptContactFooterHtml()}
    </div>`;
  openModal('modal-invoice');
}


// ════════════════════════════════════════════════
//  COURSES
// ════════════════════════════════════════════════
async function saveCourse() {
  if (!can('courses')) { toast('Access denied.', 'error'); return; }
  const name = document.getElementById('course-name').value.trim();
  if (!name) { toast('Program name is required.','error'); return; }
  const payload = {
    name, code: document.getElementById('course-code').value.trim(),
    duration: document.getElementById('course-duration').value.trim(),
    fee: +document.getElementById('course-fee').value||0,
    desc: document.getElementById('course-desc').value.trim(),
  };
  try {
    const res = await apiPost('addCourse', payload);
    if (res.success) {
      toast('Program saved!','success'); reloadAfterWrite();
      ['course-name','course-code','course-duration','course-fee','course-desc'].forEach(id=>document.getElementById(id).value='');
    } else toast('Error: '+res.error,'error');
  } catch(e) { toast('Failed: '+e.message,'error'); }
}

function renderCourses() {
  const tbody = document.getElementById('courses-tbody');
  if (!state.courses.length) { tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted);">No programs yet</td></tr>'; return; }
  tbody.innerHTML = state.courses.map(c=>{
    const count = state.students.filter(s=>s.program===c.name).length;
    return `<tr>
      <td><strong>${c.code||'&mdash;'}</strong></td><td>${c.name}</td>
      <td>${c.duration||'&mdash;'}</td><td>KES ${fmt(c.fee)}</td>
      <td><span class="badge badge-info">${count} students</span></td>
      <td>${can('courses')?`<button class="btn btn-danger btn-sm" onclick="deleteCourse('${c.name}')">&#128465;</button>`:'&mdash;'}</td>
    </tr>`;
  }).join('');
}

async function deleteCourse(name) {
  if (!can('courses')) { toast('Access denied.', 'error'); return; }
  if (!confirm('Delete program "'+name+'"?')) return;
  try {
    const res = await apiPost('deleteCourse',{name});
    if (res.success) { toast('Deleted.','success'); reloadAfterWrite(); }
    else toast('Error: '+res.error,'error');
  } catch(e) { toast('Failed: '+e.message,'error'); }
}

// ════════════════════════════════════════════════
//  FEE STRUCTURES (local only)
// ════════════════════════════════════════════════
function saveFeeStructure() {
  const prog=document.getElementById('fs-program').value.trim();
  const fee=document.getElementById('fs-fee').value;
  if (!prog||!fee) { toast('Fill all fields.','error'); return; }
  state.feeStructures.push({program:prog,fee:+fee,duration:document.getElementById('fs-duration').value,desc:document.getElementById('fs-desc').value});
  renderFeeStructures(); toast('Structure saved!','success');
}

function renderFeeStructures() {
  const tbody=document.getElementById('fee-structures-tbody');
  if (!state.feeStructures.length) { tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--muted);">None yet</td></tr>'; return; }
  tbody.innerHTML=state.feeStructures.map((f,i)=>`
    <tr>
      <td>${f.program}</td><td>KES ${fmt(f.fee)}</td>
      <td>${f.duration||'&mdash;'}</td><td>${f.desc||'&mdash;'}</td>
      <td><button class="btn btn-danger btn-sm" onclick="state.feeStructures.splice(${i},1);renderFeeStructures()">&#128465;</button></td>
    </tr>`).join('');
}

// ════════════════════════════════════════════════
//  REPORTS
// ════════════════════════════════════════════════
function renderReports() {
  const s=state.students;
  const totalBilled=s.reduce((a,x)=>a+(+x.totalFee||0),0);
  const totalPaid=s.reduce((a,x)=>a+(+x.amountPaid||0),0);
  const totalBal=s.reduce((a,x)=>a+(+x.feeBalance||0),0);
  const rate=totalBilled>0?Math.round((totalPaid/totalBilled)*100):0;
  document.getElementById('report-collection-rate').textContent=rate+'%';
  document.getElementById('report-total-billed').textContent='KES '+fmt(totalBilled);
  document.getElementById('report-total-paid').textContent='KES '+fmt(totalPaid);
  document.getElementById('report-total-balance').textContent='KES '+fmt(totalBal);
  const programs=[...new Set(s.map(x=>x.program).filter(Boolean))];
  const tbody=document.getElementById('report-tbody');
  tbody.innerHTML=programs.length?programs.map(prog=>{
    const group=s.filter(x=>x.program===prog);
    const billed=group.reduce((a,x)=>a+(+x.totalFee||0),0);
    const paid=group.reduce((a,x)=>a+(+x.amountPaid||0),0);
    const bal=group.reduce((a,x)=>a+(+x.feeBalance||0),0);
    const r=billed>0?Math.round((paid/billed)*100):0;
    return `<tr>
      <td>${prog}</td><td>${group.length}</td>
      <td>KES ${fmt(billed)}</td>
      <td style="color:var(--success);font-weight:600;">KES ${fmt(paid)}</td>
      <td style="color:var(--danger);font-weight:600;">KES ${fmt(bal)}</td>
      <td><div style="display:flex;align-items:center;gap:8px;">
        <div class="progress-bar" style="width:80px;"><div class="progress-fill ${r===100?'success':r<50?'danger':''}" style="width:${r}%;"></div></div>${r}%
      </div></td></tr>`;
  }).join(''):'<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--muted);">No data</td></tr>';
  const defaulters=s.filter(x=>(+x.feeBalance||0)>0);
  document.getElementById('defaulters-tbody').innerHTML=defaulters.length
    ?defaulters.sort((a,b)=>(+b.feeBalance||0)-(+a.feeBalance||0)).map(x=>`
      <tr>
        <td>${x.regNo}</td><td>${x.fullName}</td><td>${x.program||'&mdash;'}</td>
        <td>KES ${fmt(x.totalFee)}</td><td>KES ${fmt(x.amountPaid)}</td>
        <td style="color:var(--danger);font-weight:700;">KES ${fmt(x.feeBalance)}</td>
        <td>
          ${can('payment') ? `<button class="btn btn-gold btn-sm" onclick="quickPay('${x.regNo}')">&#128176; Pay</button>` : ''}
          <button class="btn btn-outline btn-sm" onclick="printStudentInvoice('${x.regNo}')">&#128196;</button>
          ${can('sms') ? `<button class="btn btn-sms btn-sm" onclick="openSmsModal('${x.regNo}')">&#128241;</button>` : ''}
        </td>
      </tr>`).join('')
    :'<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--success);">&#9989; All students are up to date!</td></tr>';

  const smsLogCard = document.getElementById('sms-log-card');
  if (smsLogCard) smsLogCard.style.display = can('sms') ? '' : 'none';
}

// ════════════════════════════════════════════════
//  SMS DELIVERY LOG
//  Fetched on-demand (not part of getAll) since the log
//  can grow large — one row is written per recipient phone.
// ════════════════════════════════════════════════

async function loadSmsLog() {
  if (!can('sms')) { toast('Access denied.', 'error'); return; }
  const tbody = document.getElementById('sms-log-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted);"><span class="loader" style="border-color:var(--border);border-top-color:var(--gold);"></span> Loading&hellip;</td></tr>';
  try {
    const res = await api('getSmsLog');
    if (res.success) {
      state.smsLog = res.data || [];
      renderSmsLog();
      toast('SMS log loaded.', 'success');
    } else {
      toast('Error loading SMS log: ' + (res.error || 'Unknown'), 'error');
    }
  } catch (e) {
    toast('Failed to load SMS log: ' + e.message, 'error');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted);">Failed to load. Click Refresh to retry.</td></tr>';
  }
}

function renderSmsLog(filtered) {
  const data = filtered || state.smsLog || [];
  const tbody = document.getElementById('sms-log-tbody');

  const total = data.length;
  const sent  = data.filter(l => l.status === 'sent').length;
  const failed = data.filter(l => l.status === 'failed').length;
  document.getElementById('sms-log-count').textContent  = total + ' records';
  document.getElementById('sms-log-total').textContent   = total;
  document.getElementById('sms-log-success').textContent = sent;
  document.getElementById('sms-log-failed').textContent  = failed;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted);">No SMS sent yet, or click Refresh to load the log</td></tr>';
    return;
  }

  const purposeLabels = { welcome: 'Welcome', receipt: 'Receipt', defaulter: 'Defaulter Reminder', manual: 'Manual' };
  tbody.innerHTML = [...data].sort((a,b) => new Date(b.sentAt) - new Date(a.sentAt)).map(l => `
    <tr>
      <td style="font-size:12px;color:var(--muted);">${fmtDate(l.sentAt)} ${fmtTime(l.sentAt)}</td>
      <td>${l.phone||'&mdash;'}</td>
      <td><span class="badge badge-purple">${purposeLabels[l.purpose] || l.purpose || 'Manual'}</span></td>
      <td>${l.studentName ? l.studentName + (l.regNo ? ' <small style="color:var(--muted);">('+l.regNo+')</small>' : '') : '&mdash;'}</td>
      <td><span class="badge ${l.status==='sent'?'badge-success':'badge-danger'}">${l.status==='sent'?'Sent':'Failed'}</span></td>
      <td style="font-size:12px;color:var(--danger);max-width:220px;">${l.error||'&mdash;'}</td>
      <td style="font-size:12px;color:var(--muted);">${l.sentBy||'&mdash;'}</td>
    </tr>`).join('');
}

function filterSmsLog() {
  const q       = document.getElementById('sms-log-search').value.toLowerCase();
  const purpose = document.getElementById('sms-log-purpose-filter').value;
  const status  = document.getElementById('sms-log-status-filter').value;
  const filtered = (state.smsLog || []).filter(l => {
    const mq = !q || [l.phone, l.studentName, l.regNo, l.purpose].some(v => v && v.toLowerCase().includes(q));
    const mp = !purpose || l.purpose === purpose;
    const ms = !status || l.status === status;
    return mq && mp && ms;
  });
  renderSmsLog(filtered);
}

function exportSmsLog() {
  const data = state.smsLog || [];
  if (!data.length) { toast('No SMS log data to export. Click Refresh first.', 'warning'); return; }
  downloadWorkbook(data.map(l => ({
    'Date/Time': l.sentAt || '', 'Phone': l.phone || '', 'Purpose': l.purpose || '',
    'Reg No.': l.regNo || '', 'Student': l.studentName || '', 'Status': l.status || '',
    'Error': l.error || '', 'Sent By': l.sentBy || '', 'Message': l.message || '',
  })), 'SMS Log', 'JTI_SMS_Log');
}

// ════════════════════════════════════════════════
//  EXCEL EXPORTS
// ════════════════════════════════════════════════
function downloadWorkbook(rows, sheetName, fileName) {
  if (!rows||!rows.length) { toast('No data to export.','warning'); return; }
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,sheetName);
  XLSX.writeFile(wb,`${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  toast('Exported to Excel!','success');
}
function exportStudents() {
  downloadWorkbook(state.students.map(s=>({'Reg No.':s.regNo,'Full Name':s.fullName,'National ID':s.nationalId||'','Gender':s.gender||'','Phone':s.phone||'','Email':s.email||'','County':s.county||'','Program':s.program||'','Intake':s.intake||'','Enroll Date':s.enrollDate||'','Status':s.status||'','Total Fee':+s.totalFee||0,'Amount Paid':+s.amountPaid||0,'Balance':+s.feeBalance||0})),'Students','JTI_Students');
}
function exportFeeOverview() {
  const prog=document.getElementById('fee-filter-program').value;
  const stat=document.getElementById('fee-filter-status').value;
  const data=state.students.filter(s=>{
    const mp=!prog||s.program===prog;
    const pct=s.totalFee>0?Math.round((s.amountPaid/s.totalFee)*100):0;
    const fs=pct===100?'paid':pct===0?'unpaid':'partial';
    return mp&&(!stat||fs===stat);
  });
  downloadWorkbook(data.map(s=>{const pct=s.totalFee>0?Math.min(100,Math.round((s.amountPaid/s.totalFee)*100)):0;return{'Reg No.':s.regNo,'Name':s.fullName,'Program':s.program||'','Total Fee':+s.totalFee||0,'Paid':+s.amountPaid||0,'Balance':+s.feeBalance||0,'Progress %':pct,'Status':pct===100?'Fully Paid':pct===0?'Unpaid':'Partial'};}),'Fee Overview','JTI_Fee_Overview');
}
function exportPayments() {
  const q=document.getElementById('pay-search').value.toLowerCase();
  const mon=document.getElementById('pay-month-filter').value;
  const sorted=[...state.payments.filter(p=>{const mq=!q||[p.studentName,p.regNo,p.ref,p.method].some(v=>v&&v.toLowerCase().includes(q));return mq&&(!mon||(p.date&&p.date.startsWith(mon)));})].sort((a,b)=>new Date(b.date)-new Date(a.date));
  downloadWorkbook(sorted.map((p,i)=>({'#':sorted.length-i,'Date':fmtDate(p.date).replace('&mdash;',''),'Student':p.studentName,'Reg No.':p.regNo,'Program':p.program||'','Amount':+p.amount||0,'Method':p.method||'','Reference':p.ref||'','Balance After':+p.newBalance||0,'Remarks':p.remarks||''})),'Payments','JTI_Payments');
}
function exportInvoices() {
  const q=document.getElementById('inv-search').value.toLowerCase();
  downloadWorkbook(state.students.filter(s=>!q||s.fullName.toLowerCase().includes(q)||s.regNo.toLowerCase().includes(q)).map((s,i)=>{const pct=+s.totalFee>0?Math.min(100,Math.round((+s.amountPaid/+s.totalFee)*100)):0;return{'Invoice #':`INV-${String(i+1).padStart(4,'0')}`,'Student':s.fullName,'Reg No.':s.regNo,'Program':s.program||'','Total Fee':+s.totalFee||0,'Paid':+s.amountPaid||0,'Balance':+s.feeBalance||0,'Status':pct===100?'Paid':pct===0?'Unpaid':'Partial'};}),'Invoices','JTI_Invoices');
}
function exportProgramReport() {
  const programs=[...new Set(state.students.map(x=>x.program).filter(Boolean))];
  downloadWorkbook(programs.map(prog=>{const g=state.students.filter(x=>x.program===prog);const b=g.reduce((a,x)=>a+(+x.totalFee||0),0);const p=g.reduce((a,x)=>a+(+x.amountPaid||0),0);const bl=g.reduce((a,x)=>a+(+x.feeBalance||0),0);return{'Program':prog,'Students':g.length,'Total Billed':b,'Total Paid':p,'Balance':bl,'Collection %':b>0?Math.round((p/b)*100):0};}),'Program Report','JTI_Program_Report');
}
function exportDefaulters() {
  downloadWorkbook(state.students.filter(x=>(+x.feeBalance||0)>0).sort((a,b)=>(+b.feeBalance||0)-(+a.feeBalance||0)).map(x=>({'Reg No.':x.regNo,'Name':x.fullName,'Program':x.program||'','Phone':x.phone||'','Total Fee':+x.totalFee||0,'Paid':+x.amountPaid||0,'Balance':+x.feeBalance||0})),'Defaulters','JTI_Defaulters');
}

// ════════════════════════════════════════════════
//  OFFICE SERVICES MODULE
//  (Printing, Browsing, eCitizen, Photocopying, etc.)
// ════════════════════════════════════════════════

/** Default seed list — used only when no service types exist yet on first load */
const DEFAULT_SERVICE_TYPES = [
  { name: 'Printing',       icon: '\u{1F5A8}\uFE0F', price: 10  },
  { name: 'Photocopying',   icon: '\u{1F4C4}',        price: 5   },
  { name: 'Scanning',       icon: '\u{1F5C2}\uFE0F',  price: 20  },
  { name: 'Browsing',       icon: '\u{1F4BB}',        price: 50  },
  { name: 'eCitizen',       icon: '\u{1F3DB}\uFE0F',  price: 200 },
  { name: 'Lamination',     icon: '\u{1F4D1}',        price: 50  },
  { name: 'Binding',        icon: '\u{1F4DA}',        price: 100 },
  { name: 'Typesetting',    icon: '\u{2328}\uFE0F',   price: 50  },
  { name: 'CV Writing',     icon: '\u{1F4C3}',        price: 300 },
  { name: 'Other',          icon: '\u{2795}',          price: 0   },
];

let _svcLogShowAll = false;

function initServicesPage() {
  // Default date filters to today on first visit
  const today = new Date().toISOString().split('T')[0];
  const svcDateEl   = document.getElementById('svc-date');
  const reconDateEl = document.getElementById('recon-date');
  const logDateEl   = document.getElementById('svc-log-date');
  if (svcDateEl && !svcDateEl.value)     svcDateEl.value   = today;
  if (reconDateEl && !reconDateEl.value) reconDateEl.value = today;
  if (logDateEl && !logDateEl.value && !_svcLogShowAll) logDateEl.value = today;

  renderServiceTypeGrid();
  renderServiceTypesTable();
  populateServiceTypeFilter();
  filterServiceLog();
  renderReconciliation();
}

function switchSvcTab(tabId) {
  ['svc-record','svc-log','svc-recon','svc-types'].forEach(id => {
    document.getElementById('tab-' + id).style.display = (id === tabId) ? 'block' : 'none';
  });
  document.querySelectorAll('#page-services .tab-btn').forEach((b,i) => {
    const order = ['svc-record','svc-log','svc-recon','svc-types'];
    b.classList.toggle('active', order[i] === tabId);
  });
  if (tabId === 'svc-log')   filterServiceLog();
  if (tabId === 'svc-recon') renderReconciliation();
  if (tabId === 'svc-types') renderServiceTypesTable();
}

/** Effective list of service types: server-saved ones, or defaults if none saved yet */
function effectiveServiceTypes() {
  return state.serviceTypes && state.serviceTypes.length ? state.serviceTypes : DEFAULT_SERVICE_TYPES;
}

function renderServiceTypeGrid() {
  const grid = document.getElementById('svc-type-grid');
  if (!grid) return;
  const types = effectiveServiceTypes();
  const selected = document.getElementById('svc-selected-type')?.value || '';
  grid.innerHTML = types.map(t => `
    <div class="service-type-chip ${t.name===selected?'selected':''}" onclick="selectServiceType('${t.name.replace(/'/g,"\\'")}')">
      <div class="stc-icon">${t.icon||'&#128424;'}</div>
      <div class="stc-name">${t.name}</div>
      <div class="stc-price">KES ${fmt(t.price||0)}</div>
    </div>`).join('');
}

function selectServiceType(name) {
  const types = effectiveServiceTypes();
  const t = types.find(x => x.name === name);
  document.getElementById('svc-selected-type').value = name;
  if (t) document.getElementById('svc-unit-price').value = t.price || '';
  recalcServiceAmount();
  renderServiceTypeGrid();
}

function recalcServiceAmount() {
  const qty   = +document.getElementById('svc-qty').value || 1;
  const price = +document.getElementById('svc-unit-price').value || 0;
  document.getElementById('svc-amount').value = qty * price;
}

function clearServiceForm() {
  document.getElementById('svc-selected-type').value = '';
  document.getElementById('svc-desc').value = '';
  document.getElementById('svc-qty').value = 1;
  document.getElementById('svc-unit-price').value = '';
  document.getElementById('svc-amount').value = '';
  document.getElementById('svc-method').value = 'Cash';
  document.getElementById('svc-customer').value = '';
  document.getElementById('svc-phone').value = '';
  document.getElementById('svc-date').value = new Date().toISOString().split('T')[0];
  renderServiceTypeGrid();
}

async function submitService() {
  if (!can('services')) { toast('Access denied.', 'error'); return; }
  const btn = document.getElementById('svc-submit-btn');

  const serviceType = document.getElementById('svc-selected-type').value;
  const amount       = +document.getElementById('svc-amount').value;

  if (!serviceType) { toast('Select a service type.', 'error'); return; }
  if (!amount || amount <= 0) { toast('Enter a valid amount.', 'error'); return; }

  const payload = {
    serviceType,
    description: document.getElementById('svc-desc').value.trim(),
    qty:         +document.getElementById('svc-qty').value || 1,
    unitPrice:   +document.getElementById('svc-unit-price').value || 0,
    amount,
    method:      document.getElementById('svc-method').value,
    customer:    document.getElementById('svc-customer').value.trim(),
    phone:       document.getElementById('svc-phone').value.trim(),
    date:        document.getElementById('svc-date').value || new Date().toISOString().split('T')[0],
    recordedBy:  state.user?.fullName || state.user?.username || 'System',
  };

  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Saving&hellip;';
  try {
    const res = await apiPost('recordService', payload);
    if (res.success) {
      toast('Service recorded!', 'success');
      reloadAfterWrite();
      showServiceReceipt(payload, res.receiptNo);
      clearServiceForm();
    } else {
      toast('Error: ' + (res.error || 'Unknown'), 'error');
    }
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
  btn.disabled = false;
  btn.innerHTML = '&#128179; Record &amp; Print Receipt';
}

function showServiceReceipt(p, rcpNo) {
  document.getElementById('modal-svc-receipt-body').innerHTML = `
    <div class="receipt-wrap" id="svc-receipt-print-area">
      ${receiptBrandHeaderHtml('Office Services Receipt')}
      <hr class="receipt-divider">
      <div class="receipt-row"><span class="rl">Receipt No.</span><span class="rr">${rcpNo||'&mdash;'}</span></div>
      <div class="receipt-row"><span class="rl">Date</span><span class="rr">${fmtDate(p.date)}</span></div>
      <hr class="receipt-divider">
      <div class="receipt-row"><span class="rl">Service</span><span class="rr">${p.serviceType}</span></div>
      ${p.description?`<div class="receipt-row"><span class="rl">Description</span><span class="rr" style="max-width:200px;text-align:right;">${p.description}</span></div>`:''}
      <div class="receipt-row"><span class="rl">Quantity</span><span class="rr">${p.qty}</span></div>
      <div class="receipt-row"><span class="rl">Unit Price</span><span class="rr">KES ${fmt(p.unitPrice)}</span></div>
      <hr class="receipt-divider">
      <div class="receipt-row"><span class="rl">Payment Method</span><span class="rr">${p.method}</span></div>
      ${p.customer?`<div class="receipt-row"><span class="rl">Customer</span><span class="rr">${p.customer}</span></div>`:''}
      ${p.phone?`<div class="receipt-row"><span class="rl">Phone</span><span class="rr">${p.phone}</span></div>`:''}
      <div class="receipt-total"><span>Amount Paid</span><span>KES ${fmt(p.amount)}</span></div>
      <div class="receipt-stamp">Thank you for visiting our office.<br>${BRAND.name} &middot; ${BRAND.branch}</div>
      ${receiptContactFooterHtml()}
    </div>`;
  openModal('modal-svc-receipt');
}

function showServiceReceiptById(receiptNo) {
  const r = state.services.find(x => x.receiptNo === receiptNo);
  if (!r) { toast('Receipt not found.', 'error'); return; }
  showServiceReceipt(r, r.receiptNo);
}

function downloadServiceReceiptPdf() {
  const area = document.getElementById('svc-receipt-print-area');
  if (!area) { toast('No receipt open.', 'error'); return; }

  const data = {};
  area.querySelectorAll('.receipt-row').forEach(row => {
    const spans = row.querySelectorAll('span');
    if (spans.length >= 2) data[spans[0].textContent.trim()] = spans[1].textContent.trim();
  });
  const totalSpans = area.querySelectorAll('.receipt-total span');
  const totalLabel = totalSpans[0]?.textContent.trim() || 'Amount Paid';
  const totalValue = totalSpans[1]?.textContent.trim() || '';
  const stampLines = (area.querySelector('.receipt-stamp')?.innerText || '').split('\n').filter(Boolean);

  const doc = _newDoc();
  let y = _drawHeader(doc, 'Service Receipt');

  y = _sectionLabel(doc, y, 'Receipt Details');
  y = _row(doc, y, 'Receipt No.', data['Receipt No.'] || '—', { shade: true });
  y = _row(doc, y, 'Date',        data['Date']        || '—');
  y += 3;

  y = _divider(doc, y);

  y = _sectionLabel(doc, y, 'Service Details');
  y = _row(doc, y, 'Service',     data['Service']     || '—', { shade: true });
  if (data['Description']) y = _row(doc, y, 'Description', data['Description']);
  y = _row(doc, y, 'Quantity',    data['Quantity']    || '1');
  y = _row(doc, y, 'Unit Price',  data['Unit Price']  || '—');
  y += 3;

  y = _divider(doc, y);

  y = _sectionLabel(doc, y, 'Payment Details');
  y = _row(doc, y, 'Method', data['Payment Method'] || '—', { shade: true });
  if (data['Customer']) y = _row(doc, y, 'Customer', data['Customer']);
  if (data['Phone'])    y = _row(doc, y, 'Phone',    data['Phone']);
  y += 3;

  y = _divider(doc, y, false);

  y = _totalBar(doc, y, totalLabel, totalValue);
  y += 4;

  _footer(doc, y, [
    ...stampLines,
    'Generated: ' + new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' }),
  ]);

  const rcpNo = (data['Receipt No.'] || 'service-receipt').replace(/[/\\]/g, '-');
  _save(doc, 'JTI_ServiceReceipt_' + rcpNo + '.pdf');
}

// ── Admin: Edit / Delete service transactions (duty segregation) ──
// Staff can record service transactions but cannot edit or delete them
// once saved — only Admin (servicesManage permission) can correct or
// remove a transaction, and every edit is logged with who/when/why.

function openEditServiceModal(receiptNo) {
  if (!can('servicesManage')) { toast('Only an Admin can edit service transactions.', 'error'); return; }
  const s = state.services.find(x => x.receiptNo === receiptNo);
  if (!s) { toast('Transaction not found.', 'error'); return; }

  document.getElementById('esvc-receipt-no').value      = s.receiptNo;
  document.getElementById('esvc-receipt-display').value = s.receiptNo;
  document.getElementById('esvc-type').value             = s.serviceType || '';
  document.getElementById('esvc-desc').value              = s.description || '';
  document.getElementById('esvc-qty').value               = s.qty || 1;
  document.getElementById('esvc-amount').value            = s.amount || '';
  document.getElementById('esvc-method').value            = s.method || 'Cash';
  document.getElementById('esvc-date').value              = toDateInputValue(s.date) || s.date;
  document.getElementById('esvc-customer').value          = s.customer || '';
  document.getElementById('esvc-phone').value              = s.phone || '';
  document.getElementById('esvc-reason').value            = '';
  openModal('modal-edit-service');
}

async function saveEditedService() {
  if (!can('servicesManage')) { toast('Only an Admin can edit service transactions.', 'error'); return; }

  const receiptNo = document.getElementById('esvc-receipt-no').value;
  const amount    = +document.getElementById('esvc-amount').value;
  const reason    = document.getElementById('esvc-reason').value.trim();

  if (!amount || amount <= 0) { toast('Enter a valid amount.', 'error'); return; }
  if (!reason) { toast('A reason for the edit is required (audit log).', 'error'); return; }

  const payload = {
    receiptNo,
    serviceType: document.getElementById('esvc-type').value.trim(),
    description: document.getElementById('esvc-desc').value.trim(),
    qty:         +document.getElementById('esvc-qty').value || 1,
    amount,
    method:      document.getElementById('esvc-method').value,
    date:        document.getElementById('esvc-date').value,
    customer:    document.getElementById('esvc-customer').value.trim(),
    phone:       document.getElementById('esvc-phone').value.trim(),
    editReason:  reason,
    editedBy:    state.user?.fullName || state.user?.username || 'Admin',
  };

  const btn = document.getElementById('esvc-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Saving&hellip;';
  try {
    const res = await apiPost('updateService', payload);
    if (res.success) {
      toast('Transaction updated and logged.', 'success');
      closeModal('modal-edit-service');
      reloadAfterWrite();
    } else toast('Error: ' + (res.error || 'Unknown'), 'error');
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
  btn.disabled = false;
  btn.innerHTML = '&#128190; Save Changes';
}

async function deleteServiceTransaction(receiptNo) {
  if (!can('servicesManage')) { toast('Only an Admin can delete service transactions.', 'error'); return; }
  const s = state.services.find(x => x.receiptNo === receiptNo);
  if (!s) return;
  const reason = prompt(`Delete transaction ${receiptNo} (KES ${fmt(s.amount)})?\n\nEnter a reason for this deletion (required for audit log):`);
  if (reason === null) return; // cancelled
  if (!reason.trim()) { toast('A reason is required to delete a transaction.', 'error'); return; }

  try {
    const res = await apiPost('deleteService', {
      receiptNo,
      deletedBy: state.user?.fullName || state.user?.username || 'Admin',
      deleteReason: reason.trim(),
    });
    if (res.success) { toast('Transaction deleted.', 'success'); reloadAfterWrite(); }
    else toast('Error: ' + (res.error || 'Unknown'), 'error');
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
}

// ── Daily Log ────────────────────────────────────────────

function populateServiceTypeFilter() {
  const sel = document.getElementById('svc-log-type-filter');
  if (!sel) return;
  const current = sel.value;
  const types = [...new Set(state.services.map(s => s.serviceType).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">All Service Types</option>' + types.map(t => `<option value="${t}">${t}</option>`).join('');
  if (current) sel.value = current;
}

function renderServiceLog(filtered) {
  const data  = filtered || state.services;
  const tbody = document.getElementById('svc-log-tbody');
  document.getElementById('svc-log-count').textContent = data.length + ' records';
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--muted);">No service transactions found</td></tr>'; return; }
  tbody.innerHTML = [...data].sort((a,b) => new Date(b.createdAt||b.date) - new Date(a.createdAt||a.date)).map((s,i) => `
    <tr>
      <td>${data.length - i}</td>
      <td>${fmtDate(s.date)}</td>
      <td><strong>${s.receiptNo||'&mdash;'}</strong>${s.editedAt ? '<br><span class="badge badge-warning" style="margin-top:3px;" title="Edited by '+(s.editedBy||'Admin')+' on '+fmtDate(s.editedAt)+'">&#9999; Edited</span>' : ''}</td>
      <td><span class="badge badge-purple">${s.serviceType}</span></td>
      <td style="font-size:12.5px;">${s.description||'&mdash;'}</td>
      <td>${s.qty||1}</td>
      <td style="font-weight:700;color:var(--success);">KES ${fmt(s.amount)}</td>
      <td><span class="badge badge-info">${s.method}</span></td>
      <td>${s.customer||'&mdash;'}</td>
      <td style="font-size:12px;color:var(--muted);">${s.recordedBy||'&mdash;'}</td>
      <td><div class="actions-cell">
        <button class="btn btn-outline btn-sm" onclick="showServiceReceiptById('${s.receiptNo}')">&#129534;</button>
        ${can('servicesManage') ? `<button class="btn btn-primary btn-sm" onclick="openEditServiceModal('${s.receiptNo}')">&#9999;</button>` : ''}
        ${can('servicesManage') ? `<button class="btn btn-danger btn-sm" onclick="deleteServiceTransaction('${s.receiptNo}')">&#128465;</button>` : ''}
      </div></td>
    </tr>`).join('');
}

function filterServiceLog() {
  const q    = (document.getElementById('svc-log-search')?.value || '').toLowerCase();
  const date = document.getElementById('svc-log-date')?.value || '';
  const type = document.getElementById('svc-log-type-filter')?.value || '';
  const filtered = state.services.filter(s => {
    const mq = !q || [s.customer, s.serviceType, s.receiptNo, s.description].some(v => v && v.toLowerCase().includes(q));
    const md = !date || dateKey(s.date) === date;
    const mt = !type || s.serviceType === type;
    return mq && md && mt;
  });
  renderServiceLog(filtered);
}

function toggleServiceLogShowAll() {
  _svcLogShowAll = !_svcLogShowAll;
  const dateEl = document.getElementById('svc-log-date');
  const btn    = document.getElementById('svc-log-showall-btn');
  if (_svcLogShowAll) {
    dateEl.value = '';
    dateEl.disabled = true;
    btn.innerHTML = '&#128197; Today Only';
    btn.classList.add('btn-gold');
  } else {
    dateEl.disabled = false;
    dateEl.value = new Date().toISOString().split('T')[0];
    btn.innerHTML = '&#128197; Show All Dates';
    btn.classList.remove('btn-gold');
  }
  filterServiceLog();
}

function clearServiceLogFilter() {
  document.getElementById('svc-log-search').value = '';
  document.getElementById('svc-log-type-filter').value = '';
  if (!_svcLogShowAll) {
    document.getElementById('svc-log-date').value = new Date().toISOString().split('T')[0];
  } else {
    document.getElementById('svc-log-date').value = '';
  }
  filterServiceLog();
}

function exportServiceLog() {
  const q    = (document.getElementById('svc-log-search')?.value || '').toLowerCase();
  const date = document.getElementById('svc-log-date')?.value || '';
  const type = document.getElementById('svc-log-type-filter')?.value || '';
  const data = state.services.filter(s => {
    const mq = !q || [s.customer, s.serviceType, s.receiptNo, s.description].some(v => v && v.toLowerCase().includes(q));
    const md = !date || dateKey(s.date) === date;
    const mt = !type || s.serviceType === type;
    return mq && md && mt;
  });
  downloadWorkbook(data.map(s => ({
    'Receipt No.': s.receiptNo||'', 'Date': s.date||'', 'Service Type': s.serviceType||'',
    'Description': s.description||'', 'Qty': +s.qty||1, 'Unit Price': +s.unitPrice||0,
    'Amount': +s.amount||0, 'Method': s.method||'', 'Customer': s.customer||'',
    'Phone': s.phone||'', 'Recorded By': s.recordedBy||'',
  })), 'Service Log', 'JTI_Service_Log');
}

// ── Daily Reconciliation ─────────────────────────────────

function renderReconciliation() {
  const dateEl = document.getElementById('recon-date');
  if (!dateEl) return;
  const date = dateEl.value || new Date().toISOString().split('T')[0];

  const dayTx = state.services.filter(s => dateKey(s.date) === date);

  const total = dayTx.reduce((a, s) => a + (+s.amount || 0), 0);
  const svcCash  = dayTx.filter(s => s.method === 'Cash').reduce((a, s) => a + (+s.amount || 0), 0);
  const digital = total - svcCash;

  // Fee payments (Students/Fees module) made in cash on the same date — these land
  // in the same physical drawer, so they belong in the same cash reconciliation.
  const dayFeeCashTx = state.payments.filter(p => p.method === 'Cash' && dateKey(p.date) === date);
  const feeCash = dayFeeCashTx.reduce((a, p) => a + (+p.amount || 0), 0);

  const systemCashTotal = svcCash + feeCash;

  document.getElementById('recon-tx-count').textContent = dayTx.length;
  document.getElementById('recon-total').textContent    = 'KES ' + fmt(total);
  document.getElementById('recon-cash').textContent     = 'KES ' + fmt(systemCashTotal);
  document.getElementById('recon-digital').textContent  = 'KES ' + fmt(digital);

  // Breakdown by service type
  const byType = {};
  dayTx.forEach(s => {
    const k = s.serviceType || 'Other';
    if (!byType[k]) byType[k] = { count: 0, total: 0 };
    byType[k].count++;
    byType[k].total += (+s.amount || 0);
  });
  const typeRows = Object.entries(byType).sort((a,b) => b[1].total - a[1].total);
  document.getElementById('recon-by-type-tbody').innerHTML = typeRows.length
    ? typeRows.map(([name, v]) => `<tr><td>${name}</td><td>${v.count}</td><td style="font-weight:600;">KES ${fmt(v.total)}</td></tr>`).join('')
    : '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--muted);">No transactions for this date</td></tr>';

  // Breakdown by payment method (office services only)
  const byMethod = {};
  dayTx.forEach(s => {
    const k = s.method || 'Cash';
    byMethod[k] = (byMethod[k] || 0) + (+s.amount || 0);
  });
  const methodEntries = Object.entries(byMethod);
  document.getElementById('recon-by-method').innerHTML = methodEntries.length
    ? methodEntries.map(([m, v]) => `<div class="method-pill"><span class="mp-dot"></span>${m}: <strong>&nbsp;KES ${fmt(v)}</strong></div>`).join('')
    : '<div style="color:var(--muted);font-size:13px;">No transactions for this date</div>';

  // Office service transactions table
  const txBody = document.getElementById('recon-tx-tbody');
  txBody.innerHTML = dayTx.length
    ? [...dayTx].sort((a,b) => new Date(a.createdAt||a.date) - new Date(b.createdAt||b.date)).map(s => `
        <tr>
          <td>${fmtTime(s.createdAt) || '&mdash;'}</td>
          <td><strong>${s.receiptNo||'&mdash;'}</strong></td>
          <td>${s.serviceType||'&mdash;'}</td>
          <td style="font-weight:600;">KES ${fmt(s.amount)}</td>
          <td><span class="badge badge-info">${s.method}</span></td>
          <td>${s.customer||'&mdash;'}</td>
          <td style="font-size:12px;color:var(--muted);">${s.recordedBy||'&mdash;'}</td>
        </tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);">No transactions for this date</td></tr>';

  // Fee payment (cash) transactions table
  const feeCashBody = document.getElementById('recon-fee-cash-tbody');
  feeCashBody.innerHTML = dayFeeCashTx.length
    ? [...dayFeeCashTx].sort((a,b) => new Date(a.recordedAt||a.date) - new Date(b.recordedAt||b.date)).map(p => `
        <tr>
          <td>${fmtTime(p.recordedAt) || '&mdash;'}</td>
          <td><strong>${p.receiptNo||'&mdash;'}</strong></td>
          <td>${p.studentName||'&mdash;'}<br><small style="color:var(--muted);">${p.regNo||''}</small></td>
          <td style="font-weight:600;color:var(--success);">KES ${fmt(p.amount)}</td>
          <td style="font-size:12px;color:var(--muted);">${p.ref||'&mdash;'}</td>
        </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--muted);">No cash fee payments for this date</td></tr>';

  // ── Cash reconciliation card (Admin-only — duty segregation) ──
  document.getElementById('recon-system-cash-display').value = 'KES ' + fmt(systemCashTotal);
  document.getElementById('recon-cash-source-breakdown').innerHTML = `
    <div class="method-pill"><span class="mp-dot"></span>Office Services Cash: <strong>&nbsp;KES ${fmt(svcCash)}</strong></div>
    <div class="method-pill"><span class="mp-dot"></span>Fee Payments Cash: <strong>&nbsp;KES ${fmt(feeCash)}</strong></div>`;

  const countedInput = document.getElementById('recon-counted-cash');
  const notesInput    = document.getElementById('recon-notes');
  const saveBtn        = document.getElementById('recon-save-btn');
  const statusBanner   = document.getElementById('recon-status-banner');
  const lastSavedEl     = document.getElementById('recon-last-saved');

  // Pre-fill from any existing saved reconciliation for this date
  const existing = (state.reconciliations || []).find(r => dateKey(r.date) === date);
  countedInput.value = existing ? existing.countedCash : '';
  notesInput.value   = existing ? existing.notes : '';

  if (!can('reconcile')) {
    countedInput.disabled = true;
    notesInput.disabled = true;
    saveBtn.disabled = true;
    saveBtn.style.display = 'none';
    statusBanner.style.display = 'block';
    statusBanner.innerHTML = `<div class="notice neutral">
      <div class="notice-icon">&#128274;</div>
      <div><div class="notice-title">Admin-only</div>
      <div class="notice-body">Only an Admin can count and reconcile cash. Ask your Admin to complete today's reconciliation.</div></div></div>`;
  } else {
    countedInput.disabled = false;
    notesInput.disabled = false;
    saveBtn.disabled = false;
    saveBtn.style.display = '';
    statusBanner.style.display = 'none';
  }

  if (existing) {
    lastSavedEl.innerHTML = `Last reconciled by <strong>${existing.reconciledBy||'Admin'}</strong> on ${fmtDate(existing.createdAt)} ${fmtTime(existing.createdAt)}`;
  } else {
    lastSavedEl.innerHTML = '';
  }

  updateReconVariance();
  renderReconciliationHistory();
}

/** Recomputes the variance display whenever the counted-cash figure changes */
function updateReconVariance() {
  const cashText = document.getElementById('recon-system-cash-display').value || '';
  const systemCash = +(cashText.replace(/[^\d.-]/g, '')) || 0;
  const countedRaw = document.getElementById('recon-counted-cash').value;
  const varianceEl = document.getElementById('recon-variance-display');

  if (countedRaw === '' || countedRaw === null) {
    varianceEl.value = '';
    varianceEl.style.color = '';
    return;
  }
  const counted  = +countedRaw || 0;
  const variance = counted - systemCash;

  if (variance === 0) {
    varianceEl.value = 'KES 0 — Balanced';
    varianceEl.style.color = 'var(--success)';
  } else if (variance > 0) {
    varianceEl.value = '+KES ' + fmt(variance) + ' (Surplus)';
    varianceEl.style.color = 'var(--info)';
  } else {
    varianceEl.value = '-KES ' + fmt(Math.abs(variance)) + ' (Shortage)';
    varianceEl.style.color = 'var(--danger)';
  }
}

/** Admin saves the cash reconciliation for the selected date (system vs counted) */
async function saveCashReconciliation() {
  if (!can('reconcile')) { toast('Only an Admin can reconcile cash.', 'error'); return; }

  const date = document.getElementById('recon-date').value || new Date().toISOString().split('T')[0];
  const cashText = document.getElementById('recon-system-cash-display').value || '';
  const systemCash = +(cashText.replace(/[^\d.-]/g, '')) || 0;
  const digitalText = document.getElementById('recon-digital').textContent || '';
  const systemDigital = +(digitalText.replace(/[^\d.-]/g, '')) || 0;
  const countedRaw = document.getElementById('recon-counted-cash').value;

  if (countedRaw === '' || countedRaw === null) { toast('Enter the physically counted cash amount.', 'error'); return; }
  const countedCash = +countedRaw;
  if (isNaN(countedCash) || countedCash < 0) { toast('Enter a valid counted cash amount.', 'error'); return; }

  const payload = {
    date, systemCash, countedCash, systemDigital,
    notes: document.getElementById('recon-notes').value.trim(),
    reconciledBy: state.user?.fullName || state.user?.username || 'Admin',
  };

  const btn = document.getElementById('recon-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Saving&hellip;';
  try {
    const res = await apiPost('saveReconciliation', payload);
    if (res.success) {
      const variance = res.variance || 0;
      const msg = variance === 0
        ? 'Reconciled — cash balances exactly.'
        : variance > 0
          ? `Reconciled — surplus of KES ${fmt(variance)}.`
          : `Reconciled — shortage of KES ${fmt(Math.abs(variance))}.`;
      toast(msg, variance === 0 ? 'success' : 'warning');
      reloadAfterWrite();
    } else toast('Error: ' + (res.error || 'Unknown'), 'error');
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
  btn.disabled = false;
  btn.innerHTML = '&#9989; Save Reconciliation';
}

/** Renders the table of all previously saved daily reconciliations, most recent first */
function renderReconciliationHistory() {
  const tbody = document.getElementById('recon-history-tbody');
  if (!tbody) return;
  const records = [...(state.reconciliations || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--muted);">No reconciliations saved yet</td></tr>';
    return;
  }
  const currentDate = document.getElementById('recon-date')?.value || '';
  tbody.innerHTML = records.map(r => {
    const variance = +r.variance || 0;
    const badge = variance === 0 ? 'badge-success' : variance > 0 ? 'badge-info' : 'badge-danger';
    const label = variance === 0 ? 'Balanced' : variance > 0 ? '+KES ' + fmt(variance) : '-KES ' + fmt(Math.abs(variance));
    const isCurrentRow = dateKey(r.date) === currentDate;
    return `<tr style="${isCurrentRow ? 'background:var(--cream);' : ''}">
      <td><strong>${fmtDate(r.date)}</strong></td>
      <td>KES ${fmt(r.systemCash)}</td>
      <td>KES ${fmt(r.countedCash)}</td>
      <td><span class="badge ${badge}">${label}</span></td>
      <td style="font-size:12px;color:var(--muted);">${r.reconciledBy||'&mdash;'}</td>
      <td style="font-size:12px;color:var(--muted);">${fmtDate(r.createdAt)} ${fmtTime(r.createdAt)}</td>
      <td style="font-size:12.5px;max-width:180px;">${r.notes||'&mdash;'}</td>
      <td><button class="btn btn-outline btn-sm" onclick="jumpToReconDate('${dateKey(r.date)}')">&#128065; View</button></td>
    </tr>`;
  }).join('');
}

/** Jumps the reconciliation date picker to a given date and re-renders */
function jumpToReconDate(dateStr) {
  if (!dateStr) return;
  document.getElementById('recon-date').value = dateStr;
  renderReconciliation();
  document.getElementById('recon-cash-count-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exportReconciliationHistory() {
  const records = [...(state.reconciliations || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!records.length) { toast('No reconciliation history to export.', 'warning'); return; }
  downloadWorkbook(records.map(r => ({
    'Date': r.date || '', 'System Cash': +r.systemCash || 0, 'Counted Cash': +r.countedCash || 0,
    'Variance': +r.variance || 0, 'System Digital (M-Pesa/Bank)': +r.systemDigital || 0,
    'Total System': +r.totalSystem || 0, 'Reconciled By': r.reconciledBy || '',
    'Saved At': r.createdAt || '', 'Notes': r.notes || '',
  })), 'Reconciliation History', 'JTI_Reconciliation_History');
}

function exportReconciliation() {
  const date = document.getElementById('recon-date').value || new Date().toISOString().split('T')[0];
  const dayTx = state.services.filter(s => dateKey(s.date) === date);
  if (!dayTx.length) { toast('No transactions to export for this date.', 'warning'); return; }
  downloadWorkbook(dayTx.map(s => ({
    'Time': fmtTime(s.createdAt) || '', 'Receipt No.': s.receiptNo||'', 'Service Type': s.serviceType||'',
    'Description': s.description||'', 'Amount': +s.amount||0, 'Method': s.method||'',
    'Customer': s.customer||'', 'Phone': s.phone||'', 'Recorded By': s.recordedBy||'',
  })), 'Reconciliation_' + date, 'JTI_Daily_Reconciliation_' + date);
}

function printReconciliation() {
  window.print();
}

// ── Service Types (Price List) management ────────────────

function renderServiceTypesTable() {
  const tbody = document.getElementById('svc-types-tbody');
  if (!tbody) return;
  const types = effectiveServiceTypes();
  if (!types.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted);">No service types yet</td></tr>'; return; }
  tbody.innerHTML = types.map(t => `
    <tr>
      <td style="font-size:18px;">${t.icon||'&#128424;'}</td>
      <td>${t.name}</td>
      <td>KES ${fmt(t.price||0)}</td>
      <td><div class="actions-cell">
        ${can('services') ? `<button class="btn btn-outline btn-sm" onclick="editServiceType('${t.name.replace(/'/g,"\\'")}')">&#9999; Edit</button>` : ''}
        ${can('services') ? `<button class="btn btn-danger btn-sm" onclick="deleteServiceType('${t.name.replace(/'/g,"\\'")}')">&#128465;</button>` : ''}
        ${!can('services') ? '&mdash;' : ''}
      </div></td>
    </tr>`).join('');
}

function editServiceType(name) {
  if (!can('services')) { toast('Access denied.', 'error'); return; }
  const t = effectiveServiceTypes().find(x => x.name === name);
  if (!t) return;
  document.getElementById('svct-name').value           = t.name;
  document.getElementById('svct-icon').value            = t.icon || '';
  document.getElementById('svct-price').value           = t.price || '';
  document.getElementById('svct-edit-mode').value       = 'true';
  document.getElementById('svct-original-name').value   = t.name;
  document.getElementById('svct-form-title').textContent = 'Edit Service Type';
  document.getElementById('svct-save-btn').textContent  = 'Update Service Type';
  document.getElementById('svct-cancel-btn').style.display = '';
  document.getElementById('svct-name').focus();
}

function clearServiceTypeForm() {
  ['svct-name','svct-icon','svct-price'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('svct-edit-mode').value       = 'false';
  document.getElementById('svct-original-name').value   = '';
  document.getElementById('svct-form-title').textContent = 'Add Service Type';
  document.getElementById('svct-save-btn').textContent  = 'Save Service Type';
  document.getElementById('svct-cancel-btn').style.display = 'none';
}

async function saveServiceType() {
  if (!can('services')) { toast('Access denied.', 'error'); return; }
  const name     = document.getElementById('svct-name').value.trim();
  const icon     = document.getElementById('svct-icon').value.trim() || '\u{1F4C4}';
  const price    = +document.getElementById('svct-price').value || 0;
  const editMode = document.getElementById('svct-edit-mode').value === 'true';
  const origName = document.getElementById('svct-original-name').value;

  if (!name) { toast('Service name is required.', 'error'); return; }

  const btn = document.getElementById('svct-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Saving&hellip;';

  try {
    const action  = editMode ? 'updateServiceType' : 'addServiceType';
    const payload = editMode ? { originalName: origName, name, icon, price } : { name, icon, price };
    const res = await apiPost(action, payload);
    if (res.success) {
      toast(editMode ? 'Service type updated!' : 'Service type saved!', 'success');
      reloadAfterWrite();
      clearServiceTypeForm();
    } else toast('Error: ' + res.error, 'error');
  } catch (e) { toast('Failed: ' + e.message, 'error'); }

  btn.disabled = false;
  btn.innerHTML = editMode ? 'Update Service Type' : 'Save Service Type';
}

async function deleteServiceType(name) {
  if (!can('services')) { toast('Access denied.', 'error'); return; }
  if (!confirm('Delete service type "' + name + '"?')) return;
  try {
    const res = await apiPost('deleteServiceType', { name });
    if (res.success) { toast('Deleted.', 'success'); reloadAfterWrite(); clearServiceTypeForm(); }
    else toast('Error: ' + res.error, 'error');
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
}

// ════════════════════════════════════════════════
//  STAFF ATTENDANCE MODULE
// ════════════════════════════════════════════════

/** Constants — must match WORK_START_HOUR/MINUTE in code.gs */
const ATT_START_HOUR   = 8;
const ATT_START_MINUTE = 0;

const LEAVE_STATUSES = new Set([
  'Annual Leave','Sick Leave','Maternity Leave','Paternity Leave',
  'Study Leave','Compassionate Leave','Unpaid Leave',
]);

/**
 * The staff dropdown used by "Mark Attendance (Admin)" is populated from
 * state.users, which is normally only fetched when the User Management
 * page is visited (loadUsersTable()). If an Admin opens Attendance first,
 * that list would still be empty and the dropdown would have nothing to
 * select — so this is now async and loads the user list itself when
 * needed, before rendering anything that depends on it.
 */
async function initAttendancePage() {
  const today = new Date().toISOString().split('T')[0];
  const todayLabel = new Date().toLocaleDateString('en-KE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});

  // Set default dates
  const regDateEl = document.getElementById('att-reg-date');
  const markDateEl = document.getElementById('att-mark-date');
  const summaryEl  = document.getElementById('att-summary-month');
  if (regDateEl && !regDateEl.value)   regDateEl.value   = today;
  if (markDateEl && !markDateEl.value) markDateEl.value  = today;
  if (summaryEl && !summaryEl.value)   summaryEl.value   = today.slice(0, 7);

  // Today label
  const todayLabelEl = document.getElementById('att-today-label');
  if (todayLabelEl) todayLabelEl.textContent = todayLabel;

  // Show/hide admin-only card
  const adminCard = document.getElementById('att-admin-mark-card');
  if (adminCard) adminCard.style.display = can('delete') ? '' : 'none';

  // Staff list (Users) is normally only loaded when User Management is
  // visited. If Attendance is opened first, load it here too so the
  // "Mark Attendance" dropdown isn't empty.
  if (can('delete') && (!state.users || !state.users.length)) {
    await loadUsersTable();
  }

  // Populate staff dropdown
  populateAttStaffDropdown();

  // Render current user clock status
  renderMyClockStatus();

  // Render today summary
  renderTodaySummary();
  renderAttRegister();
  renderAttSummary();
}

function switchAttTab(tabId) {
  ['att-clockin','att-register','att-summary'].forEach(id => {
    document.getElementById('tab-' + id).style.display = (id === tabId) ? '' : 'none';
  });
  document.querySelectorAll('#page-attendance .tab-btn').forEach((b, i) => {
    const order = ['att-clockin','att-register','att-summary'];
    b.classList.toggle('active', order[i] === tabId);
  });
  if (tabId === 'att-register') renderAttRegister();
  if (tabId === 'att-summary')  renderAttSummary();
}

function populateAttStaffDropdown() {
  const sel = document.getElementById('att-mark-staff');
  if (!sel) return;
  const staffList = (state.users || []).filter(u => u.status === 'Active');
  sel.innerHTML = '<option value="">Select staff&hellip;</option>' +
    staffList.map(u => `<option value="${u.username}" data-name="${u.fullName||u.username}">${u.fullName||u.username}</option>`).join('');
}

function renderMyClockStatus() {
  const me = state.user;
  if (!me) return;
  const today = new Date().toISOString().split('T')[0];
  const myRecord = (state.attendance || []).find(r => r.staffUsername === me.username && dateKey(r.date) === today);

  const statusEl  = document.getElementById('att-clock-status');
  const inBtn     = document.getElementById('att-clockin-btn');
  const outBtn    = document.getElementById('att-clockout-btn');
  if (!statusEl) return;

  if (!myRecord) {
    statusEl.innerHTML = `
      <div class="notice neutral">
        <div class="notice-icon">&#128198;</div>
        <div><div class="notice-title">Not clocked in yet</div>
        <div class="notice-body">Your attendance for today has not been recorded. Click Clock In to start.</div></div>
      </div>`;
    if (inBtn)  { inBtn.disabled = false; }
    if (outBtn) { outBtn.disabled = true; }
  } else if (myRecord.timeOut) {
    const hours = calcHours(myRecord.timeIn, myRecord.timeOut);
    statusEl.innerHTML = `
      <div class="notice success">
        <div class="notice-icon">&#9989;</div>
        <div><div class="notice-title">Attendance complete for today</div>
        <div class="notice-body">Clocked in: <strong>${myRecord.timeIn}</strong> &nbsp;|&nbsp; Clocked out: <strong>${myRecord.timeOut}</strong> &nbsp;|&nbsp; Hours: <strong>${hours}</strong>
        ${myRecord.lateFlag === 'Late' ? ' &nbsp;|&nbsp; <span style="color:var(--warning);font-weight:700;">&#9888; Arrived Late</span>' : ''}</div></div>
      </div>`;
    if (inBtn)  { inBtn.disabled = true; }
    if (outBtn) { outBtn.disabled = true; }
  } else {
    statusEl.innerHTML = `
      <div class="notice" style="background:#EFF8FF;border-color:#93C5FD;">
        <div class="notice-icon">&#9200;</div>
        <div><div class="notice-title">Clocked in at ${myRecord.timeIn}
          ${myRecord.lateFlag === 'Late' ? ' <span class="badge badge-warning">Late</span>' : '<span class="badge badge-success">On Time</span>'}
        </div>
        <div class="notice-body">Clock out when you leave for the day.</div></div>
      </div>`;
    if (inBtn)  { inBtn.disabled = true; }
    if (outBtn) { outBtn.disabled = false; }
  }
}

function renderTodaySummary() {
  const today = new Date().toISOString().split('T')[0];
  const todayRecs = (state.attendance || []).filter(r => dateKey(r.date) === today);

  const present = todayRecs.filter(r => r.status === 'Present').length;
  const late    = todayRecs.filter(r => r.lateFlag === 'Late').length;
  const leave   = todayRecs.filter(r => LEAVE_STATUSES.has(r.status)).length;
  const absent  = todayRecs.filter(r => r.status === 'Absent').length;

  document.getElementById('att-today-present').textContent = present;
  document.getElementById('att-today-late').textContent    = late;
  document.getElementById('att-today-leave').textContent   = leave;
  document.getElementById('att-today-absent').textContent  = absent;

  const tbody = document.getElementById('att-today-tbody');
  if (!todayRecs.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg compact">No attendance recorded yet today</td></tr>';
    return;
  }
  tbody.innerHTML = [...todayRecs].sort((a,b) => (a.staffName||'').localeCompare(b.staffName||'')).map(r => `
    <tr>
      <td><strong>${r.staffName||r.staffUsername}</strong></td>
      <td>${r.timeIn||'&mdash;'}</td>
      <td>${r.timeOut||'&mdash;'}</td>
      <td>${attStatusBadge(r.status)}</td>
      <td>${r.lateFlag ? `<span class="badge ${r.lateFlag==='Late'?'badge-warning':'badge-success'}">${r.lateFlag}</span>` : '&mdash;'}</td>
    </tr>`).join('');
}

// ── Self clock-in / clock-out ────────────────────────────

async function doClockIn() {
  const btn = document.getElementById('att-clockin-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Clocking in&hellip;';
  try {
    const res = await apiPost('clockIn', {
      staffUsername: state.user.username,
      staffName:     state.user.fullName || state.user.username,
      recordedBy:    state.user.username,
      remarks:       document.getElementById('att-remarks').value.trim(),
    });
    if (res.success) {
      if (res.alreadyClockedIn) {
        toast('Already clocked in today at ' + res.timeIn, 'warning');
      } else {
        toast('Clocked in at ' + res.timeIn + (res.lateFlag === 'Late' ? ' — marked Late' : ' — On Time') + '.', 'success');
      }
      reloadAfterWrite();
    } else toast('Error: ' + (res.error || 'Unknown'), 'error');
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
  btn.disabled = false;
  btn.innerHTML = '&#9200; Clock In';
}

async function doClockOut() {
  const btn = document.getElementById('att-clockout-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Clocking out&hellip;';
  try {
    const res = await apiPost('clockOut', {
      staffUsername: state.user.username,
      recordedBy:    state.user.username,
    });
    if (res.success) {
      toast('Clocked out at ' + res.timeOut + '. Have a good day!', 'success');
      reloadAfterWrite();
    } else toast('Error: ' + (res.error || 'Unknown'), 'error');
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
  btn.disabled = false;
  btn.innerHTML = '&#9201; Clock Out';
}

// ── Admin: Mark attendance ────────────────────────────────

function toggleAttLeaveType() {
  // Could expand to show/hide a leave-type sub-field but the status
  // dropdown already carries the leave type directly in its value, so
  // no separate field is needed.
}

async function adminMarkAttendance() {
  if (!can('delete')) { toast('Only an Admin can mark attendance for others.', 'error'); return; }
  const staffSel   = document.getElementById('att-mark-staff');
  const username   = staffSel.value;
  const staffName  = staffSel.options[staffSel.selectedIndex]?.dataset.name || username;
  const date       = document.getElementById('att-mark-date').value;
  const status     = document.getElementById('att-mark-status').value;

  if (!username || !date) { toast('Select a staff member and date.', 'error'); return; }

  const payload = {
    staffUsername: username, staffName, date, status,
    dayType:    document.getElementById('att-mark-daytype').value,
    timeIn:     document.getElementById('att-mark-timein').value,
    timeOut:    document.getElementById('att-mark-timeout').value,
    remarks:    document.getElementById('att-mark-remarks').value.trim(),
    recordedBy: state.user?.fullName || state.user?.username || 'Admin',
  };

  try {
    const res = await apiPost('markAttendance', payload);
    if (res.success) {
      toast('Attendance saved for ' + staffName + '.', 'success');
      document.getElementById('att-mark-timein').value  = '';
      document.getElementById('att-mark-timeout').value = '';
      document.getElementById('att-mark-remarks').value = '';
      reloadAfterWrite();
    } else toast('Error: ' + (res.error || 'Unknown'), 'error');
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
}

// ── Admin: Quick-add a Staff member (from the Attendance page) ──────────
// The Mark Attendance dropdown can only offer staff who already have a
// system login (Users sheet). Rather than forcing an Admin to leave the
// Attendance page and go to User Management just to onboard someone new,
// this opens a small modal right here that creates a Staff-role user, then
// immediately refreshes the dropdown so the new person can be marked.

function openAddStaffModal() {
  if (!can('users')) { toast('Only an Admin can add staff.', 'error'); return; }
  document.getElementById('staff-fullname').value = '';
  document.getElementById('staff-username').value = '';
  document.getElementById('staff-password').value = generateTempPassword();
  openModal('modal-add-staff');
}

/** A short, easy-to-read temporary password the Admin can hand off and
 *  ask the staff member to change after first login. */
function generateTempPassword() {
  return 'Jti' + Math.floor(1000 + Math.random() * 9000);
}

/** Suggests a username from the full name as it's typed (e.g.
 *  "Mary Wambui" -> "mary.wambui"), which the Admin can still edit. */
function suggestStaffUsername() {
  const fullName = document.getElementById('staff-fullname').value.trim();
  if (!fullName) return;
  const suggested = fullName.toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.');
  document.getElementById('staff-username').value = suggested;
}

async function submitAddStaff() {
  if (!can('users')) { toast('Only an Admin can add staff.', 'error'); return; }
  const fullName = document.getElementById('staff-fullname').value.trim();
  const username = document.getElementById('staff-username').value.trim().toLowerCase();
  const password  = document.getElementById('staff-password').value.trim();
  if (!fullName || !username || !password) { toast('Full name, username and password are required.', 'error'); return; }

  const btn = document.getElementById('staff-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Adding&hellip;';
  try {
    const res = await apiPost('addUser', { username, password, fullName, role: 'Staff', status: 'Active' });
    if (res.success) {
      toast(`Staff added — username "${username}", password "${password}". Share these securely.`, 'success');
      closeModal('modal-add-staff');
      await loadUsersTable();
      populateAttStaffDropdown();
    } else toast('Error: ' + (res.error || 'Unknown'), 'error');
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
  btn.disabled = false;
  btn.innerHTML = '&#128190; Add Staff';
}

// ── Daily Register ────────────────────────────────────────

function renderAttRegister() {
  const dateEl = document.getElementById('att-reg-date');
  if (!dateEl) return;
  const date = dateEl.value || new Date().toISOString().split('T')[0];
  const recs = (state.attendance || []).filter(r => dateKey(r.date) === date);

  const present = recs.filter(r => r.status === 'Present').length;
  const late    = recs.filter(r => r.lateFlag === 'Late').length;
  const leave   = recs.filter(r => LEAVE_STATUSES.has(r.status)).length;
  const absent  = recs.filter(r => r.status === 'Absent').length;
  document.getElementById('att-reg-present').textContent = present;
  document.getElementById('att-reg-late').textContent    = late;
  document.getElementById('att-reg-leave').textContent   = leave;
  document.getElementById('att-reg-absent').textContent  = absent;
  document.getElementById('att-reg-total').textContent   = recs.length;

  const tbody = document.getElementById('att-reg-tbody');
  if (!recs.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-msg">No attendance records for this date</td></tr>';
    return;
  }
  tbody.innerHTML = [...recs].sort((a,b) => (a.staffName||'').localeCompare(b.staffName||'')).map(r => `
    <tr>
      <td><strong>${r.staffName||r.staffUsername}</strong><br><small class="text-muted text-xs">${r.staffUsername}</small></td>
      <td>${r.dayType||'Weekday'}</td>
      <td style="font-weight:600;">${r.timeIn||'&mdash;'}</td>
      <td style="font-weight:600;">${r.timeOut||'&mdash;'}</td>
      <td>${calcHours(r.timeIn, r.timeOut)}</td>
      <td>${attStatusBadge(r.status)}</td>
      <td>${r.lateFlag ? `<span class="badge ${r.lateFlag==='Late'?'badge-warning':'badge-success'}">${r.lateFlag}</span>` : '&mdash;'}</td>
      <td style="font-size:12.5px;max-width:160px;">${r.remarks||'&mdash;'}${r.editedAt ? ' <span class="badge badge-warning" title="Edited by '+r.editedBy+': '+r.editReason+'">&#9999; Edited</span>' : ''}</td>
      <td style="font-size:12px;color:var(--muted);">${r.recordedBy||'&mdash;'}</td>
      <td><div class="actions-cell">
        ${can('delete') ? `<button class="btn btn-primary btn-sm" onclick="openEditAttModal('${r.attendanceId}')">&#9999;</button>` : ''}
        ${can('delete') ? `<button class="btn btn-danger btn-sm" onclick="deleteAttRecord('${r.attendanceId}')">&#128465;</button>` : ''}
      </div></td>
    </tr>`).join('');
}

function exportAttRegister() {
  const date = document.getElementById('att-reg-date')?.value || new Date().toISOString().split('T')[0];
  const recs = (state.attendance || []).filter(r => dateKey(r.date) === date);
  if (!recs.length) { toast('No records for this date.', 'warning'); return; }
  downloadWorkbook(recs.sort((a,b)=>(a.staffName||'').localeCompare(b.staffName||'')).map(r => ({
    'Staff Name': r.staffName||'', 'Username': r.staffUsername||'', 'Date': r.date||'',
    'Day Type': r.dayType||'', 'Time In': r.timeIn||'', 'Time Out': r.timeOut||'',
    'Hours': calcHoursRaw(r.timeIn, r.timeOut), 'Status': r.status||'',
    'Lateness': r.lateFlag||'', 'Remarks': r.remarks||'', 'Recorded By': r.recordedBy||'',
  })), 'Attendance_' + date, 'JTI_Attendance_' + date);
}

function printAttRegister() { window.print(); }

// ── Monthly Summary ───────────────────────────────────────

function renderAttSummary() {
  const monthEl = document.getElementById('att-summary-month');
  if (!monthEl) return;
  const month = monthEl.value || new Date().toISOString().slice(0, 7);

  const recs = (state.attendance || []).filter(r => r.date && r.date.startsWith(month));
  const tbody = document.getElementById('att-summary-tbody');

  if (!recs.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-msg">No attendance records for this month</td></tr>';
    return;
  }

  // Group by staff
  const byStaff = {};
  recs.forEach(r => {
    const key = r.staffUsername;
    if (!byStaff[key]) byStaff[key] = { name: r.staffName||r.staffUsername, recs: [] };
    byStaff[key].recs.push(r);
  });

  // Count working days in the month (Mon–Sat, adjust as needed)
  const [yr, mo] = month.split('-').map(Number);
  let workingDays = 0;
  const dim = new Date(yr, mo, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    const dow = new Date(yr, mo - 1, d).getDay();
    if (dow !== 0) workingDays++; // exclude Sundays
  }

  tbody.innerHTML = Object.values(byStaff)
    .sort((a,b) => a.name.localeCompare(b.name))
    .map(({ name, recs: staffRecs }) => {
      const present      = staffRecs.filter(r => r.status === 'Present').length;
      const late         = staffRecs.filter(r => r.lateFlag === 'Late').length;
      const absent       = staffRecs.filter(r => r.status === 'Absent').length;
      const annualLeave  = staffRecs.filter(r => r.status === 'Annual Leave').length;
      const sickLeave    = staffRecs.filter(r => r.status === 'Sick Leave').length;
      const otherLeave   = staffRecs.filter(r => LEAVE_STATUSES.has(r.status) && r.status !== 'Annual Leave' && r.status !== 'Sick Leave').length;
      const pct          = workingDays > 0 ? Math.round((present / workingDays) * 100) : 0;
      return `<tr>
        <td><strong>${name}</strong></td>
        <td>${workingDays}</td>
        <td style="color:var(--success);font-weight:600;">${present}</td>
        <td style="color:var(--warning);font-weight:600;">${late}</td>
        <td style="color:var(--danger);font-weight:600;">${absent}</td>
        <td>${annualLeave}</td>
        <td>${sickLeave}</td>
        <td>${otherLeave}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px;">
            <div class="progress-bar" style="width:80px;"><div class="progress-fill ${pct>=90?'success':pct<60?'danger':''}" style="width:${Math.min(pct,100)}%;"></div></div>
            <span style="font-size:12px;font-weight:600;">${pct}%</span>
          </div>
        </td>
      </tr>`;
    }).join('');
}

function exportAttSummary() {
  const month = document.getElementById('att-summary-month')?.value || new Date().toISOString().slice(0, 7);
  const recs  = (state.attendance || []).filter(r => r.date && r.date.startsWith(month));
  if (!recs.length) { toast('No records for this month.', 'warning'); return; }

  const byStaff = {};
  recs.forEach(r => {
    const key = r.staffUsername;
    if (!byStaff[key]) byStaff[key] = { name: r.staffName||r.staffUsername, recs: [] };
    byStaff[key].recs.push(r);
  });
  const [yr, mo] = month.split('-').map(Number);
  let workingDays = 0;
  const dim = new Date(yr, mo, 0).getDate();
  for (let d = 1; d <= dim; d++) { if (new Date(yr, mo - 1, d).getDay() !== 0) workingDays++; }

  downloadWorkbook(Object.values(byStaff).sort((a,b) => a.name.localeCompare(b.name)).map(({ name, recs: sr }) => ({
    'Staff Member': name,
    'Working Days in Month': workingDays,
    'Present': sr.filter(r => r.status === 'Present').length,
    'Late': sr.filter(r => r.lateFlag === 'Late').length,
    'Absent': sr.filter(r => r.status === 'Absent').length,
    'Annual Leave': sr.filter(r => r.status === 'Annual Leave').length,
    'Sick Leave': sr.filter(r => r.status === 'Sick Leave').length,
    'Other Leave': sr.filter(r => LEAVE_STATUSES.has(r.status) && !['Annual Leave','Sick Leave'].includes(r.status)).length,
    'Attendance %': workingDays > 0 ? Math.round((sr.filter(r => r.status==='Present').length / workingDays) * 100) : 0,
  })), 'Attendance_Summary_' + month, 'JTI_Attendance_Summary_' + month);
}

// ── Admin: Edit / Delete attendance ──────────────────────

function openEditAttModal(id) {
  if (!can('delete')) { toast('Only an Admin can edit attendance records.', 'error'); return; }
  const r = (state.attendance || []).find(x => x.attendanceId === id);
  if (!r) { toast('Record not found.', 'error'); return; }

  document.getElementById('eatt-id').value              = r.attendanceId;
  document.getElementById('eatt-staff-display').value   = (r.staffName||r.staffUsername) + ' — ' + dateKey(r.date);
  document.getElementById('eatt-status').value          = r.status || 'Present';
  document.getElementById('eatt-daytype').value         = r.dayType || 'Weekday';
  document.getElementById('eatt-timein').value          = r.timeIn || '';
  document.getElementById('eatt-timeout').value         = r.timeOut || '';
  document.getElementById('eatt-lateflag').value        = r.lateFlag || '';
  document.getElementById('eatt-remarks').value         = r.remarks || '';
  document.getElementById('eatt-reason').value          = '';
  openModal('modal-edit-attendance');
}

async function saveEditedAttendance() {
  if (!can('delete')) { toast('Only an Admin can edit attendance records.', 'error'); return; }
  const id     = document.getElementById('eatt-id').value;
  const reason = document.getElementById('eatt-reason').value.trim();
  if (!reason) { toast('A reason for the edit is required.', 'error'); return; }

  const btn = document.getElementById('eatt-save-btn');
  btn.disabled = true; btn.innerHTML = '<span class="loader"></span> Saving&hellip;';
  try {
    const res = await apiPost('updateAttendance', {
      attendanceId: id,
      status:    document.getElementById('eatt-status').value,
      dayType:   document.getElementById('eatt-daytype').value,
      timeIn:    document.getElementById('eatt-timein').value,
      timeOut:   document.getElementById('eatt-timeout').value,
      lateFlag:  document.getElementById('eatt-lateflag').value,
      remarks:   document.getElementById('eatt-remarks').value.trim(),
      editReason: reason,
      editedBy:  state.user?.fullName || state.user?.username || 'Admin',
    });
    if (res.success) {
      toast('Attendance updated.', 'success');
      closeModal('modal-edit-attendance');
      reloadAfterWrite();
    } else toast('Error: ' + (res.error || 'Unknown'), 'error');
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
  btn.disabled = false; btn.innerHTML = '&#128190; Save Changes';
}

async function deleteAttRecord(id) {
  if (!can('delete')) { toast('Only an Admin can delete attendance records.', 'error'); return; }
  const reason = prompt('Delete this attendance record?\n\nEnter a reason (required for audit log):');
  if (reason === null) return;
  if (!reason.trim()) { toast('A reason is required.', 'error'); return; }
  try {
    const res = await apiPost('deleteAttendance', { attendanceId: id, deleteReason: reason.trim() });
    if (res.success) { toast('Record deleted.', 'success'); reloadAfterWrite(); }
    else toast('Error: ' + (res.error || 'Unknown'), 'error');
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
}

// ── Attendance helpers ────────────────────────────────────

function attStatusBadge(status) {
  const map = {
    'Present': 'badge-success', 'Absent': 'badge-danger',
    'Annual Leave': 'badge-info', 'Sick Leave': 'badge-warning',
    'Off Day': 'badge-neutral', 'Public Holiday': 'badge-purple',
  };
  const cls = map[status] || 'badge-neutral';
  return `<span class="badge ${cls}">${status||'&mdash;'}</span>`;
}

function calcHoursRaw(timeIn, timeOut) {
  if (!timeIn || !timeOut) return 0;
  const [ih, im] = timeIn.split(':').map(Number);
  const [oh, om] = timeOut.split(':').map(Number);
  const mins = (oh * 60 + om) - (ih * 60 + im);
  return mins > 0 ? +(mins / 60).toFixed(2) : 0;
}

function calcHours(timeIn, timeOut) {
  const h = calcHoursRaw(timeIn, timeOut);
  if (!h) return '&mdash;';
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return hrs + 'h' + (mins ? ' ' + mins + 'm' : '');
}

// ════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════
function fmt(n) { return Number(n||0).toLocaleString('en-KE'); }
/** Normalises any date-ish value (Date object, ISO string, "2026-06-20", etc.)
 *  to a plain "YYYY-MM-DD" key for reliable same-day comparisons. Returns ''
 *  if the value can't be parsed, so callers can safely compare against it. */
function dateKey(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fmtDate(d) { if(!d) return '&mdash;'; try { return new Date(d).toLocaleDateString('en-KE',{day:'2-digit',month:'short',year:'numeric'}); } catch{return d;} }
function fmtTime(d) { if(!d) return ''; try { const dt = new Date(d); if (isNaN(dt)) return ''; return dt.toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'}); } catch { return ''; } }
function fmtIntake(d) {
  if(!d) return '&mdash;';
  const dt=new Date(d);
  if(isNaN(dt)) return d;
  return dt.toLocaleDateString('en-KE',{month:'short'}).toUpperCase()+'-'+dt.getFullYear();
}
function toDateInputValue(d) { if(!d) return ''; try { return new Date(d).toISOString().split('T')[0]; } catch { return ''; } }
function statusBadge(s) { return {Active:'badge-success',Inactive:'badge-neutral',Graduated:'badge-info',Suspended:'badge-danger'}[s]||'badge-neutral'; }
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function populateProgramDropdowns() {
  const programs=[...new Set([...state.courses.map(c=>c.name),...state.students.map(s=>s.program)].filter(Boolean))].sort();
  ['program','filter-program','fee-filter-program'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const current=el.value;
    const isFilter=id.includes('filter');
    el.innerHTML=(isFilter?'<option value="">All Programs</option>':'<option value="">Select program&hellip;</option>')+programs.map(p=>`<option value="${p}">${p}</option>`).join('');
    if(current) el.value=current;
  });
  populatePayStudentDropdown();
  populateServiceTypeFilter();
}

function toast(msg, type='info') {
  const tc=document.getElementById('toast-container');
  const t=document.createElement('div');
  t.className='toast '+type;
  t.innerHTML=`<span>${type==='success'?'✅':type==='error'?'❌':'ℹ'}</span> ${msg}`;
  tc.appendChild(t);
  setTimeout(()=>t.remove(),3500);
}

// ════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  // Clear stale cache keys from older versions
  ['jti_cache_v1'].forEach(k => { try { localStorage.removeItem(k); } catch(_) {} });

  // Pre-warm the logo image so it's ready by the time a PDF is generated
  preloadLogoForPdf();

  // Restore session
  const saved = sessionStorage.getItem('jti_user');
  if (saved) {
    try {
      state.user = JSON.parse(saved);
      applyRoleUI();
      showAppPage();
      loadAll();           // uses cache-then-network automatically
    } catch(_) { showLoginPage(); }
  } else {
    showLoginPage();
  }

  // Enter key on login
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitLogin();
  });
  document.getElementById('login-username').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitLogin();
  });

  // Default dates
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('enroll-date').value = today;
  document.getElementById('pay-date').value    = today;
  const svcDateEl   = document.getElementById('svc-date');
  const reconDateEl = document.getElementById('recon-date');
  if (svcDateEl)   svcDateEl.value   = today;
  if (reconDateEl) reconDateEl.value = today;

  if (window.innerWidth <= 768) document.getElementById('menu-toggle').style.display = 'flex';

  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
  });

  // Refresh data when tab becomes visible again after being hidden
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') silentRefresh();
  });
});
