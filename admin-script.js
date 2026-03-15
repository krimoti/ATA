// ============================================================
// DAZURA — ADMIN PANEL SCRIPT
// נטען רק ב-admin.html — לא זמין לעובדים/מנהלים
// ============================================================

function loadCompanySettings() {
  const s = getSettings();
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
  set('settingCompanyName',      s.companyName);
  set('settingCompanyLogo',      s.companyLogo);
  set('settingCycleStart',       s.cycleStartDay);
  set('settingCycleEnd',         s.cycleEndDay);
  set('settingDropMonth',        s.dropMonth);
  set('settingPayrollFormat',    s.payrollFormat);
  set('settingApprovalRequired', String(s.approvalRequired));
  set('settingApprovalTimeout',  s.approvalTimeoutHours);
  // Show logo preview in settings panel
  const preview = document.getElementById('logoPreview');
  if(preview && s.companyLogo) { preview.src = s.companyLogo; preview.style.display = ''; }
  updateCyclePreview();
  applyBranding(s);
}

function saveCompanySettings() {
  const get = id => document.getElementById(id)?.value;
  const s = {
    companyName:          get('settingCompanyName') || 'החברה שלי',
    companyLogo:          get('settingCompanyLogo') || '',
    cycleStartDay:        parseInt(get('settingCycleStart')) || 1,
    cycleEndDay:          parseInt(get('settingCycleEnd')) || 0,
    dropMonth:            get('settingDropMonth') || 'next',
    payrollFormat:        get('settingPayrollFormat') || 'csv_generic',
    approvalRequired:     get('settingApprovalRequired') === 'true',
    approvalTimeoutHours: parseInt(get('settingApprovalTimeout')) || 48,
    authLevel:            parseInt(document.querySelector('input[name="authLevel"]:checked')?.value || getSettings().authLevel || 4),
  };
  saveSettings(s);
  applyBranding(s);
  auditLog('settings_changed', 'הגדרות חברה עודכנו');
  showToast('✅ הגדרות נשמרו — הכותרת עודכנה', 'success');
  updateCyclePreview();
}

function renderAuditLog() {
  const el = document.getElementById('auditLogList');
  if(!el) return;
  const log = (getDB().auditLog||[]).slice(0,50);
  if(!log.length){el.innerHTML='<p style="color:var(--text-muted);font-size:13px;">אין רשומות</p>';return;}
  const icons={login:'🔑',logout:'👋',vacation_add:'✈️',vacation_remove:'❌',approval_approved:'✅',approval_rejected:'❌',settings_changed:'⚙️',quota_saved:'📊',employee_added:'👤',employee_deleted:'🗑️',payroll_export:'📤',monthly_report:'📄',vacation_request:'📨'};
  el.innerHTML=log.map(e=>{
    const d=new Date(e.ts);
    return `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border);">
      <span>${icons[e.action]||'📝'}</span>
      <div style="flex:1;font-size:13px;"><strong>${e.user}</strong> <span style="color:var(--text-secondary);">${e.details||e.action}</span></div>
      <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${d.toLocaleString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
    </div>`;
  }).join('');
}

function renderAdmin() {
  if (currentUser.role !== 'admin' && currentUser.role !== 'accountant' && !userHasAnyAdminAccess(currentUser.username)) return;
  renderTCTodayPreview();
  renderPendingRegistrations();
  applyPermissionsToAdminTab();
  if (currentUser.role === 'admin') { renderPermissionsTable(); }
  populateQuickPermUser();
  // Load temp password field
  const tp = document.getElementById('tempPasswordSetting');
  if (tp) tp.value = getSettings().tempPassword || '';
  
  const db = getDB();
  
  // Quota window check
  const now = new Date();
  const isQuotaWindow = now.getMonth() === 0 && now.getDate() <= 9;
  const quotaMsg = document.getElementById('quotaWindowMsg');
  const quotaAlert = document.getElementById('quotaWindowAlert');
  if (currentUser.role === 'accountant') {
    quotaMsg.textContent = `✅ כמנהלת חשבונות, ניתן לטעון מכסות בכל עת.`;
    quotaAlert.className = 'alert alert-success';
  } else if (isQuotaWindow) {
    quotaMsg.textContent = `✅ חלון הטעינה פתוח עד 09 לינואר ${now.getFullYear()}. ניתן לטעון מכסות!`;
    quotaAlert.className = 'alert alert-success';
  } else {
    quotaMsg.textContent = `🔒 חלון הטעינה סגור. ניתן לטעון מכסות רק בין 01-09 לינואר.`;
    quotaAlert.className = 'alert alert-warning';
  }

  // Render departments + managers table
  renderDeptManagerTable();
  
  // Populate quota employee select
  const quotaEmpSel = document.getElementById('quotaEmpSelect');
  quotaEmpSel.innerHTML = Object.values(db.users).map(u => `<option value="${u.username}">${u.fullName} (${u.dept})</option>`).join('');
  
  // Populate employee selector
  const empSel = document.getElementById('empListSelect');
  if (empSel) {
    const sortedUsers = Object.values(db.users).sort((a,b) => a.fullName.localeCompare(b.fullName, 'he'));
    empSel.innerHTML = '<option value="">— בחר עובד לעריכה —</option>' +
      sortedUsers.map(u => `<option value="${u.username}">${u.fullName} · ${u.dept||''}</option>`).join('');
    const countEl = document.getElementById('empListCount');
    if (countEl) countEl.textContent = `${sortedUsers.length} עובדים`;
  }
  // Hide edit row on re-render
  const editRow = document.getElementById('empListEditRow');
  if (editRow) editRow.style.display = 'none';
  
  // Admin filter selects
  const filterEmpSel = document.getElementById('adminFilterEmp');
  filterEmpSel.innerHTML = '<option value="">כל העובדים</option>' + 
    Object.values(db.users).map(u => `<option value="${u.username}">${u.fullName}</option>`).join('');

  // Department filter
  const filterDeptSel = document.getElementById('adminFilterDept');
  const allDepts = db.departments || [];
  filterDeptSel.innerHTML = '<option value="">כל המחלקות</option>' + 
    allDepts.map(d => `<option value="${d}">${d}</option>`).join('');
  
  renderAdminVacations();
  renderApprovalRequests();
}

function renderAdminVacations() {
  const db = getDB();
  const filterEmp = document.getElementById('adminFilterEmp')?.value || '';
  const filterDept = document.getElementById('adminFilterDept')?.value || '';
  const filterYear = parseInt(document.getElementById('adminFilterYear')?.value || 2026);
  const monthNames = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  
  const tbody = document.getElementById('adminVacTableBody');
  let rows = [];
  
  for (const [uname, user] of Object.entries(db.users)) {
    if (filterEmp && uname !== filterEmp) continue;
    // Department filter - support array dept
    if (filterDept) {
      const userDepts = Array.isArray(user.dept) ? user.dept : [user.dept];
      if (!userDepts.includes(filterDept)) continue;
    }
    const vacs = getVacations(uname);
    const deptDisplay = Array.isArray(user.dept) ? user.dept.join(', ') : (user.dept || '');
    
    for (let m = 1; m <= 12; m++) {
      let full = 0, half = 0, wfh = 0;
      for (const [dt, type] of Object.entries(vacs)) {
        if (!dt.startsWith(String(filterYear))) continue;
        if (parseInt(dt.split('-')[1]) !== m) continue;
        if (type === 'full') full++;
        else if (type === 'half') half++;
        else if (type === 'wfh') wfh++;
      }
      if (full + half > 0) { // Only show vacation days (not WFH-only rows)
        const total = full + half * 0.5;
        const payM = m >= 11 ? (m === 11 ? 0 : 1) : m;
        rows.push(`<tr>
          <td style="font-weight:700;">${user.fullName}</td>
          <td>${deptDisplay}</td>
          <td>${monthNames[m-1]}</td>
          <td>${full}</td>
          <td>${half}</td>
          <td style="font-weight:700;color:var(--primary);">${total}</td>
          <td style="font-size:12px;color:var(--text-muted);">${monthNames[payM]}</td>
        </tr>`);
      }
    }
  }
  
  tbody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">אין נתונים להצגה</td></tr>';
}

function clearAdminFilters() {
  const deptSel = document.getElementById('adminFilterDept');
  const empSel = document.getElementById('adminFilterEmp');
  if (deptSel) deptSel.value = '';
  if (empSel) empSel.value = '';
  renderAdminVacations();
}

function openAddEmployeeModal() {
  document.getElementById('addEmpError').style.display = 'none';
  document.getElementById('newEmpName').value = '';
  document.getElementById('newEmpUsername').value = '';
  document.getElementById('newEmpPass').value = '';
  populateDeptSelect('newEmpDept');
  openModal('addEmpModal');
}

function saveNewEmployee() {
  const name     = document.getElementById('newEmpName').value.trim();
  const username = document.getElementById('newEmpUsername').value.trim().toLowerCase();
  const dept     = document.getElementById('newEmpDept').value;
  const role     = document.getElementById('newEmpRole').value;
  const pass     = document.getElementById('newEmpPass').value;
  const salary   = parseFloat(document.getElementById('newEmpDailySalary')?.value) || 0;
  const errEl    = document.getElementById('addEmpError');

  if (!name || !username || !dept || !pass) {
    errEl.textContent = 'נא למלא את כל השדות'; errEl.style.display = 'block'; return;
  }

  const db = getDB();
  if (db.users[username]) {
    errEl.textContent = 'שם משתמש כבר קיים'; errEl.style.display = 'block'; return;
  }

  db.users[username] = {
    fullName: name, username, password: hashPass(pass),
    dept, role, email: '',
    dailySalary: salary,
    quotas: { '2026': { annual: 0, initialBalance: 0 } }
  };
  saveDB(db);
  closeModal('addEmpModal');
  auditLog('employee_added', `עובד חדש נוסף: ${name}`);
  showToast(`✅ עובד ${name} נוסף בהצלחה`, 'success');
  renderAdmin();
}

function deleteEmployee(username) {
  if (username === 'admin') return;
  const db = getDB();
  const name = db.users[username]?.fullName || username;
  if (!confirm(`למחוק את העובד ${name}? הפעולה בלתי הפיכה.`)) return;
  delete db.users[username];
  delete db.vacations[username];
  saveDB(db);
  auditLog('employee_deleted', `עובד נמחק: ${name}`);
  showToast('🗑️ העובד נמחק', 'success');
  renderAdmin();
}

function setDeptManager(dept, username) {
  const db = getDB();
  if (!db.deptManagers) db.deptManagers = {};
  if (username) {
    db.deptManagers[dept] = username;
    const managerName = db.users[username]?.fullName || username;
    showToast(`✅ ${managerName} הוגדר/ה כמנהל/ת של ${dept}`, 'success');
    auditLog('dept_manager_set', `מנהל ${dept} הוגדר: ${managerName}`);
  } else {
    delete db.deptManagers[dept];
    showToast(`⚠️ הוסר מנהל מ-${dept}`, 'warning');
  }
  saveDB(db);
  renderDeptManagerTable();
}

function addDepartment() {
  const input = document.getElementById('newDeptInput');
  const name = input.value.trim();
  if (!name) { showToast('⚠️ נא להזין שם מחלקה', 'warning'); return; }
  const db = getDB();
  if (!db.departments) db.departments = [];
  if (db.departments.includes(name)) { showToast('⚠️ מחלקה זו כבר קיימת', 'warning'); return; }
  db.departments.push(name);
  saveDB(db);
  input.value = '';
  renderDeptManagerTable();
  showToast(`✅ מחלקה "${name}" נוספה — הגדר מנהל בטבלה`, 'success');
}

function removeDepartment(name) {
  if (!confirm(`למחוק את המחלקה "${name}"?`)) return;
  const db = getDB();
  db.departments = (db.departments || []).filter(d => d !== name);
  if (db.deptManagers) delete db.deptManagers[name];
  saveDB(db);
  renderDeptManagerTable();
  showToast(`🗑️ מחלקה "${name}" נמחקה`, 'success');
}

function openResetPasswordModal(username) {
  const db = getDB();
  const user = db.users[username];
  if (!user) return;
  passwordTargetUser = username;
  document.getElementById('resetEmpName').textContent = user.fullName + ' (' + username + ')';
  document.getElementById('resetNewPass').value = '';
  openModal('resetPasswordModal');
}

function doResetPassword() {
  const newPass = document.getElementById('resetNewPass').value.trim();
  if (!newPass || newPass.length < 4) {
    showToast('⚠️ הסיסמה חייבת להיות לפחות 4 תווים', 'warning');
    return;
  }
  const db = getDB();
  db.users[passwordTargetUser].password = hashPass(newPass);
  saveDB(db);
  closeModal('resetPasswordModal');
  showToast(`✅ סיסמת ${db.users[passwordTargetUser].fullName} אופסה בהצלחה`, 'success');
}

function doChangeEmpPassword() {
  const p1 = document.getElementById('changeEmpNewPass').value;
  const p2 = document.getElementById('changeEmpNewPass2').value;
  if (!p1 || p1.length < 4) {
    showToast('⚠️ הסיסמה חייבת להיות לפחות 4 תווים', 'warning');
    return;
  }
  if (p1 !== p2) {
    showToast('⚠️ הסיסמאות אינן תואמות', 'warning');
    return;
  }
  const db = getDB();
  db.users[passwordTargetUser].password = hashPass(p1);
  saveDB(db);
  closeModal('changeEmpPasswordModal');
  showToast(`✅ סיסמת ${db.users[passwordTargetUser].fullName} שונתה בהצלחה`, 'success');
}

function changeAdminPassword() {
  const current = document.getElementById('adminCurrentPass').value;
  const newP = document.getElementById('adminNewPass').value;
  const newP2 = document.getElementById('adminNewPass2').value;
  
  const db = getDB();
  const adminUser = db.users['admin'];
  if (!adminUser) { showToast('⚠️ משתמש admin לא נמצא', 'warning'); return; }
  
  if (adminUser.password !== hashPass(current)) {
    showToast('❌ הסיסמה הנוכחית שגויה', 'error');
    return;
  }
  if (!newP || newP.length < 4) {
    showToast('⚠️ הסיסמה חייבת להיות לפחות 4 תווים', 'warning');
    return;
  }
  if (newP !== newP2) {
    showToast('⚠️ הסיסמאות אינן תואמות', 'warning');
    return;
  }
  
  db.users['admin'].password = hashPass(newP);
  saveDB(db);
  document.getElementById('adminCurrentPass').value = '';
  document.getElementById('adminNewPass').value = '';
  document.getElementById('adminNewPass2').value = '';
  showToast('✅ סיסמת ADMIN שונתה בהצלחה! שמור אותה במקום בטוח.', 'success');
}

function getUserPermissions(username) {
  const db = getDB();
  return (db.permissions || {})[username] || {};
}

function saveUserPermissions(username, perms) {
  const db = getDB();
  if (!db.permissions) db.permissions = {};
  db.permissions[username] = perms;
  saveDB(db);
}

function canSeeSectionPermission(sectionKey) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true; // admin always sees all

  const section = PERMISSION_SECTIONS.find(s => s.key === sectionKey);
  if (!section) return false;
  if (section.adminOnly) return false; // non-admins never see admin-only sections

  const perms = getUserPermissions(currentUser.username);
  return perms[sectionKey] === true;
}

function applyPermissionsToAdminTab() {
  if (!currentUser) return;
  const isAdmin = currentUser.role === 'admin';

  PERMISSION_SECTIONS.forEach(({ key, adminOnly }) => {
    const el = document.getElementById(key);
    if (!el) return;
    if (isAdmin) {
      el.style.display = ''; // admin always sees everything
      return;
    }
    // Non-admin: check section.adminOnly and their specific permission
    if (adminOnly) {
      el.style.display = 'none';
    } else {
      const perms = getUserPermissions(currentUser.username);
      el.style.display = perms[key] ? '' : 'none';
    }
  });

  // Hide the permissions section itself from non-admins always
  const permSec = document.getElementById('permissionsSection');
  if (permSec) permSec.style.display = isAdmin ? '' : 'none';
}

function userHasAnyAdminAccess(username) {
  if (!username) return false;
  const db = getDB();
  const user = db.users[username];
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'accountant') return true;
  const perms = getUserPermissions(username);
  return PERMISSION_SECTIONS.some(s => !s.adminOnly && perms[s.key] === true);
}

function renderPermissionsTable() {
  const el = document.getElementById('permissionsTable');
  if (!el) return;
  const db = getDB();

  // Only show non-admin users (managers + employees)
  const users = Object.values(db.users).filter(u =>
    u.role !== 'admin' && isUserActive(u)
  ).sort((a, b) => a.fullName.localeCompare(b.fullName));

  if (!users.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">אין עובדים להצגה</div>';
    return;
  }

  const grantableSections = PERMISSION_SECTIONS.filter(s => !s.adminOnly);

  el.innerHTML = `
    <table style="border-collapse:collapse;width:100%;font-size:12px;min-width:600px;">
      <thead>
        <tr style="background:var(--surface2);">
          <th style="padding:10px 12px;text-align:right;font-size:13px;min-width:140px;">עובד / מנהל</th>
          <th style="padding:10px 8px;text-align:center;font-size:11px;min-width:50px;">גישה לניהול</th>
          ${grantableSections.map(s => `
            <th style="padding:10px 6px;text-align:center;font-size:10px;max-width:80px;white-space:normal;line-height:1.3;">${s.label}</th>
          `).join('')}
          <th style="padding:10px 8px;text-align:center;">שמור</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => {
          const perms = getUserPermissions(u.username);
          const hasAny = grantableSections.some(s => perms[s.key]);
          return `
            <tr style="border-bottom:1px solid var(--border);" id="permRow_${u.username}">
              <td style="padding:10px 12px;">
                <div style="font-weight:700;">${u.fullName}</div>
                <div style="font-size:11px;color:var(--text-muted);">${u.role === 'senior_manager' ? '🏢 הנהלה' : u.role === 'manager' ? '👔 מנהל מחלקה' : '👤 עובד'} · ${Array.isArray(u.dept) ? u.dept[0] : u.dept || ''}</div>
              </td>
              <td style="padding:10px 8px;text-align:center;">
                <span style="font-size:11px;padding:3px 8px;border-radius:10px;font-weight:700;background:${hasAny ? 'var(--success-light)' : 'var(--surface2)'};color:${hasAny ? 'var(--success)' : 'var(--text-muted)'};">
                  ${hasAny ? '✅ יש' : '—'}
                </span>
              </td>
              ${grantableSections.map(s => `
                <td style="padding:10px 6px;text-align:center;">
                  <input type="checkbox"
                    id="perm_${u.username}_${s.key}"
                    ${perms[s.key] ? 'checked' : ''}
                    style="width:16px;height:16px;cursor:pointer;"
                    onchange="onPermCheckChange('${u.username}')">
                </td>
              `).join('')}
              <td style="padding:10px 8px;text-align:center;">
                <button onclick="savePermRow('${u.username}')"
                  class="btn btn-primary"
                  style="padding:6px 14px;font-size:12px;border-radius:8px;">
                  💾
                </button>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="margin-top:12px;font-size:11px;color:var(--text-muted);">
      💡 סעיפים עם 🔒 (הגדרות חברה, סיסמת ADMIN, איפוס, הרשאות) — נגישים ל-ADMIN בלבד ולא ניתנים להאצלה.
    </div>`;
}

function quickGrantPermission() {
  const username = document.getElementById('quickPermUser').value;
  const level    = document.getElementById('quickPermLevel').value;
  if (!username) { showToast('⚠️ בחר עובד', 'warning'); return; }

  const presets = {
    reports:    { allVacationsSection: true, approvalRequestsSection: true },
    timeclock:  { timeClockExportSection: true },
    employees:  { employeeListSection: true, quotaUploadAdminSection: true, pendingRegistrationsSection: true },
    full:       { timeClockExportSection: true, pendingRegistrationsSection: true, deptMgmtSection: true,
                  quotaUploadAdminSection: true, employeeListSection: true, allVacationsSection: true, approvalRequestsSection: true }
  };

  const perms = presets[level] || {};
  saveUserPermissions(username, perms);
  const db   = getDB();
  const name = db.users[username]?.fullName || username;
  showToast(`✅ הרשאות הוענקו ל${name}`, 'success');
  auditLog('permissions_update', `הרשאת ${level} הוענקה ל${username}`);
  renderPermissionsTable();
}

function populateQuickPermUser() {
  const db = getDB();
  const users = Object.values(db.users)
    .filter(u => u.role !== 'admin' && isUserActive(u))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  const opts = users.map(u => `<option value="${u.username}">${u.fullName} · ${Array.isArray(u.dept)?u.dept[0]:u.dept||''}</option>`).join('');

  const sel = document.getElementById('quickPermUser');
  if (sel) sel.innerHTML = '<option value="">בחר עובד...</option>' + opts;

  const permSel = document.getElementById('permEditSelect');
  if (permSel) permSel.innerHTML = '<option value="">— בחר עובד לעריכת הרשאות —</option>' + opts;
}

function openWhereIsEmployee() {
  document.getElementById('whereIsSearch').value = '';
  document.getElementById('whereIsResults').innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">הקלד לפחות 2 תווים לחיפוש...</div>';
  openModal('whereIsModal');
  setTimeout(() => document.getElementById('whereIsSearch').focus(), 200);
}

function getEmployeeStatusToday(username) {
  const db    = getDB();
  const today = new Date().toISOString().split('T')[0];

  // 1. Check sick
  if (db.sick && db.sick[`${username}_${today}`]) {
    const s = db.sick[`${username}_${today}`];
    return { status: 'sick', label: s.type === 'half' ? '🤒 חצי יום מחלה' : '🤒 חולה היום', color: '#ef4444', bg: '#fef2f2' };
  }

  // 2. Check vacation
  if (db.vacations && db.vacations[username]) {
    const v = db.vacations[username][today];
    if (v) {
      if (v === 'wfh')  return { status: 'wfh',      label: '🏠 עובד מהבית',    color: '#7c3aed', bg: '#f5f3ff' };
      if (v === 'half') return { status: 'half',     label: '🌗 חצי יום חופש',  color: '#f59e0b', bg: '#fffbeb' };
      if (v === 'full') return { status: 'vacation', label: '🏖️ בחופשה היום',   color: '#1d4ed8', bg: '#eff6ff' };
    }
  }

  // 3. Check daily status (user self-report)
  const dailyKey = `${username}_${today}`;
  if (db.dailyStatus && db.dailyStatus[dailyKey]) {
    const ds = db.dailyStatus[dailyKey];
    const map = {
      office: { label: '🏢 במשרד',        color: '#16a34a', bg: '#f0fdf4' },
      home:   { label: '🏠 עובד מהבית',   color: '#7c3aed', bg: '#f5f3ff' },
      out:    { label: '🚗 מחוץ למשרד',   color: '#ea580c', bg: '#fff7ed' },
    };
    return map[ds.status] || { label: ds.status, color: '#6b7280', bg: '#f9fafb' };
  }

  return { status: 'unknown', label: '❓ אין מידע להיום', color: '#9ca3af', bg: '#f9fafb' };
}

function clearAuditLog() {
  if (currentUser?.role !== 'admin') return;
  if (!confirm('למחוק את כל יומן השינויים? פעולה זו בלתי הפיכה.')) return;
  const db = getDB();
  db.auditLog = [];
  saveDB(db);
  renderAuditLog();
  showToast('🗑️ יומן השינויים נמחק', 'info');
}

function openBulkImportModal() {
  _bulkImportData = [];
  document.getElementById('bulkImportPreview').style.display = 'none';
  document.getElementById('bulkImportBtn').style.display = 'none';
  document.getElementById('bulkExcelFile').value = '';
  openModal('bulkImportModal');
  // Load saved temp password and show it in modal
  const saved = getSettings().tempPassword || 'Welcome1';
  const tp = document.getElementById('tempPasswordSetting');
  if (tp) tp.value = saved;
  // Update password display inside modal
  const modalPassEl = document.getElementById('bulkModalTempPass');
  if (modalPassEl) modalPassEl.textContent = saved;
}

function handleBulkDrop(e) {
  e.preventDefault();
  document.getElementById('bulkDropZone').style.borderColor = 'var(--border)';
  const file = e.dataTransfer.files[0];
  if (file) parseBulkFile(file);
}

function handleBulkImportFile(input) {
  const file = input.files[0];
  if (file) parseBulkFile(file);
}

function applyBulkImport() {
  if (!_bulkImportData.length) return;

  // Read temp password directly from the field
  const tpField  = document.getElementById('tempPasswordSetting');
  const tempPass = (tpField && tpField.value.trim()) ? tpField.value.trim()
                   : (getSettings().tempPassword || 'Welcome1');

  // *** Pause real-time listener so it doesn't overwrite our save ***
  if (_fbUnsubscribe) { _fbUnsubscribe(); _fbUnsubscribe = null; }

  const db   = getDB();
  const year = new Date().getFullYear();

  // Persist the temp password
  if (!db.settings) db.settings = {};
  db.settings.tempPassword = tempPass;

  let added = 0, updated = 0;
  const hashedPass = hashPass(tempPass);

  _bulkImportData.forEach(p => {
    if (p.isUpdate) {
      const u = db.users[p.username];
      if (!u) return;
      if (!u.quotas) u.quotas = {};
      if (!u.quotas[year]) u.quotas[year] = { annual: 0, initialBalance: 0 };
      if (p.annual  !== null) u.quotas[year].annual         = p.annual;
      if (p.balance !== null) u.quotas[year].initialBalance = p.balance;
      if (p.salary  !== null) u.dailySalary                 = p.salary;
      if (p.birthday)         u.birthday                    = p.birthday;
      if (p.email && !u.email) u.email = p.email;
      updated++;
    } else {
      if (db.users[p.username]) return;
      const quotas = { [year]: {
        annual:         p.annual  !== null ? p.annual  : 0,
        initialBalance: p.balance !== null ? p.balance : 0
      }};
      db.users[p.username] = {
        fullName: p.fullName,
        username: p.username,
        password: hashedPass,
        dept: p.dept,
        role: 'employee',
        status: 'active',
        email: p.email || '',
        mustChangePassword: true,
        dailySalary: p.salary !== null ? p.salary : 0,
        birthday: p.birthday || '',
        quotas,
        registeredAt: new Date().toISOString()
      };
      if (!db.departments.includes(p.dept)) db.departments.push(p.dept);
      added++;
    }
  });

  // Save locally first
  _saveDBLocal(db);

  // Push to Firebase and restart listener only after push completes
  if (firebaseConnected && firebaseDB) {
    pushToFirebase().then(() => {
      startRealtimeListener(); // restart listener only after push
    }).catch(err => {
      console.warn('Firebase push error:', err);
      startRealtimeListener();
    });
  }

  closeModal('bulkImportModal');
  const msg = [
    added   ? `✅ נוספו ${added} עובדים`   : '',
    updated ? `🔄 עודכנו ${updated} עובדים` : ''
  ].filter(Boolean).join(' | ');
  showToast(msg + (added ? ` — סיסמה: "${tempPass}"` : ''), 'success', 8000);
  auditLog('bulk_import', `${added} נוספו, ${updated} עודכנו — סיסמה: ${tempPass}`);
  renderAdmin();
  _bulkImportData = [];
}

function deleteImportedEmployees() {
  const db = getDB();
  const users = db.users || {};

  // Count employees eligible for deletion (not admin/accountant/manager roles, not built-in)
  const toDelete = Object.values(users).filter(u =>
    u.username !== 'admin' &&
    u.role !== 'accountant' &&
    u.role !== 'ceo'
  );

  if (!toDelete.length) {
    showToast('⚠️ אין עובדים למחיקה', 'warning');
    return;
  }

  const names = toDelete.slice(0, 5).map(u => u.fullName).join(', ');
  const more  = toDelete.length > 5 ? ` ועוד ${toDelete.length - 5}...` : '';

  if (!confirm(
    `🗑️ מחיקת ${toDelete.length} עובדים\n\n` +
    `${names}${more}\n\n` +
    `⚠️ יימחקו גם:\n• כל ימי החופשה שלהם\n• כל דיווחי השעות שלהם\n• מחלקות שנשארו ריקות\n\n` +
    `פעולה זו בלתי הפיכה. להמשיך?`
  )) return;

  // Delete users
  toDelete.forEach(u => {
    delete db.users[u.username];
    // Delete their vacations
    if (db.vacations) delete db.vacations[u.username];
    // Delete their timeclock records
    if (db.timeClockRecords) delete db.timeClockRecords[u.username];
    if (db.timeclock)        delete db.timeclock[u.username];
    // Delete their sick records
    if (db.sick) {
      db.sick = Object.fromEntries(
        Object.entries(db.sick).filter(([,s]) => s.username !== u.username)
      );
    }
    // Remove from approval requests
    if (db.approvalRequests) {
      db.approvalRequests = db.approvalRequests.filter(r => r.username !== u.username);
    }
    // Remove from dept managers
    if (db.deptManagers) {
      Object.keys(db.deptManagers).forEach(dept => {
        if (db.deptManagers[dept] === u.username) delete db.deptManagers[dept];
      });
    }
  });

  // Remove departments that are now empty
  const remainingDepts = new Set(
    Object.values(db.users)
      .map(u => Array.isArray(u.dept) ? u.dept[0] : u.dept)
      .filter(Boolean)
  );
  const deptsBefore = (db.departments || []).length;
  db.departments = (db.departments || []).filter(d => remainingDepts.has(d));
  const deptsRemoved = deptsBefore - db.departments.length;

  saveDB(db);
  auditLog('bulk_delete', `נמחקו ${toDelete.length} עובדים ו-${deptsRemoved} מחלקות`);
  showToast(
    `✅ נמחקו ${toDelete.length} עובדים` + (deptsRemoved ? ` + ${deptsRemoved} מחלקות ריקות` : ''),
    'success', 5000
  );
  renderAdmin();
}

function saveTempPassword() {
  const val = document.getElementById('tempPasswordSetting')?.value.trim();
  if (!val) { showToast('⚠️ הזן סיסמה זמנית', 'warning'); return; }
  const db = getDB();
  if (!db.settings) db.settings = {};
  db.settings.tempPassword = val;
  saveDB(db);
  showToast('✅ סיסמה זמנית נשמרה', 'success');
}

function openFirebaseModal() {
  const statusDiv = document.getElementById('firebaseStatusDiv');
  if (firebaseConnected) {
    statusDiv.innerHTML = '<div class="alert alert-success"><span class="alert-icon">✅</span><span>מחובר ל-Firebase בזמן אמת — כל שינוי מסונכרן אוטומטית לכל המכשירים</span></div>';
    document.getElementById('fbDisconnectBtn').style.display = '';
    document.getElementById('fbResetBtn').style.display = '';
  } else {
    statusDiv.innerHTML = '<div class="alert" style="background:var(--danger-light);color:var(--danger);border:1px solid #fca5a5;"><span class="alert-icon">⚠️</span><span>לא מחובר — עובד במצב לא מקוון. הנתונים נשמרים מקומית בלבד.</span></div>';
    document.getElementById('fbDisconnectBtn').style.display = 'none';
    document.getElementById('fbResetBtn').style.display = 'none';
  }
  openModal('firebaseModal');
}

function disconnectFirebase() {
  if (_fbUnsubscribe) { _fbUnsubscribe(); _fbUnsubscribe = null; }
  firebaseConnected = false;
  firebaseDB = null;
  updateFirebaseBadge(false);
  document.getElementById('fbDisconnectBtn').style.display = 'none';
  document.getElementById('fbResetBtn').style.display = 'none';
  document.getElementById('firebaseStatusDiv').innerHTML =
    '<div class="alert alert-info"><span class="alert-icon">🔌</span><span>נותק. הנתונים נשמרים מקומית בלבד.</span></div>';
  showToast('🔌 נותק מ-Firebase', 'warning');
}

function closeEmpEdit() {
  const editRow = document.getElementById('empListEditRow');
  if (editRow) editRow.style.display = 'none';
  const sel = document.getElementById('empListSelect');
  if (sel) sel.value = '';
  _currentEditEmp = null;
}

function saveEmpBirthdayEdit() {
  if (!_currentEditEmp) return;
  const val = document.getElementById('empEditBirthday').value;
  saveEmpBirthday(_currentEditEmp, val);
}

function saveEmpSalaryEdit() {
  if (!_currentEditEmp) return;
  const val = document.getElementById('empEditSalary').value;
  saveEmpSalary(_currentEditEmp, val);
}

function openResetPasswordModalEdit() {
  if (!_currentEditEmp) return;
  openResetPasswordModal(_currentEditEmp);
}

function deleteEmployeeEdit() {
  if (!_currentEditEmp) return;
  closeEmpEdit();
  deleteEmployee(_currentEditEmp);
}

function renderPermForEmployee() {
  const sel = document.getElementById('permEditSelect');
  const container = document.getElementById('permEditRow');
  if (!sel || !container) return;

  const username = sel.value;
  if (!username) {
    container.style.display = 'none';
    return;
  }

  const db = getDB();
  const u = db.users[username];
  if (!u) return;

  const perms = getUserPermissions(username);
  const grantableSections = PERMISSION_SECTIONS.filter(s => !s.adminOnly);
  const hasAccess = grantableSections.some(s => perms[s.key]);

  container.innerHTML = `
    <div style="background:var(--surface);border:1.5px solid var(--primary);border-radius:14px;padding:18px 20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <div>
          <span style="font-size:16px;font-weight:900;">${u.fullName}</span>
          <span style="font-size:12px;color:var(--text-muted);margin-right:8px;">${u.role === 'senior_manager' ? '🏢 הנהלה' : u.role === 'manager' ? '👔 מנהל מחלקה' : '👤 עובד'} · ${Array.isArray(u.dept)?u.dept[0]:u.dept||''}</span>
          <span style="font-size:11px;padding:3px 10px;border-radius:10px;font-weight:700;background:${hasAccess ? 'var(--success-light)' : 'var(--surface2)'};color:${hasAccess ? 'var(--success)' : 'var(--text-muted)'};">${hasAccess ? '✅ יש גישה' : '— אין גישה'}</span>
        </div>
        <button onclick="document.getElementById('permEditRow').style.display='none';document.getElementById('permEditSelect').value='';"
          style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 14px;cursor:pointer;font-family:'Heebo',sans-serif;font-size:13px;font-weight:700;">✕ סגור</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
        ${grantableSections.map(s => `
          <label style="display:flex;align-items:center;gap:6px;background:var(--surface2);border:1.5px solid ${perms[s.key] ? 'var(--primary)' : 'var(--border)'};border-radius:10px;padding:8px 12px;cursor:pointer;font-size:12px;font-weight:600;transition:border-color 0.15s;">
            <input type="checkbox" id="perm_${username}_${s.key}" ${perms[s.key] ? 'checked' : ''}
              onchange="updatePermCheckbox('${username}','${s.key}',this.checked,this)"
              style="width:15px;height:15px;accent-color:var(--primary);">
            ${s.label}
          </label>
        `).join('')}
      </div>
      <button onclick="savePermissionsForUser('${username}')"
        style="background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:white;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:800;cursor:pointer;font-family:'Heebo',sans-serif;">
        💾 שמור הרשאות
      </button>
    </div>`;

  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function savePermissionsForUser(username) {
  const db = getDB();
  const grantableSections = PERMISSION_SECTIONS.filter(s => !s.adminOnly);
  const perms = {};
  grantableSections.forEach(s => {
    const cb = document.getElementById(`perm_${username}_${s.key}`);
    if (cb) perms[s.key] = cb.checked;
  });
  if (!db.permissions) db.permissions = {};
  db.permissions[username] = perms;
  saveDB(db);
  pushToFirebase();
  showToast('✅ הרשאות נשמרו', 'success');
  // Refresh the row
  renderPermForEmployee();
}

function selectSplash(n) {
  _selectedSplash = n;
  document.querySelectorAll('.splash-option').forEach(el => {
    el.classList.toggle('selected', parseInt(el.dataset.splash) === n);
  });
}

function openSplashSelector() {
  const db = getDB();
  const saved = db.settings?.splashTheme || 1;
  _selectedSplash = saved;
  const timing = db.settings?.splashTiming || 2;
  const inp = document.getElementById('splashTimingInput');
  const val = document.getElementById('splashTimingVal');
  if (inp) inp.value = timing;
  if (val) val.textContent = timing;
  document.querySelectorAll('.splash-option').forEach(el => {
    el.classList.toggle('selected', parseInt(el.dataset.splash) === saved);
  });
  openModal('splashSelectorModal');
}

