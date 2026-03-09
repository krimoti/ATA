// ============================================================
// DAZURA AI ENGINE — ai.js
// Natural language HR assistant with full permission system
// ============================================================

const DazuraAI = (() => {

  // ── Conversation memory (last 10 messages) ──────────────────
  let conversationHistory = [];
  const MAX_HISTORY = 10;

  // ── Synonyms dictionary (600-800 entries) ───────────────────
  const SYNONYMS = {
    // חופשה
    'חופשה':['חופש','חג','נופש','יציאה לחופש','ימי חופש','ימי מנוחה','vacation','leave','פנאי','מנוחה','הפסקה','חל"ת','חופשת שכר','ימי החופש','חופשות','חופשתי','חופשותי','חופשתך','חופשה שלי','ימים שלקחתי'],
    // WFH
    'wfh':['עבודה מהבית','מהבית','home','remote','עבד מהבית','עובד מהבית','בית','מרחוק','עבודה מרחוק','ריחוק','טלוורק','עבודה ביתית','עבודה מרחוק','עובד ביתי','עבד בבית','ממשרד הבית','בישיבת בית'],
    // מחלה
    'מחלה':['חולה','מחלה','sick','חולני','לא מרגיש טוב','לא בסדר','ימי מחלה','ימי חולי','בחולי','תעודת מחלה','אישור מחלה','נעדר','היעדרות','חסר','חסרה','מחוסר','מחלות','מחלים','ימי מחלה שלי','כמה מחלתי','מחלתי'],
    // יתרה
    'יתרה':['יתרת חופשה','ימים שנשארו','כמה נשאר','כמה ימים נשאר','כמה ימים יש לי','כמה ימים נותרו','ימים שנותרו','balance','יתרת ימים','יתרה שלי','ימים שנשאר לי','כמה ימים אני יכול לקחת','כמה ימים זמינים','ניצול חופשה','ניצול ימים','ימים שנצברו','צבירה','נצבר','צברתי','נצבר לי'],
    // ניצול
    'ניצול':['השתמשתי','לקחתי','כמה לקחתי','ימים שניצלתי','ניצלתי','השתמש','שניצל','נוצלו','חופשות שלקחתי','ימי חופש שניצלתי','כמה השתמשתי','פניתי','ניצל','נוצל'],
    // תחזית
    'תחזית':['חיזוי','forecast','predict','צפי','עתיד','תכנון','תכנן','מתי אפשר','מתי כדאי','כמה אוכל לקחת','כדאי לקחת','המלצה','מלצי','תמליץ','מה מומלץ','מומלץ','מה כדאי'],
    // מנהל
    'מנהל':['מנהלת','boss','manager','ממונה','מנהל שלי','מנהל מחלקה','מנהלת מחלקה','מנהל הצוות','ראש צוות','team lead'],
    // אישור
    'אישור':['לאשר','לאשר חופשה','אושר','approved','ממתין לאישור','אושרה','מאושר','מאושרת','אישור חופשה','סטטוס','status','מה הסטטוס','מה מצב','בקשה','בקשת חופשה'],
    // עובד
    'עובד':['employee','worker','צוות','צוותי','עמית','עמיתי','חבר צוות','חברי צוות','עובדים','כוח אדם','אנשים','אנשי','staff'],
    // כמה
    'כמה':['מה מספר','כמות','מספר','how many','count','סה"כ','סכום','כולל','מנה','ספור','ספר'],
    // היום
    'היום':['כיום','today','עכשיו','now','ברגע זה','כרגע','הרגע','בו זמנית','הנוכחי','הנוכחית','כרגע','כעת'],
    // שבוע
    'שבוע':['שבועי','week','weekly','השבוע','בשבוע','ימי שבוע','שבוע הבא','שבוע הנוכחי'],
    // חודש
    'חודש':['חודשי','monthly','month','בחודש','החודש','הרבעון','חודש הבא','חודש קודם','חודשים','חודש ה','ב-חודש'],
    // שנה
    'שנה':['שנתי','year','annual','yearly','השנה','בשנה','שנת','השנה הנוכחית','שנה הבאה'],
    // דוח
    'דוח':['report','דוחות','סיכום','סיכוי','תמצית','תקציר','נתונים','export','ייצוא'],
    // חג
    'חג':['holiday','חגים','מועד','ערב חג','חג לאומי','יום טוב','שבת','שבתות','מנוחה','ימי חג'],
    // מחלקה
    'מחלקה':['department','dept','יחידה','אגף','מחלקות','הצוות שלי','הצוות','קבוצה'],
    // שחיקה
    'שחיקה':['burnout','עייפות','עומס','לחץ','עומסים','שחוק','כבד','עמוס'],
    // עלות
    'עלות':['cost','מחיר','תמחיר','חבות','עלויות','תקציב','כסף','ₓ','₪','שכר'],
    // נוכחות
    'נוכחות':['attendance','present','נמצא','נמצאת','במשרד','office','פיזי','פיזית','בעבודה','בחברה'],
    // בקשה
    'בקשה':['request','פנייה','פניה','שאלתי','ביקשתי','ביקש','שאלה','בקשה שלי'],
    // ממתין
    'ממתין':['pending','waiting','מחכה','טרם אושר','טרם','בהמתנה','ממתינה'],
    // אמש / אתמול
    'אתמול':['yesterday','אמש','לילה שעבר','האתמול'],
    // מחר
    'מחר':['tomorrow','הבא','יום הבא','למחר'],
    // שאלה כללית
    'מי אני':['מי אני','מה שמי','מהו שמי','זהות שלי','פרטים שלי','הפרופיל שלי','מידע עלי','אני','אחי','אחרי'],
    // הצג
    'הצג':['show','display','הראה','תראה לי','תן לי','הכן','הפק','צג','הצג לי','אני רוצה לראות','רוצה לדעת'],
    // ניהול משאבים
    'ניהול':['manage','administration','ניהולי','ניהולית','בקרה','ממשל','שלטון','פיקוח'],
    // חיסכון
    'חיסכון':['save','חוסך','לחסוך','חסכוני','תכנון','אופטימיזציה'],
    // הסעות
    'הסעות':['transportation','תחבורה','שאטל','נסיעה','הסעה','רכב'],
    // חשמל
    'חשמל':['electricity','energy','אנרגיה','חשמל','כח','מתח'],
    // ציון
    'ציון':['score','grade','דירוג','rank','מדד','מדרג','נקודה','מדרגה'],
    // רווחה
    'רווחה':['welfare','wellbeing','אושר','שביעות רצון','איכות חיים','מצב רוח','כושר','בריאות'],
    // מפת חום
    'מפת חום':['heatmap','heat map','heat-map','מפה','מדד חום','צפיפות','פיזור','תרשים'],
    // מחסור
    'מחסור':['shortage','deficit','חוסר','פגיעה','קיצור','הורדה','כח אדם'],
    // הצטרפות
    'הצטרפות':['join','registration','הרשמה','רישום','קליטה','כניסה ראשונה'],
    // לוח שנה
    'לוח שנה':['calendar','diary','schedule','אג"ב','תכנית','תכנון','לו"ז','לוז'],
    // חצי יום
    'חצי יום':['half day','half','חצי','חלקי','חצי-יום','פחות יום'],
    // מעקב
    'מעקב':['tracking','log','audit','רישום','יומן','ניטור','מעקב אחר'],
    // עדכון
    'עדכון':['update','refresh','חידוש','תיקון','שינוי','עריכה'],
    // ביטול
    'ביטול':['cancel','delete','remove','מחיקה','ביטול חופשה','הסרה'],
    // אחריות
    'אחריות':['delegate','האצלה','העברה','מאציל','מעביר'],
    // הרשאה
    'הרשאה':['permission','access','גישה','זכות','אישור גישה','הרשאות','role'],
    // פרטי
    'פרטי':['private','personal','אישי','סודי','מוגן','פרטיות'],
    // סיסמה
    'סיסמה':['password','pass','קוד','מפתח'],
    // לוג
    'לוג':['log','audit log','יומן','רשומה','רשומות','היסטוריה','תיעוד','ביומן'],
    // הודעה
    'הודעה':['message','notification','הודעות','הודע','הודיע','התראה'],
    // כל העובדים
    'כל העובדים':['כולם','all employees','כל הצוות','כל אנשי','מצבת','עובדים כולם','כלל העובדים','כל המחלקות'],
    // 90 יום
    '90 יום':['שלושה חודשים','3 חודשים','quarter','רבעון','ללא חופש'],
    // צבירה
    'צבירה':['accrual','accumulate','נצבר','מצטבר','נצברו','צובר'],
    // מכסה
    'מכסה':['quota','annual quota','מכסה שנתית','מכסה חודשית','מכסת חופשה','ימי זכות'],
    // ימי בריאות
    'ימי בריאות':['sick days','health days','ימי מחלה','ימי חולה'],
    // כניסה
    'כניסה':['login','signin','כנס','להיכנס','כנסתי','כניסה למערכת'],
    // יציאה
    'יציאה':['logout','signout','יצא','התנתקות','עזיבה'],
    // סנכרון
    'סנכרון':['sync','synchronize','firebase','עדכון נתונים','סינכרון','רענון'],
    // תאריך
    'תאריך':['date','יום','ביום','לתאריך','בתאריך','תאריך התחלה','תאריך סיום'],
  };

  // ── Intent patterns with regex + keyword matching ───────────
  const INTENTS = [
    // פרטים אישיים
    { name: 'who_am_i',       pattern: /מי אני|מה שמי|שמי|פרטים שלי|הפרופיל שלי|אני (מי|איזה)|זהות/ },
    { name: 'my_dept',        pattern: /באיזה מחלקה|מחלקה שלי|איזה צוות|הצוות שלי|אני ב/ },
    // יתרות וצבירה
    { name: 'my_balance',     pattern: /יתרת|יתרה|כמה ימים (יש לי|נשאר|נותר|זמין)|כמה נשאר|ימים שנשאר|balance|כמה חופשה|מה היתרה|ימים שנצבר|ימים צבורים|מה הצבירה|כמה צברתי|מה צברתי/ },
    { name: 'my_used',        pattern: /כמה ניצלתי|כמה לקחתי|ימים שניצלתי|ניצול|ימים שהשתמשתי|כמה ימים הולכתי|ימים שהלכתי|כמה השתמשתי/ },
    { name: 'my_quota',       pattern: /מכסה (שלי|שנתית)|כמה ימי חופש מגיע|ימי חופש שמגיע|מה המכסה|זכאי ל/ },
    { name: 'my_monthly',     pattern: /כמה (ימים|יום) בחודש|צבירה חודשית|חודשי/ },
    // תחזית ותכנון
    { name: 'forecast',       pattern: /תחזית|חיזוי|תכנון|כמה (ימים|יום) אוכל לקחת|מה מומלץ|מתי כדאי|מומלץ לקחת|תמליץ|המלצה לניצול|קצב ניצול|האם בקצב/ },
    { name: 'eoy_projection', pattern: /סוף שנה|בסוף השנה|עד סוף|עד דצמבר|כמה יישאר|כמה יהיה לי|עד סוף ה/ },
    // סטטוס בקשות
    { name: 'request_status', pattern: /סטטוס (בקשה|חופשה)|הבקשה (שלי|אחרונה)|אושרה הבקשה|נדחה|ממתין לאישור|מה מצב הבקשה|מצב בקשת|אושר|מאושר|pending/ },
    // WHO IS WHERE TODAY
    { name: 'who_vacation_today', pattern: /מי (ב|הוא|היא|נמצא|נמצאת)(חופשה|חופש|בחופש|בחופשה)|מי יצא לחופש|מי חופשה היום/ },
    { name: 'who_wfh_today',      pattern: /מי (עובד מהבית|ב-?wfh|מהבית|remote) (היום|כרגע|עכשיו)|wfh היום|מי מהבית/ },
    { name: 'who_sick_today',     pattern: /מי חולה|מי (ב|בחולי|מחלה) היום|מי נעדר|מי חסר|מחלה היום/ },
    { name: 'who_office_today',   pattern: /מי במשרד|מי (בחברה|בעבודה) היום|נוכחות היום|מי פיזי/ },
    { name: 'team_today',         pattern: /מי (מהצוות|מהמחלקה) (שלי|נמצא|היום)|מצב הצוות|הצוות היום/ },
    // היסטוריה
    { name: 'my_history_month',   pattern: /חופשה ב(חודש|ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)|כמה (ימים|יום) (לקחתי|ניצלתי) ב/ },
    { name: 'my_history_date',    pattern: /בתאריך|ביום|ב-\d{1,2}\/\d{1,2}|בחודש \d/ },
    // ניהול - CEO/ADMIN only
    { name: 'all_wfh',        pattern: /כמה עובדים מהבית|רשימת wfh|עובדי wfh|כל מי שb-?wfh|רשימת עובדי בית/ },
    { name: 'all_sick',       pattern: /כמה עובדים חולים|רשימת חולים|כל החולים|עובדים במחלה/ },
    { name: 'all_vacation',   pattern: /כמה עובדים בחופשה|רשימת חופשות|כל החופשות|עובדים בחופש/ },
    { name: 'burnout_risk',   pattern: /שחיקה|90 יום|לא לקח חופש|ללא חופש|סכנת שחיקה|burnout|לא לקחו חופש/ },
    { name: 'cost_analysis',  pattern: /עלות|עלויות|חבות|כסף|שכר|תקציב|כמה עולה|עלות חופשות/ },
    { name: 'pending_48',     pattern: /48 שעות|ממתין(ות)? לאישור|בקשות (ממתינות|שלא אושרו)|מעל 48|אישור עולה/ },
    { name: 'dept_overload',  pattern: /מחלקה עמוסה|עומס מחלקה|מחלקה עם (הכי|הרבה|יותר)|מחלקה בעומס/ },
    { name: 'heatmap',        pattern: /מפת חום|heatmap|heat map|פיזור חופשות|עומסי חופשה/ },
    { name: 'forecast_load',  pattern: /עומסי חופשה צפויים|חיזוי עומס|8 שבועות|שבועות הבא|עתיד קרוב/ },
    { name: 'headcount',      pattern: /כמה עובדים|סה"כ עובדים|מצבת עובדים|כמה אנשים בחברה|כמה נפשות/ },
    { name: 'departments',    pattern: /כמה מחלקות|אילו מחלקות|מה המחלקות|רשימת מחלקות/ },
    { name: 'audit_log',      pattern: /לוג|audit|יומן|מי שינה|מי ביצע|מי גישה|מי ראה|היסטוריית פעולות|תיעוד/ },
    { name: 'permissions',    pattern: /הרשאות|מי (יש לו|יש לה) הרשאה|הרשאת גישה|מי יכול/ },
    { name: 'emp_balance',    pattern: /יתרת (ה?עובד|החופשה של|ה?ימים של)|כמה (ימים של|חופש ל)|הצג יתרה של/ },
    { name: 'emp_history',    pattern: /היסטוריית (עובד|חיסורים|חופשות) של|חיסורי|כמה חסר/ },
    { name: 'welfare_score',  pattern: /ציון רווחה|welfare|ציוני עובדים|מצב רוח|איכות חיים/ },
    { name: 'shortage_forecast', pattern: /מחסור (כוח אדם|עובדים)|חוסר (עובדים|כוח)|shortage|חיזוי מחסור/ },
    // לוח חגים
    { name: 'holidays',       pattern: /חג|מועד|חגים|ערב חג|פסח|ראש השנה|שבועות|סוכות|ת"א|חנוכה|לאומי|פורים|עצמאות|יום כיפור/ },
    // מידע צוות
    { name: 'team_info',      pattern: /מי מ(ה?)צוות|מצוות שלי|חברי הצוות|עמיתים/ },
    // האצלת סמכויות
    { name: 'delegate',       pattern: /האצל|מאציל|להאציל|העבר|להעביר|אחריות|מי ממלא|ממלא מקומי/ },
    // ברכות
    { name: 'greeting',       pattern: /שלום|היי|הי|בוקר טוב|ערב טוב|צהריים|תקשורת|מה נשמע|מה מצבך|מה קורה/ },
    // עזרה
    { name: 'help',           pattern: /עזרה|help|מה (אתה|את) יכול|מה (יכולות|יכולת)|מה אפשר לשאול|מה ניתן לשאול|ה-?ai יכול/ },
    // שאלות לא רלוונטיות
    { name: 'off_topic',      pattern: /מזג אוויר|בישול|מתכון|חדשות|ספורט|קוד|תכנות|פוליטיקה|כלכלה|crypto|ביטקוין|מניות|weather/ },
  ];

  // ── Hebrew month names ────────────────────────────────────────
  const MONTH_NAMES = ['','ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const MONTH_NAMES_SHORT = ['','ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'];

  // ── NLP helpers ───────────────────────────────────────────────

  function normalize(text) {
    return text.toLowerCase().trim()
      .replace(/[?,!.;:]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  function expandSynonyms(text) {
    let expanded = text;
    for (const [canonical, syns] of Object.entries(SYNONYMS)) {
      for (const syn of syns) {
        if (expanded.includes(syn.toLowerCase())) {
          expanded = expanded + ' ' + canonical;
        }
      }
    }
    return expanded;
  }

  function detectIntent(text) {
    const norm = normalize(expandSynonyms(text));
    for (const intent of INTENTS) {
      if (intent.pattern.test(norm)) return intent.name;
    }
    return 'unknown';
  }

  function extractYear(text) {
    const m = text.match(/20[23]\d/);
    return m ? parseInt(m[0]) : new Date().getFullYear();
  }

  function extractMonth(text) {
    const names = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    for (let i = 0; i < names.length; i++) {
      if (text.includes(names[i])) return i + 1;
    }
    const m = text.match(/ב-?0?(\d{1,2})\/|\bחודש\s+0?(\d{1,2})\b/);
    if (m) return parseInt(m[1] || m[2]);
    return new Date().getMonth() + 1;
  }

  function extractEmployeeName(text, db) {
    if (!db || !db.users) return null;
    const lowerText = text.toLowerCase();
    for (const [uname, user] of Object.entries(db.users)) {
      const nameParts = user.fullName.toLowerCase().split(' ');
      for (const part of nameParts) {
        if (part.length > 1 && lowerText.includes(part)) return uname;
      }
    }
    return null;
  }

  function todayKey() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} (${days[d.getDay()]})`;
  }

  // ── Get today's status for all users ─────────────────────────
  function getTodayStats(db) {
    const today = todayKey();
    let vacation = [], wfh = [], sick = [], office = [];
    for (const [uname, user] of Object.entries(db.users || {})) {
      if (!user.fullName) continue;
      const type = (db.vacations?.[uname] || {})[today];
      if (type === 'full' || type === 'half') vacation.push(user.fullName);
      else if (type === 'wfh') wfh.push(user.fullName);
      else if (type === 'sick') sick.push(user.fullName);
      else if (user.status !== 'pending') office.push(user.fullName);
    }
    return { vacation, wfh, sick, office };
  }

  function getStatsForDate(db, dateStr) {
    let vacation = [], wfh = [], sick = [], office = [];
    for (const [uname, user] of Object.entries(db.users || {})) {
      if (!user.fullName) continue;
      const type = (db.vacations?.[uname] || {})[dateStr];
      if (type === 'full' || type === 'half') vacation.push(user.fullName);
      else if (type === 'wfh') wfh.push(user.fullName);
      else if (type === 'sick') sick.push(user.fullName);
      else if (user.status !== 'pending') office.push(user.fullName);
    }
    return { vacation, wfh, sick, office };
  }

  // ── Balance calculation (mirrors script.js calcBalance) ───────
  function calcBalanceAI(username, year, db) {
    const user = db.users[username];
    if (!user) return null;
    const quota = (user.quotas || {})[String(year)] || { annual: 0, initialBalance: 0 };
    const vacs = db.vacations?.[username] || {};

    let full = 0, half = 0, wfh = 0, sick = 0;
    for (const [dt, type] of Object.entries(vacs)) {
      if (dt.startsWith(String(year))) {
        if (type === 'full') full++;
        else if (type === 'half') half++;
        else if (type === 'wfh') wfh++;
        else if (type === 'sick') sick++;
      }
    }
    const used = full + half * 0.5;

    const annual = quota.annual || 0;
    const monthly = annual / 12;
    const now = new Date();
    let loadMonth = 1, knownBal = quota.initialBalance || 0;

    if (quota.balanceDate) {
      const bd = new Date(quota.balanceDate + 'T00:00:00');
      if (bd.getFullYear() === year) loadMonth = bd.getMonth() + 1;
      if (quota.knownBalance !== null && quota.knownBalance !== undefined) knownBal = quota.knownBalance;
    }

    const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : (year < now.getFullYear() ? 12 : loadMonth);
    const monthsElapsed = Math.max(0, currentMonth - loadMonth);
    const accrued = knownBal + monthly * monthsElapsed;
    const balance = accrued - used;
    const endOfYearAccrued = knownBal + monthly * Math.max(0, 12 - loadMonth);
    const projectedEndBalance = endOfYearAccrued - used;

    return { annual, monthly, knownBal, accrued, balance, used, full, half, wfh, sick, projectedEndBalance, endOfYearAccrued, currentMonth, loadMonth };
  }

  // ── Permission check ──────────────────────────────────────────
  function hasAdminAccess(user) {
    return user && (user.role === 'admin' || user.role === 'accountant' || user.username === 'gmaneg');
  }
  function hasManagerAccess(user, db) {
    if (!user) return false;
    if (hasAdminAccess(user)) return true;
    if (user.role === 'manager') return true;
    return false;
  }

  // ── Response composers ────────────────────────────────────────

  function respondWhoAmI(user, db) {
    const cb = calcBalanceAI(user.username, new Date().getFullYear(), db);
    const dept = Array.isArray(user.dept) ? user.dept.join(', ') : (user.dept || 'לא מוגדר');
    const roleLabel = user.role === 'admin' ? 'מנהל מערכת' : user.role === 'manager' ? 'מנהל מחלקה' : user.role === 'accountant' ? 'חשבות' : 'עובד';
    return `שמך הוא **${user.fullName}**, שם משתמש: ${user.username}. אתה משמש כ${roleLabel} במחלקת ${dept}. יתרת החופשה הנוכחית שלך לשנת ${new Date().getFullYear()} עומדת על **${cb ? cb.balance.toFixed(1) : '?'} ימים**.`;
  }

  function respondMyBalance(user, db, year) {
    const cb = calcBalanceAI(user.username, year, db);
    if (!cb) return 'לא נמצאו נתוני יתרה עבורך.';
    const monthName = MONTH_NAMES[cb.currentMonth] || '';
    return `יתרת החופשה שלך לשנת ${year}: כרגע עומדת על **${cb.balance.toFixed(1)} ימים** (נכון ל${monthName}). מכסה שנתית: ${cb.annual} ימים, ניצלת עד כה: ${cb.used.toFixed(1)} ימים, נצבר: ${cb.accrued.toFixed(1)} ימים. תחזית לסוף השנה: **${cb.projectedEndBalance.toFixed(1)} ימים**.`;
  }

  function respondMyUsed(user, db, year) {
    const cb = calcBalanceAI(user.username, year, db);
    if (!cb) return 'לא נמצאו נתוני ניצול.';
    return `בשנת ${year} ניצלת **${cb.used.toFixed(1)} ימי חופשה** — מתוכם ${cb.full} ימים מלאים ו-${cb.half} חצאי ימים. בנוסף, דיווחת על ${cb.wfh} ימי עבודה מהבית ו-${cb.sick} ימי מחלה.`;
  }

  function respondForecast(user, db, year) {
    const cb = calcBalanceAI(user.username, year, db);
    if (!cb) return 'לא ניתן לחשב תחזית ללא נתונים.';
    const remaining = 12 - cb.currentMonth;
    const expected = cb.balance;
    let rec = '';
    if (expected > 10) rec = `מומלץ לתכנן **${Math.floor(expected / (remaining || 1) + 0.5)} ימי חופש בחודש** בממוצע כדי לנצל את יתרתך. תאריכים מומלצים: ימים לפני חגים (חנוכה, פסח).`;
    else if (expected < 0) rec = '⚠️ אתה בחוסר ימי חופש — מומלץ להמנע מחופשות נוספות.';
    else rec = `הקצב שלך סביר. מומלץ לתכנן חופשה קצרה לפני החגים הבאים.`;
    return `תחזית ניצול חופש לשנת ${year}: יתרה נוכחית **${cb.balance.toFixed(1)} ימים**, עד סוף השנה צפויים **${cb.projectedEndBalance.toFixed(1)} ימים**. ${rec}`;
  }

  function respondHolidays(year, db) {
    const HOL = typeof HOLIDAYS !== 'undefined' ? HOLIDAYS : {};
    const upcoming = [];
    const now = new Date();
    for (const [key, h] of Object.entries(HOL)) {
      const parts = key.split('-');
      const y = parseInt(parts[0]), m = parseInt(parts[1]), d = parseInt(parts[2]);
      if (y === year) {
        const dt = new Date(y, m-1, d);
        if (dt >= now) upcoming.push({ name: h.n, date: `${d}/${m}/${y}`, blocked: h.blocked, half: h.half });
      }
    }
    upcoming.sort((a,b) => a.date.localeCompare(b.date));
    if (!upcoming.length) return `לא נמצאו חגים עתידיים לשנת ${year}.`;
    const top = upcoming.slice(0, 6).map(h => `• ${h.name} — ${h.date}${h.blocked ? ' (יום חג רשמי)' : ''}${h.half ? ' (יום קצר)' : ''}`).join('\n');
    return `החגים הקרובים בשנת ${year}:\n${top}`;
  }

  function respondRequestStatus(user, db) {
    const reqs = (db.approvalRequests || []).filter(r => r.username === user.username);
    if (!reqs.length) return 'לא נמצאו בקשות חופשה על שמך במערכת.';
    const last = reqs[reqs.length - 1];
    const statusMap = { pending: '⏳ ממתינה לאישור', approved: '✅ אושרה', rejected: '❌ נדחתה', changed: '⚠️ ימים שונו — יש לשלוח מחדש' };
    const statusText = statusMap[last.status] || last.status;
    return `הבקשה האחרונה שלך לחודש ${MONTH_NAMES[last.month] || last.month}/${last.year} — סטטוס: **${statusText}**${last.rejectReason ? `. סיבת הדחייה: ${last.rejectReason}` : ''}.`;
  }

  function respondTeamToday(user, db) {
    const today = todayKey();
    const userDept = Array.isArray(user.dept) ? user.dept[0] : user.dept;
    const teamMembers = Object.values(db.users || {}).filter(u => {
      const d = Array.isArray(u.dept) ? u.dept[0] : u.dept;
      return d === userDept && u.username !== user.username;
    });
    if (!teamMembers.length) return `לא נמצאו עמיתים נוספים במחלקת ${userDept}.`;
    const result = teamMembers.map(u => {
      const type = (db.vacations?.[u.username] || {})[today];
      const status = type === 'full' || type === 'half' ? 'בחופשה' : type === 'wfh' ? 'עובד מהבית' : type === 'sick' ? 'במחלה' : 'במשרד';
      return `• ${u.fullName}: ${status}`;
    }).join('\n');
    return `מצב עמיתי הצוות שלך (${userDept}) להיום:\n${result}`;
  }

  function respondWhoWFH(db, dateStr, isAdmin) {
    if (!isAdmin) return 'אין לך הרשאה לצפות בנתוני כלל העובדים.';
    const stats = getStatsForDate(db, dateStr);
    if (!stats.wfh.length) return `לא נמצאו עובדים ב-WFH בתאריך ${formatDate(dateStr)}.`;
    return `עובדים המדווחים על עבודה מהבית בתאריך ${formatDate(dateStr)} (${stats.wfh.length} עובדים):\n${stats.wfh.map(n=>`• ${n}`).join('\n')}`;
  }

  function respondBurnout(db) {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const atRisk = [];
    for (const [uname, user] of Object.entries(db.users || {})) {
      if (user.role === 'admin') continue;
      const vacs = db.vacations?.[uname] || {};
      const hasRecent = Object.keys(vacs).some(dt => {
        const d = new Date(dt + 'T00:00:00');
        const type = vacs[dt];
        return d >= ninetyDaysAgo && (type === 'full' || type === 'half');
      });
      if (!hasRecent) atRisk.push(user.fullName);
    }
    if (!atRisk.length) return 'כל העובדים לקחו חופשה במהלך 90 הימים האחרונים. אין חשש לשחיקה כרגע.';
    return `⚠️ **${atRisk.length} עובדים** לא לקחו חופשה ב-90 הימים האחרונים — קיים סיכון לשחיקה:\n${atRisk.map(n=>`• ${n}`).join('\n')}\nמומלץ לפנות אליהם לעידוד לקיחת חופש.`;
  }

  function respondCostAnalysis(db) {
    let totalCost = 0;
    const details = [];
    for (const [uname, user] of Object.entries(db.users || {})) {
      const dailySalary = user.dailySalary || 0;
      if (!dailySalary) continue;
      const cb = calcBalanceAI(uname, new Date().getFullYear(), db);
      if (!cb) continue;
      const accruedCost = cb.balance * dailySalary;
      totalCost += accruedCost;
      if (accruedCost > 0) details.push({ name: user.fullName, days: cb.balance.toFixed(1), cost: accruedCost });
    }
    if (!details.length) return 'לא הוגדרו נתוני שכר לעובדים — לא ניתן לחשב עלות חופשות.';
    const top = details.sort((a,b)=>b.cost-a.cost).slice(0,5).map(d=>`• ${d.name}: ${d.days} ימים — ₪${Math.round(d.cost).toLocaleString()}`).join('\n');
    return `חבות חופשות צבורות לכלל העובדים: **₪${Math.round(totalCost).toLocaleString()}**\nהעובדים עם החבות הגבוהה ביותר:\n${top}`;
  }

  function respondPending48(db) {
    const now = new Date();
    const fortyEightAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const pending = (db.approvalRequests || []).filter(r => r.status === 'pending' && new Date(r.createdAt) < fortyEightAgo);
    if (!pending.length) return 'אין בקשות ממתינות מעל 48 שעות. כל הבקשות טופלו בזמן.';
    const list = pending.map(r => {
      const user = db.users[r.username];
      const name = user ? user.fullName : r.username;
      const hours = Math.floor((now - new Date(r.createdAt)) / 3600000);
      return `• ${name} — ${MONTH_NAMES[r.month]}/${r.year} (ממתין ${hours} שעות)`;
    }).join('\n');
    return `⚠️ **${pending.length} בקשות** ממתינות לאישור מעל 48 שעות:\n${list}`;
  }

  function respondHeadcount(db) {
    const active = Object.values(db.users || {}).filter(u => u.status !== 'pending');
    const depts = db.departments || [];
    const today = getTodayStats(db);
    return `בחברה פעילים **${active.length} עובדים** ב-**${depts.length} מחלקות**: ${depts.join(', ')}.\nהיום: ${today.office.length} במשרד, ${today.wfh.length} מהבית, ${today.vacation.length} בחופשה, ${today.sick.length} חולים.`;
  }

  function respondDepartmentOverload(db) {
    const depts = {};
    const today = todayKey();
    for (const [uname, user] of Object.entries(db.users || {})) {
      const dept = Array.isArray(user.dept) ? user.dept[0] : user.dept;
      if (!dept) continue;
      if (!depts[dept]) depts[dept] = { total: 0, away: 0 };
      depts[dept].total++;
      const type = (db.vacations?.[uname] || {})[today];
      if (type && type !== 'wfh') depts[dept].away++;
    }
    const sorted = Object.entries(depts)
      .filter(([,v]) => v.total > 0)
      .map(([k,v]) => ({ dept: k, pct: Math.round(v.away / v.total * 100), away: v.away, total: v.total }))
      .sort((a,b) => b.pct - a.pct);
    if (!sorted.length) return 'אין נתוני מחלקות זמינים.';
    const top = sorted.slice(0,3).map(d => `• ${d.dept}: ${d.away}/${d.total} עובדים נעדרים (${d.pct}%)`).join('\n');
    return `המחלקות עם עומס הנעדרים הגבוה ביותר היום:\n${top}`;
  }

  function respondAuditLog(db) {
    const logs = (db.auditLog || []).slice(0, 10);
    if (!logs.length) return 'לוג הפעולות ריק.';
    const list = logs.map(l => {
      const d = new Date(l.ts);
      const time = `${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
      return `• ${time} — ${l.user}: ${l.details || l.action}`;
    }).join('\n');
    return `10 הפעולות האחרונות במערכת:\n${list}`;
  }

  function respondWelfareScore(db) {
    const scores = [];
    for (const [uname, user] of Object.entries(db.users || {})) {
      const cb = calcBalanceAI(uname, new Date().getFullYear(), db);
      if (!cb) continue;
      const utilizationRate = cb.annual > 0 ? (cb.used / (cb.accrued || 1)) * 100 : 0;
      const score = Math.min(100, Math.round(utilizationRate));
      scores.push({ name: user.fullName, score, used: cb.used.toFixed(1), balance: cb.balance.toFixed(1) });
    }
    scores.sort((a,b) => a.score - b.score);
    const avg = scores.length ? Math.round(scores.reduce((s,x)=>s+x.score,0)/scores.length) : 0;
    const bottom = scores.slice(0,3).map(s=>`• ${s.name}: ציון ${s.score} (ניצל ${s.used} ימים, יתרה ${s.balance})`).join('\n');
    return `ציון רווחת עובדים ממוצע: **${avg}/100**\nעובדים הזקוקים לתשומת לב (ניצול חופש נמוך):\n${bottom}\n\nעובדים עם ניצול נמוך נמצאים בסיכון לשחיקה — מומלץ לעודד אותם לקחת חופש.`;
  }

  function respondShortage(db) {
    const now = new Date();
    const weeks = [];
    for (let w = 0; w < 8; w++) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      let awayCount = 0;
      for (const [uname] of Object.entries(db.users || {})) {
        let d = new Date(weekStart);
        while (d <= weekEnd) {
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const type = (db.vacations?.[uname] || {})[key];
          if (type === 'full' || type === 'half' || type === 'sick') { awayCount++; break; }
          d.setDate(d.getDate() + 1);
        }
      }
      const d1 = `${weekStart.getDate()}/${weekStart.getMonth()+1}`;
      const d2 = `${weekEnd.getDate()}/${weekEnd.getMonth()+1}`;
      weeks.push({ label: `${d1}–${d2}`, away: awayCount });
    }
    const list = weeks.map((w,i) => `• שבוע ${i+1} (${w.label}): ${w.away} נעדרים`).join('\n');
    const maxWeek = weeks.reduce((a,b)=>a.away>b.away?a:b);
    return `חיזוי נוכחות ל-8 השבועות הבאים:\n${list}\n\n⚠️ עומס הנעדרים הגבוה ביותר: **${maxWeek.label}** עם ${maxWeek.away} נעדרים. מומלץ לתגבר כוח אדם בתקופה זו.`;
  }

  function respondEmpBalance(targetUser, db, year) {
    const cb = calcBalanceAI(targetUser.username, year, db);
    if (!cb) return `לא נמצאו נתונים עבור ${targetUser.fullName}.`;
    return `**${targetUser.fullName}** — יתרת חופשה לשנת ${year}: **${cb.balance.toFixed(1)} ימים**. ניצל: ${cb.used.toFixed(1)}, נצבר: ${cb.accrued.toFixed(1)}, מכסה שנתית: ${cb.annual}.`;
  }

  function respondMyHistoryMonth(user, db, month, year) {
    const vacs = db.vacations?.[user.username] || {};
    const monthStr = String(month).padStart(2,'0');
    const prefix = `${year}-${monthStr}`;
    const days = Object.entries(vacs).filter(([dt]) => dt.startsWith(prefix));
    if (!days.length) return `לא נמצאו ימי חופשה בחודש ${MONTH_NAMES[month]}/${year}.`;
    const count = days.reduce((s,[,t]) => s + (t==='full'?1:t==='half'?0.5:0), 0);
    const list = days.sort((a,b)=>a[0].localeCompare(b[0])).map(([dt,t])=>`• ${formatDate(dt)}: ${t==='full'?'יום מלא':t==='half'?'חצי יום':t==='wfh'?'WFH':'מחלה'}`).join('\n');
    return `חופשות בחודש ${MONTH_NAMES[month]}/${year} (${count} ימים):\n${list}`;
  }

  function respondDelegate(user) {
    return `להאצלת סמכויות ומשימות בזמן חופשה, מומלץ:\n• פנה למנהל שלך דרך הודעה מהאפליקציה לפני היציאה לחופשה\n• ציין אילו משימות פתוחות יש להעביר ולמי\n• הגדר תאריכי תחלופה ברורים\n• וודא שנמסרו כל סיסמאות וגישות לממלא מקום\n\nהאצלת סמכויות נכונה מאפשרת לך ליהנות מהחופשה ללא הפרעות.`;
  }

  function respondGreeting(user) {
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'שלום' : 'ערב טוב';
    return `${greet} ${user.fullName}! אני כאן לעזור לך בכל שאלה הקשורה לחופשות, נוכחות ומידע ארגוני. מה תרצה לדעת?`;
  }

  function respondHelp(user) {
    const isAdmin = hasAdminAccess(user);
    const basic = `**מה שאני יכול לעשות עבורך:**\n• יתרת ימי חופשה ותחזית שנתית\n• ניצול חופשות לפי חודש או תאריך\n• סטטוס בקשת האישור האחרונה שלך\n• מצב חברי הצוות היום (חופשה/WFH/מחלה)\n• לוח חגים וימי שיא\n• המלצות לניצול חופש`;
    const admin = isAdmin ? `\n\n**בתור מנהל, גם:**\n• רשימות WFH/חופשה/מחלה לכל תאריך\n• ניתוח שחיקה (90 יום ללא חופש)\n• עלות חופשות צבורות בחברה\n• בקשות ממתינות מעל 48 שעות\n• עומס מחלקות וחיזוי מחסור\n• ציוני רווחת עובדים\n• לוג פעולות ואירועים` : '';
    return basic + admin + '\n\n**שאל אותי בחופשיות — מבין עברית טבעית!**';
  }

  // ── Main AI response function ─────────────────────────────────
  function respond(rawInput, currentUser, db) {
    if (!rawInput || !rawInput.trim()) return 'בבקשה הקלד שאלה.';
    if (!currentUser) return 'יש להתחבר למערכת כדי לשאול שאלות.';

    // Add to history
    conversationHistory.push({ role: 'user', text: rawInput });
    if (conversationHistory.length > MAX_HISTORY * 2) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
    }

    const text = normalize(rawInput);
    const intent = detectIntent(rawInput);
    const year = extractYear(rawInput);
    const month = extractMonth(rawInput);
    const isAdmin = hasAdminAccess(currentUser);
    const isManager = hasManagerAccess(currentUser, db);

    let response = '';

    // ── Handle intents ────────────────────────────────────────
    switch (intent) {
      case 'greeting':
        response = respondGreeting(currentUser); break;
      case 'help':
        response = respondHelp(currentUser); break;
      case 'who_am_i':
        response = respondWhoAmI(currentUser, db); break;
      case 'my_dept': {
        const dept = Array.isArray(currentUser.dept) ? currentUser.dept.join(', ') : (currentUser.dept || 'לא מוגדר');
        response = `אתה משויך למחלקת **${dept}**.`; break;
      }
      case 'my_balance':
        response = respondMyBalance(currentUser, db, year); break;
      case 'my_used':
        response = respondMyUsed(currentUser, db, year); break;
      case 'my_quota': {
        const cb = calcBalanceAI(currentUser.username, year, db);
        response = cb ? `המכסה השנתית שלך לשנת ${year} היא **${cb.annual} ימים** (${cb.monthly.toFixed(2)} ימים לחודש).` : 'לא נמצאה מכסה.'; break;
      }
      case 'my_monthly': {
        const cb = calcBalanceAI(currentUser.username, year, db);
        response = cb ? `אתה צובר **${cb.monthly.toFixed(2)} ימי חופש בחודש** (מכסה שנתית: ${cb.annual} ימים / 12).` : 'לא נמצאו נתונים.'; break;
      }
      case 'forecast':
        response = respondForecast(currentUser, db, year); break;
      case 'eoy_projection': {
        const cb = calcBalanceAI(currentUser.username, year, db);
        response = cb ? `תחזית יתרת החופשה שלך בסוף שנת ${year}: **${cb.projectedEndBalance.toFixed(1)} ימים**.${cb.projectedEndBalance < 0 ? ' ⚠️ אתה בחוסר — מומלץ להסדיר!' : cb.projectedEndBalance > 15 ? ' ניצול יתר — כדאי לתכנן חופשות!' : ' הניצול שלך תקין.'}` : 'לא נמצאו נתונים.'; break;
      }
      case 'request_status':
        response = respondRequestStatus(currentUser, db); break;
      case 'team_today':
        response = respondTeamToday(currentUser, db); break;
      case 'who_wfh_today':
        if (!isAdmin) {
          response = respondTeamToday(currentUser, db);
        } else {
          response = respondWhoWFH(db, todayKey(), true);
        }
        break;
      case 'who_vacation_today': {
        const stats = getTodayStats(db);
        if (!isAdmin) {
          response = respondTeamToday(currentUser, db);
        } else {
          response = stats.vacation.length
            ? `עובדים בחופשה היום (${stats.vacation.length}):\n${stats.vacation.map(n=>`• ${n}`).join('\n')}`
            : 'אין עובדים בחופשה היום.';
        }
        break;
      }
      case 'who_sick_today': {
        if (!isAdmin) {
          const dept = Array.isArray(currentUser.dept) ? currentUser.dept[0] : currentUser.dept;
          // Only show "absent" without revealing sick reason to non-admins
          const stats = getStatsForDate(db, todayKey());
          const deptSick = Object.entries(db.users || {}).filter(([,u]) => {
            const d = Array.isArray(u.dept) ? u.dept[0] : u.dept;
            return d === dept && (db.vacations?.[u.username]||{})[todayKey()] === 'sick';
          }).map(([,u]) => u.fullName);
          response = deptSick.length ? `${deptSick.length} עמית/ים ממחלקתך נעדרים היום.` : 'אין נעדרים במחלקתך היום.';
        } else {
          const stats = getTodayStats(db);
          response = stats.sick.length
            ? `עובדים ביום מחלה היום (${stats.sick.length}):\n${stats.sick.map(n=>`• ${n}`).join('\n')}`
            : 'אין עובדים ביום מחלה היום.';
        }
        break;
      }
      case 'who_office_today': {
        const stats = getTodayStats(db);
        if (!isAdmin) {
          response = respondTeamToday(currentUser, db);
        } else {
          response = stats.office.length
            ? `עובדים במשרד היום (${stats.office.length}):\n${stats.office.map(n=>`• ${n}`).join('\n')}`
            : 'לא נמצאו עובדים המדווחים כנוכחים במשרד היום.';
        }
        break;
      }
      case 'all_wfh':
        if (!isAdmin) { response = 'אין לך הרשאה לצפות ברשימה זו.'; break; }
        response = respondWhoWFH(db, todayKey(), true); break;
      case 'all_sick':
        if (!isAdmin) { response = 'אין לך הרשאה לצפות ברשימה זו.'; break; }
        const stats2 = getTodayStats(db);
        response = stats2.sick.length ? `עובדים ביום מחלה היום:\n${stats2.sick.map(n=>`• ${n}`).join('\n')}` : 'אין עובדים ביום מחלה.';
        break;
      case 'all_vacation':
        if (!isAdmin) { response = 'אין לך הרשאה לצפות ברשימה זו.'; break; }
        const stats3 = getTodayStats(db);
        response = stats3.vacation.length ? `עובדים בחופשה היום:\n${stats3.vacation.map(n=>`• ${n}`).join('\n')}` : 'אין עובדים בחופשה היום.';
        break;
      case 'burnout_risk':
        if (!isAdmin) { response = 'מידע זה זמין למנהלים בלבד.'; break; }
        response = respondBurnout(db); break;
      case 'cost_analysis':
        if (!isAdmin) { response = 'מידע כספי זמין למנהלים בלבד.'; break; }
        response = respondCostAnalysis(db); break;
      case 'pending_48':
        if (!isAdmin) { response = 'מידע זה זמין למנהלים בלבד.'; break; }
        response = respondPending48(db); break;
      case 'dept_overload':
        if (!isAdmin) { response = 'מידע זה זמין למנהלים בלבד.'; break; }
        response = respondDepartmentOverload(db); break;
      case 'heatmap':
        if (!isAdmin) { response = 'מידע זה זמין למנהלים בלבד.'; break; }
        response = respondHeatmap(db); break;
      case 'headcount':
        if (!isAdmin) { response = 'מידע זה זמין למנהלים בלבד.'; break; }
        response = respondHeadcount(db); break;
      case 'departments': {
        const depts = db.departments || [];
        response = `בחברה קיימות **${depts.length} מחלקות**: ${depts.join(', ')}.`; break;
      }
      case 'audit_log':
        if (!isAdmin) { response = 'לוג פעולות זמין למנהלים בלבד.'; break; }
        response = respondAuditLog(db); break;
      case 'permissions':
        if (!isAdmin) { response = 'מידע הרשאות זמין למנהלים בלבד.'; break; }
        response = respondPermissions(db); break;
      case 'emp_balance': {
        if (!isAdmin) { response = 'מידע על עובדים אחרים זמין למנהלים בלבד.'; break; }
        const targetUname = extractEmployeeName(rawInput, db);
        if (!targetUname) { response = 'לא זיהיתי את שם העובד. נסח מחדש עם שם מלא.'; break; }
        response = respondEmpBalance(db.users[targetUname], db, year); break;
      }
      case 'emp_history': {
        if (!isAdmin) { response = 'מידע היסטורי על עובדים אחרים זמין למנהלים בלבד.'; break; }
        const targetUname = extractEmployeeName(rawInput, db);
        if (!targetUname) { response = 'לא זיהיתי את שם העובד.'; break; }
        response = respondMyHistoryMonth(db.users[targetUname] ? { username: targetUname } : currentUser, db, month, year); break;
      }
      case 'my_history_month':
        response = respondMyHistoryMonth(currentUser, db, month, year); break;
      case 'my_history_date': {
        const dateMatch = rawInput.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
        if (dateMatch) {
          const d = dateMatch[1].padStart(2,'0'), m2 = dateMatch[2].padStart(2,'0'), y2 = dateMatch[3] || new Date().getFullYear();
          const dt = `${y2}-${m2}-${d}`;
          const vacs = db.vacations?.[currentUser.username] || {};
          const type = vacs[dt];
          response = type ? `בתאריך ${d}/${m2}/${y2} דיווחת: **${type==='full'?'יום חופש מלא':type==='half'?'חצי יום חופש':type==='wfh'?'עבודה מהבית':'מחלה'}**.` : `לא נמצא דיווח לתאריך ${d}/${m2}/${y2}.`;
        } else {
          response = 'לא זיהיתי תאריך בשאלה. נסה לכתוב בפורמט DD/MM/YYYY.';
        }
        break;
      }
      case 'holidays':
        response = respondHolidays(year, db); break;
      case 'team_info': {
        const dept = Array.isArray(currentUser.dept) ? currentUser.dept[0] : currentUser.dept;
        const team = Object.values(db.users || {}).filter(u => {
          const d = Array.isArray(u.dept) ? u.dept[0] : u.dept;
          return d === dept;
        });
        response = `מחלקת ${dept} מונה **${team.length} עובדים**: ${team.map(u=>u.fullName).join(', ')}.`; break;
      }
      case 'delegate':
        response = respondDelegate(currentUser); break;
      case 'welfare_score':
        if (!isAdmin) { response = 'מידע זה זמין למנהלים בלבד.'; break; }
        response = respondWelfareScore(db); break;
      case 'forecast_load':
        if (!isAdmin) { response = 'מידע זה זמין למנהלים בלבד.'; break; }
        response = respondShortage(db); break;
      case 'shortage_forecast':
        if (!isAdmin) { response = 'מידע זה זמין למנהלים בלבד.'; break; }
        response = respondShortage(db); break;
      case 'off_topic':
        response = 'אני מוגבל לנושאים הקשורים למערכת ניהול חופשות ונוכחות. לשאלות כלליות, פנה למקורות אחרים.'; break;
      default:
        response = respondUnknown(rawInput, currentUser, db); break;
    }

    // Add response to history
    conversationHistory.push({ role: 'ai', text: response });

    return response;
  }

  function respondHeatmap(db) {
    const weeks = {};
    const now = new Date();
    for (let w = 0; w < 12; w++) {
      const d = new Date(now);
      d.setDate(now.getDate() + w * 7);
      const key = `${d.getDate()}/${d.getMonth()+1}`;
      let count = 0;
      for (const [uname] of Object.entries(db.users || {})) {
        const dt = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const type = (db.vacations?.[uname] || {})[dt];
        if (type === 'full' || type === 'half') count++;
      }
      const bar = '█'.repeat(Math.min(count, 10)) + '░'.repeat(Math.max(0, 10 - count));
      weeks[key] = { count, bar };
    }
    const list = Object.entries(weeks).map(([k,v]) => `• ${k}: ${v.bar} (${v.count})`).join('\n');
    return `מפת חום חופשות — 12 שבועות קדימה:\n${list}\n\n(כל █ = עובד אחד בחופשה)`;
  }

  function respondPermissions(db) {
    const perms = db.permissions || {};
    const summary = Object.entries(perms).map(([uname, p]) => {
      const user = db.users[uname];
      if (!user) return null;
      const permList = Object.entries(p).filter(([,v])=>v).map(([k])=>k).join(', ');
      return permList ? `• ${user.fullName}: ${permList}` : null;
    }).filter(Boolean);
    return summary.length ? `הרשאות מיוחדות בחברה:\n${summary.join('\n')}` : 'לא הוגדרו הרשאות מיוחדות לאף עובד.';
  }

  function respondUnknown(text, user, db) {
    // Try to provide useful context-based answer
    const lowerText = text.toLowerCase();

    // Check if asking about a specific employee by name (admin only)
    if (hasAdminAccess(user)) {
      const targetUname = extractEmployeeName(text, db);
      if (targetUname && db.users[targetUname]) {
        return respondEmpBalance(db.users[targetUname], db, new Date().getFullYear());
      }
    }

    // Check if contains a date
    if (/\d{1,2}\/\d{1,2}/.test(text)) {
      const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
      if (dateMatch) {
        const d = dateMatch[1].padStart(2,'0'), m = dateMatch[2].padStart(2,'0'), y = dateMatch[3] || new Date().getFullYear();
        const dt = `${y}-${m}-${d}`;
        const vacs = db.vacations?.[user.username] || {};
        const type = vacs[dt];
        return type ? `בתאריך ${d}/${m}/${y} דיווחת: **${type==='full'?'יום חופש מלא':type==='half'?'חצי יום':type==='wfh'?'WFH':'מחלה'}**.` : `לא נמצא דיווח לתאריך ${d}/${m}/${y}.`;
      }
    }

    return `לא הצלחתי להבין את השאלה. נסה לנסח אחרת, לדוגמה:\n• "מה יתרת החופשה שלי?"\n• "מי עובד מהבית היום?"\n• "כמה ימי חופש ניצלתי בינואר?"\n\nאני מבין עברית טבעית — כתוב בחופשיות.`;
  }

  function clearHistory() {
    conversationHistory = [];
  }

  // ── Public API ───────────────────────────────────────────────
  return { respond, clearHistory };

})();
