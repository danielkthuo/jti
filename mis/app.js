const GAS_URL = 'https://script.google.com/macros/s/AKfycbxGq2qZoqpDzEvWXydUIx0aoPbTy7gSvOWSmX5AOkVQTGV-HKBG3Lb32WUfN7K8zsk/exec';

// ════════════════════════════════════════════════
//  JTI CONTACT DETAILS — used across receipts, invoices & PDFs
// ════════════════════════════════════════════════
const JTI = {
  name:   'Joshcab Training Institute',
  branch: 'Mwiki Branch',
  phone1: '0734 080 808',
  phone2: '0722 699 212',
  phones: '0734 080 808 / 0722 699 212',
  email:  'jckmwiki@gmail.com',
  logo:   'images/JTI logo.jpg',
};

// ════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════
let state = {
  students: [], payments: [], courses: [], feeStructures: [],
  invoiceRecords: [],
  currentPage: 'dashboard', editMode: false, editRegNo: null,
  user: null,
  users: [],
};

// ════════════════════════════════════════════════
//  ROLE PERMISSIONS
// ════════════════════════════════════════════════
const ROLES = {
  Admin:  { register: true,  payment: true,  delete: true,  courses: true,  users: true,  sms: true,  charge: true  },
  Staff:  { register: true,  payment: true,  delete: false, courses: false, users: false, sms: true,  charge: true  },
  Viewer: { register: false, payment: false, delete: false, courses: false, users: false, sms: false, charge: false },
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

  document.getElementById('topbar-user-name').textContent = state.user?.fullName || '';
  document.getElementById('topbar-user-role').textContent = r;
  document.getElementById('topbar-user-role').className =
    'role-badge role-' + r.toLowerCase();

  document.getElementById('nav-register').style.display  = can('register') ? '' : 'none';
  document.getElementById('nav-users').style.display     = can('users')    ? '' : 'none';

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
async function sendSms(phones, message) {
  const phoneList = Array.isArray(phones) ? phones : [phones];
  const normalised = phoneList
    .map(p => String(p).replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, ''))
    .filter(p => p.length >= 9);
  if (!normalised.length) return { success: false, sent: 0, failed: 0 };
  return apiPost('sendSms', { phones: normalised, message });
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
    ` Kindly clear at the earliest. Contact us: 0734 080 808. -Joshcab Training Institute`;
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
  if (!phone || !message) { toast('Phone and message are required.', 'error'); return; }
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Sending&hellip;';
  try {
    const res = await sendSms(phone, message);
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
        const res = await sendSms(s.phone, buildDefaulterSms(s));
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
  courses:'Courses & Programs', reports:'Reports', users:'User Management',
};

function navigate(page) {
  if (page === 'register' && !can('register')) { toast('Access denied.', 'error'); return; }
  if (page === 'users'    && !can('users'))    { toast('Access denied.', 'error'); return; }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'" + page + "'")) n.classList.add('active');
  });
  document.getElementById('page-title').textContent = pageTitles[page] || page;
  state.currentPage = page;
  if (page === 'register' && !state.editMode) prepRegisterForm();
  if (page === 'fees')     renderFeeOverview();
  if (page === 'payments') renderPayments();
  if (page === 'invoices') renderInvoices();
  if (page === 'reports')  renderReports();
  if (page === 'users')    loadUsersTable();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

function switchTab(tabId, page) {
  document.querySelectorAll('[id^="tab-fee-"]').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tabId).style.display = 'block';
  event.target.classList.add('active');
}

// ════════════════════════════════════════════════
//  DATA LOAD  —  fast path + cache
// ════════════════════════════════════════════════
const CACHE_KEY     = 'jti_cache_v2';
const CACHE_TTL_MS  = 5 * 60 * 1000;
let   _refreshTimer = null;

function applyData(bundle, renderMode) {
  state.students       = bundle.students || [];
  state.payments       = bundle.payments || [];
  state.courses        = bundle.courses  || [];
  state.invoiceRecords = bundle.invoices || [];
  populateProgramDropdowns();
  if (renderMode === 'current') renderCurrentPage();
  else renderAll();
}

function renderAll() {
  renderDashboard();
  renderStudentsTable();
  renderPayments();
  renderFeeOverview();
  renderInvoices();
  renderReports();
  renderCourses();
}

function renderCurrentPage() {
  const p = state.currentPage;
  if (p === 'dashboard') renderDashboard();
  else if (p === 'students') renderStudentsTable();
  else if (p === 'fees')     renderFeeOverview();
  else if (p === 'payments') renderPayments();
  else if (p === 'invoices') renderInvoices();
  else if (p === 'reports')  renderReports();
  else if (p === 'courses')  renderCourses();
  if (p !== 'dashboard') renderDashboard();
}

function saveCache(bundle) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), bundle })); } catch(_) {}
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, bundle } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return bundle;
  } catch(_) { return null; }
}

async function fetchFresh(silent = false) {
  if (!silent) setStatus('&#128260; Syncing&hellip;');
  const res = await api('getAll');
  if (!res.success) throw new Error(res.error || 'getAll failed');
  const bundle = {
    students: res.students || [],
    payments: res.payments || [],
    courses:  res.courses  || [],
    invoices: res.invoices || [],
  };
  saveCache(bundle);
  return bundle;
}

async function loadAll(forceFull = false) {
  const cached = loadCache();

  if (cached && !forceFull) {
    applyData(cached);
    setStatus('&#128993; Cached');

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

async function silentRefresh() {
  try {
    const bundle = await fetchFresh(true);
    applyData(bundle, 'current');
    setStatus('&#128994; Connected');
  } catch(e) {
    setStatus('&#128308; Offline');
  }
}

function scheduleAutoRefresh() {
  clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(async () => {
    await silentRefresh();
    scheduleAutoRefresh();
  }, CACHE_TTL_MS);
}

let _reloadDebounce = null;
function reloadAfterWrite() {
  clearTimeout(_reloadDebounce);
  _reloadDebounce = setTimeout(() => {
    try { localStorage.removeItem(CACHE_KEY); } catch(_) {}
    loadAll(true).then(() => renderAll());
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

  document.getElementById('dash-month-label').textContent =
    now.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });

  const monthEnrollments = s.filter(x => isThisMonth(x.enrollDate));
  document.getElementById('stat-month-enrollments').textContent = monthEnrollments.length;

  const monthPayments  = state.payments.filter(p => isThisMonth(p.date));
  const monthCollected = monthPayments.reduce((a, p) => a + (+p.amount || 0), 0);
  document.getElementById('stat-month-collected').textContent = 'KES ' + fmt(monthCollected);
  document.getElementById('stat-month-paycount').textContent  = monthPayments.length;
  const avgPayment = monthPayments.length ? monthCollected / monthPayments.length : 0;
  document.getElementById('stat-month-avg').textContent = 'KES ' + fmt(Math.round(avgPayment));

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
        sendSms(payload.phone, buildWelcomeSms(payload))
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
  document.getElementById('modal-edit-btn').onclick = () => { closeModal('modal-student'); editStudent(regNo); };
  document.getElementById('modal-sms-student-btn').onclick = () => { closeModal('modal-student'); openSmsModal(regNo); };
  document.getElementById('modal-charge-student-btn').onclick = () => { closeModal('modal-student'); openChargeModal(regNo); };
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
  document.querySelectorAll('.tab-btn').forEach((b,i)=>{
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
        sendSms(s.phone, buildPaymentSms(payload, receiptNo))
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
      <td style="font-weight:700;color:var(--success);">KES ${fmt(p.amount)}</td>
      <td><span class="badge badge-info">${p.method}</span></td>
      <td style="font-size:12px;color:var(--muted);">${p.ref||'&mdash;'}</td>
      <td style="color:${+p.newBalance>0?'var(--warning)':'var(--success)'};">KES ${fmt(p.newBalance)}</td>
      <td><button class="btn btn-outline btn-sm" onclick="showReceiptById('${p.receiptNo||p.regNo+p.date}')">&#129534; Receipt</button></td>
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

function showReceiptById(key) {
  const p = state.payments.find(x => (x.receiptNo || x.regNo + x.date) === key);
  if (!p) { toast('Receipt not found.', 'error'); return; }
  showReceipt(p, p.receiptNo || '');
}

// ── HTML receipt (modal) — professional letterhead layout ────────────
function showReceipt(p, rcpNo) {
  document.getElementById('modal-receipt-body').innerHTML = `
    <div class="receipt-wrap" id="receipt-print-area">
      <div class="receipt-header">
        <div class="receipt-header-inner">
          <div class="receipt-header-logo">
            <img src="${JTI.logo}" alt="JTI Logo" class="receipt-logo"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <span class="receipt-logo-fallback">JTI</span>
          </div>
          <div class="receipt-header-info">
            <div class="receipt-title">${JTI.name}</div>
            <div class="receipt-subtitle">${JTI.branch}</div>
            <div class="receipt-contact">
              <span>&#128222; ${JTI.phones}</span>
              <span class="receipt-contact-sep">|</span>
              <span>&#9993; ${JTI.email}</span>
            </div>
          </div>
          <div class="receipt-doc-badge">PAYMENT<br>RECEIPT</div>
        </div>
        <div class="receipt-header-rule"></div>
      </div>
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
      <div class="receipt-stamp">This is an official receipt from ${JTI.name}<br>Tel: ${JTI.phones} &nbsp;|&nbsp; ${JTI.email}<br>Printed: ${new Date().toLocaleDateString('en-KE',{day:'2-digit',month:'long',year:'numeric'})}</div>
    </div>`;
  openModal('modal-receipt');
}

// ════════════════════════════════════════════════
//  PDF ENGINE  —  Professional receipts & invoices
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
  W:   137.6, // matches the HTML receipt's max-width: 520px (520 / 96in * 25.4mm)
  PAD:  13,   // kept proportional to the old 105mm page (10mm / 105 ≈ 13mm / 137.6)
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

function _drawHeader(doc, docType) {
  const W   = PDF.W;
  const PAD = PDF.PAD;

  // ── Background: full-width navy bar ──────────────────────────────────
  doc.setFillColor(...PDF.navy);
  doc.rect(0, 0, W, 40, 'F');

  // ── Gold rule at bottom of navy bar ──────────────────────────────────
  doc.setFillColor(...PDF.gold);
  doc.rect(0, 40, W, 2.5, 'F');

  // ── LEFT COLUMN: logo box ────────────────────────────────────────────
  const logoBoxX = PAD;
  const logoBoxY = 9;
  const logoBoxW = 18;
  const logoBoxH = 18;

  // White rounded rect as logo background (cleaner contrast)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(logoBoxX, logoBoxY, logoBoxW, logoBoxH, 2, 2, 'F');

  // Try to embed the real logo image
  let logoEmbedded = false;
  try {
    const logoImg = document.querySelector('.receipt-logo');
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      const canvas  = document.createElement('canvas');
      canvas.width  = logoImg.naturalWidth;
      canvas.height = logoImg.naturalHeight;
      canvas.getContext('2d').drawImage(logoImg, 0, 0);
      const imgData = canvas.toDataURL('image/jpeg');
      // Centre image inside the white box with 2px padding
      const imgPad = 2;
      doc.addImage(imgData, 'JPEG',
        logoBoxX + imgPad, logoBoxY + imgPad,
        logoBoxW - imgPad * 2, logoBoxH - imgPad * 2);
      logoEmbedded = true;
    }
  } catch(_) {}

  if (!logoEmbedded) {
    // Fallback: gold "JTI" monogram centred in the white box
    _font(doc, 'bold', 11, PDF.navy);
    doc.text('JTI', logoBoxX + logoBoxW / 2, logoBoxY + logoBoxH / 2 + 2, { align: 'center' });
  }

  // ── CENTRE COLUMN: institute name, branch, contacts ──────────────────
  const textX = logoBoxX + logoBoxW + 4;  // 4 mm gap after logo box

  _font(doc, 'bold', 12.5, PDF.white);
  doc.text(JTI.name, textX, 16);

  _font(doc, 'normal', 8, [180, 200, 235]);
  doc.text(JTI.branch, textX, 22);

  // Thin rule under branch name
  doc.setDrawColor(...[80, 110, 160]);
  doc.setLineWidth(0.25);
  doc.setLineDash([1, 1.5], 0);
  doc.line(textX, 24.5, textX + 55, 24.5);
  doc.setLineDash([], 0);

  // Phone and email on separate short lines
  _font(doc, 'normal', 7, [160, 185, 215]);
  doc.text('Tel: ' + JTI.phones, textX, 29);
  doc.text('Email: ' + JTI.email, textX, 34);

  // ── RIGHT COLUMN: document-type label (flush, no separate box) ───────
  const labelRightX = W - PAD;
  const ruleTopY    = 15;
  const ruleBotY    = 27;
  const labelW      = 32;
  const labelLeftX  = labelRightX - labelW;

  doc.setDrawColor(...PDF.gold);
  doc.setLineWidth(0.5);
  doc.line(labelLeftX, ruleTopY, labelRightX, ruleTopY);
  doc.line(labelLeftX, ruleBotY, labelRightX, ruleBotY);

  _font(doc, 'bold', 8.5, PDF.goldLt);
  doc.text(docType.toUpperCase(), labelRightX, (ruleTopY + ruleBotY) / 2 + 1.4, { align: 'right' });

  return 50; // y position after header + rule
}

function _sectionLabel(doc, y, text) {
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
  doc.setFillColor(...PDF.gold);
  doc.roundedRect(PDF.PAD, y, 3, barH, 1, 1, 'F');
  _font(doc, 'bold', 10.5, PDF.white);
  doc.text(label, PDF.PAD + 6, y + 8);
  doc.text(value, PDF.W - PDF.PAD - 2, y + 8, { align: 'right' });
  return y + barH + 5;
}

function _footer(doc, y, lines) {
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

  // Bottom gold strip
  doc.setFillColor(...PDF.gold);
  doc.rect(0, 196, PDF.W, 4, 'F');
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

  _footer(doc, y, stampLines);

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

  _footer(doc, y, stampLines);

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
      showChargeInvoice(res, payload, state.students.find(x => x.regNo === regNo));
    } else {
      toast('Error: ' + (res.error || 'Unknown'), 'error');
    }
  } catch(e) { toast('Failed: ' + e.message, 'error'); }

  btn.disabled = false;
  btn.innerHTML = '&#129534; Raise Invoice';
}

// ── HTML charge invoice (modal) — professional letterhead layout ─────
function showChargeInvoice(res, payload, student) {
  if (!student) return;
  document.getElementById('modal-invoice-body').innerHTML = `
    <div class="receipt-wrap" id="invoice-print-area">
      <div class="receipt-header">
        <div class="receipt-header-inner">
          <div class="receipt-header-logo">
            <img src="${JTI.logo}" alt="JTI Logo" class="receipt-logo"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <span class="receipt-logo-fallback">JTI</span>
          </div>
          <div class="receipt-header-info">
            <div class="receipt-title">${JTI.name}</div>
            <div class="receipt-subtitle">${JTI.branch}</div>
            <div class="receipt-contact">
              <span>&#128222; ${JTI.phones}</span>
              <span class="receipt-contact-sep">|</span>
              <span>&#9993; ${JTI.email}</span>
            </div>
          </div>
          <div class="receipt-doc-badge">CHARGE<br>INVOICE</div>
        </div>
        <div class="receipt-header-rule"></div>
      </div>
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
      <div class="receipt-stamp">This charge has been applied to the student's account.<br>Tel: ${JTI.phones} &nbsp;|&nbsp; ${JTI.email}<br>${JTI.name} &middot; ${JTI.branch}</div>
    </div>`;
  openModal('modal-invoice');
}

// ════════════════════════════════════════════════
//  INVOICES PAGE
// ════════════════════════════════════════════════
function generateInvoices() { renderInvoices(); }

function renderInvoices(filtered) {
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

// ── HTML fee invoice (modal) — professional letterhead layout ────────
function printStudentInvoice(regNo) {
  const s = state.students.find(x=>x.regNo===regNo);
  if (!s) return;
  document.getElementById('modal-invoice-body').innerHTML = `
    <div class="receipt-wrap" id="invoice-print-area">
      <div class="receipt-header">
        <div class="receipt-header-inner">
          <div class="receipt-header-logo">
            <img src="${JTI.logo}" alt="JTI Logo" class="receipt-logo"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <span class="receipt-logo-fallback">JTI</span>
          </div>
          <div class="receipt-header-info">
            <div class="receipt-title">${JTI.name}</div>
            <div class="receipt-subtitle">${JTI.branch}</div>
            <div class="receipt-contact">
              <span>&#128222; ${JTI.phones}</span>
              <span class="receipt-contact-sep">|</span>
              <span>&#9993; ${JTI.email}</span>
            </div>
          </div>
          <div class="receipt-doc-badge">FEE<br>INVOICE</div>
        </div>
        <div class="receipt-header-rule"></div>
      </div>
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
      <div class="receipt-stamp">Please make payments via M-Pesa or Bank Transfer<br>Tel: ${JTI.phones} &nbsp;|&nbsp; ${JTI.email}<br>${JTI.name} &middot; ${JTI.branch}</div>
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
//  UTILS
// ════════════════════════════════════════════════
function fmt(n) { return Number(n||0).toLocaleString('en-KE'); }
function fmtDate(d) { if(!d) return '&mdash;'; try { return new Date(d).toLocaleDateString('en-KE',{day:'2-digit',month:'short',year:'numeric'}); } catch{return d;} }
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
  ['jti_cache_v1'].forEach(k => { try { localStorage.removeItem(k); } catch(_) {} });

  const saved = sessionStorage.getItem('jti_user');
  if (saved) {
    try {
      state.user = JSON.parse(saved);
      applyRoleUI();
      showAppPage();
      loadAll();
    } catch(_) { showLoginPage(); }
  } else {
    showLoginPage();
  }

  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitLogin();
  });
  document.getElementById('login-username').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitLogin();
  });

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('enroll-date').value = today;
  document.getElementById('pay-date').value    = today;

  if (window.innerWidth <= 768) document.getElementById('menu-toggle').style.display = 'flex';

  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') silentRefresh();
  });
});