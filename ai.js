// ============================================================
// DAZURA AI ENGINE — ai.js
// כל לוגיקת ה-AI של המערכת — מנוע מקומי + Gemini אופציונלי
// ============================================================

// ── SPLASH KILLER (הועבר מ-index.html) ─────────────────────
(function(){
  var done=false;
  function kill(){
    if(done)return;done=true;
    var s=document.getElementById('dazura-splash');
    if(!s)return;
    s.style.pointerEvents='none';
    s.style.transition='opacity 0.5s ease';
    s.style.opacity='0';
    setTimeout(function(){if(s&&s.parentNode)s.parentNode.removeChild(s);},550);
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(kill,2000);});
  setTimeout(kill,4500);
  window._killSplash=kill;
})();

// ── SAFE CALL GUARD (הועבר מ-index.html) ──────────────────
window._scriptReady = false;
window._pendingCalls = [];
function _safeCall(fn, args) {
  if (window._scriptReady && typeof window[fn] === 'function') {
    window[fn].apply(null, args||[]);
  } else {
    window._pendingCalls.push({fn:fn, args:args||[]});
  }
}

// ============================================================
// GEMINI KEY MANAGEMENT
// ============================================================
function saveGeminiKey() {
  const val = (document.getElementById('geminiApiKeyInput')?.value || '').trim();
  if (!val || val.length < 20) {
    const st = document.getElementById('geminiKeyStatus');
    if (st) { st.textContent = '⚠️ מפתח לא תקין'; st.classList.remove('dz-clr-ok','dz-clr-muted'); st.classList.add('dz-clr-danger'); }
    return;
  }
  localStorage.setItem('dazura_gemini_key', val);
  if (document.getElementById('geminiApiKeyInput')) document.getElementById('geminiApiKeyInput').value = '';
  const st = document.getElementById('geminiKeyStatus');
  if (st) { st.textContent = '✅ מפתח נשמר — AI ישתמש ב-Gemini'; st.classList.remove('dz-clr-danger','dz-clr-muted'); st.classList.add('dz-clr-ok'); }
}
function clearGeminiKey() {
  localStorage.removeItem('dazura_gemini_key');
  if (document.getElementById('geminiApiKeyInput')) document.getElementById('geminiApiKeyInput').value = '';
  const st = document.getElementById('geminiKeyStatus');
  if (st) { st.textContent = 'מפתח הוסר — AI עובד מקומית'; st.classList.remove('dz-clr-danger','dz-clr-ok'); st.classList.add('dz-clr-muted'); }
}
function initGeminiKeyStatus() {
  const has = !!localStorage.getItem('dazura_gemini_key');
  const st  = document.getElementById('geminiKeyStatus');
  if (st) {
    st.textContent = has ? '🟢 מפתח Gemini פעיל' : '⚪ ללא מפתח — AI מקומי בלבד';
    st.classList.toggle('dz-clr-ok', has); st.classList.toggle('dz-clr-muted', !has);
  }
  if (document.getElementById('geminiApiKeyInput')) document.getElementById('geminiApiKeyInput').value = '';
}

// ============================================================
// AI ENGINE — מנוע מקומי מבוסס נתוני החברה
// ============================================================
const AIEngine = {
  getStoredData() {
    try { return JSON.parse(localStorage.getItem('vacSystem_v3')) || {}; }
    catch(e) { return {}; }
  },

  patterns: {
    todayStatus:      [/מי (במשרד|נמצא|בעבודה|היום|כרגע|עכשיו)/i, /סטטוס (היום|עכשיו|כרגע)/i, /(איפה|מי|איזה) (עובדים|אנשים) (היום|כרגע)/i],
    vacationBalance:  [/כמה (חופש|ימי חופשה|יתרה|נותר|נשאר)/i, /(יתרת|נותרו|נשארו|כמה נשאר).*חופשה/i, /מה (היתרה|המכסה|החופש) (שלי|של)/i],
    whoOnVacation:    [/מי (בחופש|בחופשה|לא פה|חופש|מחלה|מהבית)/i, /מי (חולה|במחלה)/i, /מי (עובד מהבית|WFH|מהבית)/i, /רשימת (חופשות|מחלות|WFH)/i],
    departmentStatus: [/סטטוס (מחלקה|מחלקת|צוות)/i, /מי (ב|לא ב) מחלקת/i, /(עומס|כיסוי|כוח אדם) (במחלקה|בצוות)/i],
    futurePrediction: [/חיזוי (חופשות|עומס|כיסוי)/i, /מה (צפוי|יהיה) (מחר|בשבוע|בחודש)/i],
    burnoutRisk:      [/מי (בסיכון|עייף|שחוק|בשחיקה)/i, /סיכון שחיקה/i],
    costEstimate:     [/עלות (חופשות|חופש|מחלות)/i, /חיסכון (WFH|מהבית)/i, /תקציב (חופשות|עלויות)/i],
    birthdayCheck:    [/יום הולדת/i, /מי (חוגג|יש לו) יום הולדת/i],
    pendingApprovals: [/ממתין|אישור|בקשות פתוחות|לאשר/i],
    auditLog:         [/יומן|ביקורת|שינוי מכסה|מי שינה/i],
  },

  context: { lastUser: null, lastDate: null, lastDept: null },

  ask(question, cu) {
    const db = this.getStoredData();
    const q  = (question||'').trim().toLowerCase();
    if (!cu) return 'לא מחובר למערכת.';

    const isAdmin = cu.username === 'gmaneg' || cu.role === 'admin';
    const isMgr   = isAdmin || cu.role === 'manager';
    const isAcct  = cu.role === 'accountant';
    const userDept = Array.isArray(cu.dept) ? cu.dept[0] : (cu.dept||'');

    // Extract context
    const name = this.extractName(q, db);
    if (name) this.context.lastUser = name;
    const dept = this.extractDept(q, db);
    if (dept) this.context.lastDept = dept;
    const date = this.extractDate(q);
    if (date) this.context.lastDate = date;

    // ── PERMISSION CHECKS ──────────────────────────────────
    // חסימת מידע אישי של עובדים אחרים
    if (!isMgr && !isAcct && name && name.toLowerCase() !== (cu.fullName||'').toLowerCase()) {
      if (this.matchAny(q, this.patterns.vacationBalance)) {
        return '🔒 אינך מורשה לצפות ביתרות של עובדים אחרים.';
      }
    }
    // מנהל — מחלקה שלו בלבד
    if (cu.role === 'manager' && !isAdmin) {
      const targetDept = dept || this.context.lastDept;
      if (targetDept && targetDept !== userDept) {
        return '🔒 אין לי הרשאה להציג מידע מחוץ למחלקת ' + userDept + '.';
      }
    }
    // חסימת שאלות חיצוניות
    if (this.isExternalQuestion(q)) return '⛔ אני עונה רק על שאלות הקשורות למערכת Dazura.';

    // ── INTENTS ────────────────────────────────────────────
    if (this.matchAny(q, this.patterns.todayStatus))
      return this.getTodayStatus(db, cu, isMgr, userDept);

    if (this.matchAny(q, this.patterns.whoOnVacation))
      return this.getWhoOnTypeToday(db, this.detectType(q), cu, isMgr, userDept);

    if (this.matchAny(q, this.patterns.vacationBalance))
      return this.getVacationBalance(db, name || cu.fullName, cu, isMgr, isAcct);

    if (this.matchAny(q, this.patterns.departmentStatus))
      return this.getDeptStatus(db, dept || userDept, date || this.getTodayKey());

    if (this.matchAny(q, this.patterns.burnoutRisk) && isMgr)
      return this.assessBurnoutRisk(db, name, isMgr ? null : userDept);

    if (this.matchAny(q, this.patterns.futurePrediction) && isMgr)
      return this.predictFutureLoad(db, date || this.getTomorrowKey());

    if (this.matchAny(q, this.patterns.costEstimate) && (isMgr || isAcct))
      return this.estimateCosts(db);

    if (this.matchAny(q, this.patterns.pendingApprovals) && isMgr)
      return this.getPendingApprovals(db, cu, isAdmin, userDept);

    if (this.matchAny(q, this.patterns.auditLog) && isAdmin)
      return this.getAuditLog(db);

    if (this.matchAny(q, this.patterns.birthdayCheck))
      return this.checkBirthdays(db, date || this.getTodayKey());

    // ── MY OWN STATUS (עובד) ───────────────────────────────
    if (!isMgr && !isAcct) return this.getMyStatus(db, cu);

    return this.getHelpfulFallback(cu.role);
  },

  isExternalQuestion(q) {
    const external = [/מזג אוויר/i, /מה שעה/i, /ויקיפדיה/i, /תכנות/i, /python/i, /javascript/i, /html/i];
    return external.some(r => r.test(q));
  },

  matchAny(text, regexArray) { return regexArray.some(r => r.test(text)); },

  detectType(q) {
    if (/חופש|חופשה/i.test(q)) return 'vacation';
    if (/מחלה|חולה/i.test(q)) return 'sick';
    if (/מהבית|WFH/i.test(q)) return 'wfh';
    return 'all';
  },

  extractName(q, db) {
    const words = q.split(/\s+/);
    for (const word of words) {
      const clean = word.replace(/[.,!?]/g,'').toLowerCase();
      for (const uid in db.users||{}) {
        const fullName = (db.users[uid].fullName||'').toLowerCase();
        const first    = fullName.split(' ')[0];
        if (first && first === clean) return db.users[uid].fullName;
        if (fullName === clean) return db.users[uid].fullName;
      }
    }
    return null;
  },

  extractDept(q, db) {
    const depts = [...new Set(Object.values(db.users||{}).map(u => Array.isArray(u.dept)?u.dept[0]:u.dept).filter(Boolean))];
    for (const dept of depts) {
      if (q.includes(dept.toLowerCase())) return dept;
    }
    return null;
  },

  extractDate(q) {
    if (/מחר/i.test(q)) return this.getTomorrowKey();
    if (/השבוע/i.test(q)) return { type:'week' };
    if (/החודש/i.test(q)) return { type:'month' };
    const m = q.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2})/);
    if (m) {
      if (m[1]) return m[1];
      if (m[2]) { const [d,mo]=m[2].split('/').map(Number); const y=new Date().getFullYear(); return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'); }
    }
    return null;
  },

  getTodayKey() { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); },
  getTomorrowKey() { const d=new Date(); d.setDate(d.getDate()+1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); },

  getUsersForRole(db, cu, isMgr, userDept) {
    const all = Object.values(db.users||{}).filter(u => u.role!=='admin' && (!u.status||u.status==='active'));
    if (!isMgr) return all.filter(u=>u.username===cu.username);
    const isAdmin = cu.username==='gmaneg'||cu.role==='admin';
    if (isAdmin) return all;
    return all.filter(u => { const d=Array.isArray(u.dept)?u.dept[0]:u.dept; return d===userDept; });
  },

  getTodayStatus(db, cu, isMgr, userDept) {
    const today = this.getTodayKey();
    const users = this.getUsersForRole(db, cu, isMgr, userDept);
    const vacs  = db.vacations||{};
    const inOffice=[], vacation=[], wfh=[], sick=[];
    users.forEach(u => {
      const t = (vacs[u.username]||{})[today];
      const n = u.fullName||u.username;
      if (t==='full'||t==='half') vacation.push(n);
      else if (t==='wfh') wfh.push(n);
      else if (t==='sick') sick.push(n);
      else inOffice.push(n);
    });
    const scope = isMgr ? '' : ' (הצוות שלך)';
    return 'סטטוס להיום (' + today + ')' + scope + ':\n\n' +
      '🏢 במשרד: ' + inOffice.length + (inOffice.length ? ' — ' + inOffice.join(', ') : '') + '\n' +
      '🌴 בחופשה: ' + vacation.length + (vacation.length ? ' — ' + vacation.join(', ') : '') + '\n' +
      '🏠 WFH: '    + wfh.length     + (wfh.length     ? ' — ' + wfh.join(', ')     : '') + '\n' +
      '🤒 מחלה: '   + sick.length    + (sick.length    ? ' — ' + sick.join(', ')    : '');
  },

  getWhoOnTypeToday(db, type, cu, isMgr, userDept) {
    const today = this.getTodayKey();
    const users = this.getUsersForRole(db, cu, isMgr, userDept);
    const vacs  = db.vacations||{};
    const labels = { vacation:'בחופשה', sick:'במחלה', wfh:'עובד מהבית', all:'לא במשרד' };
    const result = users.filter(u => {
      const t = (vacs[u.username]||{})[today];
      if (type==='vacation') return t==='full'||t==='half';
      if (type==='sick') return t==='sick';
      if (type==='wfh') return t==='wfh';
      return t==='full'||t==='half'||t==='sick'||t==='wfh';
    }).map(u => u.fullName||u.username);
    if (!result.length) return 'אף אחד לא ' + (labels[type]||'') + ' היום.';
    return (labels[type]||'') + ' היום:\n' + result.map(n=>'• '+n).join('\n');
  },

  getVacationBalance(db, name, cu, isMgr, isAcct) {
    if (!name) return 'ציין בבקשה שם עובד.';
    const user = Object.values(db.users||{}).find(u => (u.fullName||'').toLowerCase().includes(name.toLowerCase()) || u.username.toLowerCase()===name.toLowerCase());
    if (!user) return 'לא מצאתי עובד בשם "' + name + '".';
    if (!isMgr && !isAcct && user.username !== cu.username) return '🔒 אינך מורשה לצפות ביתרות של עובדים אחרים.';
    const year = new Date().getFullYear();
    const quota = ((user.quotas||{})[year]||{}).annual || 0;
    const vacs  = db.vacations||{};
    const used  = Object.values(vacs[user.username]||{}).filter(t=>t==='full'||t==='half').length;
    const sickDays = Object.values(vacs[user.username]||{}).filter(t=>t==='sick').length;
    return (user.fullName||user.username) + ' — יתרת חופשה:\n\n' +
      '📅 מכסה שנתית: ' + quota + ' ימים\n' +
      '✅ נוצל: ' + used + ' ימים\n' +
      '💰 יתרה: ' + (quota-used) + ' ימים\n' +
      '🤒 ימי מחלה השנה: ' + sickDays;
  },

  getDeptStatus(db, dept, dateKey) {
    if (!dept) return 'ציין מחלקה.';
    if (typeof dateKey !== 'string') dateKey = this.getTodayKey();
    const users = Object.values(db.users||{}).filter(u => { const d=Array.isArray(u.dept)?u.dept[0]:u.dept; return (d||'').toLowerCase()===dept.toLowerCase(); });
    if (!users.length) return 'לא מצאתי מחלקה בשם "' + dept + '".';
    const vacs = db.vacations||{};
    let available=0, absent=0;
    users.forEach(u => {
      const t=(vacs[u.username]||{})[dateKey];
      if (!t||t==='wfh') available++; else absent++;
    });
    const pct = Math.round((available/users.length)*100);
    return 'מחלקת ' + dept + ' — ' + dateKey + ':\n\n' +
      '👥 סה"כ: ' + users.length + '\n' +
      '✅ זמינים: ' + available + ' (' + pct + '%)\n' +
      '❌ נעדרים: ' + absent + '\n' +
      (pct < 70 ? '⚠️ כיסוי נמוך — שקול גיוס זמני.' : '✔️ כיסוי תקין.');
  },

  assessBurnoutRisk(db, name, deptFilter) {
    const now = new Date();
    const vacs = db.vacations||{};
    let users = Object.values(db.users||{}).filter(u=>u.role!=='admin'&&(!u.status||u.status==='active'));
    if (deptFilter) users = users.filter(u=>(Array.isArray(u.dept)?u.dept[0]:u.dept)===deptFilter);
    if (name) users = users.filter(u=>(u.fullName||'').toLowerCase().includes(name.toLowerCase()));
    const risks = users.filter(u => {
      const last = Object.keys(vacs[u.username]||{}).filter(d=>(vacs[u.username][d]==='full'||vacs[u.username][d]==='half')).sort().pop();
      if (!last) return true;
      return (now-new Date(last))/86400000 > 90;
    });
    if (!risks.length) return '✅ אין עובדים בסיכון שחיקה כרגע.';
    return '🔥 עובדים שלא לקחו חופש מעל 90 יום:\n' + risks.map(u=>'• '+u.fullName).join('\n');
  },

  predictFutureLoad(db, startDate) {
    if (typeof startDate !== 'string') startDate = this.getTomorrowKey();
    const past = [];
    for (let i=1;i<=7;i++) { const d=new Date(); d.setDate(d.getDate()-i); past.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')); }
    const vacs = db.vacations||{};
    let total=0;
    past.forEach(day => { Object.values(vacs).forEach(uv=>{ if(uv[day]==='full'||uv[day]==='half') total++; }); });
    const avg = Math.round(total/7);
    const totalUsers = Object.values(db.users||{}).filter(u=>u.role!=='admin').length;
    return 'חיזוי עומס (' + startDate + '):\n\n' +
      '📊 ממוצע חופשות יומי (שבוע שעבר): ~' + avg + ' עובדים\n' +
      '👥 סה"כ עובדים: ' + totalUsers + '\n' +
      (avg/totalUsers > 0.3 ? '⚠️ סיכון עומס גבוה — תכנן גיבויים.' : '✔️ צפי תקין.');
  },

  estimateCosts(db) {
    const monthStart = new Date(); monthStart.setDate(1);
    const ms = monthStart.getFullYear()+'-'+String(monthStart.getMonth()+1).padStart(2,'0')+'-01';
    const vacs = db.vacations||{};
    let vacDays=0, wfhDays=0;
    Object.values(vacs).forEach(uv => {
      Object.entries(uv).forEach(([d,t]) => {
        if (d>=ms) { if(t==='full'||t==='half') vacDays++; if(t==='wfh') wfhDays++; }
      });
    });
    return 'הערכת עלויות החודש (ללא נתוני שכר):\n\n' +
      '🌴 ימי חופשה: ' + vacDays + '\n' +
      '🏠 ימי WFH: ' + wfhDays + '\n' +
      '💡 חיסכון משוער WFH: ~20% מעלויות משרד\n' +
      '(לנתונים מדויקים — ייצא דוח שכר)';
  },

  getPendingApprovals(db, cu, isAdmin, userDept) {
    let reqs = (db.approvalRequests||[]).filter(r=>r.status==='pending');
    if (!isAdmin) reqs = reqs.filter(r => {
      const u = (db.users||{})[r.username];
      const d = u ? (Array.isArray(u.dept)?u.dept[0]:u.dept) : '';
      return d===userDept;
    });
    if (!reqs.length) return '✅ אין בקשות ממתינות לאישור.';
    const now = new Date();
    return '⏳ בקשות ממתינות לאישור (' + reqs.length + '):\n\n' +
      reqs.map(r => {
        const hrs = r.submittedAt ? Math.round((now-new Date(r.submittedAt))/3600000) : 0;
        return '• ' + (r.employeeName||r.username) + ': ' + (r.startDate||'') + ' → ' + (r.endDate||'') + (hrs>48?' ⚠️ '+hrs+'ש':'');
      }).join('\n');
  },

  getAuditLog(db) {
    const log = (db.auditLog||[]).slice(-15);
    if (!log.length) return 'אין רשומות ביומן.';
    return '📋 יומן ביקורת (15 פעולות אחרונות):\n\n' +
      log.reverse().map(e=>'[' + (e.ts||'').slice(0,16) + '] ' + (e.user||'') + ': ' + (e.action||'') + (e.details?' — '+e.details:'')).join('\n');
  },

  checkBirthdays(db, dateKey) {
    if (typeof dateKey !== 'string') dateKey = this.getTodayKey();
    const mmdd = dateKey.slice(5);
    const bdays = Object.values(db.users||{}).filter(u=>u.birthday&&u.birthday.slice(5)===mmdd);
    if (!bdays.length) return 'אין ימי הולדת ב-' + dateKey + '.';
    return '🎉 ימי הולדת ב-' + dateKey + ':\n' + bdays.map(u=>'• '+u.fullName).join('\n');
  },

  getMyStatus(db, cu) {
    const today = this.getTodayKey();
    const year  = new Date().getFullYear();
    const vacs  = (db.vacations||{})[cu.username]||{};
    const quota = ((cu.quotas||{})[year]||{}).annual||0;
    const used  = Object.values(vacs).filter(t=>t==='full'||t==='half').length;
    const sick  = Object.values(vacs).filter(t=>t==='sick').length;
    const todayStatus = vacs[today];
    const statusLabel = !todayStatus ? 'נוכח' : todayStatus==='full'?'חופשה':todayStatus==='half'?'חופשה חצי-יום':todayStatus==='wfh'?'WFH':'מחלה';
    const myReqs = (db.approvalRequests||[]).filter(r=>r.username===cu.username);
    return 'שלום ' + (cu.fullName||cu.username) + '! הנה הסטטוס שלך:\n\n' +
      '📅 היום: ' + statusLabel + '\n' +
      '🌴 יתרת חופשה: ' + (quota-used) + ' / ' + quota + ' ימים\n' +
      '🤒 ימי מחלה השנה: ' + sick + '\n' +
      '📨 בקשות שלי: ' + myReqs.length + ' (מאושרות: ' + myReqs.filter(r=>r.status==='approved').length + ', ממתינות: ' + myReqs.filter(r=>r.status==='pending').length + ')';
  },

  getHelpfulFallback(role) {
    const chips = getAIChipsForRole(role);
    return 'לא הבנתי את השאלה 😅\n\nנסה לשאול:\n' + chips.map(c=>'• ' + c.label).join('\n');
  }
};

// ============================================================
// CHIPS PER ROLE
// ============================================================
function getAIChipsForRole(role) {
  const isAdmin = role === 'admin' || (typeof isCeoUser === 'function' && isCeoUser());
  const isMgr   = isAdmin || role === 'manager';
  const isAcct  = role === 'accountant';

  if (isAdmin) return [
    { label:'מי בחופשה היום?',        q:'מי בחופשה היום?' },
    { label:'מי עובד מהבית?',         q:'מי עובד מהבית היום?' },
    { label:'מי בסיכון שחיקה?',       q:'מי בסיכון שחיקה?' },
    { label:'בקשות ממתינות',          q:'כמה בקשות ממתינות לאישור?' },
    { label:'עלויות החודש',           q:'עלות חופשות החודש' },
    { label:'חיזוי עומס מחר',         q:'חיזוי עומס מחר' },
    { label:'יומן ביקורת',            q:'הצג יומן ביקורת' },
  ];
  if (isMgr) return [
    { label:'סטטוס הצוות היום',       q:'סטטוס מחלקה היום' },
    { label:'מי בחופשה?',             q:'מי בחופשה היום?' },
    { label:'בקשות ממתינות',          q:'בקשות פתוחות לאישור' },
    { label:'שחיקה בצוות',            q:'מי בסיכון שחיקה?' },
    { label:'חיזוי עומס',             q:'חיזוי עומס השבוע' },
  ];
  if (isAcct) return [
    { label:'יתרות חופשה',            q:'יתרות חופשה לכל העובדים' },
    { label:'עלויות החודש',           q:'עלות חופשות החודש' },
    { label:'ימי מחלה החודש',         q:'סה"כ ימי מחלה החודש' },
  ];
  // employee
  return [
    { label:'הסטטוס שלי',             q:'מה הסטטוס שלי?' },
    { label:'היתרה שלי',              q:'מה יתרת החופשה שלי?' },
    { label:'הבקשות שלי',             q:'מה קורה עם הבקשות שלי?' },
    { label:'מי חסר מהצוות?',         q:'מי לא בעבודה היום?' },
  ];
}

// ============================================================
// GEMINI INTEGRATION (אופציונלי — רק אם יש מפתח)
// ============================================================
async function askGemini(userQ, localAnswer, apiKey) {
  const db = (typeof getDB === 'function') ? getDB() : AIEngine.getStoredData();
  const cu = (typeof currentUser !== 'undefined') ? currentUser : null;
  if (!cu) throw new Error('לא מחובר');

  const isAdmin = (typeof isCeoUser==='function'&&isCeoUser()) || cu.role==='admin';
  const isMgr   = isAdmin || cu.role==='manager';
  const userDept = Array.isArray(cu.dept)?cu.dept[0]:(cu.dept||'');
  const roleLabel = isAdmin?'מנכ"ל/אדמין':cu.role==='manager'?'מנהל מחלקה':cu.role==='accountant'?'חשבת':'עובד';
  const today = new Date().toISOString().split('T')[0];

  const systemPrompt = [
    '## זהות',
    'אתה מנוע ה-AI הרשמי של מערכת Dazura 3.0 לניהול חופשות ונוכחות. עבוד בעברית מקצועית בלבד.',
    '',
    '## משתמש מחובר',
    'שם: ' + (cu.fullName||cu.username) + ' | תפקיד: ' + roleLabel + ' | מחלקה: ' + userDept + ' | תאריך: ' + today,
    '',
    '## הרשאות',
    isAdmin ? 'גישה מלאה. התרע על עומס אם מחלקה מתחת ל-70%.' :
    isMgr   ? 'גישה למחלקה ' + userDept + ' בלבד. מחלקה אחרת — "אין לי הרשאה."' :
    cu.role==='accountant' ? 'גישה ליתרות וצבירה. WFH רק אם נשאל.' :
    'גישה אישית בלבד.',
    '',
    '## תשובת המנוע המקומי',
    localAnswer,
    '',
    '## מגבלות',
    '- אל תמציא נתונים. אם חסר — "לא נמצא דיווח".',
    '- סיבת מחלה/חופשה — "לא יכול לענות על כך".',
    '- אל תענה על שאלות חיצוניות (מזג אוויר, קוד, ויקיפדיה).',
    '- אל תחשוף סיסמאות או מיילים.',
    '- ענה בעברית ברורה ומקצועית.'
  ].join('\n');

  const resp = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
    { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        system_instruction: {parts:[{text:systemPrompt}]},
        contents: [{role:'user',parts:[{text:userQ}]}],
        generationConfig: {maxOutputTokens:600, temperature:0.4}
      })
    }
  );
  if (!resp.ok) { const e=await resp.text().catch(()=>''); throw new Error('Gemini '+resp.status+': '+e.slice(0,80)); }
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('תשובה ריקה');
  return text.trim();
}

// ============================================================
// UNIFIED AI CHAT — משמש את כל המסכים
// ============================================================
const DazuraAI = {
  histories: {}, // per containerId

  getHistory(id) {
    if (!this.histories[id]) this.histories[id] = [];
    return this.histories[id];
  },

  clearHistory(id) {
    this.histories[id] = [];
    this.render(id);
  },

  render(containerId, chipsId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const hist = this.getHistory(containerId);
    const chips = chipsId ? document.getElementById(chipsId) : null;

    if (!hist.length) {
      container.innerHTML = '<div class="dz-1164"><div style="font-size:11px;color:rgba(180,210,255,0.7);">בחר שאלה מהירה או הקלד שאלה חופשית</div></div>';
      if (chips) chips.style.display = 'flex';
      return;
    }
    if (chips) chips.style.display = 'none';
    container.innerHTML = hist.map(msg =>
      '<div class="dz-flex-col-1165">' +
      '<div style="max-width:92%;background:'+(msg.role==='user'?'rgba(0,80,255,0.65)':'rgba(255,255,255,0.07)')+';color:white;border-radius:'+(msg.role==='user'?'12px 12px 3px 12px':'12px 12px 12px 3px')+';padding:9px 13px;font-size:12px;line-height:1.6;white-space:pre-wrap;border:1px solid '+(msg.role==='user'?'rgba(0,150,255,0.3)':'rgba(255,255,255,0.08)')+';">' +
      msg.content + '</div></div>'
    ).join('');
    container.scrollTop = container.scrollHeight;
  },

  renderChips(chipsId, role) {
    const el = document.getElementById(chipsId);
    if (!el) return;
    const chips = getAIChipsForRole(role);
    const containerId = chipsId.replace('Chips','Messages');
    const inputId     = chipsId.replace('Chips','Input');
    el.innerHTML = chips.map(c =>
      '<button onclick="DazuraAI.send(\''+containerId+'\',\''+chipsId+'\',\''+inputId+'\',\''+c.q.replace(/'/g,"\\'")+'\')" class="ai-chip">'+c.label+'</button>'
    ).join('');
  },

  async send(containerId, chipsId, inputId, query) {
    const input = document.getElementById(inputId);
    const q = query || (input ? input.value.trim() : '');
    if (!q) return;
    if (input) input.value = '';

    const cu = (typeof currentUser !== 'undefined') ? currentUser : null;
    const hist = this.getHistory(containerId);
    hist.push({ role:'user', content:q });
    this.render(containerId, chipsId);

    // typing indicator
    const container = document.getElementById(containerId);
    const typingId = 'aiTyping_' + containerId;
    if (container) {
      container.innerHTML += '<div id="'+typingId+'" class="dz-flex-1166"><div style="background:rgba(255,255,255,0.07);border-radius:14px 14px 14px 4px;padding:10px 14px;font-size:13px;border:1px solid rgba(255,255,255,0.08);"><span class="dz-1167"><span style="width:6px;height:6px;background:rgba(100,180,255,0.7);border-radius:50%;animation:typingDot 1.2s infinite 0s;display:inline-block;"></span><span class="dz-bg-1168"></span><span style="width:6px;height:6px;background:rgba(100,180,255,0.7);border-radius:50%;animation:typingDot 1.2s infinite 0.4s;display:inline-block;"></span></span></div></div>';
      container.scrollTop = container.scrollHeight;
    }

    // local answer
    const localAnswer = AIEngine.ask(q, cu);
    const apiKey = localStorage.getItem('dazura_gemini_key');

    let finalAnswer = localAnswer;
    if (apiKey && !localAnswer.startsWith('🔒') && !localAnswer.startsWith('⛔')) {
      try { finalAnswer = await askGemini(q, localAnswer, apiKey); }
      catch(e) { finalAnswer = localAnswer + '\n\n⚠️ Gemini: ' + e.message; }
    }

    const typing = document.getElementById(typingId);
    if (typing) typing.remove();
    hist.push({ role:'assistant', content:finalAnswer });
    this.render(containerId, chipsId);
  }
};

// ============================================================
// LEGACY COMPATIBILITY — functions called from existing HTML
// ============================================================
const ceoAiHistory = DazuraAI.getHistory('ceoAiMessages');

function renderCeoAiMessages() { DazuraAI.render('ceoAiMessages','ceoAiChips'); }
function initCeoAiChat()       { DazuraAI.renderChips('ceoAiChips', currentUser?.role||'admin'); DazuraAI.render('ceoAiMessages','ceoAiChips'); }
function clearCeoAiChat()      { DazuraAI.clearHistory('ceoAiMessages'); }
function sendCeoAiQuery(q)     { DazuraAI.send('ceoAiMessages','ceoAiChips','ceoAiInput',q); }

function renderModuleAiMessages() { DazuraAI.render('moduleAiMessages','moduleAiChips'); }
function clearModuleAiChat()      { DazuraAI.clearHistory('moduleAiMessages'); }
function sendModuleAiQuery(q)     { DazuraAI.send('moduleAiMessages','moduleAiChips','moduleAiInput',q); }

// Refresh chips when module selector loads (called from showModuleSelector in script.js)
function initModuleAiChat() {
  const role = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : 'employee';
  DazuraAI.renderChips('moduleAiChips', role);
  DazuraAI.render('moduleAiMessages','moduleAiChips');
}

// Signal ready (must be last line of ai.js)
window._aiReady = true;
