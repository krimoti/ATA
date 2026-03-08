// ============================================================
// DAZURA AI ENGINE — ai.js
// כל לוגיקת ה-AI של המערכת
// ============================================================

// ── SPLASH KILLER ───────────────────────────────────────────
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

// ── SAFE CALL GUARD ─────────────────────────────────────────
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
    if (st) { st.classList.remove('dz-clr-ok','dz-clr-muted'); st.classList.add('dz-clr-danger'); st.textContent = '⚠️ מפתח לא תקין'; }
    return;
  }
  localStorage.setItem('dazura_gemini_key', val);
  if (document.getElementById('geminiApiKeyInput')) document.getElementById('geminiApiKeyInput').value = '';
  const st = document.getElementById('geminiKeyStatus');
  if (st) { st.classList.remove('dz-clr-danger','dz-clr-muted'); st.classList.add('dz-clr-ok'); st.textContent = '✅ מפתח נשמר — AI ישתמש ב-Gemini'; }
}
function clearGeminiKey() {
  localStorage.removeItem('dazura_gemini_key');
  if (document.getElementById('geminiApiKeyInput')) document.getElementById('geminiApiKeyInput').value = '';
  const st = document.getElementById('geminiKeyStatus');
  if (st) { st.classList.remove('dz-clr-danger','dz-clr-ok'); st.classList.add('dz-clr-muted'); st.textContent = 'מפתח הוסר — AI עובד מקומית'; }
}
function initGeminiKeyStatus() {
  const has = !!localStorage.getItem('dazura_gemini_key');
  const st  = document.getElementById('geminiKeyStatus');
  if (st) {
    st.classList.toggle('dz-clr-ok', has);
    st.classList.toggle('dz-clr-muted', !has);
    st.textContent = has ? '🟢 מפתח Gemini פעיל' : '⚪ ללא מפתח — AI מקומי בלבד';
  }
  if (document.getElementById('geminiApiKeyInput')) document.getElementById('geminiApiKeyInput').value = '';
}

// ============================================================
// LAYER 1: SYNONYM EXPANSION
// מילון נרחב של וריאציות עבריות
// ============================================================
const AI_SYNONYMS = {
  // נוכחות / חופשה / מחלה / עבודה מהבית
  'חופשה': [
    'חופש','חג','פנוי','יצא','לא פה','נעדר','חסר','חופשה מלאה','חצי יום',
    'VACATION','vacation','day off','time off','holiday','holiday break','חופשת מחלה','חופשה שנתית',
    'חופשה מרוכזת','חופשה אישית','חופשת לידה','חופשה משפחתית','חופשה מיוחדת','חופש פתוח','חופשה מתוזמנת'
  ],
  'מחלה': [
    'חולה','לא מרגיש','לא מרגישה','מחלה','sick','ill','לא בסדר','ביתי','sick day','חופשת מחלה',
    'חולה בבית','חולה חזק','חסרה עקב מחלה','חולה חולים','חוסר בריאות','חולשה','אי יכולת עבודה',
    'חולי','illness','sick leave','sick today','חולה היום','חוסר נוכחות עקב מחלה','חולה חזרה הביתה'
  ],
  'wfh': [
    'מהבית','בבית','ביתי','remote','מרחוק','עובד מהבית','עובדת מהבית','working from home','WFH','home office',
    'עבודה מרחוק','עבודה מהבית זמנית','בידוד ביתי','remote work','telework','עובד טלפונית','עבודה מרחוק חלקית',
    'עבודה מרחוק מלאה','עבודה חצי מרחוק','בבית בלבד','שולחן ביתי','טלה-וורק','עבודה מהבית היום'
  ],
  'נוכחות': [
    'במשרד','פה','בעבודה','הגיע','הגיעה','נמצא','נמצאת','כאן','present','on site','here today','attending',
    'נוכח','נוכחת','נכח במשרד','נוכחת במשרד','מתייצב לעבודה','נכח היום','נוכחות מלאה','נוכח חלקית','נוכחות חלקית',
    'נכנס','נכנסה','מגיע למשרד','מגיעה למשרד','בא למשרד','באה למשרד','משרדית','at work'
  ],

  // יתרה / חישוב חופשה / שעות
  'יתרה': [
    'כמה ימים','כמה נשאר','כמה חופש','מכסה','צבירה','ניצלתי','נותר','נשאר','remaining','quota','balance','left days',
    'available days','unused vacation','vacation balance','ימי חופש','חופשה שנותרה','ימי מחלה','שעות עודפות',
    'יתר חופשה','יתרה חודשית','צבירה שנתית','כמות חופשה','צבירת חופשה','חופשה פנויה','ימים פנויים','חופשה זמינה',
    'זכאות','vacation eligibility','days left','חופשה זמינה לניצול','יתרה עכשווית','חופשה נצברת'
  ],

  // אישורים ובקשות
  'אישור': [
    'ממתין','פתוח','טרם אושר','לאשר','בקשה פתוחה','תלוי','pending','approval','waiting','approval request','open request',
    'אישור מנהל','אישור HR','אישור מיידי','אישור סופי','אישור חלקי','אישור חופשה','אישור מחלה','manager approval',
    'HR approval','approved','not approved','אישור רשמי','אישור בפועל','אישור זמני','אישור דחוף','אישור סופי'
  ],

  // שחיקה ועייפות
  'שחיקה': [
    'עייפות','עייף','עייפה','סיכון','לא לקח חופש','לא לקחה חופש','90 יום','זמן רב','burnout','overworked','fatigue',
    'חוסר מנוחה','מחסור בחופש','לא נרגע','stress','stressed','חוסר שינה','עומס עבודה','עבודה יתר','תשישות',
    'הרגשה כבדה','מועקה','עייפות מצטברת','עייפות רבה','פגיעה בבריאות','תחושת עייפות','mental fatigue','physical fatigue'
  ],

  // עלויות וכספים
  'עלויות': [
    'כסף','תקציב','עלות','חיסכון','הוצאות','שכר','cost','budget','expense','saving','financial','funds',
    'חסכון כספי','עלות חודשית','budgeting','הוצאות אישיות','חסכון בחברה','עלות פר יום','עלות פר שעה',
    'ניצול תקציב','חיסכון בזמן','חסכון במשאבים','מחיר','תשלום','חשבונית','עלות כוללת','cost estimation','financial planning'
  ],

  // תאריכים
  'היום': [
    'עכשיו','כרגע','הבוקר','הצהריים','ברגע זה','today','this morning','this afternoon','right now','at the moment',
    'כאן ועכשיו','היום כולו','יום זה','היום הנוכחי','current day','present day','היום בפועל','היום ממשי'
  ],
  'מחר': [
    'מחרתיים','יום שישי','יום ראשון','מחר בבוקר','tomorrow','next day','מחר בלילה','morning tomorrow',
    'מחרת היום','היום הבא','יום הבא','מחר כולו','following day','next calendar day','מחר בפועל','מחר ממשי'
  ],
  'שבוע הבא': [
    'שבוע הקרוב','next week','בשבוע הבא','הקרוב','שבוע הבא כולו','שבוע העבודה הבא','שבוע הבא במשרד',
    'שבוע הבא בפועל','השבוע הבא','next calendar week','שבוע הבא ממשי'
  ],

  // מנהל / צוות
  'מנהל': [
    'מנהלת','ראש צוות','team lead','מנה','supervisor','manager','head','department head','team manager','מנהל פרויקט',
    'מנהלת פרויקט','מנהלת מחלקה','מנהיג צוות','מפקח','מפקחת','head of team','מנהל ישיר','supervising manager'
  ],
  'עובד': [
    'עובדת','איש','אשה','חבר','חברת','אדם','אנשים','employee','staff','person','colleague','worker','team member','user',
    'חבר צוות','חברת צוות','עובד זמני','עובדת זמנית','חבר קבוע','עובד קבוע','עובד חדש','עובדת חדשה','personnel','team staff'
  ],

  // פעולות כלליות
  'בדיקה': [
    'בדוק','בדיקה','verify','check','review','test','testing','confirm','validate','inspect','בדוק מצב','בחן','בחינה','אימות',
    'בדיקת סטטוס','בדיקת נוכחות','בדיקת חופשה','test case','test scenario','אימות נתונים','בדיקה מלאה','בדיקה חלקית'
  ],
  'סטטוס': [
    'status','מצב','מצב נוכחות','מצב חופשה','סטטוס נוכחי','current status','today status','עדכון','תיעוד','הערכת מצב','ניטור',
    'סטטוס עדכני','סטטוס מלא','סטטוס חלקי','current situation','activity status','state','state update'
  ],
  'חיזוי': [
    'forecast','predict','צפי','חיזוי עומס','תכנון','prediction','projection','expected','חיזוי נוכחות','חיזוי משאבים','צפי עבודה',
    'חיזוי עתידי','חיזוי נוכחות עתידית','חיזוי ימי חופשה','forecasting','expected status','expected workload','projected presence'
  ],

  // מילות חיפוש כלליות
  'מי': [
    'who','מי נמצא','מי בחופשה','מי חולה','מי עובד מהבית','מי מהצוות','who is','who has','who is present','מי מגיע','מי לא הגיע',
    'מי לא נמצא','מי נעדר','מי נוכח','who reports','who is absent','מי מנהל','who manages'
  ],
  'כמה': [
    'how many','כמה אנשים','כמה ימים','כמה שעות','what is the count','ספירה','count','total','כמה עובדים','כמה נוכחים',
    'כמה חופשה','כמה מחלה','כמה עובדים בחופשה','how much','סך הכל','מספר כולל','total count','count of employees'
  ],

  // ביטויים נוספים
  'יומן': [
    'log','audit','שינוי','מי שינה','history','record','רשומות','activity','מעקב','תיעוד','לוג נוכחות','מעקב שעות','יומן פעילות',
    'activity log','tracking','recording','system log','audit trail','log file','logbook','follow-up','action log'
  ],
  'יום הולדת': [
    'birthday','חוגג','חגיגה','celebration','יום הולדת','birthday today','celebrate','יום חג','חוגגת','מאורע',
    'birthday event','birthday celebration','happy birthday','יום הולדת שמח','birthday party','birth anniversary'
  ],
  'פגישה': [
    'meeting','פגישת צוות','one on one','עדכון','שיחה','call','video call','zoom','Teams','פגישה עסקית','פגישה אישית',
    'meeting schedule','scheduled meeting','team meeting','business meeting','personal meeting','פגישת עדכון','conference','online meeting'
  ],
  'משימה': [
    'task','job','assignment','משימה','מטלה','למשלוח','משימות פתוחות','משימות סגורות','to do','action','פעולה',
    'משימה דחופה','משימה רגילה','task list','work item','pending task','open task','completed task','action item'
  ],
  'דוח': [
    'report','דו"ח','summary','סיכום','סטטיסטיקה','נתונים','analytics','דוחות חודשיים','דוחות שבועיים','דוחות יומיים',
    'reporting','data report','statistical report','financial report','weekly report','monthly report','daily report','summary report'
  ]
};
function expandSynonyms(q) {
  let expanded = q;
  for (const [canonical, synonyms] of Object.entries(AI_SYNONYMS)) {
    for (const syn of synonyms) {
      if (expanded.includes(syn) && !expanded.includes(canonical)) {
        expanded = expanded + ' ' + canonical;
        break;
      }
    }
  }
  return expanded;
}

// ============================================================
// LAYER 2: INTENT SCORING (במקום match/no-match)
// ============================================================
const AI_INTENTS = [
  {
    name: 'todayStatus',
    keywords: ['מי','סטטוס','נוכחות','נמצא','במשרד','היום','כרגע','עכשיו','פה','בעבודה'],
    patterns: [/מי (במשרד|נמצא|בעבודה|היום|כרגע|עכשיו|פה)/i, /סטטוס (היום|עכשיו|כרגע)/i],
    weight: 1.0
  },
  {
    name: 'whoOnVacation',
    keywords: ['מי','חופשה','חופש','נעדר','לא פה','חסר'],
    patterns: [/מי (בחופש|בחופשה|לא פה|חסר|נעדר)/i, /רשימת חופשות/i],
    weight: 1.0
  },
  {
    name: 'whoSick',
    keywords: ['מי','חולה','מחלה','לא מרגיש'],
    patterns: [/מי (חולה|במחלה|לא מרגיש)/i],
    weight: 1.0
  },
  {
    name: 'whoWFH',
    keywords: ['מי','מהבית','wfh','ביתי','remote'],
    patterns: [/מי (עובד מהבית|WFH|מהבית)/i],
    weight: 1.0
  },
  {
    name: 'vacationBalance',
    keywords: ['יתרה','מכסה','כמה ימים','נותר','נשאר','ניצלתי','צברתי','חופש שלי'],
    patterns: [/כמה (ימי )?חופש/i, /יתרת? חופשה/i, /מה (היתרה|המכסה)/i],
    weight: 1.0
  },
  {
    name: 'pendingApprovals',
    keywords: ['ממתין','אישור','בקשות','פתוח','לאשר','approval'],
    patterns: [/בקשות? (ממתינות?|פתוחות?|לאישור)/i, /אישורים ממתינים/i],
    weight: 1.0
  },
  {
    name: 'burnoutRisk',
    keywords: ['שחיקה','סיכון','עייף','90 יום','זמן רב','לא לקח'],
    patterns: [/מי (בסיכון|שחוק|עייף)/i, /סיכון שחיקה/i, /90 יום/i],
    weight: 1.0
  },
  {
    name: 'departmentStatus',
    keywords: ['מחלקה','צוות','סטטוס מחלקה','כיסוי','עומס'],
    patterns: [/סטטוס מחלקת?/i, /כיסוי (במחלקה|בצוות)/i],
    weight: 1.0
  },
  {
    name: 'futurePrediction',
    keywords: ['חיזוי','מחר','שבוע הבא','צפי','עומס','תכנון'],
    patterns: [/חיזוי (עומס|חופשות)/i, /מה צפוי/i, /מחר.*עומס/i],
    weight: 1.0
  },
  {
    name: 'costEstimate',
    keywords: ['עלות','תקציב','חיסכון','כסף','הוצאות'],
    patterns: [/עלות (חופשות|מחלות)/i, /חיסכון WFH/i],
    weight: 1.0
  },
  {
    name: 'auditLog',
    keywords: ['יומן','ביקורת','שינוי','מי שינה','היסטוריה','log'],
    patterns: [/יומן ביקורת/i, /מי שינה/i],
    weight: 1.0
  },
  {
    name: 'myStatus',
    keywords: ['שלי','אני','הסטטוס שלי','מה יש לי','הבקשות שלי'],
    patterns: [/(הסטטוס|היתרה|הבקשות) שלי/i, /^מה (יש לי|הסטטוס)/i],
    weight: 1.0
  },
  {
    name: 'birthdayCheck',
    keywords: ['יום הולדת','חוגג','חגיגה','birthday'],
    patterns: [/יום הולדת/i],
    weight: 1.0
  },
];

function scoreIntents(q) {
  const ql = q.toLowerCase();
  const scores = [];

  for (const intent of AI_INTENTS) {
    let score = 0;

    // Pattern match = high score
    for (const pattern of intent.patterns) {
      if (pattern.test(ql)) { score += 3; break; }
    }

    // Keyword match = partial score
    for (const kw of intent.keywords) {
      if (ql.includes(kw)) score += 1;
    }

    if (score > 0) scores.push({ name: intent.name, score: score * intent.weight });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores;
}

// ============================================================
// LAYER 3: CONTEXT MEMORY
// ============================================================
const AIContext = {
  lastUser:   null,
  lastDept:   null,
  lastDate:   null,
  lastIntent: null,
  lastQ:      null,

  update(name, dept, date, intent, q) {
    if (name)   this.lastUser   = name;
    if (dept)   this.lastDept   = dept;
    if (date)   this.lastDate   = date;
    if (intent) this.lastIntent = intent;
    if (q)      this.lastQ      = q;
  },

  resolve(name, dept, date) {
    return {
      name:   name   || this.lastUser,
      dept:   dept   || this.lastDept,
      date:   date   || this.lastDate,
    };
  }
};

// ============================================================
// AI ENGINE — מנוע מקומי
// ============================================================
const AIEngine = {
  getStoredData() {
    try { return JSON.parse(localStorage.getItem('vacSystem_v3')) || {}; }
    catch(e) { return {}; }
  },

  ask(question, cu) {
    const db  = this.getStoredData();
    const raw = (question||'').trim();
    if (!raw) return 'שאל אותי משהו 😊';
    if (!cu) return 'לא מחובר למערכת.';

    // Layer 1: expand synonyms
    const q   = expandSynonyms(raw).toLowerCase();
    const ql  = q;

    const isAdmin = cu.username === 'gmaneg' || cu.role === 'admin';
    const isMgr   = isAdmin || cu.role === 'manager';
    const isAcct  = cu.role === 'accountant';
    const userDept = Array.isArray(cu.dept) ? cu.dept[0] : (cu.dept||'');

    // Extract entities
    const name = this.extractName(ql, db);
    const dept = this.extractDept(ql, db);
    const date = this.extractDate(ql);

    // Update context (Layer 3)
    AIContext.update(name, dept, date, null, raw);
    const ctx = AIContext.resolve(name, dept, date);

    // Permission check: employee asking about others
    if (!isMgr && !isAcct && ctx.name && ctx.name.toLowerCase() !== (cu.fullName||'').toLowerCase()) {
      if (ql.includes('יתרה') || ql.includes('מכסה') || ql.includes('כמה ימים')) {
        return '🔒 אינך מורשה לצפות ביתרות של עובדים אחרים.';
      }
    }

    // Manager dept restriction
    if (cu.role === 'manager' && !isAdmin && ctx.dept && ctx.dept !== userDept) {
      return '🔒 אין לי הרשאה להציג מידע מחוץ למחלקת ' + userDept + '.';
    }

    // External question block
    if (/מזג אוויר|ויקיפדיה|python|javascript|html|css|קוד|recipe|מתכון|ספורט|כדורגל/i.test(ql)) {
      return '⛔ אני עונה רק על שאלות הקשורות למערכת Dazura.';
    }

    // Layer 2: score intents and pick winner
    const scores = scoreIntents(ql);
    const topIntent = scores[0]?.name;

    // Update context with winning intent
    AIContext.lastIntent = topIntent;

    // Handle follow-up questions (Layer 3 context)
    // "ומחר?" / "ואתמול?" / "ומה עם X?" 
    const isFollowUp = raw.length < 15 || raw.startsWith('ו') || raw.startsWith('מה ל') || raw.startsWith('ואם');
    const effectiveIntent = (isFollowUp && !topIntent && AIContext.lastIntent) ? AIContext.lastIntent : topIntent;

    // ── DISPATCH ─────────────────────────────────────────────
    switch(effectiveIntent) {
      case 'todayStatus':
        return this.getTodayStatus(db, cu, isMgr, userDept, ctx.date);
      case 'whoOnVacation':
        return this.getWhoOnType(db, 'vacation', cu, isMgr, userDept, ctx.date);
      case 'whoSick':
        return this.getWhoOnType(db, 'sick', cu, isMgr, userDept, ctx.date);
      case 'whoWFH':
        return this.getWhoOnType(db, 'wfh', cu, isMgr, userDept, ctx.date);
      case 'vacationBalance':
        return this.getVacationBalance(db, ctx.name || cu.fullName, cu, isMgr, isAcct);
      case 'pendingApprovals':
        if (!isMgr) return '🔒 הצגת בקשות ממתינות מיועדת למנהלים בלבד.';
        return this.getPendingApprovals(db, cu, isAdmin, userDept);
      case 'burnoutRisk':
        if (!isMgr) return '🔒 ניתוח שחיקה מיועד למנהלים בלבד.';
        return this.assessBurnoutRisk(db, ctx.name, isAdmin ? null : userDept);
      case 'departmentStatus':
        return this.getDeptStatus(db, ctx.dept || userDept, ctx.date || this.getTodayKey());
      case 'futurePrediction':
        if (!isMgr) return '🔒 חיזוי עומס מיועד למנהלים בלבד.';
        return this.predictFutureLoad(db, ctx.date || this.getTomorrowKey());
      case 'costEstimate':
        if (!isMgr && !isAcct) return '🔒 נתוני עלויות מיועדים למנהלים וחשבות בלבד.';
        return this.estimateCosts(db);
      case 'auditLog':
        if (!isAdmin) return '🔒 יומן ביקורת מיועד לאדמינים בלבד.';
        return this.getAuditLog(db);
      case 'myStatus':
        return this.getMyStatus(db, cu);
      case 'birthdayCheck':
        return this.checkBirthdays(db, ctx.date || this.getTodayKey());
      default:
        // No clear intent — check if it's a personal question
        if (!isMgr && !isAcct) return this.getMyStatus(db, cu);
        return this.getHelpfulFallback(cu.role);
    }
  },

  // ── UTILITIES ───────────────────────────────────────────────
  getTodayKey() {
    const d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  },
  getTomorrowKey() {
    const d=new Date(); d.setDate(d.getDate()+1);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  },

  extractName(q, db) {
    const words = q.split(/\s+/);
    const users = Object.values(db.users||{});
    for (const word of words) {
      const clean = word.replace(/[.,!?']/g,'');
      if (clean.length < 2) continue;
      for (const u of users) {
        const full  = (u.fullName||'').toLowerCase();
        const first = full.split(' ')[0];
        if (first === clean || full === clean) return u.fullName;
        // partial first name (min 3 chars)
        if (clean.length >= 3 && first.startsWith(clean)) return u.fullName;
      }
    }
    return null;
  },

  extractDept(q, db) {
    const depts = [...new Set(Object.values(db.users||{}).map(u => Array.isArray(u.dept)?u.dept[0]:u.dept).filter(Boolean))];
    for (const d of depts) {
      if (q.includes(d.toLowerCase())) return d;
    }
    return null;
  },

  extractDate(q) {
    if (/מחר/i.test(q)) return this.getTomorrowKey();
    if (/אתמול/i.test(q)) { const d=new Date(); d.setDate(d.getDate()-1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
    if (/השבוע/i.test(q)) return { type:'week' };
    if (/החודש/i.test(q)) return { type:'month' };
    if (/היום|עכשיו|כרגע/i.test(q)) return this.getTodayKey();
    const m = q.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2})/);
    if (m) {
      if (m[1]) return m[1];
      if (m[2]) { const [d,mo]=m[2].split('/').map(Number); const y=new Date().getFullYear(); return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'); }
    }
    return null;
  },

  getUsersForRole(db, cu, isMgr, userDept) {
    const all = Object.values(db.users||{}).filter(u=>u.role!=='admin'&&(!u.status||u.status==='active'));
    const isAdmin = cu.username==='gmaneg'||cu.role==='admin';
    if (!isMgr) return all.filter(u=>u.username===cu.username);
    if (isAdmin) return all;
    return all.filter(u=>{const d=Array.isArray(u.dept)?u.dept[0]:u.dept; return d===userDept;});
  },

  getTodayStatus(db, cu, isMgr, userDept, dateKey) {
    const today = (typeof dateKey === 'string') ? dateKey : this.getTodayKey();
    const users = this.getUsersForRole(db, cu, isMgr, userDept);
    const vacs  = db.vacations||{};
    const inOffice=[], vacation=[], wfh=[], sick=[];
    users.forEach(u => {
      const t=(vacs[u.username]||{})[today];
      const n=u.fullName||u.username;
      if (t==='full'||t==='half') vacation.push(n);
      else if (t==='wfh') wfh.push(n);
      else if (t==='sick') sick.push(n);
      else inOffice.push(n);
    });
    const label = today === this.getTodayKey() ? 'היום' : today === this.getTomorrowKey() ? 'מחר' : today;
    return 'סטטוס ' + label + (isMgr ? '' : ' (הצוות שלך)') + ':\n\n' +
      '🏢 במשרד: ' + inOffice.length + (inOffice.length ? ' — ' + inOffice.join(', ') : '') + '\n' +
      '🌴 בחופשה: ' + vacation.length + (vacation.length ? ' — ' + vacation.join(', ') : '') + '\n' +
      '🏠 WFH: '    + wfh.length     + (wfh.length     ? ' — ' + wfh.join(', ')     : '') + '\n' +
      '🤒 מחלה: '   + sick.length    + (sick.length    ? ' — ' + sick.join(', ')    : '');
  },

  getWhoOnType(db, type, cu, isMgr, userDept, dateKey) {
    const today = (typeof dateKey === 'string') ? dateKey : this.getTodayKey();
    const users = this.getUsersForRole(db, cu, isMgr, userDept);
    const vacs  = db.vacations||{};
    const labels = {vacation:'בחופשה', sick:'במחלה', wfh:'עובד מהבית'};
    const result = users.filter(u => {
      const t=(vacs[u.username]||{})[today];
      if (type==='vacation') return t==='full'||t==='half';
      if (type==='sick') return t==='sick';
      if (type==='wfh') return t==='wfh';
      return false;
    }).map(u=>u.fullName||u.username);
    const label = today === this.getTodayKey() ? 'היום' : today === this.getTomorrowKey() ? 'מחר' : today;
    if (!result.length) return 'אף אחד לא ' + (labels[type]||'') + ' ' + label + '.';
    return (labels[type]||'') + ' ' + label + ':\n' + result.map(n=>'• '+n).join('\n');
  },

  getVacationBalance(db, name, cu, isMgr, isAcct) {
    if (!name) return 'ציין בבקשה שם עובד.';
    const user = Object.values(db.users||{}).find(u=>(u.fullName||'').toLowerCase().includes((name||'').toLowerCase())||u.username.toLowerCase()===(name||'').toLowerCase());
    if (!user) return 'לא מצאתי עובד בשם "' + name + '".';
    if (!isMgr && !isAcct && user.username !== cu.username) return '🔒 אינך מורשה לצפות ביתרות של עובדים אחרים.';
    const year  = new Date().getFullYear();
    const quota = ((user.quotas||{})[year]||{}).annual||0;
    const vacs  = db.vacations||{};
    const used  = Object.values(vacs[user.username]||{}).filter(t=>t==='full'||t==='half').length;
    const sick  = Object.values(vacs[user.username]||{}).filter(t=>t==='sick').length;
    const remaining = quota - used;
    const monthsLeft = 12 - new Date().getMonth();
    return (user.fullName||user.username) + ' — יתרת חופשה ' + year + ':\n\n' +
      '📅 מכסה שנתית: ' + quota + ' ימים\n' +
      '✅ נוצל: ' + used + ' ימים\n' +
      '💰 יתרה: ' + remaining + ' ימים\n' +
      '🤒 ימי מחלה: ' + sick + '\n' +
      (remaining > 0 && monthsLeft > 0 ? '📊 קצב מומלץ: ' + (remaining/monthsLeft).toFixed(1) + ' ימים לחודש' : '');
  },

  getDeptStatus(db, dept, dateKey) {
    if (!dept) return 'ציין מחלקה.';
    if (typeof dateKey !== 'string') dateKey = this.getTodayKey();
    const users = Object.values(db.users||{}).filter(u=>{const d=Array.isArray(u.dept)?u.dept[0]:u.dept; return (d||'').toLowerCase()===dept.toLowerCase();});
    if (!users.length) return 'לא מצאתי מחלקה בשם "' + dept + '".';
    const vacs=db.vacations||{};
    let available=0, absent=0, wfh=0;
    users.forEach(u=>{const t=(vacs[u.username]||{})[dateKey]; if(!t) available++; else if(t==='wfh'){available++;wfh++;} else absent++;});
    const pct=Math.round((available/users.length)*100);
    const label = dateKey === this.getTodayKey() ? 'היום' : dateKey === this.getTomorrowKey() ? 'מחר' : dateKey;
    return 'מחלקת ' + dept + ' — ' + label + ':\n\n' +
      '👥 סה"כ: ' + users.length + '\n' +
      '✅ זמינים: ' + available + ' (' + pct + '%)\n' +
      '🏠 WFH: ' + wfh + '\n' +
      '❌ נעדרים: ' + absent + '\n' +
      (pct < 70 ? '⚠️ כיסוי נמוך — שקול גיוס זמני.' : '✔️ כיסוי תקין.');
  },

  assessBurnoutRisk(db, name, deptFilter) {
    const now=new Date();
    const vacs=db.vacations||{};
    let users=Object.values(db.users||{}).filter(u=>u.role!=='admin'&&(!u.status||u.status==='active'));
    if (deptFilter) users=users.filter(u=>(Array.isArray(u.dept)?u.dept[0]:u.dept)===deptFilter);
    if (name) users=users.filter(u=>(u.fullName||'').toLowerCase().includes(name.toLowerCase()));
    const risks=users.filter(u=>{
      const last=Object.keys(vacs[u.username]||{}).filter(d=>(vacs[u.username][d]==='full'||vacs[u.username][d]==='half')).sort().pop();
      if(!last)return true;
      return (now-new Date(last))/86400000>90;
    });
    if (!risks.length) return '✅ אין עובדים בסיכון שחיקה כרגע.';
    return '🔥 עובדים שלא לקחו חופש מעל 90 יום:\n' + risks.map(u=>'• '+u.fullName+' ['+(Array.isArray(u.dept)?u.dept[0]:u.dept)+']').join('\n');
  },

  predictFutureLoad(db, startDate) {
    if (typeof startDate !== 'string') startDate = this.getTomorrowKey();
    const past=[];
    for(let i=1;i<=7;i++){const d=new Date();d.setDate(d.getDate()-i);past.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));}
    const vacs=db.vacations||{};
    let total=0;
    past.forEach(day=>{Object.values(vacs).forEach(uv=>{if(uv[day]==='full'||uv[day]==='half')total++;});});
    const avg=Math.round(total/7);
    const totalUsers=Object.values(db.users||{}).filter(u=>u.role!=='admin').length;
    const label = startDate === this.getTomorrowKey() ? 'מחר' : startDate;
    return 'חיזוי עומס (' + label + '):\n\n' +
      '📊 ממוצע חופשות יומי (7 ימים אחרונים): ~' + avg + ' עובדים\n' +
      '👥 סה"כ עובדים: ' + totalUsers + '\n' +
      (avg/totalUsers > 0.3 ? '⚠️ סיכון עומס גבוה — תכנן גיבויים.' : '✔️ צפי תקין.');
  },

  estimateCosts(db) {
    const now=new Date();
    const ms=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-01';
    const vacs=db.vacations||{};
    let vacDays=0, wfhDays=0, sickDays=0;
    Object.values(vacs).forEach(uv=>{
      Object.entries(uv).forEach(([d,t])=>{
        if(d>=ms){
          if(t==='full'||t==='half')vacDays++;
          if(t==='wfh')wfhDays++;
          if(t==='sick')sickDays++;
        }
      });
    });
    return 'הערכת עלויות החודש (ללא נתוני שכר):\n\n' +
      '🌴 ימי חופשה: ' + vacDays + '\n' +
      '🏠 ימי WFH: ' + wfhDays + '\n' +
      '🤒 ימי מחלה: ' + sickDays + '\n' +
      '💡 חיסכון משוער WFH: ~20% מעלויות משרד\n' +
      '(לנתונים מדויקים — ייצא דוח שכר)';
  },

  getPendingApprovals(db, cu, isAdmin, userDept) {
    let reqs=(db.approvalRequests||[]).filter(r=>r.status==='pending');
    if (!isAdmin) reqs=reqs.filter(r=>{const u=(db.users||{})[r.username];const d=u?(Array.isArray(u.dept)?u.dept[0]:u.dept):'';return d===userDept;});
    if (!reqs.length) return '✅ אין בקשות ממתינות לאישור.';
    const now=new Date();
    return '⏳ בקשות ממתינות (' + reqs.length + '):\n\n' +
      reqs.map(r=>{
        const hrs=r.submittedAt?Math.round((now-new Date(r.submittedAt))/3600000):0;
        return '• '+(r.employeeName||r.username)+': '+(r.startDate||'')+' → '+(r.endDate||'')+(hrs>48?' ⚠️ '+hrs+'ש רשום':'');
      }).join('\n');
  },

  getAuditLog(db) {
    const log=(db.auditLog||[]).slice(-15);
    if (!log.length) return 'אין רשומות ביומן.';
    return '📋 יומן ביקורת (15 פעולות אחרונות):\n\n' +
      log.reverse().map(e=>'[' + (e.ts||'').slice(0,16) + '] ' + (e.user||'') + ': ' + (e.action||'') + (e.details?' — '+e.details:'')).join('\n');
  },

  checkBirthdays(db, dateKey) {
    if (typeof dateKey !== 'string') dateKey = this.getTodayKey();
    const mmdd=dateKey.slice(5);
    const bdays=Object.values(db.users||{}).filter(u=>u.birthday&&u.birthday.slice(5)===mmdd);
    if (!bdays.length) return 'אין ימי הולדת ב-' + dateKey + '.';
    return '🎉 ימי הולדת ב-' + dateKey + ':\n' + bdays.map(u=>'• '+u.fullName).join('\n');
  },

  getMyStatus(db, cu) {
    const today=this.getTodayKey();
    const year=new Date().getFullYear();
    const vacs=(db.vacations||{})[cu.username]||{};
    const quota=((cu.quotas||{})[year]||{}).annual||0;
    const used=Object.values(vacs).filter(t=>t==='full'||t==='half').length;
    const sick=Object.values(vacs).filter(t=>t==='sick').length;
    const todayStatus=vacs[today];
    const statusLabel=!todayStatus?'נוכח/ת':todayStatus==='full'?'חופשה':todayStatus==='half'?'חופשה חצי-יום':todayStatus==='wfh'?'WFH':'מחלה';
    const myReqs=(db.approvalRequests||[]).filter(r=>r.username===cu.username);
    return 'שלום ' + (cu.fullName||cu.username) + '! הנה הסטטוס שלך:\n\n' +
      '📅 היום: ' + statusLabel + '\n' +
      '🌴 יתרת חופשה: ' + (quota-used) + ' / ' + quota + ' ימים\n' +
      '🤒 ימי מחלה השנה: ' + sick + '\n' +
      '📨 בקשות: ' + myReqs.length + ' (מאושרות: ' + myReqs.filter(r=>r.status==='approved').length + ', ממתינות: ' + myReqs.filter(r=>r.status==='pending').length + ')';
  },

  getHelpfulFallback(role) {
    const chips = getAIChipsForRole(role);
    return 'לא הבנתי בדיוק 😅\n\nנסה לשאול:\n' + chips.slice(0,5).map(c=>'• '+c.label).join('\n');
  }
};

// ============================================================
// CHIPS PER ROLE
// ============================================================
function getAIChipsForRole(role) {
  const isAdmin = role==='admin' || (typeof isCeoUser==='function'&&isCeoUser());
  const isMgr   = isAdmin || role==='manager';
  const isAcct  = role==='accountant';

  if (isAdmin) return [
    {label:'מי בחופשה היום?',    q:'מי בחופשה היום?'},
    {label:'מי עובד מהבית?',     q:'מי עובד מהבית היום?'},
    {label:'מי בסיכון שחיקה?',   q:'מי בסיכון שחיקה?'},
    {label:'בקשות ממתינות',      q:'כמה בקשות ממתינות לאישור?'},
    {label:'עלויות החודש',       q:'עלות חופשות החודש'},
    {label:'חיזוי עומס מחר',     q:'חיזוי עומס מחר'},
    {label:'יומן ביקורת',        q:'הצג יומן ביקורת'},
  ];
  if (isMgr) return [
    {label:'סטטוס הצוות היום',   q:'סטטוס מחלקה היום'},
    {label:'מי בחופשה?',         q:'מי בחופשה היום?'},
    {label:'בקשות ממתינות',      q:'בקשות פתוחות לאישור'},
    {label:'שחיקה בצוות',        q:'מי בסיכון שחיקה?'},
    {label:'חיזוי עומס',         q:'חיזוי עומס השבוע'},
  ];
  if (isAcct) return [
    {label:'יתרות חופשה',        q:'יתרות חופשה לכל העובדים'},
    {label:'עלויות החודש',       q:'עלות חופשות החודש'},
    {label:'ימי מחלה החודש',     q:'כמה ימי מחלה החודש'},
  ];
  return [
    {label:'הסטטוס שלי',         q:'מה הסטטוס שלי?'},
    {label:'היתרה שלי',          q:'מה יתרת החופשה שלי?'},
    {label:'הבקשות שלי',         q:'מה קורה עם הבקשות שלי?'},
    {label:'מי חסר מהצוות?',     q:'מי לא בעבודה היום?'},
  ];
}

// ============================================================
// GEMINI — optional enhancement
// ============================================================
async function askGemini(userQ, localAnswer, apiKey) {
  const cu = (typeof currentUser!=='undefined')?currentUser:null;
  if (!cu) throw new Error('לא מחובר');
  const isAdmin = (typeof isCeoUser==='function'&&isCeoUser())||cu.role==='admin';
  const isMgr   = isAdmin||cu.role==='manager';
  const userDept = Array.isArray(cu.dept)?cu.dept[0]:(cu.dept||'');
  const roleLabel = isAdmin?'מנכ"ל/אדמין':cu.role==='manager'?'מנהל מחלקה':cu.role==='accountant'?'חשבת':'עובד';
  const today = new Date().toISOString().split('T')[0];

  const systemPrompt = [
    '## זהות',
    'אתה מנוע ה-AI הרשמי של מערכת Dazura 3.0. עבוד בעברית מקצועית בלבד.',
    '',
    '## משתמש: ' + (cu.fullName||cu.username) + ' | תפקיד: ' + roleLabel + ' | מחלקה: ' + userDept + ' | ' + today,
    '',
    '## הרשאות',
    isAdmin ? 'גישה מלאה. התרע על עומס אם מחלקה מתחת ל-70%.' :
    isMgr   ? 'מחלקה ' + userDept + ' בלבד.' :
    cu.role==='accountant' ? 'יתרות וצבירה בלבד.' : 'מידע אישי בלבד.',
    '',
    '## תשובת המנוע המקומי',
    localAnswer,
    '',
    '## חוקים',
    '- אל תמציא נתונים. אם חסר — "לא נמצא דיווח".',
    '- סיבת מחלה/חופשה — "לא יכול לענות על כך".',
    '- אל תענה על שאלות חיצוניות.',
    '- ענה בעברית ברורה ומקצועית.'
  ].join('\n');

  const resp = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key='+apiKey,
    {method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({
       system_instruction:{parts:[{text:systemPrompt}]},
       contents:[{role:'user',parts:[{text:userQ}]}],
       generationConfig:{maxOutputTokens:600,temperature:0.4}
     })
    }
  );
  if (!resp.ok) { const e=await resp.text().catch(()=>''); throw new Error('Gemini '+resp.status+': '+e.slice(0,80)); }
  const data=await resp.json();
  const text=data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('תשובה ריקה');
  return text.trim();
}

// ============================================================
// UNIFIED CHAT — DazuraAI
// ============================================================
const DazuraAI = {
  histories: {},

  getHistory(id) { if(!this.histories[id])this.histories[id]=[]; return this.histories[id]; },
  clearHistory(id) { this.histories[id]=[]; this.render(id); },

  render(containerId, chipsId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const hist = this.getHistory(containerId);
    const chips = chipsId ? document.getElementById(chipsId) : null;
    if (!hist.length) {
      container.innerHTML = '<div style="text-align:center;padding:14px 8px;opacity:0.65;"><div style="font-size:11px;color:rgba(180,210,255,0.7);">בחר שאלה מהירה או הקלד שאלה חופשית</div></div>';
      if (chips) { chips.classList.remove('dz-20'); chips.style.display = 'flex'; }
      return;
    }
    if (chips) chips.style.display = 'none';
    container.innerHTML = hist.map(msg =>
      '<div style="display:flex;flex-direction:column;align-items:'+(msg.role==='user'?'flex-end':'flex-start')+';margin-bottom:8px;">' +
      '<div style="max-width:92%;background:'+(msg.role==='user'?'rgba(0,80,255,0.65)':'rgba(255,255,255,0.07)')+';color:white;border-radius:'+(msg.role==='user'?'12px 12px 3px 12px':'12px 12px 12px 3px')+';padding:9px 13px;font-size:12px;line-height:1.6;white-space:pre-wrap;border:1px solid '+(msg.role==='user'?'rgba(0,150,255,0.3)':'rgba(255,255,255,0.08)')+';">' +
      msg.content+'</div></div>'
    ).join('');
    container.scrollTop = container.scrollHeight;
  },

  renderChips(chipsId, role) {
    const el = document.getElementById(chipsId);
    if (!el) return;
    const chips = getAIChipsForRole(role||'employee');
    const containerId = chipsId.replace('Chips','Messages');
    const inputId     = chipsId.replace('Chips','Input');
    el.innerHTML = chips.map(c =>
      '<button onclick="DazuraAI.send(\''+containerId+'\',\''+chipsId+'\',\''+inputId+'\',\''+c.q.replace(/'/g,"\\'")+'\')" class="ai-chip">'+c.label+'</button>'
    ).join('');
    el.classList.remove('dz-20');
    el.style.display = 'flex';
  },

  async send(containerId, chipsId, inputId, query) {
    const input = document.getElementById(inputId);
    const q = query || (input ? input.value.trim() : '');
    if (!q) return;
    if (input) input.value = '';

    const cu = (typeof currentUser!=='undefined') ? currentUser : null;
    const hist = this.getHistory(containerId);
    hist.push({role:'user', content:q});
    this.render(containerId, chipsId);

    const container = document.getElementById(containerId);
    const typingId = 'aiTyping_'+containerId;
    if (container) {
      container.innerHTML += '<div id="'+typingId+'" style="display:flex;align-items:flex-start;margin-bottom:10px;"><div style="background:rgba(255,255,255,0.07);border-radius:14px 14px 14px 4px;padding:10px 14px;font-size:13px;border:1px solid rgba(255,255,255,0.08);"><span style="display:inline-flex;gap:4px;"><span style="width:6px;height:6px;background:rgba(100,180,255,0.7);border-radius:50%;animation:typingDot 1.2s infinite 0s;display:inline-block;"></span><span style="width:6px;height:6px;background:rgba(100,180,255,0.7);border-radius:50%;animation:typingDot 1.2s infinite 0.2s;display:inline-block;"></span><span style="width:6px;height:6px;background:rgba(100,180,255,0.7);border-radius:50%;animation:typingDot 1.2s infinite 0.4s;display:inline-block;"></span></span></div></div>';
      container.scrollTop = container.scrollHeight;
    }

    const localAnswer = AIEngine.ask(q, cu);
    const apiKey = localStorage.getItem('dazura_gemini_key');
    let finalAnswer = localAnswer;
    if (apiKey && !localAnswer.startsWith('🔒') && !localAnswer.startsWith('⛔')) {
      try { finalAnswer = await askGemini(q, localAnswer, apiKey); }
      catch(e) { finalAnswer = localAnswer + '\n\n⚠️ Gemini: ' + e.message; }
    }

    const typing = document.getElementById(typingId);
    if (typing) typing.remove();
    hist.push({role:'assistant', content:finalAnswer});
    this.render(containerId, chipsId);
  }
};

// ============================================================
// LEGACY COMPATIBILITY
// ============================================================
function renderCeoAiMessages()  { DazuraAI.render('ceoAiMessages','ceoAiChips'); }
function initCeoAiChat()        { DazuraAI.renderChips('ceoAiChips', currentUser?.role||'admin'); DazuraAI.render('ceoAiMessages','ceoAiChips'); }
function clearCeoAiChat()       { DazuraAI.clearHistory('ceoAiMessages'); }
function sendCeoAiQuery(q)      { DazuraAI.send('ceoAiMessages','ceoAiChips','ceoAiInput',q); }
function renderModuleAiMessages(){ DazuraAI.render('moduleAiMessages','moduleAiChips'); }
function clearModuleAiChat()    { DazuraAI.clearHistory('moduleAiMessages'); }
function sendModuleAiQuery(q)   { DazuraAI.send('moduleAiMessages','moduleAiChips','moduleAiInput',q); }
function initModuleAiChat() {
  const role=(typeof currentUser!=='undefined'&&currentUser)?currentUser.role:'employee';
  DazuraAI.renderChips('moduleAiChips',role);
  DazuraAI.render('moduleAiMessages','moduleAiChips');
}

// Signal ready
window._aiReady = true;
