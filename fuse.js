// ============================================================
// DAZURA AI FUSE ENGINE v2.1 — OFFLINE ONLY (סגור בכספת)
// ============================================================

const DazuraFuse = (() => {

  let _fuseLoaded = false;

  function loadFuse() {
    if (_fuseLoaded && window.Fuse) return Promise.resolve(true);
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.0.0/fuse.min.js'; // אפשר להוריד ולהעלות לשרת שלכם
      script.onload = () => { _fuseLoaded = true; resolve(true); };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  // ... (כל פונקציות fuzzyFindEmployee, fuzzyFindDept, smartExtractEmployee נשארות אותו דבר)

  // ──────────────────────────────────────────
  // 3. RESPOND ASYNC — רק מקומי + שיפור fallback
  // ──────────────────────────────────────────

  let _history = [];

  async function respondAsync(msg, currentUser, db) {
    _history.push({ role: 'user', text: msg });

    // קודם AI מקומי (הישן שלך)
    let local = null;
    try {
      if (typeof DazuraAI !== 'undefined') local = DazuraAI.respond(msg, currentUser, db);
    } catch (e) {}

    if (local && !isUnknown(local)) {
      _history.push({ role: 'ai', text: local });
      return addPersonality(local, currentUser); // ← חדש! הופך יבש → חי
    }

    // Fallback משופר (ללא Claude)
    const fb = enhancedFallback(msg, currentUser, db);
    _history.push({ role: 'ai', text: fb });
    return addPersonality(fb, currentUser);
  }

  function isUnknown(text) {
    const signals = ['לא הצלחתי להבין', 'לא בטוח מה', 'נסח מחדש', '❓', 'לא הבנתי'];
    return !text || signals.some(s => text.includes(s));
  }

  // Fallback חכם יותר
  function enhancedFallback(text, currentUser, db) {
    const emp = smartExtractEmployee(text, db);
    if (emp && db?.users?.[emp]) {
      const u = db.users[emp];
      const today = new Date().toISOString().split('T')[0];
      const type = db?.vacations?.[emp]?.[today];
      const s = { full: 'בחופשה', half: 'בחצי יום', wfh: 'מהבית', sick: 'ביום מחלה' }[type] || 'במשרד';
      return `**${u.fullName}** — היום: ${s} 📋`;
    }

    // הצעות חכמות לפי תפקיד
    const roleExamples = currentUser.role === 'admin' 
      ? `• "מי בחופשה מחר?"\n• "יתרה של דנה כהן"\n• "תחזה עומס לשבוע הבא"`
      : currentUser.role === 'manager'
      ? `• "מי מהצוות שלי בחופשה היום?"\n• "בקשות ממתינות"`
      : `• "מה היתרה שלי?"\n• "מי מהצוות מחר?"`;

    return `לא הבנתי בדיוק, **${currentUser.fullName.split(' ')[0]}** 😊\n\nנסה ככה:\n${roleExamples}\n\nאני כאן לכל שאלה על חופשות ונוכחות!`;
  }

  // ← חדש: שכבת אישיות שמוסיפה חיים לכל תשובה
  function addPersonality(text, user) {
    const first = user.fullName.split(' ')[0];
    const prefixes = [
      `בשמחה, **${first}**! `,
      `הנה מה שמצאתי בשבילך, **${first}** 😊 `,
      `רק רגע... ✅ `,
      `תמיד כאן בשבילך, **${first}** 🤍 `
    ];
    const suffixes = [
      `\n\nיש עוד משהו?`,
      `\n\nמה דעתך?`,
      `\n\nאם צריך להעמיק — תגיד/י!`
    ];
    return prefixes[Math.floor(Math.random()*prefixes.length)] + text + suffixes[Math.floor(Math.random()*suffixes.length)];
  }

  // ... (שאר הפונקציות searchEmployee, searchDept, analyzeTeam נשארות)

  setTimeout(() => loadFuse(), 2000);
  return { respondAsync, searchEmployee, searchDept, analyzeTeam, clearHistory };

})();