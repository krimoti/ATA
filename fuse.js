// ============================================================
// DAZURA AI FUSE ENGINE v2.1
// ============================================================
// ללא LLM — מקומי לחלוטין, עובד על כל מכשיר ודפדפן
//  1. Fuse.js  — חיפוש פאזי לשמות עובדים ומחלקות
//  2. DazuraAI — מנוע תשובות מקומי (ai.js)
//  3. Fallback — תשובה חכמה לפי מילות מפתח
// ============================================================

const DazuraFuse = (() => {

  // ──────────────────────────────────────────
  // 1. FUSE.JS LOADER
  // ──────────────────────────────────────────
  let _fuseLoaded = false;

  function loadFuse() {
    if (_fuseLoaded && window.Fuse) return Promise.resolve(true);
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.0.0/fuse.min.js';
      script.onload  = () => { _fuseLoaded = true; resolve(true); };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  // ──────────────────────────────────────────
  // 2. FUZZY SEARCH
  // ──────────────────────────────────────────

  // נרמול — מסיר ניקוד עברי, גרשיים, רווחים כפולים
  function normalizeText(text) {
    return (text || '')
      .replace(/[\u0591-\u05C7]/g, '')  // ניקוד עברי
      .replace(/['"״׳]/g, '')            // גרש/גרשיים
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  function buildUserIndex(db) {
    if (!db?.users) return [];
    return Object.entries(db.users)
      .filter(([, u]) => u.fullName && u.status !== 'pending')
      .map(([username, u]) => ({
        username,
        fullName:   u.fullName,
        normalized: normalizeText(u.fullName),
        firstName:  u.fullName.split(' ')[0] || '',
        lastName:   u.fullName.split(' ').slice(-1)[0] || '',
        nickname:   u.nickname || u.fullName.split(' ')[0] || '',
      }));
  }

  function fuzzyFindEmployee(query, db) {
    if (!window.Fuse || !db?.users) return null;
    const q     = normalizeText(query);
    const users = buildUserIndex(db);

    // חיפוש מדויק קודם
    const exact = users.find(u =>
      u.normalized === q ||
      u.firstName.toLowerCase() === q ||
      u.lastName.toLowerCase() === q ||
      u.username.toLowerCase() === q
    );
    if (exact) return exact;

    // חיפוש פאזי
    const fuse = new Fuse(users, {
      keys: [
        { name: 'fullName',   weight: 0.4 },
        { name: 'normalized', weight: 0.3 },
        { name: 'firstName',  weight: 0.15 },
        { name: 'lastName',   weight: 0.1 },
        { name: 'nickname',   weight: 0.05 },
      ],
      threshold: 0.42,
      minMatchCharLength: 2,
      includeScore: true,
      ignoreLocation: true,
    });

    const results = fuse.search(q);
    if (results.length && results[0].score < 0.5) return results[0].item;
    return null;
  }

  function fuzzyFindDept(query, db) {
    if (!window.Fuse || !db?.departments) return null;
    const depts = (db.departments || []).map(d => ({
      name: d, normalized: normalizeText(d),
    }));
    const fuse = new Fuse(depts, {
      keys: ['name', 'normalized'],
      threshold: 0.4,
      minMatchCharLength: 2,
    });
    const r = fuse.search(normalizeText(query));
    return r.length ? r[0].item.name : null;
  }

  function smartExtractEmployee(text, db) {
    if (!db?.users) return null;
    const t = normalizeText(text);

    // שם מלא
    for (const [uname, user] of Object.entries(db.users)) {
      if (user.status === 'pending') continue;
      if (t.includes(normalizeText(user.fullName))) return uname;
    }
    // חלק מהשם (מינימום 3 תווים)
    for (const [uname, user] of Object.entries(db.users)) {
      if (user.status === 'pending') continue;
      const parts = normalizeText(user.fullName).split(' ').filter(p => p.length >= 3);
      if (parts.some(p => t.includes(p))) return uname;
    }
    // Fuse על מילים בודדות בטקסט
    if (window.Fuse) {
      const words = text.match(/[\u0590-\u05FF\w]{2,}/g) || [];
      for (const word of words) {
        if (word.length < 3) continue;
        const found = fuzzyFindEmployee(word, db);
        if (found) return found.username;
      }
    }
    return null;
  }

  // ──────────────────────────────────────────
  // 3. UNKNOWN DETECTION
  // ──────────────────────────────────────────

  const UNKNOWN_SIGNALS = [
    'לא הצלחתי להבין', 'לא בטוח מה', 'נסח מחדש',
    'שאלה מחוץ לתחום', '❓', 'לא הבנתי את', 'אנסה שוב',
    'אין לי תשובה', 'לא מצאתי', 'לא יכול לעזור',
  ];

  function isUnknown(text) {
    if (!text || text.trim().length < 5) return true;
    return UNKNOWN_SIGNALS.some(s => text.includes(s));
  }

  // ──────────────────────────────────────────
  // 4. SMART FALLBACK (ללא LLM)
  // ──────────────────────────────────────────

  function fallback(text, currentUser, db) {
    const today = new Date().toISOString().split('T')[0];

    // עובד לפי שם בטקסט
    const empUsername = smartExtractEmployee(text, db);
    if (empUsername && db?.users?.[empUsername]) {
      const u    = db.users[empUsername];
      const type = db?.vacations?.[empUsername]?.[today];
      const statusMap = {
        full: 'בחופשה 🏖️', half: 'בחצי יום 🌅',
        wfh:  'עובד/ת מהבית 🏠', sick: 'ביום מחלה 🤒',
      };
      return `**${u.fullName}** — היום: ${statusMap[type] || 'במשרד 📍'}`;
    }

    // מחלקה לפי שם בטקסט
    const deptName = fuzzyFindDept(text, db);
    if (deptName) {
      const inDept = Object.values(db?.users || {}).filter(u => {
        const d = Array.isArray(u.dept) ? u.dept[0] : u.dept;
        return d === deptName && u.status !== 'pending';
      });
      const away = inDept.filter(u => {
        const t = db?.vacations?.[u.username]?.[today];
        return t === 'full' || t === 'half' || t === 'sick';
      });
      return `מחלקת **${deptName}**: ${inDept.length} עובדים, ${away.length} נעדרים היום.`;
    }

    // הצעה לפי מילות מפתח
    const t = text.toLowerCase();
    if (/חופש|חופשה|יתרה|ימים/.test(t))  return `שאל/י: "מה היתרה שלי?" או "מי בחופשה היום?" 💡`;
    if (/מחלקה|צוות|עובדים/.test(t))      return `שאל/י: "מצב הצוות היום" או "מי במחלקה X?" 💡`;
    if (/מחר|השבוע|שבוע הבא/.test(t))     return `שאל/י: "מי בחופשה מחר?" או "מצב השבוע הבא" 💡`;
    if (/שעות|כניסה|יציאה/.test(t))       return `שאל/י: "איך מתקנים שעות?" או "למי מדווחות השעות?" 💡`;
    if (/אישור|בקשה|סטטוס/.test(t))       return `שאל/י: "מה סטטוס הבקשה שלי?" 💡`;

    return `שאל אותי: "מי בחופשה היום?" | "מה היתרה שלי?" | "מצב הצוות" 💡`;
  }

  // ──────────────────────────────────────────
  // 5. HISTORY + MAIN RESPOND
  // ──────────────────────────────────────────

  let _history = [];
  const MAX_HISTORY = 16;

  async function respondAsync(msg, currentUser, db) {
    _history.push({ role: 'user', text: msg });
    if (_history.length > MAX_HISTORY) _history = _history.slice(-MAX_HISTORY);

    // שלב 1: DazuraAI מקומי (ai.js + ai-patch.js)
    let local = null;
    try {
      if (typeof DazuraAI !== 'undefined') {
        local = DazuraAI.respond(msg, currentUser, db);
      }
    } catch (e) {}

    if (!isUnknown(local)) {
      _history.push({ role: 'ai', text: local });
      return local;
    }

    // שלב 2: Fallback חכם מקומי
    const fb = fallback(msg, currentUser, db);
    _history.push({ role: 'ai', text: fb });
    return fb;
  }

  function clearHistory() { _history = []; }

  // ──────────────────────────────────────────
  // 6. PUBLIC API
  // ──────────────────────────────────────────

  async function searchEmployee(q, db)  { await loadFuse(); return fuzzyFindEmployee(q, db); }
  async function searchDept(q, db)      { await loadFuse(); return fuzzyFindDept(q, db); }
  async function extractEmployee(t, db) { await loadFuse(); return smartExtractEmployee(t, db); }

  // analyzeTeam — ניתוח סטטיסטי מקומי (ללא LLM)
  async function analyzeTeam(prompt, user, db) {
    if (user.role !== 'admin' && user.role !== 'manager') return 'זמין למנהלים בלבד.';

    const year      = new Date().getFullYear();
    const employees = Object.values(db.users || {})
      .filter(u => u.status === 'active' && u.role === 'employee');

    const deptSummary = {};
    employees.forEach(u => {
      const dept = Array.isArray(u.dept) ? u.dept[0] : (u.dept || 'ללא');
      if (!deptSummary[dept]) deptSummary[dept] = { count: 0, used: 0, quota: 0 };
      const vacs = db.vacations?.[u.username] || {};
      let used = 0;
      Object.entries(vacs).forEach(([dt, t]) => {
        if (dt.startsWith(String(year))) used += t === 'full' ? 1 : t === 'half' ? 0.5 : 0;
      });
      deptSummary[dept].count++;
      deptSummary[dept].used  += used;
      deptSummary[dept].quota += u.quotas?.[year]?.annual || 0;
    });

    const rows = Object.entries(deptSummary).map(([dept, s]) => {
      const avg   = (s.used  / Math.max(s.count, 1)).toFixed(1);
      const quota = (s.quota / Math.max(s.count, 1)).toFixed(1);
      const pct   = s.quota > 0 ? Math.round(s.used / s.quota * 100) : 0;
      const flag  = pct > 70 ? '⚠️' : pct < 30 ? '💡' : '✅';
      return `${flag} **${dept}**: ${s.count} עובדים | ניצול ממוצע ${avg}/${quota} ימים (${pct}%)`;
    });

    return `**ניתוח צוות ${year}** (${employees.length} עובדים):\n${rows.join('\n')}`;
  }

  // טען Fuse.js ברקע לאחר שה-splash נעלם
  setTimeout(() => loadFuse(), 2500);

  return {
    respondAsync,
    searchEmployee,
    searchDept,
    extractEmployee,
    analyzeTeam,
    clearHistory,
  };

})();
