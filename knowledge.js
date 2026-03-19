// ============================================================
// DAZURA KNOWLEDGE BASE — קובץ ראשי (מאגד)
// knowledge.js v4.0
// Built by מוטי קריחלי 🏆
//
// ארכיטקטורת קבצים:
// ─────────────────────────────────────────────
//  kb_holidays.js      — חגים ולוח שנה        (21 ערכים)
//  kb_vacation.js      — חופשה: הגשה וניהול   (32 ערכים)
//  kb_balance.js       — יתרות, צבירה, מכסות  (24 ערכים)
//  kb_attendance.js    — מחלה, נוכחות, שעות   (29 ערכים)
//  kb_admin.js         — ניהול, אדמין, ייצוא  (48 ערכים)
//  kb_manager.js       — ממשק מנהל מחלקה      (16 ערכים)
//  kb_system.js        — מערכת, AI, PWA, אבטחה(41 ערכים)
//  kb_conversation.js  — שיחה, הומור, ברכות   (57 ערכים)
// ─────────────────────────────────────────────
//  סה"כ: 268+ ערכי Q&A
// ─────────────────────────────────────────────
//
// הוראות:
//  q       — השאלה הראשית
//  aliases — ניסוחים נוספים
//  a       — התשובה (מחרוזת או מערך לרנדום)
//  tags    — תגיות לחיפוש
//  i       — DB directive: BALANCE / FORECAST / USED / QUOTA /
//            DEPARTMENTS / NEXT_HOLIDAY / VACATIONS / EMPLOYEES
//  random  — true = בחר תשובה אקראית מהמערך
//
// עריכה:
//  • לשינוי תשובה — פתח את הקובץ הרלוונטי (kb_*.js)
//  • להוספת ערך — הוסף לקובץ הרלוונטי בתור שורה חדשה
//  • לא לגעת בקובץ זה (knowledge.js) — הוא רק מאגד
// ============================================================

// ── בדיקת תלויות ──────────────────────────────────────────
(function checkDependencies() {
  const required = [
    ['KB_HOLIDAYS',     'kb_holidays.js'],
    ['KB_VACATION',     'kb_vacation.js'],
    ['KB_BALANCE',      'kb_balance.js'],
    ['KB_ATTENDANCE',   'kb_attendance.js'],
    ['KB_ADMIN',        'kb_admin.js'],
    ['KB_MANAGER',      'kb_manager.js'],
    ['KB_SYSTEM',       'kb_system.js'],
    ['KB_CONVERSATION', 'kb_conversation.js'],
  ];
  const missing = required.filter(([v]) => typeof window !== 'undefined' && typeof window[v] === 'undefined');
  if (missing.length > 0) {
    console.warn('[Dazura KB] ⚠️ קבצי ידע חסרים:', missing.map(([,f]) => f).join(', '));
  }
})();

// ── סנכרון: מאחד את כל מאגרי הידע ──────────────────────
const AI_KNOWLEDGE = (function buildKnowledge() {
  const sources = [
    typeof KB_HOLIDAYS     !== 'undefined' ? KB_HOLIDAYS     : [],
    typeof KB_VACATION     !== 'undefined' ? KB_VACATION     : [],
    typeof KB_BALANCE      !== 'undefined' ? KB_BALANCE      : [],
    typeof KB_ATTENDANCE   !== 'undefined' ? KB_ATTENDANCE   : [],
    typeof KB_ADMIN        !== 'undefined' ? KB_ADMIN        : [],
    typeof KB_MANAGER      !== 'undefined' ? KB_MANAGER      : [],
    typeof KB_SYSTEM       !== 'undefined' ? KB_SYSTEM       : [],
    typeof KB_CONVERSATION !== 'undefined' ? KB_CONVERSATION : [],
  ];

  const merged = [].concat(...sources);

  // ── כפילויות: מסנן לפי q ──
  const seen = new Set();
  const unique = merged.filter(entry => {
    const key = (entry.q || '').trim().toLowerCase();
    if (seen.has(key)) { return false; }
    seen.add(key);
    return true;
  });

  console.log(`[Dazura KB] ✅ נטענו ${unique.length} ערכי ידע מ-${sources.filter(s=>s.length).length} קבצים`);
  return unique;
})();
