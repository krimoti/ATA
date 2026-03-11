// ============================================================
// DAZURA AI FUSE ENGINE v2.0
// ============================================================
// שדרוג מלא ל-DazuraAI:
//  1. Fuse.js — חיפוש פאזי לשמות עובדים ומחלקות
//  2. Claude API — תשובות LLM לשאלות מורכבות
//  3. Patch על sendAIMessage (לא על DazuraAI.respond — נשאר סינכרוני)
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

  function fuzzyFindEmployee(query, db) {
    if (!window.Fuse || !db?.users) return null;
    const users = Object.entries(db.users)
      .filter(([, u]) => u.fullName && u.status !== 'pending')
      .map(([username, u]) => ({ username, fullName: u.fullName }));
    const fuse = new Fuse(users, {
      keys: ['fullName', 'username'],
      threshold: 0.4,
      minMatchCharLength: 2,
      includeScore: true,
      ignoreLocation: true,
    });
    const r = fuse.search(query);
    return r.length ? r[0].item : null;
  }

  function fuzzyFindDept(query, db) {
    if (!window.Fuse || !db?.departments) return null;
    const depts = (db.departments || []).map(d => ({ name: d }));
    const fuse = new Fuse(depts, { keys: ['name'], threshold: 0.4, minMatchCharLength: 2 });
    const r = fuse.search(query);
    return r.length ? r[0].item.name : null;
  }

  function smartExtractEmployee(text, db) {
    if (!db?.users) return null;
    const t = text.toLowerCase();
    for (const [uname, user] of Object.entries(db.users)) {
      if (t.includes(user.fullName.toLowerCase())) return uname;
    }
    for (const [uname, user] of Object.entries(db.users)) {
      for (const part of user.fullName.split(' ').filter(p => p.length > 2)) {
        if (t.includes(part.toLowerCase())) return uname;
      }
    }
    if (window.Fuse) {
      const words = text.match(/[\u0590-\u05FF]{2,}|[A-Za-z]{3,}/g) || [];
      for (const word of words) {
        const found = fuzzyFindEmployee(word, db);
        if (found) return found.username;
      }
    }
    return null;
  }

  // ──────────────────────────────────────────
  // 3. CLAUDE API
  // ──────────────────────────────────────────

  const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

  function buildSystemPrompt(currentUser, db) {
    const today = new Date().toLocaleDateString('he-IL', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const companyName = db?.settings?.companyName || 'החברה';
    const depts = (db?.departments || []).join(', ');
    const roleLabel = { admin: 'מנהל מערכת', manager: 'מנהל מחלקה', accountant: 'חשב/ת', employee: 'עובד/ת' }[currentUser.role] || 'עובד/ת';
    const userDept = Array.isArray(currentUser.dept) ? currentUser.dept.join(', ') : (currentUser.dept || '');

    let balanceInfo = '';
    try {
      const year = new Date().getFullYear();
      const vacs = db?.vacations?.[currentUser.username] || {};
      let full = 0, half = 0;
      Object.entries(vacs).forEach(([dt, type]) => {
        if (dt.startsWith(String(year))) { if (type === 'full') full++; else if (type === 'half') half++; }
      });
      const quota = db?.users?.[currentUser.username]?.quotas?.[year]?.annual || 0;
      const used = full + half * 0.5;
      balanceInfo = `יתרה: ${(quota - used).toFixed(1)} ימים (ניצל ${used}/${quota})`;
    } catch (e) {}

    let companyStatus = '';
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const active = Object.values(db?.users || {}).filter(u => u.status === 'active');
      let onVac = 0, onWfh = 0;
      active.forEach(u => {
        const t = db?.vacations?.[u.username]?.[todayStr];
        if (t === 'full' || t === 'half') onVac++;
        else if (t === 'wfh') onWfh++;
      });
      const pending = (db?.approvalRequests || []).filter(r => r.status === 'pending').length;
      companyStatus = `${onVac} בחופשה, ${onWfh} WFH, ${pending} בקשות ממתינות`;
    } catch (e) {}

    return `אתה MOTI — עוזר חכם של מערכת Dazura לניהול חופשות, חברה: "${companyName}".
ענה תמיד בעברית, קצר וממוקד. **Bold** להדגשות. אל תמציא נתונים.

👤 ${currentUser.fullName} | ${roleLabel} | ${userDept} | ${balanceInfo}
🏢 מחלקות: ${depts}
📅 היום: ${today} | ${companyStatus}
🔒 הרשאות: ${currentUser.role === 'admin' ? 'מלאות' : currentUser.role === 'manager' ? 'מחלקה בלבד' : 'אישי בלבד'}`;
  }

  async function callClaudeAPI(userMessage, history, currentUser, db) {
    try {
      const messages = history.slice(-8).map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text
      }));
      messages.push({ role: 'user', content: userMessage });

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1000,
          system: buildSystemPrompt(currentUser, db),
          messages,
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.content?.map(c => c.text || '').join('') || null;
    } catch (err) {
      return null;
    }
  }

  // ──────────────────────────────────────────
  // 4. UNKNOWN DETECTION
  // ──────────────────────────────────────────

  const UNKNOWN_SIGNALS = [
    'לא הצלחתי להבין', 'לא בטוח מה', 'נסח מחדש',
    'שאלה מחוץ לתחום', '❓', 'לא הבנתי את', 'אנסה שוב',
  ];

  function isUnknown(text) {
    return !text || UNKNOWN_SIGNALS.some(s => text.includes(s));
  }

  // ──────────────────────────────────────────
  // 5. HISTORY + MAIN RESPOND
  // ──────────────────────────────────────────

  let _history = [];

  async function respondAsync(msg, currentUser, db) {
    _history.push({ role: 'user', text: msg });

    // קודם AI מקומי
    let local = null;
    try {
      if (typeof DazuraAI !== 'undefined') local = DazuraAI.respond(msg, currentUser, db);
    } catch (e) {}

    if (!isUnknown(local)) {
      _history.push({ role: 'ai', text: local });
      return local;
    }

    // Claude
    const claude = await callClaudeAPI(msg, _history, currentUser, db);
    if (claude) { _history.push({ role: 'ai', text: claude }); return claude; }

    // Fallback
    const fb = fallback(msg, currentUser, db);
    _history.push({ role: 'ai', text: fb });
    return fb;
  }

  function fallback(text, currentUser, db) {
    if (window.Fuse) {
      const emp = smartExtractEmployee(text, db);
      if (emp && db?.users?.[emp]) {
        const u = db.users[emp];
        const today = new Date().toISOString().split('T')[0];
        const type = db?.vacations?.[emp]?.[today];
        const s = { full: 'בחופשה', half: 'בחצי יום', wfh: 'עובד/ת מהבית', sick: 'ביום מחלה' }[type] || 'במשרד';
        return `**${u.fullName}** — היום: ${s} 📋`;
      }
    }
    return `שאל אותי: "מי בחופשה היום?" או "מה היתרה שלי?" 💡`;
  }

  function clearHistory() { _history = []; }

  async function searchEmployee(q, db) { await loadFuse(); return fuzzyFindEmployee(q, db); }
  async function searchDept(q, db) { await loadFuse(); return fuzzyFindDept(q, db); }

  async function analyzeTeam(prompt, user, db) {
    if (user.role !== 'admin' && user.role !== 'manager') return 'זמין למנהלים בלבד.';
    const year = new Date().getFullYear();
    const summary = Object.values(db.users || {}).filter(u => u.status === 'active' && u.role === 'employee').slice(0, 25)
      .map(u => {
        const vacs = db.vacations?.[u.username] || {};
        let used = 0;
        Object.entries(vacs).forEach(([dt, t]) => { if (dt.startsWith(String(year))) used += t === 'full' ? 1 : t === 'half' ? 0.5 : 0; });
        return `${u.fullName}: ${used}/${u.quotas?.[year]?.annual || 0}`;
      }).join('\n');
    return await callClaudeAPI(prompt + '\n\nנתונים:\n' + summary, [], user, db) || 'לא ניתן לנתח כרגע.';
  }

  // טען Fuse.js ברקע — רק אחרי שה-splash נעלם
  setTimeout(() => loadFuse(), 3000);

  return { respondAsync, searchEmployee, searchDept, analyzeTeam, clearHistory };

})();

// ================================================================
// PATCH — sendAIMessage
// ================================================================
// עוטף את sendAIMessage הקיים כדי לתמוך ב-Claude async.
// ה-splash לא מושפע בכלל כי הpatch קורה רק אחרי window.load.
// ================================================================

window.addEventListener('load', function patchAI() {
  function tryPatch() {
    if (typeof sendAIMessage !== 'function') {
      setTimeout(tryPatch, 300);
      return;
    }

    window.sendAIMessage = function(msg) {
      if (!msg?.trim()) return;

      const messagesEl = document.getElementById('aiMessages');
      if (messagesEl) messagesEl.innerHTML = '';
      if (typeof appendAIMessage === 'function') appendAIMessage(msg, 'user');
      if (typeof showAITyping === 'function') showAITyping();

      // נסה DazuraAI סינכרוני תחילה
      let localResp = null;
      try {
        const db = typeof getDB === 'function' ? getDB() : {};
        const user = (db?.users && currentUser) ? (db.users[currentUser.username] || currentUser) : currentUser;
        const r = typeof DazuraAI !== 'undefined' ? DazuraAI.respond(msg, user, db) : null;
        const BAD = ['לא הצלחתי להבין','לא בטוח מה','נסח מחדש','שאלה מחוץ','❓','לא הבנתי את','אנסה שוב'];
        if (r && !BAD.some(s => r.includes(s))) localResp = r;
      } catch (e) {}

      const delay = 350 + Math.random() * 300;

      if (localResp) {
        // תשובה מקומית — מהיר
        setTimeout(() => {
          if (typeof hideAITyping === 'function') hideAITyping();
          if (typeof appendAIMessage === 'function') appendAIMessage(localResp, 'ai');
          if (typeof scrollAIToBottom === 'function') scrollAIToBottom();
        }, delay);
      } else {
        // Claude async
        setTimeout(async () => {
          try {
            const db = typeof getDB === 'function' ? getDB() : {};
            const user = (db?.users && currentUser) ? (db.users[currentUser.username] || currentUser) : currentUser;
            const resp = await DazuraFuse.respondAsync(msg, user, db);
            if (typeof hideAITyping === 'function') hideAITyping();
            if (typeof appendAIMessage === 'function') appendAIMessage(resp, 'ai');
            if (typeof scrollAIToBottom === 'function') scrollAIToBottom();
          } catch (e) {
            if (typeof hideAITyping === 'function') hideAITyping();
            if (typeof appendAIMessage === 'function') appendAIMessage('מצטער, אירעה שגיאה. נסה שוב.', 'ai');
          }
        }, delay);
      }
    };

    console.log('✅ DazuraFuse v2: sendAIMessage patched');
  }

  tryPatch();
});

// ================================================================
// GLOBAL HELPERS
// ================================================================
async function fuzzySearchEmployee(query) {
  const db = typeof getDB === 'function' ? getDB() : null;
  return db ? DazuraFuse.searchEmployee(query, db) : null;
}
async function aiAnalyzeTeam(prompt) {
  const db = typeof getDB === 'function' ? getDB() : null;
  const user = typeof currentUser !== 'undefined' ? currentUser : null;
  return (db && user) ? DazuraFuse.analyzeTeam(prompt, user, db) : 'שגיאה.';
}
