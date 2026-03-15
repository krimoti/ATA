// ============================================================
// DAZURA AI FUSE ENGINE v3.0
// ============================================================
// 100% מקומי — ללא רשת, ללא LLM חיצוני
// 1. BuiltinFuse   — חיפוש פאזי מובנה (ללא CDN)
// 2. DazuraAI      — מנוע תשובות מלא (ai.js)
// 3. CustomQA      — מאגר שאלות/תשובות מותאם אישית
// 4. SmartFallback — fallback חכם מהנתונים האמיתיים
// ============================================================

const DazuraFuse = (() => {

  // ──────────────────────────────────────────────────────────
  // 1. BUILT-IN FUZZY SEARCH (100% מקומי, ללא CDN)
  // ──────────────────────────────────────────────────────────
  class BuiltinFuse {
    constructor(list, options = {}) {
      this._list      = list;
      this._keys      = (options.keys || []).map(k => typeof k === 'string' ? { name: k, weight: 1 } : k);
      this._threshold = options.threshold !== undefined ? options.threshold : 0.6;
      this._minLen    = options.minMatchCharLength || 1;
    }
    search(pattern) {
      if (!pattern || pattern.length < this._minLen) return [];
      const p = pattern.toLowerCase();
      const results = [];
      for (const item of this._list) {
        let bestScore = 1;
        for (const key of this._keys) {
          const val = String(this._get(item, key.name) || '').toLowerCase();
          if (!val) continue;
          const score = this._score(p, val) * (1 - Math.min((key.weight || 1) * 0.1, 0.5));
          if (score < bestScore) bestScore = score;
        }
        if (bestScore <= this._threshold) results.push({ item, score: bestScore });
      }
      return results.sort((a, b) => a.score - b.score);
    }
    _get(obj, path) { return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj); }
    _score(pattern, text) {
      if (text === pattern) return 0;
      if (text.startsWith(pattern)) return 0.05;
      if (text.includes(pattern)) return 0.1 + (1 - pattern.length / text.length) * 0.15;
      const words = text.split(/\s+/);
      for (const w of words) { if (w.startsWith(pattern) || pattern.startsWith(w)) return 0.2; }
      return this._lev(pattern.slice(0,20), text.slice(0,20)) / Math.max(pattern.length, text.length, 1);
    }
    _lev(a, b) {
      if (!a.length) return b.length; if (!b.length) return a.length;
      const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
      for (let j = 0; j <= b.length; j++) dp[0][j] = j;
      for (let i = 1; i <= a.length; i++)
        for (let j = 1; j <= b.length; j++)
          dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      return dp[a.length][b.length];
    }
  }

  if (typeof window !== 'undefined') window.Fuse = BuiltinFuse;
  function loadFuse() { if (typeof window !== 'undefined') window.Fuse = BuiltinFuse; return Promise.resolve(true); }

  // ──────────────────────────────────────────────────────────
  // 2. TEXT NORMALIZER
  // ──────────────────────────────────────────────────────────
  function normalizeText(text) {
    return (text || '').replace(/[\u0591-\u05C7]/g, '').replace(/['"'"\u05f4\u05f3]/g, '')
      .toLowerCase().trim().replace(/\s+/g, ' ');
  }

  // ──────────────────────────────────────────────────────────
  // 3. EMPLOYEE / DEPT FUZZY SEARCH
  // ──────────────────────────────────────────────────────────
  function buildUserIndex(db) {
    if (!db?.users) return [];
    return Object.entries(db.users).filter(([, u]) => u.fullName && u.status !== 'pending')
      .map(([username, u]) => ({
        username, fullName: u.fullName, normalized: normalizeText(u.fullName),
        firstName: u.fullName.split(' ')[0] || '', lastName: u.fullName.split(' ').slice(-1)[0] || '',
      }));
  }

  function fuzzyFindEmployee(query, db) {
    if (!db?.users) return null;
    const q = normalizeText(query);
    const users = buildUserIndex(db);
    const exact = users.find(u => u.normalized === q || u.firstName.toLowerCase() === q ||
      u.lastName.toLowerCase() === q || u.username.toLowerCase() === q);
    if (exact) return exact;
    const fuse = new BuiltinFuse(users, {
      keys: [{ name:'fullName', weight:0.4 }, { name:'normalized', weight:0.35 },
             { name:'firstName', weight:0.15 }, { name:'lastName', weight:0.1 }],
      threshold: 0.45, minMatchCharLength: 2,
    });
    const results = fuse.search(q);
    return results.length && results[0].score < 0.5 ? results[0].item : null;
  }

  function fuzzyFindDept(query, db) {
    if (!db?.departments) return null;
    const depts = (db.departments || []).map(d => ({ name: d, normalized: normalizeText(d) }));
    const fuse = new BuiltinFuse(depts, { keys: ['name', 'normalized'], threshold: 0.45, minMatchCharLength: 2 });
    const r = fuse.search(normalizeText(query));
    return r.length ? r[0].item.name : null;
  }

  function smartExtractEmployee(text, db) {
    if (!db?.users) return null;
    const t = normalizeText(text);
    for (const [uname, user] of Object.entries(db.users)) {
      if (user.status === 'pending') continue;
      if (t.includes(normalizeText(user.fullName))) return uname;
    }
    for (const [uname, user] of Object.entries(db.users)) {
      if (user.status === 'pending') continue;
      const parts = normalizeText(user.fullName).split(' ').filter(p => p.length >= 3);
      if (parts.some(p => t.includes(p))) return uname;
    }
    const words = text.match(/[\u0590-\u05FF\w]{2,}/g) || [];
    for (const word of words) {
      if (word.length < 3) continue;
      const found = fuzzyFindEmployee(word, db);
      if (found) return found.username;
    }
    return null;
  }

  // ──────────────────────────────────────────────────────────
  // 4. CUSTOM Q&A ENGINE
  // שאלות/תשובות מותאמות אישית — נטען מ-db.customQA
  // ──────────────────────────────────────────────────────────
  function getCustomQA(db) { return db?.customQA || []; }

  function matchCustomQA(text, db) {
    const qa = getCustomQA(db);
    if (!qa.length) return null;
    const t = normalizeText(text);
    for (const entry of qa) {
      const q = normalizeText(entry.question);
      if (t === q || t.includes(q) || q.includes(t)) return entry.answer;
      const aliases = (entry.aliases || []).map(a => normalizeText(a));
      if (aliases.some(a => t.includes(a))) return entry.answer;
    }
    const fuse = new BuiltinFuse(qa, {
      keys: [{ name:'question', weight:0.7 }, { name:'tags', weight:0.3 }],
      threshold: 0.38, minMatchCharLength: 3,
    });
    const results = fuse.search(t);
    if (results.length && results[0].score < 0.33) return results[0].item.answer;
    return null;
  }

  // ──────────────────────────────────────────────────────────
  // 5. UNKNOWN DETECTION
  // ──────────────────────────────────────────────────────────
  const UNKNOWN_SIGNALS = [
    'לא הצלחתי להבין', 'לא בטוח מה', 'נסח מחדש', 'שאלה מחוץ לתחום',
    'לא הבנתי את', 'אנסה שוב', 'אין לי תשובה', 'לא מצאתי', 'לא יכול לעזור',
  ];
  function isUnknown(text) {
    if (!text || text.trim().length < 5) return true;
    return UNKNOWN_SIGNALS.some(s => text.includes(s));
  }

  // ──────────────────────────────────────────────────────────
  // 6. SMART DATA-DRIVEN FALLBACK
  // ──────────────────────────────────────────────────────────
  function fallback(text, currentUser, db) {
    const today = new Date().toISOString().split('T')[0];
    const t = text.toLowerCase();

    const empUsername = smartExtractEmployee(text, db);
    if (empUsername && db?.users?.[empUsername]) {
      const u = db.users[empUsername];
      const type = db?.vacations?.[empUsername]?.[today];
      const statusMap = { full:'בחופשה 🏖️', half:'בחצי יום 🌅', wfh:'עובד/ת מהבית 🏠', sick:'ביום מחלה 🤒' };
      const year = new Date().getFullYear();
      const vacs = db.vacations?.[empUsername] || {};
      let used = 0;
      Object.entries(vacs).forEach(([dt, tp]) => {
        if (dt.startsWith(String(year))) used += tp === 'full' ? 1 : tp === 'half' ? 0.5 : 0;
      });
      const q = u.quotas?.[year];
      const annual = q?.annual || 0;
      const initBal = q?.knownBalance ?? q?.initialBalance ?? 0;
      const balance = annual ? (initBal - used).toFixed(1) : '?';
      return `**${u.fullName}** — היום: ${statusMap[type] || 'במשרד 📍'}\nיתרת חופשה ${year}: **${balance} ימים**`;
    }

    const deptName = fuzzyFindDept(text, db);
    if (deptName) {
      const inDept = Object.values(db?.users || {}).filter(u => {
        const d = Array.isArray(u.dept) ? u.dept[0] : u.dept;
        return d === deptName && u.status !== 'pending';
      });
      const away = inDept.filter(u => {
        const tp = db?.vacations?.[u.username]?.[today];
        return tp === 'full' || tp === 'half' || tp === 'sick';
      });
      return `מחלקת **${deptName}**: ${inDept.length} עובדים (${inDept.map(u=>u.fullName).join(', ')})\nנעדרים היום: ${away.length ? away.map(u=>u.fullName).join(', ') : 'אין נעדרים ✅'}`;
    }

    if (/חופש|חופשה|יתרה/.test(t))   return 'שאל/י: "מה היתרה שלי?" | "מי בחופשה היום?" 💡';
    if (/מחלקה|צוות/.test(t))         return 'שאל/י: "מי במחלקה שלי?" | "מצב הצוות היום" 💡';
    if (/מחר|השבוע/.test(t))          return 'שאל/י: "מי בחופשה מחר?" | "מצב השבוע הבא" 💡';
    return 'שאל אותי: "מי בחופשה היום?" | "מה היתרה שלי?" | "מצב הצוות" 💡';
  }

  // ──────────────────────────────────────────────────────────
  // 7. MAIN RESPOND — Custom QA → DazuraAI → Fallback
  // ──────────────────────────────────────────────────────────
  let _history = [];
  const MAX_HISTORY = 20;

  async function respondAsync(msg, currentUser, db) {
    _history.push({ role: 'user', text: msg });
    if (_history.length > MAX_HISTORY) _history = _history.slice(-MAX_HISTORY);

    const customAnswer = matchCustomQA(msg, db);
    if (customAnswer) {
      const answer = typeof customAnswer === 'function' ? customAnswer(currentUser, db) : customAnswer;
      _history.push({ role: 'ai', text: answer });
      return answer;
    }

    let local = null;
    try {
      if (typeof DazuraAI !== 'undefined') local = DazuraAI.respond(msg, currentUser, db);
    } catch (e) { console.warn('DazuraAI:', e); }

    if (!isUnknown(local)) {
      _history.push({ role: 'ai', text: local });
      return local;
    }

    const fb = fallback(msg, currentUser, db);
    _history.push({ role: 'ai', text: fb });
    return fb;
  }

  function clearHistory() { _history = []; }

  // ──────────────────────────────────────────────────────────
  // 8. PUBLIC API
  // ──────────────────────────────────────────────────────────
  async function searchEmployee(q, db)  { return fuzzyFindEmployee(q, db); }
  async function searchDept(q, db)      { return fuzzyFindDept(q, db); }
  async function extractEmployee(t, db) { return smartExtractEmployee(t, db); }

  async function analyzeTeam(prompt, user, db) {
    const isManager = user.role === 'admin' || user.role === 'manager' ||
      Object.values(db.deptManagers || {}).includes(user.username);
    if (!isManager) return 'זמין למנהלים בלבד.';
    const year = new Date().getFullYear();
    const employees = Object.values(db.users || {}).filter(u => u.status === 'active' && u.role === 'employee');
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
      const avg = (s.used / Math.max(s.count, 1)).toFixed(1);
      const quota = (s.quota / Math.max(s.count, 1)).toFixed(1);
      const pct = s.quota > 0 ? Math.round(s.used / s.quota * 100) : 0;
      return `${pct > 70 ? '⚠️' : pct < 30 ? '💡' : '✅'} **${dept}**: ${s.count} עובדים | ${avg}/${quota} ימים (${pct}%)`;
    });
    return `**ניתוח צוות ${year}** (${employees.length} עובדים):\n${rows.join('\n')}`;
  }

  return { respondAsync, searchEmployee, searchDept, extractEmployee, analyzeTeam, clearHistory };

})();
