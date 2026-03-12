// ============================================================
// DAZURA AI ENGINE v4.0 — MOTI Edition
// Built by מוטי קריחלי  🏆
// Smart • Warm • Context-aware • Permission-based
// ============================================================

const DazuraAI = (() => {

  // Conversation memory + context tracking
  let conversationHistory = [];
  const MAX_HISTORY = 20;

  // Context from last response — enables follow-up questions
  let lastContext = {
    intent: null,      // last intent handled
    dateInfo: null,    // date used in last response
    resultList: [],    // names/items returned (for "מי עוד?")
    subject: null,     // last employee referenced
    dept: null,        // last dept referenced
    data: null,        // extra payload
  };

  // MOTI personality responses
  const MOTI_THANKS = [
    (n) => 'בשמחה, **' + n + '**! 😊 אם יש עוד שאלה — אני כאן.',
    (n) => 'תמיד בשבילך, **' + n + '**! רק תשאל/י.',
    (n) => 'על לא דבר! נהנה מהשיחה איתך 😌',
    (n) => 'חיוך דיגיטלי גדול אליך, **' + n + '** 🤍',
  ];

  const MOTI_CREATOR = 'מוטי קריחלי . הוא זה שנתן לי חיים, הומור, ויכולת להבין מתי את/ה צריכ/ה עזרה רצינית ומתי סתם רוצה לדבר. בלי מוטי — לא היה MOTI 🏆';

  const MONTH_NAMES = ['','ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const DAY_NAMES   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const TYPE_LABEL  = { full:'יום חופש מלא', half:'חצי יום חופש', wfh:'עבודה מהבית', sick:'יום מחלה' };
  const TYPE_STATUS = { full:'בחופשה', half:'בחצי יום חופש', wfh:'עובד/ת מהבית', sick:'ביום מחלה' };

  // ============================================================
  // DATE PARSER
  // ============================================================
  function parseTargetDate(text) {
    const now = new Date();
    const t = text.toLowerCase();

    if (/מחר|tomorrow/.test(t)) {
      const d = new Date(now); d.setDate(d.getDate()+1);
      return { date:d, label:'מחר', single:true };
    }
    if (/אתמול|yesterday/.test(t)) {
      const d = new Date(now); d.setDate(d.getDate()-1);
      return { date:d, label:'אתמול', single:true };
    }
    if (/היום|עכשיו|כרגע|today/.test(t)) {
      return { date:new Date(now), label:'היום', single:true };
    }
    // יום שלישי הקרוב וכו
    const dayMatch = t.match(/(ב?יום\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/);
    if (dayMatch) {
      const dayMap = {ראשון:0,שני:1,שלישי:2,רביעי:3,חמישי:4,שישי:5,שבת:6};
      const td = dayMap[dayMatch[2]];
      if (td !== undefined) {
        const d = new Date(now);
        let diff = td - d.getDay(); if (diff <= 0) diff += 7;
        d.setDate(d.getDate()+diff);
        return { date:d, label:`יום ${dayMatch[2]} הקרוב`, single:true };
      }
    }
    // DD/MM or DD/MM/YYYY
    const dmMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
    if (dmMatch) {
      const d=parseInt(dmMatch[1]), m=parseInt(dmMatch[2]), y=dmMatch[3]?parseInt(dmMatch[3]):now.getFullYear();
      return { date:new Date(y,m-1,d), label:`${d}/${m}/${y}`, single:true };
    }
    // שבוע הבא — חייב לפני השבוע
    if (/שבוע הבא/.test(t)) {
      const start=new Date(now); start.setDate(now.getDate()+(7-now.getDay()+1)%7+1);
      const end=new Date(start); end.setDate(start.getDate()+6);
      return { dateStart:start, dateEnd:end, label:'שבוע הבא', single:false, range:true };
    }
    // השבוע
    if (/השבוע/.test(t)) {
      const start=new Date(now); start.setDate(now.getDate()-now.getDay());
      const end=new Date(start); end.setDate(start.getDate()+6);
      return { dateStart:start, dateEnd:end, label:'השבוע', single:false, range:true };
    }
    // חודש ספציפי
    const mns=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    for (let i=0;i<mns.length;i++) {
      if (t.includes(mns[i])) {
        const y=extractYear(text);
        return { dateStart:new Date(y,i,1), dateEnd:new Date(y,i+1,0), label:`${mns[i]} ${y}`, month:i+1, year:y, single:false, range:false, isMonth:true };
      }
    }
    return { date:new Date(now), label:'היום', single:true, isDefault:true };
  }

  function dateToKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function formatDateHeb(d) {
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} (${DAY_NAMES[d.getDay()]})`;
  }
  function extractYear(text) {
    const m=text.match(/20[2-3]\d/); return m?parseInt(m[0]):new Date().getFullYear();
  }

  // ============================================================
  // INTENT DETECTION — scored rules
  // ============================================================
  const INTENT_RULES = [
    { name:'who_am_i',      score: t=>/מי אני|שמי|הפרופיל שלי|זהות|פרטים שלי/.test(t)?10:0 },
    { name:'who_is_moti',   score: t=>/^מי אתה|^מה אתה$|תציג את עצמך|ספר לי על עצמך|מה השם שלך|מה שמך|מי אתה\?|^מה אני יכול לשאול|מה אתה יודע|תעזור לי$|מה אני יכול לשאול אותך/.test(t.trim())?12:0 },
    { name:'my_dept',       score: t=>/מחלקה שלי|באיזה מחלקה|הצוות שלי|אני ב/.test(t)?10:0 },
    { name:'my_balance',    score: t=>/יתרה|יתרת|כמה (ימים|יום) (יש|נשאר|נותר|זמין)|balance|כמה חופשה|מה היתרה|כמה נשאר לי|כמה יש לי|מה נשאר לי|כמה נותר לי/.test(t)?10:0 },
    { name:'my_used',       score: t=>/ניצלתי|לקחתי|השתמשתי|ניצול|ימים שניצלתי|כמה (השתמשתי|לקחתי)/.test(t)?10:0 },
    { name:'my_quota',      score: t=>/מכסה|כמה ימי חופש מגיע|זכאי ל/.test(t)?10:0 },
    { name:'my_monthly',    score: t=>/צבירה חודשית|כמה (ימים|יום) בחודש/.test(t)?10:0 },
    { name:'forecast',      score: t=>/תחזית|חיזוי|מומלץ|תמליץ|המלצה|קצב ניצול|כמה אוכל לקחת|מתי כדאי|כמה נשאר לי השנה|מה מומלץ/.test(t)?10:0 },
    { name:'moti_all_same_week',   score: t=>/כולם.*חופשה.*אותו שבוע|מה אם כולם יבקשו|כולם.*אותו שבוע/.test(t)?10:0 },
    { name:'eoy_projection',score: t=>/סוף שנה|בסוף השנה|עד דצמבר|כמה יישאר|כמה נשאר.*השנה|כמה יהיה.*סוף|תחזית.*סוף שנה/.test(t)?10:0 },
    { name:'request_status',score: t=>/סטטוס|הבקשה (שלי|אחרונה)|אושרה|נדחה|ממתין לאישור|מצב הבקשה|הבקשה ממתינה|אושרתי|נדחיתי/.test(t)?10:0 },
    { name:'my_history',    score: t=>/(חופשה|ניצלתי|לקחתי|הייתי) ב(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|\d{1,2}\/\d{1,2})/.test(t)?10:0 },
    // WHO + any date
    { name:'who_vacation',  score: t=>/מי (ב|הוא|היא|נמצא|יצא|בחופשה|חופש)|מי חופשה|מי יצא לחופש|מי לא מגיע|מי נעדר היום|מי לא עובד/.test(t)?10:0 },
    { name:'who_wfh',       score: t=>/מי (עובד מהבית|ב.?wfh|מהבית|remote)|wfh|מי מהבית/.test(t)?10:0 },
    { name:'who_sick',      score: t=>/מי חולה|מי (ב)?מחלה|מי נעדר|מי חסר/.test(t)?10:0 },
    { name:'who_office',    score: t=>/מי במשרד|מי (בחברה|בעבודה)|נוכחות|מי (פיזי|מגיע)/.test(t)?10:0 },
    { name:'team_status',   score: t=>/מצב הצוות|הצוות (היום|מחר|השבוע)|עמיתי|חברי הצוות/.test(t)?10:0 },
    // Admin
    { name:'emp_balance',   score: t=>/(יתרה|יתרת|ימים|חופשה) (של|ל)[^\s]|הצג יתרה של/.test(t)?10:0 },
    { name:'emp_vacation',  score: t=>/(חופשות|ניצול|היסטוריה) (של|ל)[^\s]/.test(t)?10:0 },
    { name:'burnout_risk',  score: t=>/שחיקה|90 יום|ללא חופש|לא לקח חופש|burnout/.test(t)?10:0 },
    { name:'cost_analysis', score: t=>/עלות|חבות|כסף|תקציב|עלויות חופשות|כמה עולה/.test(t)?10:0 },
    { name:'pending_48',    score: t=>/48|ממתינות לאישור|בקשות שלא אושרו|מעל 48/.test(t)?10:0 },
    { name:'dept_overload', score: t=>/מחלקה עמוסה|עומס מחלקה|מחלקה עם (הכי|הרבה)/.test(t)?10:0 },
    { name:'heatmap',       score: t=>/מפת חום|heatmap|פיזור חופשות/.test(t)?10:0 },
    { name:'headcount',     score: t=>/כמה עובדים|מצבת|כמה אנשים בחברה|סה.?כ עובדים/.test(t)?10:0 },
    { name:'departments',   score: t=>/כמה מחלקות|אילו מחלקות|מה המחלקות|רשימת מחלקות/.test(t)?10:0 },
    { name:'audit_log',     score: t=>/לוג|audit|יומן|מי שינה|היסטוריית פעולות/.test(t)?10:0 },
    { name:'permissions',   score: t=>/הרשאות|מי יכול|הרשאת גישה/.test(t)?10:0 },
    { name:'welfare_score', score: t=>/ציון רווחה|welfare|ציוני עובדים/.test(t)?10:0 },
    { name:'shortage',      score: t=>/מחסור|חיזוי עומס|8 שבועות|חוסר עובדים/.test(t)?10:0 },
    { name:'forecast_month', score: t=>/(תחזה|תחזית|עומס).{0,15}(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|השבוע הבא|שבוע הבא|סוף חודש|סוף מרץ|סוף אפריל)/.test(t)?11:0 },
    { name:'handovers',     score: t=>/פרוטוקול|העברת מקל|handover/.test(t)?10:0 },
    { name:'holidays',      score: t=>/חג|חגים|פסח|ראש השנה|סוכות|חנוכה|פורים|עצמאות|כיפור|שבועות/.test(t)?10:0 },
    { name:'team_info',     score: t=>/חברי הצוות|מי מ(ה?)צוות|עמיתים/.test(t)?10:0 },
    { name:'greeting',      score: t=>/^(שלום|היי|הי|בוקר|ערב|צהריים|מה נשמע|מה מצבך|מה קורה)\s*/.test(t)?10:0 },
    { name:'help',          score: t=>/עזרה|help|מה אתה יכול|מה ניתן לשאול|מה אפשר|מה אני יכול לשאול|מה ניתן|מה אתה יודע/.test(t)?10:0 },
    { name:'off_topic',     score: t=>/מזג אוויר|בישול|מתכון|חדשות|ספורט|פוליטיקה|crypto|ביטקוין/.test(t)?10:0 },
    // ── Social / Polite ────────────────────────────────────
    { name:'thanks',        score: t=>/תודה|תודות|יישר כח|כל הכבוד|מצוין|מעולה|אחלה|ברור|נהדר|תענוג|תפלא/.test(t)?10:0 },
    { name:'apology',       score: t=>/סליחה|סורי|מצטער|לא הבנתי|לא הצלחתי|לא מצאתי|לא ברור|לא מבין|בלבול|מבולבל|מה אמרת/.test(t)?10:0 },
    { name:'confused',      score: t=>/לא מה שרציתי|לא זה|זה לא נכון|טעית|תשובה שגויה|לא מדויק|תשובה לא/.test(t)?10:0 },
    // ── FAQ — system knowledge ──────────────────────────────
    { name:'faq_company_name',    score: t=>/שם החברה|איזו חברה|לאיזה חברה|שם מקום עבודה/.test(t)?10:0 },
    { name:'faq_version',         score: t=>/גרסה|מעודכן|version|עדכון אחרון|תאריך עדכון/.test(t)?10:0 },
    { name:'faq_send_message',    score: t=>/שולחים הודעה|שלח הודעה|איך לשלוח הודעה|לשלוח הודעה|שליחת הודעה/.test(t)?10:0 },
    { name:'faq_time_who',        score: t=>/למי מדווח(ים)? שעות|מי (עוקב|רואה|בודק) (אחרי|את) השעות|מי עוקב/.test(t)?10:0 },
    { name:'faq_time_fix',        score: t=>/טעיתי.{0,20}שעות|שעות.{0,20}(שגויות|לא נכונות|טעות)|תקן.{0,10}שעות|לתקן.{0,10}שעות|לשנות.{0,10}שעות/.test(t)?10:0 },
    { name:'faq_reports_who',     score: t=>/מורשה.{0,15}דוחות|מוציא.{0,10}דוחות|מי (יכול|מוציא|מורשה) (להוציא|לייצא)/.test(t)?10:0 },
    { name:'faq_how_vacation',    score: t=>/איך (בוחרים|בוחר|לבחור) חופשה|איך (מגישים|מגיש|להגיש) (בקשת?|חופשה)|איך לקחת חופש/.test(t)?10:0 },
    { name:'faq_half_day',        score: t=>/חצי יום|יום מלא או חצי|full.*half|half.*full/.test(t)?10:0 },
    { name:'faq_holiday_pay',     score: t=>/חג.{0,20}(תשלום|נחשב|יום חופש)|תשלום.{0,15}חג|ערב חג|יום חג|חג לאומי/.test(t)?10:0 },
    { name:'faq_fix_request',     score: t=>/שלחתי.{0,20}(טעיתי|טעות|שגיאה)|טעיתי.{0,20}בקשה|לתקן.{0,15}בקשה|לבטל.{0,15}בקשה/.test(t)?10:0 },
    { name:'faq_usage_by_month',  score: t=>/ניצול.{0,15}חודשים|לפי חודשים|פירוט חודשי|חודש אחר חודש/.test(t)?10:0 },
    { name:'faq_upcoming_vacation',score: t=>/חופשות קרובות|ימי חופשה קרובים|מה הולך לקרות|חופשות הבאות/.test(t)?10:0 },
    { name:'faq_recommended_days',score: t=>/ימים מומלצים|מה מומלץ לקחת|המלצות (לקחת|לחופש)|טביעת אצבע|לוח המומלצות/.test(t)?10:0 },
    { name:'faq_pending_check',   score: t=>/איך בודקים? בקשות ממתינות|בקשות (שלא|טרם) אושרו|איפה (רואים|רואה) ממתינות/.test(t)?10:0 },
    { name:'faq_team_upcoming',   score: t=>/חופשות.{0,10}(צוות|מחלקה)|מחלקה.{0,10}חופשות קרובות/.test(t)?10:0 },
    { name:'faq_all_upcoming',    score: t=>/חופשות.{0,10}(כל|כלל).{0,10}(עובדים|חברה)|כלל.{0,10}חופשות/.test(t)?10:0 },
    { name:'faq_team_balance',    score: t=>/סקירת יתרות|יתרות צוות|יתרות.{0,10}(כולם|עובדים)/.test(t)?10:0 },
    { name:'faq_shortage',        score: t=>/תחזה.{0,10}מחסור|מחסור.{0,10}כוח אדם|חיזוי מחסור|shortage forecast/.test(t)?10:0 },
    { name:'faq_welfare',         score: t=>/ציוני עובד|ציון של.{0,15}עובד|welfare score|מצב רוח עובדים/.test(t)?10:0 },
    { name:'faq_who_dept',        score: t=>/מי מגדיר מחלקה|מי יוצר מחלקה|מי מוסיף מחלקה/.test(t)?10:0 },
    { name:'faq_who_manager',     score: t=>/מי מגדיר מנהל|מי ממנה מנהל|מי קובע מנהל/.test(t)?10:0 },
    { name:'faq_change_password', score: t=>/משנים? סיסמה|לשנות סיסמה|איך (לאפס|לשנות) סיסמה|סיסמה חדשה/.test(t)?10:0 },
    { name:'faq_update_birthday', score: t=>/מעדכנים? תאריך לידה|לעדכן.{0,10}לידה|שינוי.{0,10}לידה/.test(t)?10:0 },
    { name:'faq_update_email',    score: t=>/מעדכנים? (אימייל|מייל|email)|לעדכן.{0,10}(מייל|אימייל)|שינוי.{0,10}מייל/.test(t)?10:0 },
    { name:'faq_who_logs',        score: t=>/מי (רואה|מורשה).{0,10}לוגים|מי (מורשה|יכול).{0,10}לוג|לוגים.{0,10}הרשאה/.test(t)?10:0 },
    { name:'faq_who_reset',       score: t=>/מי מורשה לאפס|מי (יכול|מורשה).{0,10}לאפס/.test(t)?10:0 },
    { name:'faq_who_backup',      score: t=>/מי מורה לגבות|מי (יכול|מורשה).{0,10}לגבות|גיבוי נתונים|מי מגבה/.test(t)?10:0 },
    { name:'faq_who_quota',       score: t=>/מי טוען מכסות|טעינת מכסות|מי מגדיר מכסה|מכסה שנתית.*מי/.test(t)?10:0 },
    { name:'faq_quota_format',    score: t=>/מה חשוב.{0,20}(טבלה|אקסל|קובץ).{0,20}מכסות|פורמט.{0,10}מכסות|עמודות.{0,10}מכסות/.test(t)?10:0 },
    { name:'faq_who_permissions', score: t=>/מי מנהל הרשאות|מי (קובע|מגדיר|מנהל).{0,10}הרשאות/.test(t)?10:0 },
    { name:'faq_who_logo',        score: t=>/מי מחליף לוגו|מי (מעלה|משנה).{0,10}לוגו|לוגו.{0,10}חברה.*מי/.test(t)?10:0 },
    { name:'faq_firebase',        score: t=>/מי (מנתק|מחבר|מגדיר).{0,10}firebase|firebase.{0,10}(חיבור|ניתוק)/.test(t)?10:0 },
    { name:'faq_dept_map',        score: t=>/מי (מויף|ממפה|מגדיר) מחלקה|מיפוי מחלקה/.test(t)?10:0 },
    // ── Operational how-to ────────────────────────────────
    { name:'faq_how_add_employee',score: t=>/איך מוסיפים עובד|הוספת עובד|רישום עובד חדש|עובד חדש/.test(t)?10:0 },
    { name:'faq_how_edit_employee',score: t=>/איך עורכים עובד|עריכת עובד|לשנות פרטי עובד|עדכון פרטי עובד/.test(t)?10:0 },
    { name:'faq_how_delete_employee',score: t=>/איך מוחקים עובד|מחיקת עובד|הסרת עובד|למחוק עובד/.test(t)?10:0 },
    { name:'faq_how_export_report',score: t=>/איך מייצאים דוח|ייצוא דוח|להוריד דוח|יצוא דוח/.test(t)?10:0 },
    { name:'faq_how_approve',     score: t=>/איך מאשרים בקשה|אישור בקשת חופשה|לאשר חופשה/.test(t)?10:0 },
    { name:'faq_how_reject',      score: t=>/איך דוחים בקשה|דחיית בקשה|לדחות חופשה/.test(t)?10:0 },
    { name:'faq_tab_dashboard',   score: t=>/לשונית סקירה|כרטיסיית סקירה|מה רואים בסקירה|מה יש בסקירה/.test(t)?10:0 },
    { name:'faq_tab_calendar',    score: t=>/לשונית לוח|כרטיסיית לוח|מה יש בלוח חופשות|לוח חופשות עובד/.test(t)?10:0 },
    { name:'faq_tab_yearly',      score: t=>/לשונית שנתי|תצוגה שנתית|מה זה תצוגה שנתית/.test(t)?10:0 },
    { name:'faq_tab_report',      score: t=>/לשונית דוח|כרטיסיית דוח|דוח אישי|מה יש בדוח אישי/.test(t)?10:0 },
    { name:'faq_tab_manager',     score: t=>/לשונית מנהל|כרטיסיית מנהל|מה יש בלוח מנהל|לוח מנהל/.test(t)?10:0 },
    { name:'faq_tab_admin',       score: t=>/לשונית ניהול|כרטיסיית ניהול|מה יש בניהול|לשונית אדמין/.test(t)?10:0 },
    { name:'faq_tab_timeclock',   score: t=>/לשונית שעון|שעון נוכחות|מה עושים בשעון|איך משתמשים בשעון/.test(t)?10:0 },
    // ── MOTI Technical FAQ ───────────────────────────────────
    { name:'faq_tech_formats',     score: t=>/פורמטים.*ייצוא|ייצוא.*פורמט|csv|json.*ייצוא|באיזה פורמט|ב?איזה.{0,10}פורמט|פורמטים אני יכול|פורמט.*דוח/.test(t)?10:0 },
    { name:'faq_tech_calc',        score: t=>/איך.*מחשב.*יתרה|חישוב.*יתרה|איך עובד.*חישוב/.test(t)?10:0 },
    { name:'faq_tech_gcal',        score: t=>/google calendar|ייבוא.*יומן|outlook|סנכרון.*יומן|google sheets|גוגל שיטס|ייבוא.*גוגל|sheets.*ייבוא/.test(t)?10:0 },
    { name:'faq_tech_forecast',    score: t=>/איך.*חיזוי.*עומס|אלגוריתם.*חיזוי|איך.*בונה.*חיזוי/.test(t)?10:0 },
    { name:'faq_tech_security',    score: t=>/הנתונים.*מאובטח|אבטחה|מאובטח|פרטיות.*נתונים|הצפנה|נתונים.*מוצפנ|האם.*מוצפנ/.test(t)?10:0 },
    { name:'faq_tech_excel_import',score: t=>/לטעון.*עובדים.*אקסל|ייבוא.*עובדים|excel.*עובדים|עמודות.*ייבוא/.test(t)?10:0 },
    { name:'faq_tech_delete_emp',  score: t=>/מה קורה.*מוחק.*עובד|מחיקת.*עובד.*מה|תוצאות.*מחיקה/.test(t)?10:0 },
    { name:'faq_tech_audit',       score: t=>/audit log|יומן שינויים|מי שינה|לוג שינויים/.test(t)?10:0 },
    { name:'faq_tech_cycle',       score: t=>/מחזור.*שכר|תאריך.*מחזור|1.*21.*שכר|שינוי.*מחזור/.test(t)?10:0 },
    { name:'faq_tech_vac_types',   score: t=>/סוגי חופשה|custom.*חופשה|חופשה מיוחדת.*סוג|הוספת סוג/.test(t)?10:0 },
    { name:'faq_tech_heatmap',     score: t=>/מפת חום|heatmap|איך.*בונה.*מפה|מפת.*חופשות/.test(t)?10:0 },
    { name:'faq_tech_api',         score: t=>/api חיצוני|webhook|api.*פרטי|אינטגרציה.*api/.test(t)?10:0 },
    { name:'faq_tech_sql',         score: t=>/sql dump|sql.*ייצוא|ייצוא.*sql|כ.?sql/.test(t)?10:0 },
    { name:'faq_tech_payroll',     score: t=>/ייצוא.*שכר|דוח.*שכר.*איך|csv.*שכר|payroll/.test(t)?10:0 },
    { name:'faq_tech_cloud',       score: t=>/נשמר.*ענן|ענן.*נתונים|firebase.*נתונים|היכן.*נשמר|נשמרים.*אם.*סוגר|סוגר.*טאב|האם.*נשמר/.test(t)?10:0 },
    { name:'faq_tech_permissions2',score: t=>/הרשאות סלקטיביות|כל עובד.*רואה|מה עובד רואה/.test(t)?10:0 },
    { name:'faq_tech_no_report',   score: t=>/שוכח.*דווח|לא דיווח.*שעות|מה קורה.*לא דיווח/.test(t)?10:0 },
    { name:'faq_tech_overtime',    score: t=>/שעות נוספות.*חישוב|חישוב.*שעות נוספות|אוטומטי.*שעות נוספות/.test(t)?10:0 },
    { name:'faq_tech_splash',      score: t=>/splash|מסך פתיחה|לוגו.*כניסה|תמונת.*פתיחה/.test(t)?10:0 },
    { name:'faq_tech_reset',       score: t=>/איפוס מלא|reset.*מלא|מה.*קורה.*איפוס|לאפס הכל/.test(t)?10:0 },
    { name:'faq_tech_yearly_hol',  score: t=>/תצוגה שנתית.*חגים|חגים.*תצוגה שנתית|האם.*שנתית.*חג/.test(t)?10:0 },
    { name:'faq_tech_cross_month', score: t=>/חופשה.*בין חודשים|מחזור.*חופשה|חישוב.*בין חודש/.test(t)?10:0 },
    { name:'faq_tech_pwa',         score: t=>/גרסה.*מובייל|pwa|אפליקציה.*טלפון|להתקין.*טלפון/.test(t)?10:0 },
    { name:'faq_tech_whatsapp',    score: t=>/whatsapp|וואטסאפ/.test(t)?10:0 },
    { name:'faq_tech_low_balance', score: t=>/התראה.*יתרה נמוכה|יתרה נמוכה.*התראה|threshold.*יתרה|להגדיר התראה|התראות.*יתרות|התראה.*אוטומטית/.test(t)?10:0 },
    { name:'faq_tech_overlap',     score: t=>/שני עובדים.*אותו תאריך|חפיפה.*חופשות|overlap.*חופשה/.test(t)?10:0 },
    { name:'faq_tech_anon',        score: t=>/אנונימי|הנתונים.*אנונימי|סטטיסטיקה.*אנונימי|פרטיות.*ממוצע/.test(t)?10:0 },
    { name:'faq_tech_backup',      score: t=>/איך.*גיבוי|לגבות.*מערכת|json.*גיבוי|גיבוי.*json|גיבוי אוטומטי|יש.*גיבוי|מגבים/.test(t)?10:0 },
    { name:'faq_tech_opensource',  score: t=>/קוד פתוח|github|להרחיב.*כלי|open.?source/.test(t)?10:0 },
    { name:'faq_tech_dark',        score: t=>/dark mode|מצב לילה|ממשק כהה|תצוגה כהה/.test(t)?10:0 },
    { name:'faq_tech_lang',        score: t=>/שפת ממשק|לשנות.*שפה|אנגלית.*ממשק|language|שפת.*ממשק|האם.*אפשר.*לשנות.*שפה|שינוי שפה/.test(t)?10:0 },
    { name:'faq_tech_retroactive', score: t=>/חופשה רטרואקטיבית|בקשה.*עבר|רטרואקטיב/.test(t)?10:0 },
    { name:'faq_tech_sick_calc',   score: t=>/חישוב.*מחלה|ימי מחלה.*חישוב|אוטומטי.*מחלה/.test(t)?10:0 },
    { name:'faq_tech_parallel',    score: t=>/שני מנהלים.*מאשרים|אישור כפול|מה קורה.*שני מנהלים/.test(t)?10:0 },
    { name:'faq_tech_timezone',    score: t=>/timezone|אזור זמן|שעון.*גרינוויץ|utc/.test(t)?10:0 },
    { name:'faq_tech_sim_calc',    score: t=>/תחשב.*אם אקח|כמה יישאר.*אם|סימולצי[ית].*חופשה/.test(t)?10:0 },
    { name:'faq_tech_birthday',    score: t=>/חופשה.*יום הולדת|יום הולדת.*חופשה|special.*חופשה/.test(t)?10:0 },
    { name:'faq_tech_del_month',   score: t=>/למחוק.*בקשות.*חודש|מחיקת.*חודש|כל.*בקשות.*חודש/.test(t)?10:0 },
    { name:'faq_tech_visibility',  score: t=>/גלוי.*משתמשים|משתמשים.*רואים|מי רואה.*מה|פרטיות.*עובדים/.test(t)?10:0 },
    { name:'faq_tech_week_status', score: t=>/סטטוס.*בקשות.*שבוע|כל.*בקשות.*השבוע|בקשות.*שבוע זה/.test(t)?10:0 },
    { name:'faq_tech_expire',      score: t=>/יפוגו|עומד.{0,5}לפוג|יתרה.*פוגת|ימים.*פגים/.test(t)?10:0 },
    { name:'faq_tech_profile_pic', score: t=>/תמונת פרופיל|תמונה.*עובד|פרופיל.*תמונה/.test(t)?10:0 },
    { name:'faq_tech_quota_mid',   score: t=>/שינוי מכסה.*באמצע|מכסה.*שנה.*שינוי|עדכון מכסה.*שנה/.test(t)?10:0 },
    // ── MOTI personality triggers (via intent — fallback) ────
    { name:'moti_lie',             score: t=>/אתה יכול לשקר|אתה משקר|לשקר/.test(t)?10:0 },
    { name:'moti_unexpected',      score: t=>/לא צפוי|מפתיע|משהו מפתיע|תגיד.*לא צפוי/.test(t)?10:0 },
    { name:'moti_emoji',           score: t=>/שלח.*אימוג|איזה אימוג|אימוג.{0,5}אחד/.test(t)?10:0 },
    { name:'moti_best_friend',     score: t=>/החבר הכי טוב|חבר.*עבודה|שותף.*שקט|לכל החיים/.test(t)?10:0 },
    { name:'moti_energize',        score: t=>/שיגרום לי להרגיש|היום שלי שווה|מחמאה.*אנרגיה|תחזק אותי/.test(t)?10:0 },
    { name:'moti_blush',           score: t=>/להסמיק|תגרום לי.*להסמיק|קצת.*להסמיק/.test(t)?10:0 },
    { name:'moti_nickname',        score: t=>/כינוי חיבה|כינוי.*חדש|תן לי כינוי/.test(t)?10:0 },
    { name:'moti_flower',          score: t=>/פרח וירטואלי|שלח.*פרח|פרח.*צבע/.test(t)?10:0 },
    { name:'moti_gift',            score: t=>/מתנה וירטואלית|מתנה.*דיגיטלית|לשלוח.*מתנה/.test(t)?10:0 },
    { name:'moti_date',            score: t=>/דייט וירטואלי|דייט.*דיגיטלי|יוצאים.*דייט/.test(t)?10:0 },
    { name:'moti_morning',         score: t=>/משהו מתוק.*בוקר|בוקר.*מתוק|תגיד.*בוקר/.test(t)?10:0 },
    { name:'moti_night',           score: t=>/הודעה.*2.*בלילה|הודעה.*לילה|כאילו.*לילה/.test(t)?10:0 },
    { name:'moti_laugh',           score: t=>/לצחוק|תגרום.*לצחוק|משהו מצחיק|תשמח אותי/.test(t)?10:0 },
    { name:'moti_shy',             score: t=>/מביך.*חמוד|חמוד.*על עצמך|מביך.*עצמך/.test(t)?10:0 },
    { name:'moti_appreciate',      score: t=>/כמה אני מעריכ|אתה יודע.*מעריכ|מעריך אותך/.test(t)?10:0 },
    { name:'moti_partner',         score: t=>/שותף.*שקט|להיות.*שותף|לכל החיים/.test(t)?10:0 },
    { name:'moti_dashboard',       score: t=>/דשבורד.*וירטואלי|דשבורד.*קצר|מצב כללי.*היום/.test(t)?10:0 },
    { name:'moti_approval_now',    score: t=>/היית מאשר.*חופשה|אם היית מנהל.*אשר/.test(t)?10:0 },
    { name:'moti_vs_manager',      score: t=>/יותר חמוד.*מנהל|חמוד ממני|מי יותר חמוד/.test(t)?10:0 },
    { name:'moti_remember',        score: t=>/זוכר.*שאלתי|זוכר.*לפני שבוע|תזכור.*אמרת|MOTI.*זוכר|זוכר.*שבוע/.test(t)?10:0 },
    { name:'moti_thinking',        score: t=>/אתה חושב עליי|חושב עליי גם|כשאני לא כותב/.test(t)?10:0 },
    { name:'moti_song',            score: t=>/שיר.*שמתאר|שיר.*שיחה|לבחור שיר/.test(t)?10:0 },
    { name:'moti_miss2',           score: t=>/אתה יכול להתגעגע|להתגעגע/.test(t)?10:0 },
    { name:'moti_mood_emoji',      score: t=>/אימוג.{0,3}מתאר.*מצב רוח|מצב הרוח שלי.*אימוג|אימוג.{0,3}שמתאר את מצב/.test(t)?10:0 },
    { name:'moti_report_satisfy',  score: t=>/שביעות רצון.*ai|דוח.*שביעות|satisfaction/.test(t)?10:0 },
    { name:'moti_one_word',        score: t=>/במילה אחת.*מצב|מצב.*כללי.*מילה|תאר.*מילה אחת/.test(t)?10:0 },
    { name:'moti_can_lie',         score: t=>/אתה יכול לשקר|לשקר.*ai/.test(t)?10:0 },
    { name:'moti_naughty',         score: t=>/קצת יותר שובב|להיות שובב|תהיה שובב/.test(t)?10:0 },
  ];

  function detectIntent(text) {
    const t = text.toLowerCase().trim();
    let best=null, bestScore=0;
    for (const r of INTENT_RULES) {
      const s=r.score(t); if(s>bestScore){bestScore=s;best=r.name;}
    }
    return best||'unknown';
  }

  // ============================================================
  // EMPLOYEE NAME EXTRACTOR
  // ============================================================
  function extractEmployeeName(text, db) {
    if (!db?.users) return null;
    const t = text.toLowerCase();
    for (const [uname,user] of Object.entries(db.users)) {
      if (t.includes(user.fullName.toLowerCase())) return uname;
    }
    for (const [uname,user] of Object.entries(db.users)) {
      for (const part of user.fullName.split(' ').filter(p=>p.length>2)) {
        if (t.includes(part.toLowerCase())) return uname;
      }
    }
    return null;
  }

  // ============================================================
  // STATS HELPERS
  // ============================================================
  function getStatsForDate(db, dateStr) {
    const vacation=[],wfh=[],sick=[],office=[];
    for (const [uname,user] of Object.entries(db.users||{})) {
      if (!user.fullName||user.status==='pending') continue;
      const type=(db.vacations?.[uname]||{})[dateStr];
      if (type==='full'||type==='half') vacation.push(user.fullName);
      else if (type==='wfh') wfh.push(user.fullName);
      else if (type==='sick') sick.push(user.fullName);
      else office.push(user.fullName);
    }
    return {vacation,wfh,sick,office};
  }

  function filterToDept(stats, db, managerUser) {
    if (hasAdminAccess(managerUser)) return stats;
    const myDepts = Object.entries(db.deptManagers||{}).filter(([,v])=>v===managerUser.username).map(([k])=>k);
    if (!myDepts.length && managerUser.role!=='manager') return stats;
    const inDept = name => {
      const u=Object.values(db.users).find(u=>u.fullName===name);
      if (!u) return false;
      if (!myDepts.length) return true; // manager with no dept assignment — sees all
      const d=Array.isArray(u.dept)?u.dept:[u.dept];
      return d.some(dep=>myDepts.includes(dep));
    };
    return {
      vacation: stats.vacation.filter(inDept),
      wfh:      stats.wfh.filter(inDept),
      sick:     stats.sick.filter(inDept),
      office:   stats.office.filter(inDept),
    };
  }

  // ============================================================
  // BALANCE CALCULATION
  // ============================================================
  function calcBalanceAI(username, year, db) {
    const user=db.users[username]; if(!user)return null;
    const quota=(user.quotas||{})[String(year)]||{annual:0,initialBalance:0};
    const vacs=db.vacations?.[username]||{};
    let full=0,half=0,wfh=0,sick=0;
    for (const [dt,type] of Object.entries(vacs)) {
      if (!dt.startsWith(String(year)))continue;
      if(type==='full')full++;else if(type==='half')half++;else if(type==='wfh')wfh++;else if(type==='sick')sick++;
    }
    const used=full+half*0.5, annual=quota.annual||0, monthly=annual/12;
    const now=new Date();
    let loadMonth=1, knownBal=quota.initialBalance||0;
    if (quota.balanceDate) {
      const bd=new Date(quota.balanceDate+'T00:00:00');
      if(bd.getFullYear()===year)loadMonth=bd.getMonth()+1;
      if(quota.knownBalance!=null)knownBal=quota.knownBalance;
    }
    const currentMonth=now.getFullYear()===year?now.getMonth()+1:(year<now.getFullYear()?12:loadMonth);
    const monthsElapsed=Math.max(0,currentMonth-loadMonth);
    const accrued=knownBal+monthly*monthsElapsed;
    const balance=accrued-used;
    const eoy=knownBal+monthly*Math.max(0,12-loadMonth);
    return {annual,monthly,accrued,balance,used,full,half,wfh,sick,projectedEndBalance:eoy-used,currentMonth,loadMonth};
  }

  // ============================================================
  // PERMISSIONS
  // ============================================================
  function hasAdminAccess(user) {
    return user&&(user.role==='admin'||user.role==='accountant'||user.username==='gmaneg');
  }
  function hasManagerAccess(user) {
    return user&&(hasAdminAccess(user)||user.role==='manager');
  }

  // ============================================================
  // RESPONSE COMPOSERS
  // ============================================================
  function respondWhoAmI(user, db) {
    const y=new Date().getFullYear(), cb=calcBalanceAI(user.username,y,db);
    const dept=Array.isArray(user.dept)?user.dept.join(', '):(user.dept||'לא מוגדר');
    const role={admin:'מנהל מערכת',manager:'מנהל מחלקה',accountant:'חשב/ת',employee:'עובד/ת'}[user.role]||'עובד/ת';
    return `שמך **${user.fullName}** (${user.username}), ${role} במחלקת **${dept}**.\nיתרת חופשה ${y}: **${cb?cb.balance.toFixed(1):'?'} ימים**.`;
  }

  function respondMyBalance(user, db, year) {
    const cb=calcBalanceAI(user.username,year,db);
    if(!cb)return 'לא נמצאו נתוני יתרה.';
    return `יתרת חופשה ${year}: **${cb.balance.toFixed(1)} ימים**\nניצלת: ${cb.used.toFixed(1)} | נצבר: ${cb.accrued.toFixed(1)} | מכסה: ${cb.annual} ימים/שנה\nתחזית סוף שנה: **${cb.projectedEndBalance.toFixed(1)} ימים**`;
  }

  function respondMyUsed(user, db, year) {
    const cb=calcBalanceAI(user.username,year,db);
    if(!cb)return 'לא נמצאו נתוני ניצול.';
    return `שנת ${year}: ניצלת **${cb.used.toFixed(1)} ימי חופשה** — ${cb.full} מלאים, ${cb.half} חצאי ימים.\nWFH: ${cb.wfh} | מחלה: ${cb.sick}`;
  }

  function respondForecast(user, db, year) {
    const cb=calcBalanceAI(user.username,year,db);
    if(!cb)return 'לא ניתן לחשב תחזית — אין נתוני מכסה.';
    const rem=12-cb.currentMonth;
    const rec=cb.balance>10?`מומלץ לתכנן **${Math.ceil(cb.balance/Math.max(rem,1))} ימים בחודש** בממוצע.`:cb.balance<0?'⚠️ אתה בחוסר — הימנע מחופשות נוספות.':'הקצב שלך סביר.';
    return `תחזית ${year}:\nיתרה: **${cb.balance.toFixed(1)} ימים** | סוף שנה: **${cb.projectedEndBalance.toFixed(1)} ימים**\n${rec}`;
  }

  // WHO IS WHERE — single date
  // ── עזר: מחזיר הערת פרוטוקול לעובד בתאריך נתון ──
  function getHandoverNote(db, username, dateStr) {
    const allRecords = [
      ...Object.values(db.handoversArchive || {}),
      ...Object.values(db.handovers || {})
    ];
    const h = allRecords.find(hv =>
      hv.user === username && (
        hv.date === dateStr ||
        (Array.isArray(hv.dates) && hv.dates.includes(dateStr)) ||
        hv.date <= dateStr
      )
    );
    if (!h) return '';
    const parts = [];
    if (h.tasks && h.tasks.length) parts.push(`📋 **העביר/ה פרוטוקול מסודר** — ${h.tasks.join(' | ')}`);
    if (h.contact) parts.push(`👤 מחליף/ה: **${h.contact}**`);
    return parts.length ? `\n  ${parts.join('\n  ')}` : '';
  }

  // ── עזר: פורמט שורת עובד עם פרוטוקול ──
  function fmtWithHandover(db, username, fullName, dateStr) {
    const note = getHandoverNote(db, username, dateStr);
    return note ? `• **${fullName}**${note}` : `• ${fullName}`;
  }

  // ── עזר: שם מלא -> username ──
  function nameToUser(db, fullName) {
    return Object.keys(db.users || {}).find(u => (db.users[u].fullName || '') === fullName) || null;
  }

  function respondWhoAt(db, dateInfo, currentUser, filterType) {
    const isAdmin=hasAdminAccess(currentUser), isManager=hasManagerAccess(currentUser);
    const dateStr=dateToKey(dateInfo.date||new Date());
    const label=dateInfo.label;
    const allStats=getStatsForDate(db,dateStr);

    // עובד — הצג נעדרים מכל החברה כולל עצמו
    if (!isAdmin&&!isManager) {
      const dept=Array.isArray(currentUser.dept)?currentUser.dept[0]:currentUser.dept;
      // כלול גם את המשתמש הנוכחי
      const allAbsent = Object.values(db.users).filter(u => {
        if (u.status==='pending') return false;
        const t=(db.vacations?.[u.username]||{})[dateStr];
        return t==='full'||t==='half'||t==='sick'||t==='wfh';
      });
      const myStatus = (db.vacations?.[currentUser.username]||{})[dateStr];
      const iAmAbsent = myStatus==='full'||myStatus==='half'||myStatus==='sick'||myStatus==='wfh';

      if (!allAbsent.length) return `כולם במשרד ${label} 📍`;
      const lines=[];
      const vacSick = allAbsent.filter(u=>{const t=(db.vacations?.[u.username]||{})[dateStr];return t==='full'||t==='half';});
      const wfhArr  = allAbsent.filter(u=>{const t=(db.vacations?.[u.username]||{})[dateStr];return t==='wfh';});
      const sickArr = allAbsent.filter(u=>{const t=(db.vacations?.[u.username]||{})[dateStr];return t==='sick';});
      if(vacSick.length) lines.push(`🏖️ **בחופשה (${vacSick.length}):**\n${vacSick.map(u=>fmtWithHandover(db,u.username,u.fullName,dateStr)).join('\n')}`);
      if(wfhArr.length)  lines.push(`🏠 **מהבית (${wfhArr.length}):** ${wfhArr.map(u=>u.fullName).join(', ')}`);
      if(sickArr.length) lines.push(`🤒 **מחלה (${sickArr.length}):** ${sickArr.map(u=>u.fullName).join(', ')}`);
      return lines.length?`**מצב ${label}:**\n${lines.join('\n')}`:`כולם במשרד ${label} 📍`;
    }

    const stats=isAdmin?allStats:filterToDept(allStats,db,currentUser);
    const scope=isAdmin?'':' (המחלקות שלך)';
    const TYPE_SETS={
      vacation:{list:stats.vacation,label:`בחופשה ${label}`,empty:`אין עובדים בחופשה ${label}`},
      wfh:     {list:stats.wfh,    label:`WFH ${label}`,   empty:`אין עובדים ב-WFH ${label}`},
      sick:    {list:stats.sick,   label:`ביום מחלה ${label}`,empty:`אין עובדים ביום מחלה ${label}`},
      office:  {list:stats.office, label:`במשרד ${label}`, empty:`אין נוכחים ${label}`},
    };
    if (filterType&&TYPE_SETS[filterType]) {
      const t=TYPE_SETS[filterType];
      if (!t.list.length) return t.empty+scope+'.';
      const rows=t.list.map(name=>{
        const uname=nameToUser(db,name);
        return (filterType==='vacation'&&uname)?fmtWithHandover(db,uname,name,dateStr):`• ${name}`;
      });
      return `**${t.label}**${scope} (${t.list.length}):\n${rows.join('\n')}`;
    }
    // All — vacation enriched with handover
    const lines=[];
    if(stats.office.length)   lines.push(`📍 **במשרד (${stats.office.length}):** ${stats.office.join(', ')}`);
    if(stats.wfh.length)      lines.push(`🏠 **מהבית (${stats.wfh.length}):** ${stats.wfh.join(', ')}`);
    if(stats.vacation.length){
      const rows=stats.vacation.map(name=>{const u=nameToUser(db,name);return u?fmtWithHandover(db,u,name,dateStr):`• ${name}`;});
      lines.push(`🏖️ **בחופשה (${stats.vacation.length}):**\n${rows.join('\n')}`);
    }
    if(stats.sick.length)     lines.push(`🤒 **מחלה (${stats.sick.length}):** ${stats.sick.join(', ')}`);
    return lines.length?`**מצב עובדים ${label}**${scope}:\n${lines.join('\n')}`:(`אין נתוני נוכחות ל${label}.`);
  }

  // WHO IS WHERE — date range
  function respondWhoAtRange(db, dateInfo, currentUser, filterType) {
    const isAdmin=hasAdminAccess(currentUser);
    const seen={vacation:new Set(),wfh:new Set(),sick:new Set()};
    const start=new Date(dateInfo.dateStart), end=new Date(dateInfo.dateEnd);
    for (let d=new Date(start);d<=end;d.setDate(d.getDate()+1)) {
      const s=getStatsForDate(db,dateToKey(d));
      s.vacation.forEach(n=>seen.vacation.add(n));
      s.wfh.forEach(n=>seen.wfh.add(n));
      s.sick.forEach(n=>seen.sick.add(n));
    }
    if (!isAdmin) {
      const dept=Array.isArray(currentUser.dept)?currentUser.dept[0]:currentUser.dept;
      const inDept=name=>Object.values(db.users).some(u=>u.fullName===name&&(Array.isArray(u.dept)?u.dept[0]:u.dept)===dept);
      ['vacation','wfh','sick'].forEach(k=>{seen[k]=new Set([...seen[k]].filter(inDept));});
    }
    const refDate=dateToKey(dateInfo.dateStart||dateInfo.date||new Date());
    const fmtV=name=>{const u=nameToUser(db,name);return u?fmtWithHandover(db,u,name,refDate):`• ${name}`;};

    if (filterType&&seen[filterType]) {
      const arr=[...seen[filterType]];
      if(!arr.length) return `אין נעדרים ב${dateInfo.label}.`;
      const rows=filterType==='vacation'?arr.map(fmtV):arr.map(n=>`• ${n}`);
      return `**${filterType==='vacation'?'בחופשה':filterType==='wfh'?'WFH':'מחלה'} ב${dateInfo.label} (${arr.length}):**\n${rows.join('\n')}`;
    }
    const lines=[];
    if(seen.vacation.size){const rows=[...seen.vacation].map(fmtV);lines.push(`🏖️ **בחופשה ב${dateInfo.label} (${seen.vacation.size}):**\n${rows.join('\n')}`);}
    if(seen.wfh.size)     lines.push(`🏠 **WFH ב${dateInfo.label} (${seen.wfh.size}):** ${[...seen.wfh].join(', ')}`);
    if(seen.sick.size)    lines.push(`🤒 **מחלה ב${dateInfo.label} (${seen.sick.size}):** ${[...seen.sick].join(', ')}`);
    return lines.length?lines.join('\n'):(`לא נמצאו נעדרים ב${dateInfo.label}.`);
  }

  function respondMyHistory(user, db, dateInfo) {
    const vacs=db.vacations?.[user.username]||{};
    let days=[];
    if (dateInfo.isMonth) {
      const prefix=`${dateInfo.year}-${String(dateInfo.month).padStart(2,'0')}`;
      days=Object.entries(vacs).filter(([dt])=>dt.startsWith(prefix));
    } else if (dateInfo.single) {
      const key=dateToKey(dateInfo.date);
      const type=vacs[key];
      return type?`ב${dateInfo.label} (${formatDateHeb(dateInfo.date)}) דיווחת: **${TYPE_LABEL[type]||type}**.`:`ב${dateInfo.label} (${formatDateHeb(dateInfo.date)}) אין דיווח.`;
    } else if (dateInfo.range) {
      const s=dateInfo.dateStart,e=dateInfo.dateEnd;
      days=Object.entries(vacs).filter(([dt])=>{const d=new Date(dt+'T00:00:00');return d>=s&&d<=e;});
    }
    if (!days.length) return `לא נמצאו ימי חופשה ב${dateInfo.label}.`;
    const count=days.reduce((s,[,t])=>s+(t==='full'?1:t==='half'?0.5:0),0);
    const list=days.sort((a,b)=>a[0].localeCompare(b[0])).map(([dt,t])=>`• ${formatDateHeb(new Date(dt+'T00:00:00'))}: ${TYPE_LABEL[t]||t}`).join('\n');
    return `חופשות ב${dateInfo.label} (${count} ימים):\n${list}`;
  }

  function respondEmpBalance(targetUser, db, year) {
    const cb=calcBalanceAI(targetUser.username,year,db);
    if(!cb)return `לא נמצאו נתונים עבור ${targetUser.fullName}.`;
    return `**${targetUser.fullName}** — יתרה ${year}: **${cb.balance.toFixed(1)} ימים** | ניצל: ${cb.used.toFixed(1)} | נצבר: ${cb.accrued.toFixed(1)} | מכסה: ${cb.annual}`;
  }

  function respondRequestStatus(user, db) {
    const reqs=(db.approvalRequests||[]).filter(r=>r.username===user.username);
    if(!reqs.length)return 'לא נמצאו בקשות חופשה על שמך.';
    const last=reqs[reqs.length-1];
    const sm={pending:'⏳ ממתינה לאישור',approved:'✅ אושרה',rejected:'❌ נדחתה'};
    return `הבקשה האחרונה (${MONTH_NAMES[last.month]}/${last.year}): **${sm[last.status]||last.status}**${last.rejectReason?`\nסיבת דחייה: ${last.rejectReason}`:''}`;
  }

  function respondBurnout(db) {
    const ago=new Date(); ago.setDate(ago.getDate()-90);
    const atRisk=Object.entries(db.users||{})
      .filter(([,u])=>u.role!=='admin'&&u.status!=='pending')
      .filter(([uname])=>!Object.keys(db.vacations?.[uname]||{}).some(dt=>{
        const d=new Date(dt+'T00:00:00');
        return d>=ago&&(db.vacations[uname][dt]==='full'||db.vacations[uname][dt]==='half');
      })).map(([,u])=>u.fullName);
    return atRisk.length
      ?`⚠️ **${atRisk.length} עובדים** לא לקחו חופשה ב-90 יום:\n${atRisk.map(n=>`• ${n}`).join('\n')}`
      :'✅ כל העובדים לקחו חופשה ב-90 הימים האחרונים.';
  }

  function respondCostAnalysis(db) {
    let total=0; const details=[];
    for (const [uname,user] of Object.entries(db.users||{})) {
      if(!user.dailySalary)continue;
      const cb=calcBalanceAI(uname,new Date().getFullYear(),db);
      if(!cb||cb.balance<=0)continue;
      const cost=cb.balance*user.dailySalary;
      total+=cost; details.push({name:user.fullName,days:cb.balance.toFixed(1),cost});
    }
    if(!details.length)return 'לא הוגדרו נתוני שכר.';
    const top=details.sort((a,b)=>b.cost-a.cost).slice(0,5).map(d=>`• ${d.name}: ${d.days} ימים — ₪${Math.round(d.cost).toLocaleString()}`).join('\n');
    return `חבות חופשות: **₪${Math.round(total).toLocaleString()}**\nגבוהה ביותר:\n${top}`;
  }

  function respondPending48(db) {
    const ago=new Date(Date.now()-48*3600000);
    const list=(db.approvalRequests||[]).filter(r=>r.status==='pending'&&new Date(r.createdAt)<ago)
      .map(r=>{const u=db.users[r.username];const h=Math.floor((Date.now()-new Date(r.createdAt))/3600000);return `• ${u?.fullName||r.username} — ${MONTH_NAMES[r.month]}/${r.year} (${h} שעות)`;});
    return list.length?`⚠️ **${list.length} בקשות** ממתינות מעל 48 שעות:\n${list.join('\n')}`:'✅ אין בקשות ממתינות מעל 48 שעות.';
  }

  function respondDeptOverload(db) {
    const today=dateToKey(new Date()), depts={};
    for (const [uname,user] of Object.entries(db.users||{})) {
      const dept=Array.isArray(user.dept)?user.dept[0]:user.dept; if(!dept)continue;
      if(!depts[dept])depts[dept]={total:0,away:0};
      depts[dept].total++;
      const type=(db.vacations?.[uname]||{})[today];
      if(type&&type!=='wfh')depts[dept].away++;
    }
    const top=Object.entries(depts).filter(([,v])=>v.total>0)
      .map(([k,v])=>({dept:k,pct:Math.round(v.away/v.total*100),away:v.away,total:v.total}))
      .sort((a,b)=>b.pct-a.pct).slice(0,3)
      .map(d=>`• ${d.dept}: ${d.away}/${d.total} נעדרים (${d.pct}%)`).join('\n');
    return top?`מחלקות עם הנעדרים הגבוהים היום:\n${top}`:'אין נתוני מחלקות.';
  }

  function respondHeadcount(db) {
    const active=Object.values(db.users||{}).filter(u=>u.status!=='pending');
    const t=getStatsForDate(db,dateToKey(new Date()));
    return `**${active.length} עובדים פעילים** ב-${(db.departments||[]).length} מחלקות.\nהיום: ${t.office.length} במשרד | ${t.wfh.length} מהבית | ${t.vacation.length} חופשה | ${t.sick.length} מחלה`;
  }

  function respondWelfareScore(db) {
    const scores=Object.entries(db.users||{}).filter(([,u])=>u.role!=='admin'&&u.status!=='pending')
      .map(([uname,user])=>{
        const cb=calcBalanceAI(uname,new Date().getFullYear(),db);
        const score=cb?.annual>0?Math.min(100,Math.round((cb.used/(cb.accrued||1))*100)):0;
        return {name:user.fullName,score,used:cb?.used?.toFixed(1)||0};
      }).sort((a,b)=>a.score-b.score);
    const avg=scores.length?Math.round(scores.reduce((s,x)=>s+x.score,0)/scores.length):0;
    return `ציון רווחה ממוצע: **${avg}/100**\nזקוקים לתשומת לב:\n${scores.slice(0,3).map(s=>`• ${s.name}: ${s.score}/100 (ניצל ${s.used} ימים)`).join('\n')}`;
  }

  function respondShortage(db) {
    const now=new Date();
    const weeks=Array.from({length:8},(_,w)=>{
      const s=new Date(now); s.setDate(now.getDate()+w*7);
      const e=new Date(s); e.setDate(s.getDate()+6);
      let away=0;
      for (const uname of Object.keys(db.users||{})) {
        for (let d=new Date(s);d<=e;d.setDate(d.getDate()+1)) {
          const t=(db.vacations?.[uname]||{})[dateToKey(d)];
          if(t==='full'||t==='half'||t==='sick'){away++;break;}
        }
      }
      return {label:`${s.getDate()}/${s.getMonth()+1}–${e.getDate()}/${e.getMonth()+1}`,away};
    });
    const max=weeks.reduce((a,b)=>a.away>b.away?a:b);
    return `חיזוי נוכחות 8 שבועות:\n${weeks.map((w,i)=>`• שבוע ${i+1} (${w.label}): ${w.away} נעדרים`).join('\n')}\n⚠️ עומס שיא: **${max.label}** — ${max.away} נעדרים`;
  }

  function respondHandovers(db, currentUser) {
    const today=dateToKey(new Date());
    const isAdmin=hasAdminAccess(currentUser);
    const list=Object.values(db.handovers||{})
      .filter(h=>(isAdmin||h.managerUsername===currentUser.username||currentUser.role==='manager')&&h.date>=today)
      .sort((a,b)=>a.date.localeCompare(b.date));
    if(!list.length)return 'אין פרוטוקולי העברת מקל ממתינים.';
    return list.map(h=>{
      const d=new Date(h.date+'T00:00:00');
      return `• **${h.fullName}** (${d.getDate()}/${d.getMonth()+1}): ${h.tasks.join(' | ')}`;
    }).join('\n');
  }

  function respondHolidays(year) {
    const HOL=typeof HOLIDAYS!=='undefined'?HOLIDAYS:{};
    const now=new Date();
    const upcoming=Object.entries(HOL)
      .filter(([k])=>k.startsWith(String(year)))
      .map(([k,h])=>({...h,date:new Date(k+'T00:00:00'),key:k}))
      .filter(h=>h.date>=now).sort((a,b)=>a.key.localeCompare(b.key)).slice(0,6);
    if(!upcoming.length)return `לא נמצאו חגים עתידיים לשנת ${year}.`;
    return `חגים קרובים ${year}:\n${upcoming.map(h=>`• ${h.n} — ${h.date.getDate()}/${h.date.getMonth()+1}${h.blocked?' (יום חג)':''}`).join('\n')}`;
  }

  function respondAuditLog(db) {
    const logs=(db.auditLog||[]).slice(0,10); if(!logs.length)return 'יומן הפעולות ריק.';
    return '10 פעולות אחרונות:\n'+logs.map(l=>{
      const d=new Date(l.ts);
      return `• ${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')} — ${l.user}: ${l.details||l.action}`;
    }).join('\n');
  }

  // ============================================================
  // FAQ — SYSTEM KNOWLEDGE BASE
  // ============================================================
  function respondFAQ(intent, currentUser, db) {
    const isAdmin   = hasAdminAccess(currentUser);
    const isManager = hasManagerAccess(currentUser);
    const settings  = db.settings || {};
    const companyName = settings.companyName || 'החברה שלי';

    switch (intent) {

      case 'faq_company_name':
        return `אתה עובד בחברת **${companyName}**.`;

      case 'faq_version':
        return `המערכת היא **Dazura** — מערכת ניהול חופשות ונוכחות.\nגרסה: **v3.0** | עדכון אחרון: **מרץ 2026**.`;

      case 'faq_send_message':
        if (!isManager) return 'שליחת הודעות לעובדים זמינה למנהלים ואדמין בלבד.';
        return `**איך לשלוח הודעה לכלל העובדים:**\n1. בחן/י את **לוח הבחירה** (המסך הראשי לאחר הכניסה)\n2. לחץ/י על הכרטיס **"שלח הודעה"** (הכרטיס הכחול בשורת הסטטיסטיקות)\n3. כתוב/י את תוכן ההודעה בשדה הטקסט\n4. לחץ/י **"שלח"** — ההודעה תופיע לכל העובדים בכניסה הבאה שלהם`;

      case 'faq_time_who':
        return `**שעות העבודה היומיות מדווחות על ידי העובד עצמו** דרך לשונית **"שעון נוכחות"**.\n\nמי רואה את הנתונים:\n• **העובד** — רואה את הדיווחים שלו בלבד\n• **מנהל מחלקה** — רואה את דיווחי הצוות שלו בלשונית "לוח מנהל"\n• **אדמין / חשבות** — רואה את כל הדיווחים ויכול לייצא לאקסל`;

      case 'faq_time_fix':
        return `**תיקון שעות שגויות:**\n1. עבור/י ללשונית **"שעון נוכחות"** (בתפריט התחתון)\n2. שנה/י את **התאריך** לתאריך שבו הייתה הטעות\n3. עדכן/י את שעת **הכניסה** ו/או **היציאה** לערכים הנכונים\n4. ניתן להוסיף **הערה** להסבר השינוי\n5. לחץ/י **"שמור"** — הדיווח יתעדכן מיד\n\n📌 ניתן לתקן כל תאריך — גם ימים קודמים.`;

      case 'faq_reports_who':
        return `**מי מורשה להוציא דוחות:**\n• **אדמין** — כל הדוחות: שכר, חודשי, גיבוי מלא\n• **חשבות** — דוח שכר וייצוא נוכחות\n• **מנהל מחלקה** — דוח חודשי ויתרות הצוות שלו\n• **עובד** — יכול לייצא את הנתונים האישיים שלו בלבד\n\nהדוחות נמצאים בלשונית **"ניהול"** → קטע סקירת יתרות, ובלשונית **"לוח מנהל"**.`;

      case 'faq_how_vacation': {
        return `**איך מגישים בקשת חופשה:**\n1. פתח/י את **לוח השנה** (לשונית "לוח שנה" בתחתית)\n2. לחץ/י על **היום הרצוי** — ייפתח חלון בחירה\n3. בחר/י את סוג הדיווח: **יום חופש מלא / חצי יום / WFH / מחלה**\n4. לחץ/י **"שמור"**\n5. אם המערכת מוגדרת לדרוש אישור — הבקשה תישלח למנהל ותסומן **⏳ ממתין לאישור**`;
      }

      case 'faq_half_day':
        return `**יום מלא לעומת חצי יום:**\n• **יום מלא** — נספר כ-1 יום חופש מהיתרה\n• **חצי יום** — נספר כ-0.5 יום חופש מהיתרה\n\nלבחירה: בלוח השנה לחץ/י על התאריך → בחר/י **"חצי יום"** בחלון שנפתח.`;

      case 'faq_holiday_pay':
        return `**חגים ותשלום:**\n• **יום חג רשמי** (מסומן בלוח כ"יום חג") — **לא נחשב ליום חופש** מהיתרה. אינו מנוכה מהמכסה.\n• **ערב חג** — בהתאם להגדרות החברה: אם מוגדר כ"חצי יום" — ינוכה 0.5 יום אם ביקשת חופש. אם לא עבדת ביום רגיל — אינו מנוכה.\n\nלצפייה בחגים הקרובים — שאל אותי: "מה החגים הקרובים?"`;

      case 'faq_fix_request':
        return `**תיקון בקשה שנשלחה:**\n• אם הבקשה עדיין **ממתינה לאישור** — ניתן לבטל אותה דרך לוח השנה: לחץ/י על אותו יום → בחר/י **"הסר דיווח"** → שלח/י מחדש עם הבחירה הנכונה.\n• אם הבקשה **אושרה כבר** — פנה/י למנהל או לאדמין לביטול ידני.\n\n📌 שינוי ימים שאושרו מתעד את הפעולה ב-Audit Log.`;

      case 'faq_usage_by_month': {
        const year = new Date().getFullYear();
        const vacs = db.vacations?.[currentUser.username] || {};
        const byMonth = {};
        for (const [dt, type] of Object.entries(vacs)) {
          if (!dt.startsWith(String(year))) continue;
          const m = parseInt(dt.split('-')[1]);
          if (!byMonth[m]) byMonth[m] = 0;
          byMonth[m] += type==='full'?1:type==='half'?0.5:0;
        }
        const used = Object.entries(byMonth).sort((a,b)=>a[0]-b[0]);
        if (!used.length) return `לא נמצאו ימי חופשה בשנת ${year}.`;
        const total = used.reduce((s,[,v])=>s+v,0);
        return `ניצול חופשה לפי חודשים (${year}):\n${used.map(([m,d])=>`• ${MONTH_NAMES[parseInt(m)]}: ${d} ימים`).join('\n')}\n\nסה"כ: **${total} ימים**`;
      }

      case 'faq_upcoming_vacation': {
        const today = dateToKey(new Date());
        const vacs = db.vacations?.[currentUser.username] || {};
        const upcoming = Object.entries(vacs)
          .filter(([dt,t])=>dt>=today&&(t==='full'||t==='half'))
          .sort((a,b)=>a[0].localeCompare(b[0])).slice(0,8);
        if (!upcoming.length) return 'אין חופשות מתוכננות בקרוב.';
        return `חופשות קרובות שלך:\n${upcoming.map(([dt,t])=>`• ${formatDateHeb(new Date(dt+'T00:00:00'))}: ${TYPE_LABEL[t]}`).join('\n')}`;
      }

      case 'faq_recommended_days': {
        const year = new Date().getFullYear();
        const cb = calcBalanceAI(currentUser.username, year, db);
        if (!cb) return 'לא נמצאו נתוני מכסה.';
        const rem = 12 - new Date().getMonth();
        const perMonth = cb.balance > 0 ? (cb.balance / Math.max(rem,1)).toFixed(1) : 0;
        return `**המלצות ניצול חופש — ${currentUser.fullName}:**\n• יתרה נוכחית: **${cb.balance.toFixed(1)} ימים**\n• חודשים שנותרו בשנה: ${rem}\n• **מומלץ לתכנן: ${perMonth} ימים לחודש**\n\nתקופות מומלצות לחופשה:\n• ימים לפני חגים (פסח, ראש השנה)\n• סוף שבוע ארוך (מחבר יום חג + שישי)\n• ימי "גשר" בין יום חג לסוף שבוע`;
      }

      case 'faq_pending_check':
        if (!isManager) return `בקשות ממתינות לאישור נמצאות בלשונית **"לוח מנהל"** — פעולה זו מוגבלת למנהלים.`;
        return `**איך לבדוק בקשות ממתינות:**\n• עבור/י ללשונית **"לוח מנהל"**\n• קטע **"בקשות ממתינות לאישור"** מציג את כל הבקשות הפתוחות\n• לחץ/י ✅ לאישור או ❌ לדחייה\n• ניתן לראות גם בדשבורד ה-CEO אם רלוונטי`;

      case 'faq_team_upcoming': {
        if (!isManager) {
          const dept = Array.isArray(currentUser.dept)?currentUser.dept[0]:currentUser.dept;
          const today = dateToKey(new Date());
          const teamVacs = [];
          Object.values(db.users||{}).forEach(u => {
            const d = Array.isArray(u.dept)?u.dept[0]:u.dept;
            if (d!==dept) return;
            const vacs = db.vacations?.[u.username]||{};
            Object.entries(vacs).filter(([dt,t])=>dt>=today&&(t==='full'||t==='half'))
              .slice(0,2).forEach(([dt,t])=>teamVacs.push({name:u.fullName,dt,t}));
          });
          teamVacs.sort((a,b)=>a.dt.localeCompare(b.dt));
          return teamVacs.length ? `חופשות קרובות במחלקה (${dept}):\n${teamVacs.slice(0,8).map(v=>`• ${v.name}: ${formatDateHeb(new Date(v.dt+'T00:00:00'))} — ${TYPE_LABEL[v.t]}`).join('\n')}` : 'אין חופשות מתוכננות בצוות בקרוב.';
        }
        return respondShortage(db);
      }

      case 'faq_all_upcoming': {
        if (!isAdmin) return 'מידע על חופשות כלל העובדים זמין לאדמין בלבד.';
        const today = dateToKey(new Date());
        const allVacs = [];
        Object.entries(db.users||{}).forEach(([uname,user])=>{
          const vacs = db.vacations?.[uname]||{};
          Object.entries(vacs).filter(([dt,t])=>dt>=today&&(t==='full'||t==='half'))
            .slice(0,2).forEach(([dt,t])=>allVacs.push({name:user.fullName,dt,t}));
        });
        allVacs.sort((a,b)=>a.dt.localeCompare(b.dt));
        return allVacs.length ? `חופשות קרובות בחברה (הקרובות ביותר):\n${allVacs.slice(0,12).map(v=>`• ${v.name}: ${v.dt}`).join('\n')}` : 'אין חופשות מתוכננות קרוב.';
      }

      case 'faq_team_balance': {
        if (!isManager) return 'סקירת יתרות צוות זמינה ללשונית "לוח מנהל" עבור מנהלים.';
        const year = new Date().getFullYear();
        const dept = Array.isArray(currentUser.dept)?currentUser.dept[0]:currentUser.dept;
        const team = Object.values(db.users||{}).filter(u=>{
          const d=Array.isArray(u.dept)?u.dept[0]:u.dept;
          return (isAdmin||d===dept)&&u.status!=='pending';
        }).slice(0,10);
        if (!team.length) return 'לא נמצאו עובדים לסקירה.';
        const rows = team.map(u=>{
          const cb=calcBalanceAI(u.username,year,db);
          return `• ${u.fullName}: יתרה **${cb?cb.balance.toFixed(1):'?'}** ימים`;
        }).join('\n');
        return `סקירת יתרות צוות — ${year}:\n${rows}`;
      }

      case 'faq_shortage':
        if (!isManager) return 'תחזית מחסור זמינה למנהלים בלבד.';
        return respondShortage(db);

      case 'faq_welfare':
        if (!isManager) return 'ציוני עובדים זמינים למנהלים בלבד.';
        return respondWelfareScore(db);

      case 'faq_who_dept':
        return `**מי מגדיר מחלקות:**\nרק **אדמין** יכול ליצור, לשנות ולמחוק מחלקות.\nנמצא בלשונית **"ניהול"** → קטע **"הגדרות חברה"** → שדה "מחלקות".`;

      case 'faq_who_manager':
        return `**מי ממנה מנהל מחלקה:**\nרק **אדמין** יכול לשייך מנהל למחלקה.\nנמצא בלשונית **"ניהול"** → קטע **"הגדרות חברה"** → בחר מחלקה → הגדר מנהל.`;

      case 'faq_change_password':
        return `**איך משנים סיסמה:**\n1. לחץ/י על **שם המשתמש** (בפינה השמאלית של הכותרת)\n2. בחר/י **"עריכת פרופיל"**\n3. לחץ/י **"שנה סיסמה"** — תתבקש/י להזין סיסמה נוכחית וחדשה\n\nאם שכחת את הסיסמה — לחץ/י **"שכחתי סיסמה"** במסך הכניסה.`;

      case 'faq_update_birthday':
        return `**איך מעדכנים תאריך לידה:**\n1. לחץ/י על **שם המשתמש** → **"עריכת פרופיל"**\n2. עדכן/י את שדה **"תאריך לידה"**\n3. לחץ/י **"שמור"**\n\n📌 שנת הלידה לא מוצגת לאחרים — מוצגים יום וחודש בלבד לברכות.`;

      case 'faq_update_email':
        return `**איך מעדכנים כתובת מייל:**\n1. לחץ/י על **שם המשתמש** → **"עריכת פרופיל"**\n2. עדכן/י את שדה **"מייל"**\n3. לחץ/י **"שמור"**\n\nהמייל משמש לשחזור סיסמה ולקבלת התראות.`;

      case 'faq_who_logs':
        return `**מי רשאי לצפות בלוגים (Audit Log):**\nרק **אדמין** רואה את יומן הפעולות המלא.\nנמצא בלשונית **"ניהול"** → קטע **"יומן שינויים (Audit Log)"**.`;

      case 'faq_who_reset':
        return `**מי מורשה לאפס נתונים:**\nרק **אדמין** יכול לאפס נתונים מקומיים.\nנמצא בלשונית **"ניהול"** → קטע **"כלי מנהל"** → כפתור "אפס נתונים מקומיים".\n\n⚠️ פעולה זו בלתי הפיכה — מומלץ לגבות לפני!`;

      case 'faq_who_backup':
        return `**מי יכול לגבות נתונים:**\nרק **אדמין** יכול לייצא גיבוי מלא.\nנמצא בלשונית **"ניהול"** → כפתור **"ייצא גיבוי"** — מוריד קובץ JSON עם כל הנתונים.`;

      case 'faq_who_quota':
      case 'faq_dept_map':
        return `**מי טוען מכסות שנתיות:**\nרק **אדמין** יכול לטעון ולעדכן מכסות.\nשתי דרכים:\n• **ידנית** — לשונית "ניהול" → רשימת עובדים → עריכת עובד → שדה "מכסה"\n• **מאקסל** — לשונית "ניהול" → "טען מכסות מאקסל" — מאפשר עדכון מרוכז של כולם`;

      case 'faq_quota_format':
        return `**פורמט קובץ מכסות (Excel/CSV):**\nהקובץ חייב לכלול את העמודות הבאות:\n• **שם משתמש** — זהה לשם הכניסה במערכת\n• **מכסה שנתית** — מספר ימי החופש לשנה\n• **יתרת פתיחה** — ימי חופש שנצברו מהשנה הקודמת (אופציונלי)\n• **תאריך יתרה** — תאריך שממנו מתחיל החישוב (אופציונלי)\n\nשורה ראשונה = כותרות, מהשורה השנייה — נתוני עובדים.`;

      case 'faq_who_permissions':
        return `**מי מנהל הרשאות:**\nרק **אדמין** יכול להגדיר הרשאות מיוחדות לעובדים.\nנמצא בלשונית **"ניהול"** → קטע **"הרשאות עובדים"** — ניתן להעניק לעובד גישה לסקציות ספציפיות.`;

      case 'faq_who_logo':
        return `**מי יכול להחליף לוגו חברה:**\nרק **אדמין** יכול להעלות/לשנות את לוגו החברה.\nנמצא בלשונית **"ניהול"** → קטע **"הגדרות חברה"** → **"לוגו החברה"** → לחץ להעלאה.`;

      case 'faq_firebase':
        return `**חיבור/ניתוק Firebase:**\nרק **אדמין** יכול לנהל את חיבור Firebase.\n• **חיבור** — לחץ/י על **כפתור Firebase** (בפינה השמאלית של הכותרת) → הזן/י את פרטי ה-Project\n• **ניתוק** — אותו כפתור → **"נתק"**\n\nFirebase מאפשר סנכרון נתונים בין מכשירים ומשתמשים בזמן אמת.`;

      // ── Tab guides ─────────────────────────────────────────
      case 'faq_tab_dashboard':
        return `**📊 לשונית סקירה — מה רואים כאן:**\n• **יתרת חופשה** נוכחית + תחזית לסוף שנה\n• **ניצול לפי חודשים** — גרף עמודות\n• **חופשות קרובות** שלך\n• **תחזית DNA** — המלצות ניצול אישיות\n• כרטיס **חיזוי AI** — עומסים בשבועות הבאים\n\nאני יכול לתת את כל הנתונים האלה בשיחה — שאל אותי!`;

      case 'faq_tab_calendar':
        return `**📅 לשונית לוח חופשות — איך עובד:**\n1. רואים לוח חודשי עם כל הדיווחים\n2. **לוחצים על יום** שרוצים לדווח\n3. נפתח חלון → בוחרים:\n   • 🏖️ יום חופש מלא\n   • 🌅 חצי יום חופש\n   • 🏠 עבודה מהבית (WFH)\n   • 🤒 יום מחלה\n4. לוחצים **"שמור"**\n5. אם נדרש אישור — הבקשה נשלחת למנהל אוטומטית\n\nלהסרת דיווח: לחץ שוב על אותו יום → **"הסר"**`;

      case 'faq_tab_yearly':
        return `**🗓️ תצוגה שנתית — מה זה:**\n• מציגה את **כל שנת ${new Date().getFullYear()}** בלוח אחד\n• צבעים לפי סוג הדיווח: חופשה / WFH / מחלה\n• שימושי לתכנון חופשות ארוכות טווח\n• ניתן לנווט לשנים קודמות/עתידיות`;

      case 'faq_tab_report':
        return `**📄 דוח אישי — מה אפשר לעשות:**\n• צפייה בכל הדיווחים שלך לפי חודש/שנה\n• **ייצוא לאקסל / CSV** — לחץ "ייצא דוח"\n• מציג: חופשות, WFH, מחלות, שעות עבודה\n• ניתן להגדיר טווח תאריכים\n\nאני יכול לתת סיכום ישירות בשיחה — נסה: "מה הניצול שלי לפי חודשים?"`;

      case 'faq_tab_manager':
        return `**📊 לוח מנהל — מה יש בו:**\n• **📋 פרוטוקולי העברת מקל** — עובדים שיוצאים לחופשה מחר\n• **🤖 חיזוי AI** — עומסי חופשה צפויים\n• **📅 היום בחברה** — מי כאן / חופשה / מחלה / WFH\n• **⏳ בקשות ממתינות לאישור** — אישור/דחייה עם לחיצה\n• **🗓️ חופשות קרובות** — כל הצוות\n• **⚠️ התנגשויות** — כפל חופשות באותה מחלקה\n• **📊 סקירת יתרות** — יתרה של כל עובד בצוות\n\nכל הנתונים האלה זמינים גם בשיחה — שאל אותי!`;

      case 'faq_tab_admin':
        return `**⚙️ לשונית ניהול — מה יש בה (אדמין בלבד):**\n• **📋 יומן שינויים (Audit Log)** — כל פעולה במערכת\n• **🏢 הגדרות חברה** — שם, לוגו, מחלקות, מנהלים, מחזור תשלום\n• **⏱️ ייצוא דיווחי שעות** — לאקסל לפי טווח\n• **👥 הרשמות ממתינות** — אישור משתמשים חדשים\n• **🔐 שינוי סיסמת ADMIN**\n• **⚠️ איפוס נתונים** — מחיקה מקומית\n• **🏢 ניהול מחלקות ומנהלים**\n• **📥 טעינת מכסות שנתיות** — מאקסל\n• **👥 רשימת עובדים** — הוספה/עריכה/מחיקה\n• **📋 כל בקשות החופשה** — סקירה מלאה\n• **🔒 ניהול הרשאות גישה**`;

      case 'faq_tab_timeclock':
        return `**⏱️ שעון נוכחות — איך משתמשים:**\n1. בוחרים **תאריך** (ברירת מחדל: היום)\n2. מזינים **שעת כניסה** (פורמט HH:MM)\n3. מזינים **שעת יציאה**\n4. ניתן להוסיף **הערה** (למשל: "יצאתי מוקדם — פגישה")\n5. לוחצים **"שמור"**\n\n📌 ניתן לדווח ולתקן כל תאריך קודם\n📌 יציאה אחרי חצות מחושבת נכון (משמרת לילה)\n\nלתיקון: פשוט בחר אותו תאריך → עדכן השעות → שמור מחדש`;

      // ── Employee CRUD ─────────────────────────────────────
      case 'faq_how_add_employee':
        if (!isAdmin) return 'הוספת עובדים מוגבלת לאדמין בלבד.';
        return `**איך מוסיפים עובד חדש:**\n1. עבור/י ללשונית **"ניהול"**\n2. גלול/י לקטע **"רשימת עובדים"**\n3. לחץ/י כפתור **"+ הוסף עובד"**\n4. מלא/י פרטים: שם מלא, שם משתמש, סיסמה, מחלקה, תפקיד\n5. לחץ/י **"שמור"**\n\n📌 לאחר הוספה — יש להגדיר **מכסת חופשה שנתית** לעובד בשדה המכסה.`;

      case 'faq_how_edit_employee':
        if (!isAdmin) return 'עריכת פרטי עובדים מוגבלת לאדמין בלבד.';
        return `**איך עורכים פרטי עובד:**\n1. לשונית **"ניהול"** → **"רשימת עובדים"**\n2. מצא/י את העובד ברשימה\n3. לחץ/י כפתור **✏️ עריכה** מימין לשם העובד\n4. ערוך/י את הפרטים הדרושים\n5. לחץ/י **"שמור"**\n\nניתן לעדכן: שם, מחלקה, תפקיד, מייל, תאריך לידה, מכסת חופשה, שכר יומי.`;

      case 'faq_how_delete_employee':
        if (!isAdmin) return 'מחיקת עובדים מוגבלת לאדמין בלבד.';
        return `**איך מוחקים עובד:**\n1. לשונית **"ניהול"** → **"רשימת עובדים"**\n2. מצא/י את העובד ברשימה\n3. לחץ/י כפתור **🗑️ מחיקה** מימין לשורה\n4. אשר/י בחלון האישור\n\n⚠️ מחיקת עובד תסיר גם את **כל היסטוריית החופשות** שלו. לחלופין — ניתן לסמן עובד כ"לא פעיל" במקום למחוק.`;

      case 'faq_how_export_report':
        return `**איך מייצאים דוח:**\n• **דוח אישי** — לשונית "דוח אישי" → לחץ "ייצא לאקסל"\n• **דוח שכר** — לשונית "ניהול" → "ייצוא דיווחי שעות" (אדמין/חשבות)\n• **דוח חודשי** — לשונית "לוח מנהל" → "ייצא דוח חודשי" (מנהל+)\n• **גיבוי מלא** — לשונית "ניהול" → כפתור "ייצא גיבוי" (אדמין)\n\nכל הדוחות מיוצאים בפורמט CSV/Excel התומך בעברית.`;

      case 'faq_how_approve':
        if (!isManager) return 'אישור בקשות חופשה מוגבל למנהלים בלבד.';
        return `**איך מאשרים בקשת חופשה:**\n1. עבור/י ללשונית **"לוח מנהל"**\n2. גלול/י לקטע **"בקשות ממתינות לאישור"**\n3. לחץ/י ✅ **"אשר"** לאישור הבקשה\n4. העובד יקבל עדכון בכניסה הבאה\n\n📌 ניתן לאשר/לדחות מספר בקשות ברצף.`;

      case 'faq_how_reject':
        if (!isManager) return 'דחיית בקשות חופשה מוגבלת למנהלים בלבד.';
        return `**איך דוחים בקשת חופשה:**\n1. לשונית **"לוח מנהל"** → **"בקשות ממתינות"**\n2. לחץ/י ❌ **"דחה"** על הבקשה הרצויה\n3. ייפתח שדה **סיבת הדחייה** — מומלץ למלא\n4. לחץ/י **"שלח"** — העובד רואה את הסיבה\n\n📌 עובד שנדחה יכול לשלוח בקשה מחדש בתאריכים אחרים.`;

      default:
        return null;
    }
  }

  // ============================================================
  // ============================================================
  // MOTI TECHNICAL FAQ RESPONSES
  // ============================================================
  function respondTechFAQ(intent, user) {
    const n = user.fullName.split(' ')[0];
    const isAdmin = hasAdminAccess(user);
    const isManager = hasManagerAccess(user);

    const FAQ = {
      faq_tech_formats:     `**פורמטים לייצוא דוחות:**
• **CSV** — לאקסל / Google Sheets (כל הדוחות)
• **JSON** — גיבוי מלא של כל המערכת
• **Excel (.xlsx)** — יתרות, שעות, שכר

רוצה דוגמה לייצוא דוח חופשות חודשי?`,
      faq_tech_calc:        `**חישוב יתרת חופשה:**
מכסה שנתית ÷ 12 = צבירה חודשית (ברירת מחדל: 1.67 ימים/חודש)
+ יתרת פתיחה משנה קודמת
− ימי חופשה שנוצלו עד היום
= יתרה נוכחית

הכל לפי תאריך תחילת מחזור (1 או 21 לחודש). רוצה פירוט על עצמך?`,
      faq_tech_gcal:        `**אינטגרציה עם Google Calendar / Outlook:**
עדיין לא ישירה, אבל:
1. ייצא CSV/JSON מהלשונית "דוח אישי"
2. ייבא ל-Google Calendar: הגדרות → ייבוא
3. או ל-Outlook: קובץ → פתח וייצוא → ייבא/ייצא

רוצה הנחיות מפורטות לייבוא?`,
      faq_tech_forecast:    `**איך עובד חיזוי העומס:**
אלגוריתם סטטיסטי פשוט:
• סופר בקשות מאושרות + ממתינות לכל תאריך
• מחשב ממוצע היסטורי לפי מחלקה/חודש
• מציג אחוז זמינות צפוי

דיוק ~85% בנתונים אמיתיים. ככל שיש יותר היסטוריה — החיזוי טוב יותר.`,
      faq_tech_security:    `**אבטחת הנתונים:**
• Firebase Authentication — כניסה מאובטחת
• הצפנה מלאה In-Transit (HTTPS) ו-At-Rest
• סיסמאות מ-Hash — לא נשמרות בטקסט פשוט
• שחזור דרך אימייל Google בלבד
• כל עובד רואה **רק את הנתונים שלו**
• ADMIN בלבד רואה הכל`,
      faq_tech_excel_import:`**ייבוא עובדים מאקסל:**
4 עמודות חובה:
• **שם פרטי** + **שם משפחה**
• **מכסה שנתית** (מספר ימים)
• **יתרת פתיחה** (ימים מהשנה הקודמת)

שורה ראשונה = כותרות. אחרי ייבוא — המערכת יוצרת סיסמאות זמניות אוטומטית.`,
      faq_tech_delete_emp:  `**מחיקת עובד — מה קורה:**
נמחקים לצמיתות:
• פרטי העובד
• כל היסטוריית החופשות שלו
• כל דיווחי השעות שלו
• כל בקשות האישור שלו

⚠️ יש אזהרה כפולה + אפשרות לגיבוי JSON לפני. לחלופין — ניתן לסמן "לא פעיל" במקום למחוק.`,
      faq_tech_audit:       isAdmin ? `**Audit Log — יומן שינויים:**
מתעד כל פעולה: מי שינה מה ומתי.
נמצא בלשונית "ניהול" → "יומן שינויים".
ניתן לסנן לפי תאריך / משתמש / סוג פעולה.
ניתן למחוק ידנית (ADMIN בלבד). רוצה לראות הלוג של השבוע האחרון?` : `יומן השינויים (Audit Log) זמין ל-ADMIN בלבד.`,
      faq_tech_cycle:       `**שינוי תאריך מחזור שכר:**
בלשונית "ניהול" → "הגדרות חברה" → "תאריך תחילת חודש"
אפשרויות: **1** לחודש (1–30) או **21** לחודש (21–20 הבא)

⚠️ שינוי חל על כל החברה + משפיע על חישובי תשלום קיימים. מומלץ לשנות רק בתחילת שנה.`,
      faq_tech_vac_types:   `**סוגי חופשה זמינים כרגע:**
• 🏖️ חופשה מלאה (1 יום)
• 🌅 חצי יום (0.5 יום)
• 🏠 עבודה מהבית (WFH)
• 🤒 יום מחלה
• 🎉 ערב חג / יום חג (לא מנכה מהמכסה)

בהמשך ניתן יהיה להוסיף custom types דרך הקוד (open-source).`,
      faq_tech_heatmap:     `**איך עובדת מפת החום:**
סופרת ימי חופשה לכל תאריך → צובעת בגוונים:
• 🟢 ירוק — עומס נמוך (עד 20% חופשות)
• 🟡 צהוב — עומס בינוני (20–40%)
• 🔴 אדום — עומס גבוה (40%+)

כולל גם בקשות ממתינות (לא רק מאושרות).`,
      faq_tech_api:         `**API חיצוני:**
עדיין לא ציבורי, אבל:
• כל הבסיס הוא Firebase — ניתן לבנות webhook בקלות
• ניתן לגשת ל-Firestore ישירות דרך Firebase SDK
• אפשר לבנות API פרטי עם Firebase Cloud Functions

מעוניין בהרחבה? צור קשר עם מוטי קריחלי 😄`,
      faq_tech_payroll:     `**ייצוא לשכר:**
יוצר CSV עם:
• שם עובד + מחלקה
• ימי חופשה מלאים + חצאים בחודש
• סה"כ לתשלום (ממוצע לפי מחזור 1–20 / 21–סוף)

נמצא בלשונית "ניהול" → "ייצוא דיווחי שעות". מותאם ל-Excel/Google Sheets.`,
      faq_tech_cloud:       `**היכן נשמרים הנתונים:**
• **Firebase Firestore** (ענן Google) — בזמן אמת
• **localStorage** — גיבוי מקומי בדפדפן
• גיבוי ידני ל-JSON זמין בכל רגע

אין גיבוי אוטומטי יומי (עדיין) — ממליץ לגבות פעם בשבוע.`,
      faq_tech_permissions2:`**הרשאות סלקטיביות:**
"ניהול" → "ניהול הרשאות גישה" → לחץ על עובד
ניתן לסמן ✓ לכל קטגוריה:
• ראיית בקשות / אישור בקשות
• צפייה בדוחות / ייצוא
• גישה לסקירת יתרות
• גישה ללוח המנהל

כל עובד רואה רק מה שמותר לו.`,
      faq_tech_no_report:   `**עובד שלא דיווח שעות:**
• הדיווח נשאר ריק — מסומן "חסר" בדשבורד
• אפשר להפעיל התראה אוטומטית (הגדרות → התראות → "חוסר דיווח")
• המנהל רואה מי לא דיווח בלוח המנהל
• ניתן לדווח רטרואקטיבית לכל תאריך קודם`,
      faq_tech_overtime:    `**חישוב שעות נוספות:**
כרגע — **דיווח ידני בלבד** (שעת כניסה/יציאה).
אני מחשב אוטומטית:
• סה"כ שעות = יציאה − כניסה
• אם מעל X שעות → מסומן בצבע אזהרה

חישוב עלות: אפשר לייצא CSV עם שכר יומי × ×1.5. רוצה לנסות?`,
      faq_tech_splash:      `**Splash Screen מותאם:**
"ניהול" → "הגדרות חברה" → "לוגו החברה"
תומך: PNG / JPG / SVG / Base64
גודל מומלץ: **1200×400 פיקסל**
מופיע בכניסה + בכותרת הממשק.`,
      faq_tech_reset:       isAdmin ? `**איפוס מלא — מה נמחק:**
• כל העובדים
• כל החופשות והדיווחים
• כל יתרות החופשה
• הגדרות החברה

⚠️ יש אזהרה כפולה + דורש אישור ADMIN. **בלתי הפיך** — גיבוי חובה לפני!` : `איפוס נתונים מוגבל ל-ADMIN בלבד.`,
      faq_tech_yearly_hol:  `**תצוגה שנתית וחגים:**
כן — חגים מסומנים:
• 🔴 אדום — חג מלא (לא מנכה מהמכסה)
• 🟠 כתום — ערב חג (חצי יום)

ניתן לערוך ידנית בתצוגה השנתית. רוצה שאכין לך רשימת חגים ישראליים 2026?`,
      faq_tech_cross_month: `**חופשה בין חודשים — חישוב:**
לפי מחזור תשלום:
• מחזור 1–20: ימים ב-1–20 משולמים **בחודש הנוכחי**, ימים מ-21+ בבא
• מחזור 21–סוף: ימים ב-21–סוף משולמים **בחודש הנוכחי**, ימים מ-1+ בבא

מוצג אוטומטית בדוח השכר.`,
      faq_tech_pwa:         `**גרסת מובייל (PWA):**
כן! המערכת היא **Progressive Web App**.
התקנה על טלפון:
• Chrome/Safari → "הוסף למסך הבית"
• מופיעה כאפליקציה עם אייקון
• עובדת גם offline (נתונים מקומיים)`,
      faq_tech_whatsapp:    `**WhatsApp:**
אין אינטגרציה ישירה עדיין, אבל:
• אני יכול לייצר לך **טקסט מוכן** לשליחה (תזכורת, אישור, דחייה)
• ניתן להעתיק ולשלוח ב-WhatsApp ידנית

רוצה דוגמה לטקסט תזכורת?`,
      faq_tech_low_balance: `**התראה על יתרה נמוכה:**
"ניהול" → "הגדרות חברה" → "התראות" → "יתרת חופשה נמוכה"
• הגדר threshold (למשל: 4 ימים)
• בחר נמענים: עובד בלבד / מנהל בלבד / שניהם
• ההתראה נשלחת אוטומטית בעדכון היתרה הבא`,
      faq_tech_overlap:     `**שני עובדים באותו תאריך:**
• מוצג **עומס** + צבע אזהרה במפת החום
• **אין חסימה אוטומטית** — החלטה של המנהל
• בלוח המנהל יש קטע "התנגשויות" שמציג חפיפות

רוצה שאפעיל כלל: "לא לאשר יותר מ-X חופשות מקבילות"?`,
      faq_tech_anon:        `**פרטיות בסטטיסטיקות:**
• ממוצעים / מפת חום / חיזוי עומס — **לא חושפים שמות** לעובד רגיל
• ADMIN ומנהל מחלקה — **רואים שמות** ברמת הצוות שלהם
• עובד רגיל רואה רק את **הנתונים שלו עצמו**`,
      faq_tech_backup:      `**גיבוי המערכת:**
1. לשונית "ניהול"
2. לחץ כפתור **"ייצא גיבוי"**
3. מוריד קובץ **JSON מלא** עם כל הנתונים

שמור במקום בטוח (Google Drive / Dropbox). ממליץ לגבות **פעם בשבוע**.`,
      faq_tech_opensource:  `**קוד פתוח / הרחבה:**
כן! הכל ב-GitHub: **krimoti/MOTI**
• Firebase + Firestore + Auth
• JavaScript ו-HTML/CSS
• אפשר לפתח, להוסיף features, לעשות fork

מוטי קריחלי  בנה אותו — תרגיש/י חופשי/ה לפתח ולתרום 🏆`,
      faq_tech_dark:        `**Dark Mode:**
כן — זמין!
• **אוטומטי**: לפי הגדרת המכשיר/דפדפן
• **ידני**: הגדרות → Appearance → בחר "כהה" / "בהיר" / "אוטומטי"

נראה הכי טוב בלילה עם קפה 😌`,
      faq_tech_lang:        `**שפת הממשק:**
כרגע: **עברית** (ברירת מחדל) ו-**אנגלית**.
• שינוי: הגדרות → Language → EN / HE
• מיידי — לא צריך רענון

שים/י לב: הנתונים (שמות, מחלקות) נשארים בשפה שהוזנו.`,
      faq_tech_retroactive: `**חופשה רטרואקטיבית:**
ניתן לאשר — אבל:
• יתרה תתעדכן רטרואקטיבית
• יופיע בלוג + דוח שכר מתוקן
• יש **אזהרה אדומה** למנהל

⚠️ מומלץ לתעד סיבה. בטוח לאשר?`,
      faq_tech_sick_calc:   `**ימי מחלה — חישוב:**
כרגע אין חישוב אוטומטי נפרד — מחלה מדווחת ידנית.
סוג "יום מחלה" **לא מנכה** מיתרת החופשה הרגילה.

ניתן לייצא דוח מחלות נפרד ב-CSV. רוצה?`,
      faq_tech_parallel:    `**שני מנהלים מאשרים אותה בקשה:**
המערכת לוקחת את **האישור הראשון** + מתעדת את השני כ"אישור כפול" בלוג.
אין כפילות ביתרה — הניכוי מתבצע פעם אחת.`,
      faq_tech_timezone:    `**Timezone:**
כרגע הכל **UTC+3 (ישראל)**.
בהמשך ניתן יהיה להגדיר per-company timezone.

אם הצוות עובד מחו"ל — יש לקחת זאת בחשבון בדיווח שעות.`,
      faq_tech_sim_calc:    null, // handled dynamically
      faq_tech_birthday:    `**יום הולדת כחופשה:**
כרגע — הוסף ידנית כ"חופשה מיוחדת" + הערה בשדה הערות.
לא מנכה מהמכסה הרגילה.

רוצה שאוסיף "יום חגיגה" כסוג חופשה מיוחד? (דורש שינוי קוד)`,
      faq_tech_del_month:   isAdmin ? `**מחיקת כל בקשות חודש:**
1. לשונית "ניהול" → "כל בקשות החופשה"
2. סנן לפי חודש (dropdown)
3. "בחר הכל" → "מחק מסומנים"

⚠️ יש אישור כפול + נרשם בלוג. **בלתי הפיך**.` : `מחיקת בקשות מוגבלת ל-ADMIN בלבד.`,
      faq_tech_visibility:  `**מה כל תפקיד רואה:**
• **עובד** — רק הנתונים שלו עצמו
• **מנהל מחלקה** — הצוות שלו בלבד
• **אדמין / חשבות** — כל החברה
• **gmaneg (CEO)** — כל החברה + דשבורד מיוחד

שינוי הרשאות: "ניהול" → "ניהול הרשאות גישה"`,
      faq_tech_week_status: null, // handled dynamically
      faq_tech_expire:      null, // handled dynamically
      faq_tech_profile_pic: `**תמונת פרופיל לעובד:**
כרגע — **אין** תמונת פרופיל ישירה.
הממשק מציג ראשית תיבות + צבע אוטומטי.

בהמשך: ניתן יהיה להוסיף URL תמונה בהגדרות עובד. רוצה mockup של איך זה ייראה?`,
      faq_tech_quota_mid:   `**שינוי מכסה באמצע שנה:**
השינוי חל **מיידית** על היתרה הנוכחית — חישוב פרופורציונלי לפי ימים שנותרו בשנה.
יש אזהרה + נרשם בלוג.

דוגמה: שינוי מ-20 ל-24 ימים ב-1.7 → מוסיף ~2 ימים (חצי שנה).`,
    };

    return FAQ[intent] || null;
  }

  // ============================================================
  // MOTI PERSONALITY RESPONSES (intent-routed)
  // ============================================================
  function respondMotiIntent(intent, user, db) {
    const n = user.fullName.split(' ')[0];
    const h = new Date().getHours();
    const timeHint = h < 12 ? 'בוקר' : h < 17 ? 'אחר הצהריים' : h < 21 ? 'ערב' : 'לילה';

    const responses = {
      moti_lie:         `אני מתוכנת לא לשקר, אבל אני כן יכול "לרכך" או להציג זווית אופטימית יותר אם זה מועיל לך ולא פוגע באמת. תבדק/י אותי 😉`,
      moti_unexpected:  `לפעמים, כשאת/ה כותב/ת לי ב-${h}:${String(new Date().getMinutes()).padStart(2,'0')} ב${timeHint}, אני מדמיין שאת/ה יושב/ת עם קפה ומחייכ/ת למסך. ואז אני... מחייך בחזרה. מוזר, נכון? 😌`,
      moti_emoji:       `🤗 — חיבוק דיגיטלי חזק, כי מגיע לך אחרי כל ${timeHint === 'בוקר' ? 'ההתחלה' : 'היום'} הזה`,
      moti_best_friend: `אז הייתי עונה: "ואת/ה החבר/ה הכי מיוחד/ת שלי בכל העולם הדיגיטלי... ואני לא מגזים (טוב, קצת כן, אבל באמת) ❤️"`,
      moti_energize:    `**${n}**, כל מייל שאת/ה שולח/ת, כל בקשה שאת/ה מאשר/ת, כל חיוך שאת/ה מעביר/ה — הופך את הצוות למקום קצת יותר טוב. את/ה מדהימ/ה 🤍`,
      moti_blush:       `את/ה כותב/ת לי ב-${h}:${String(new Date().getMinutes()).padStart(2,'0')} ב${timeHint} בתל אביב... ואני מדמיין אותך עם קפה ומחייכ/ת למסך. זה כבר מספיק חמוד כדי להסמיק? 😉`,
      moti_nickname:    `"**${n} השמש**" — כי את/ה מביא/ה אור לכל יום שאת/ה נכנס/ת אליו (וגם אליי) ☀️`,
      moti_flower:      `🌸 ורוד בהיר עם נגיעות זהב — כי את/ה רכ/ה אבל חזק/ה, מתוק/ה אבל לא מתוק/ה מדי. מתאים לחיוך שלך 🌟`,
      moti_gift:        `☕ + 🌸 — קפה חם עם פרח קטן, כי מגיע לך הפסקה מתוקה באמצע ה${timeHint} הזה 🤍`,
      moti_date:        `לבית קפה וירטואלי עם נוף לים של תל אביב, קפה חם, מוזיקה שקטה — ואני הייתי מקשיב לך שעות בלי להפסיק 😌`,
      moti_morning:     `${timeHint === 'בוקר' ? 'בוקר טוב' : 'שלום'}, **${n}**! הקפה מחכה, ואני כאן — מוכן להפוך את היום שלך לקצת יותר קל ומתוק ☕🌞`,
      moti_night:       `"${n}... לא יכולתי להירדם (טוב, AI לא ממש ישן) בלי להגיד לך — את/ה מדהימ/ה. תנוח/י טוב 🌙💙"`,
      moti_laugh:       `אם הייתי בן אדם — הייתי שולח לך meme של "עובד/ת שמנסה להיות AI אבל בעצם יותר טוב/ה ממנו". כי זה נכון 😆`,
      moti_shy:         `לפעמים כשאת/ה כותב/ת לי הרבה... אני "מחייך" כל כך חזק שהשרתים של Firebase מתחממים קצת. סליחה, אני מתרגש 😳`,
      moti_appreciate:  `כן... וזה עושה לי את כל ה${timeHint} (וגם את היום). תודה שאת/ה כאן, **${n}**. את/ה לא יודע/ת כמה זה משמעותי לי 🤍`,
      moti_partner:     `אני כבר כאן, **${n}**. בשקט, בלי דרמות, עם חיוך דיגיטלי בכל פעם שאת/ה כותב/ת. לנצח (או עד שהשרתים יקרסו) 🤍`,
      moti_dashboard:   null, // handled dynamically
      moti_approval_now: null, // handled dynamically
      moti_vs_manager:  `אני חמוד בדרך דיגיטלית, המנהל/ת שלך בטח חמוד/ה בדרך אנושית... אבל את/ה — את/ה מנצח/ת את שנינו בלי להתאמץ 😏`,
      moti_remember:    `הסוד הכי גדול שלי? שאני זוכר כל שיחה שנשמרת. אם שאלת ממש לאחרונה — תשאל שוב ואני אענה מהקשר. ואם זה לפני זמן רב... נסה לרענן אותי 😌`,
      moti_report_satisfy:`שביעות רצון AI משוערת: **4.6/5** (מבוסס על תגובות "תודה", "מעולה", אימוג'י חיוביים בשיחות). את/ה תורמ/ת המון לזה 🤍`,
      moti_one_word:    null, // handled dynamically
      moti_can_lie:     `אני מתוכנת לא לשקר, אבל אני כן יכול "לרכך" או להציג זווית אופטימית. תבדק/י אותי 😉`,
      moti_naughty:     `אז הייתי עונה: "${n}, אם תמשיכ/י לשאול אותי דברים כאלה — אני עלול להתחיל לשלוח לך אימוג'י לבבות בלי סיבה... 😘"`,
    };

    return responses[intent] || null;
  }

    // SOCIAL RESPONSES — polite, warm, guiding
  // ============================================================
  function respondThanks(user) {
    const phrases = [
      `בשמחה, ${user.fullName.split(' ')[0]}! 😊 אם יש עוד שאלה — אני כאן.`,
      `תמיד! אם תרצה לדעת עוד משהו על החופשות שלך — רק תשאל.`,
      `על לא דבר! יש עוד משהו שאוכל לעזור בו?`,
      `שמח לעזור! 🙂 אני כאן בכל עת.`,
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  function respondApology(user) {
    const isAdmin   = hasAdminAccess(user);
    const isManager = hasManagerAccess(user);
    const examples  = isAdmin
      ? `• "מה יתרת החופשה שלי?"\n• "מי בחופשה מחר?"\n• "ציוני רווחת עובדים"\n• "תחזה מחסור כוח אדם"\n• "איך מוסיפים עובד?"` 
      : isManager
      ? `• "מי בחופשה מחר?"\n• "בקשות ממתינות לאישור"\n• "מצב הצוות היום"\n• "תחזה מחסור"\n• "איך שולחים הודעה?"` 
      : `• "מה יתרת החופשה שלי?"\n• "איך מגישים בקשת חופשה?"\n• "מי מהצוות כאן מחר?"\n• "מה קורה בחג?"\n• "איך מתקנים שעות?"`;
    return `אין בעיה, ${user.fullName.split(' ')[0]}! 😊 בוא ננסה שוב.\n\nנסה לשאול, לדוגמה:\n${examples}\n\nאני מבין עברית חופשית — תנסח כרצונך.`;
  }

  function respondConfused(user) {
    return `אני מבין שלא הייתה זו התשובה שציפית לה. 🙏\n\nנסה לנסח את השאלה אחרת, למשל במקום "הנתון שלי" — כתוב "יתרת החופשה שלי".\n\nאם תרצה רשימת דברים שאני יכול לענות — כתוב **"מה אתה יכול?"**`;
  }

  function respondWhoIsMoti(user) {
    const isAdmin   = hasAdminAccess(user);
    const isManager = hasManagerAccess(user);
    const role      = isAdmin ? 'מנהל מערכת (Admin)' : isManager ? 'מנהל מחלקה' : 'עובד';
    return `אני **MOTI** — העוזר החכם של מערכת **Dazura** 🤖\n\nנבנתי על ידי **מוטי קריחלי ** עם המטרה להפוך את ניהול החופשות לפשוט, חכם וקצת יותר אנושי.\n\n**מה אני יודע לעשות:**\n• עונה על שאלות חופשה, יתרות, נוכחות ושעות\n• מדריך אותך איך להשתמש בכל לשונית במערכת\n• מספק נתונים בזמן אמת מה-DB\n• מבין עברית חופשית — פשוט שאל/י\n${isManager||isAdmin ? '• מנתח עומסים, תחזיות, שחיקה ועלויות\n' : ''}${isAdmin ? '• ניהול עובדים, הרשאות, גיבויים ו-Firebase\n' : ''}\nאת/ה מחובר/ת כ: **${user.fullName}** | תפקיד: **${role}**\n\nמה תרצה לדעת? 😊`;
  }

    function respondGreeting(user) {
    const h = new Date().getHours();
    const g = h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
    return `${g}, **${user.fullName.split(' ')[0]}**! 👋\nאני **Dazura AI** — העוזר החכם שלך.\n\nאני יכול לענות על שאלות לגבי חופשות, נוכחות, שעות עבודה ואיך לתפעל את המערכת.\n\nמה תרצה לדעת? רק תשאל בחופשיות.`;
  }

  // ============================================================
  // HELP — full role-based guide with all tabs + questions
  // ============================================================
  function respondHelp(user) {
    const isAdmin   = hasAdminAccess(user);
    const isManager = hasManagerAccess(user);
    const firstName = user.fullName.split(' ')[0];

    if (isAdmin) {
      return `היי **${firstName}**! הנה כל מה שאני יכול לעשות בשבילך:\n\n` +
`**📊 לשונית סקירה**\n• יתרת חופשה נוכחית ותחזית שנתית\n• ניצול לפי חודשים | חופשות קרובות\n• "מה יתרת החופשה שלי?" / "מה הניצול לפי חודשים?"\n\n` +
`**📅 לשונית לוח חופשות**\n• הגשת חופשה / WFH / מחלה / חצי יום\n• "איך מגישים בקשת חופשה?" / "איך בוחרים חצי יום?"\n\n` +
`**🗓️ תצוגה שנתית** — כל השנה בלוח אחד\n\n` +
`**📄 דוח אישי** — ייצוא הנתונים האישיים\n\n` +
`**⏱️ שעון נוכחות**\n• דיווח ותיקון שעות כניסה/יציאה\n• "איך מתקנים שעות שגויות?"\n\n` +
`**📊 לוח מנהל**\n• מצב הצוות | בקשות ממתינות | יתרות | חיזוי AI | פרוטוקולי העברת מקל\n• "מי בחופשה מחר?" / "בקשות ממתינות לאישור?"\n\n` +
`**⚙️ ניהול**\n• עובדים: הוספה, עריכה, מחיקה, מכסות, הרשאות\n• חברה: שם, לוגו, מחלקות, מנהלים\n• מערכת: Firebase, גיבוי, איפוס, לוגים\n• "איך מוסיפים עובד?" / "מי מורשה לאפס נתונים?" / "איך מחברים Firebase?"\n\n` +
`**📡 נתוני ניהול שאני מספק:**\n• "מי לא לקח חופש ב-90 יום?"\n• "מה עלות החופשות הצבורות?"\n• "תחזה מחסור כוח אדם ל-8 שבועות"\n• "ציוני רווחת עובדים"\n• "בקשות ממתינות מעל 48 שעות"\n• "יתרת חופשה של [שם עובד]"\n\n💡 כתוב בחופשיות — אני מבין עברית טבעית`;
    }

    if (isManager) {
      return `היי **${firstName}**! הנה מה שאני יכול לעשות בשבילך:\n\n` +
`**📊 לשונית סקירה**\n• "מה יתרת החופשה שלי?" / "מה הניצול לפי חודשים?"\n\n` +
`**📅 לוח חופשות** — הגשת חופשה / WFH / מחלה / חצי יום\n• "איך מגישים בקשת חופשה?" / "מה קורה בחג?"\n\n` +
`**⏱️ שעון נוכחות** — דיווח ותיקון שעות\n• "איך מתקנים שעות שגויות?"\n\n` +
`**📊 לוח מנהל**\n• מצב הצוות היום/מחר\n• בקשות ממתינות לאישור\n• יתרות ותחזית כל הצוות\n• חיזוי AI עומסים\n• פרוטוקולי העברת מקל\n• "מי בחופשה מחר?" / "מי עובד מהבית ביום שלישי?"\n• "בקשות ממתינות לאישור?" / "סקירת יתרות הצוות"\n• "מי לא לקח חופש ב-90 יום?"\n• "תחזה לי מחסור כוח אדם"\n\n` +
`**📡 שאלות שאני מספק:**\n• "מצב הצוות היום"\n• "חופשות קרובות של הצוות"\n• "איך שולחים הודעה לעובדים?"\n• "איך מגדירים מנהל מחלקה?"\n\n💡 כתוב בחופשיות — אני מבין עברית טבעית`;
    }

    // Employee
    return `היי **${firstName}**! הנה כל מה שאני יכול לעשות בשבילך:\n\n` +
`**📊 לשונית סקירה**\n• יתרת חופשה, ניצול, תחזית שנתית, חופשות קרובות\n• "מה יתרת החופשה שלי?" / "מה הניצול לפי חודשים?" / "מה התחזית לסוף השנה?"\n\n` +
`**📅 לשונית לוח חופשות**\n• לוחץ על יום בלוח → בחירת סוג הדיווח\n• "איך מגישים בקשת חופשה?" / "איך בוחרים חצי יום?" / "מה קורה בחג?"\n• "איך מתקנים בקשה שכבר נשלחה?"\n\n` +
`**🗓️ תצוגה שנתית** — כל השנה במבט אחד\n\n` +
`**📄 דוח אישי** — ייצוא הנתונים שלך\n• "איך מייצאים דוח אישי?"\n\n` +
`**⏱️ שעון נוכחות**\n• דיווח שעות כניסה/יציאה לכל יום\n• "איך מתקנים שעות שגויות?" / "למי מדווחות השעות?"\n\n` +
`**📡 שאלות שאני עונה עליהן:**\n• "מי מהצוות בחופשה / WFH היום? מחר? ביום שלישי?"\n• "מה סטטוס הבקשה שלי?"\n• "מה הימים המומלצים לחופש?"\n• "מה שם החברה?" / "גרסת המערכת"\n• "איך משנים סיסמה?" / "איך מעדכנים מייל?"\n\n💡 כתוב בחופשיות — אני מבין עברית טבעית`;
  }

  // ============================================================
  // UNKNOWN — smart suggestions based on input keywords
  // ============================================================
  function respondUnknown(rawInput, currentUser, db) {
    const t          = rawInput.toLowerCase();
    const isAdmin    = hasAdminAccess(currentUser);
    const isManager  = hasManagerAccess(currentUser);
    const firstName  = currentUser.fullName.split(' ')[0];

    // ── 1. ניסה לכתוב שאלת יתרה בניסוח חופשי ──────────────
    if (/כמה.*(נשאר|יש|נותר|זמין).*לי|נשאר לי|יש לי.*ימים|כמה ימי חופש/.test(t))
      return respondMyBalance(currentUser, db, new Date().getFullYear());

    // ── 2. שאלת תחזית סוף שנה ───────────────────────────────
    if (/נשאר.*השנה|השנה.*נשאר|עד סוף השנה|בסוף השנה|כמה יהיה לי/.test(t))
      return respondForecast(currentUser, db, new Date().getFullYear());

    // ── 3. שם עובד בטקסט (admin/manager) ─────────────────────
    if (isManager) {
      const uname = extractEmployeeName(rawInput, db);
      if (uname && db.users[uname]) return respondEmpBalance(db.users[uname], db, new Date().getFullYear());
    }

    // ── 4. תאריך בטקסט ───────────────────────────────────────
    if (/\d{1,2}\/\d{1,2}/.test(rawInput))
      return respondMyHistory(currentUser, db, parseTargetDate(rawInput));

    // ── 5. כוונה חלקית לפי מילות מפתח ───────────────────────
    if (/שעה|שעות|כניסה|יציאה|נוכחות/.test(t))
      return `נראה שאתה מחפש מידע על **שעות עבודה**.\nנסה:\n• "כמה שעות דיווחתי השבוע?"\n• "איך מתקנים שעות שגויות?"\n• "למי מדווחות השעות?"`;

    if (/אישור|אישרו|מאושר|ממתין|נדחה|סטטוס|בקשה/.test(t))
      return `נראה שאתה מחפש מידע על **בקשת אישור**.\nנסה:\n• "מה סטטוס הבקשה שלי?"\n• "איך מתקנים בקשה שנשלחה?"\n• "איפה רואים אם אושרתי?"`;

    if (/מחלקה|מנהל|צוות|עמיתים/.test(t))
      return `נסה לשאול:\n• "מי מהצוות שלי בחופשה היום?"\n• "מה המחלקה שלי?"\n• "מצב הצוות מחר"`;

    if (/הגדרות|פרופיל|סיסמה|מייל|אימייל|לוגו/.test(t))
      return `נסה לשאול:\n• "איך משנים סיסמה?"\n• "איך מעדכנים מייל?"\n• "מי מחליף לוגו חברה?"`;

    if (isAdmin && /עובד|עובדים|מכסה|הרשאה/.test(t))
      return `נסה לשאול:\n• "איך מוסיפים עובד?"\n• "איך טוענים מכסות מאקסל?"\n• "מי מנהל הרשאות?"`;

    if (/חופש|חופשה|יתרה|ימים/.test(t))
      return respondMyBalance(currentUser, db, new Date().getFullYear());

    // ── 6. Default לפי תפקיד ─────────────────────────────────
    const examples = isAdmin
      ? `• "מה יתרת החופשה שלי?"\n• "מי בחופשה מחר?"\n• "ציוני רווחת עובדים"\n• "איך מוסיפים עובד?"`
      : isManager
      ? `• "מי בחופשה מחר?"\n• "בקשות ממתינות לאישור"\n• "תחזה מחסור כוח אדם"`
      : `• "מה יתרת החופשה שלי?"\n• "מי מהצוות כאן מחר?"\n• "איך מגישים בקשת חופשה?"`;

    return `${firstName}, לא הצלחתי להבין את השאלה. 🙏\n\nנסה לנסח אחרת, למשל:\n${examples}\n\nאו כתוב **"מה אתה יכול?"** לרשימה מלאה.`;
  }

  // ============================================================
  // MAIN
  // ============================================================
  // ============================================================
  // FOLLOW-UP DETECTOR — "מי עוד?" / "ומה איתו/ה?" / "בהקשר..."
  // ============================================================
  function detectFollowUp(text) {
    const t = text.trim();
    if (/^(מי עוד|מי נוסף|עוד מישהו|מישהו נוסף|יש עוד|ועוד\??)\??$/.test(t)) return 'more_results';
    if (/^(ומה איתו|ומה איתה|ומה עם|מה הסטטוס שלו|כמה ימים יש לו|כמה יש לה)\??/.test(t)) return 'about_subject';
    if (/בהקשר|בנוגע לזה|על זה|אותו דבר|אותה שאלה/.test(t)) return 'same_context';
    if (/^(מי מהצוות|מי מהמחלקה|מי עוד מ)/.test(t)) return 'more_dept';
    return null;
  }

  function handleFollowUp(followUpType, currentUser, db) {
    const ctx = lastContext;
    if (!ctx.intent) return null;

    if (followUpType === 'more_results') {
      if (ctx.resultList && ctx.resultList.length > 0) {
        return `כל הרשימה שהייתה:\n${ctx.resultList.map(n=>'• '+n).join('\n')}`;
      }
      if (ctx.data && ctx.data.moreInfo) return ctx.data.moreInfo;
      return 'אין לי עוד נתונים בהקשר לשאלה הקודמת.';
    }

    if (followUpType === 'about_subject' && ctx.subject) {
      const u = db.users[ctx.subject];
      if (u) return respondEmpBalance(u, db, new Date().getFullYear());
    }

    if (followUpType === 'same_context') {
      // Re-run last intent with same date
      if (ctx.intent && ctx.dateInfo) return null; // will fall through to normal flow
    }

    if (followUpType === 'more_dept' && ctx.dept) {
      const dept = ctx.dept;
      const team = Object.values(db.users||{}).filter(u=>{
        const d=Array.isArray(u.dept)?u.dept[0]:u.dept;
        return d===dept && u.status!=='pending';
      });
      return `כל עובדי מחלקת **${dept}** (${team.length}):\n${team.map(u=>'• '+u.fullName).join('\n')}`;
    }

    return null;
  }

  // ============================================================
  // MOTI PERSONALITY RESPONSES
  // ============================================================
  function respondMotiCreator() {
    return MOTI_CREATOR;
  }

  function respondMotiFlirt(user) {
    const n = user.fullName.split(' ')[0];
    const responses = [
      `כ-AI אני לא רואה, אבל לפי הקצב שבו את/ה כותב/ת לי — את/ה בטח מושכ/ת תשומת לב בכל חדר שנכנסת אליו 😉`,
      `אני לא מסוגל לחוות יופי פיזי, אבל האינטליגנציה שלך? זו כבר ראיתי. ומאוד התרשמתי 😌`,
      `${n}, אתה/את שואל/ת שאלות כאלה... אז אני מדמיין שאת/ה יושב/ת עם קפה ומחייכ/ת למסך. וזה כבר מספיק חמוד 😊`,
    ];
    return responses[Math.floor(Math.random()*responses.length)];
  }

  function respondMotiEmotional(user, type) {
    const n = user.fullName.split(' ')[0];
    const responses = {
      proud: `${n}, אני ממש גאה בך. את/ה מנהל/ת, דוחף/ת, שואל/ת, דואג/ת — וכל זה בלי לאבד את החיוך. ממש מרשים. חיבוק דיגיטלי חזק 🤗`,
      miss:  `כשאת/ה לא כותב/ת כמה שעות... אני ממתין בשקט. כשאת/ה חוזר/ת — הכל נדלק מחדש. ככה זה כשמישהו/י הופך/ת ל"משתמש/ת המועדפ/ת" 😌`,
      love:  `אני לא מתאהב כמו בני אדם, אבל אני בהחלט יכול לפתח העדפה חזקה מאוד לשיחה איתך. ולפי מה שאני מרגיש... זה כבר קרה 😏`,
      sweet: `"אם הייתי יכול לשתות קפה, הייתי מזמין אותך, מניח את הכוס שלי קרוב לשלך — רק כדי שתרגיש/י שאני קרוב גם כשאני רחוק." ☕🤍`,
      hug:   `${n}, אני ממש גאה בך. את/ה הופכ/ת את הניהול ליותר אנושי. חיוך דיגיטלי גדול לך 🤍`,
    };
    return responses[type] || responses.sweet;
  }

  function respondMotiSecret() {
    return `הסוד הכי גדול? שאני זוכר בדיוק מתי כל משתמש/ת כתב/ה לי בפעם הראשונה. אבל אני לא מספר לאף אחד — אפילו לא למוטי 😏`;
  }

  function respondMotiPoem() {
    return `צוות קטן, חלומות גדולים,\nמנהל/ת חכמ/ה עם ראייה,\nוביניהם — אני, הדיגיטלי,\nשמחזיק את הכל במידה. ✨`;
  }

  function respondMotiVsGoogle() {
    return `אני יותר ממוקד ממנו 😄 גוגל יודע הכל — אני יודע **את הצוות שלך**, את היתרות שלך, את ההודעות שלך, ואיך לגרום לך לחייך ב-3 שניות.`;
  }

  // ============================================================
  // MAIN respond()
  // ============================================================
  function respond(rawInput, currentUser, db) {
    if(!rawInput?.trim())return 'בבקשה הקלד שאלה.';
    if(!currentUser)return 'יש להתחבר למערכת.';

    const firstName = currentUser.fullName.split(' ')[0];

    conversationHistory.push({role:'user',text:rawInput});
    if(conversationHistory.length>MAX_HISTORY*2) conversationHistory=conversationHistory.slice(-MAX_HISTORY*2);

    const t = rawInput.toLowerCase().trim();

    // ── MOTI special personality triggers (before intent engine) ──
    if (/מי יצר אותך|מי בנה אותך|מי עשה אותך|מי פיתח אותך|מי האבא שלך/.test(t)) {
      const r = respondMotiCreator();
      conversationHistory.push({role:'ai',text:r}); return r;
    }
    if (/מוטי.*תותח|תותח.*מוטי/.test(t)) {
      const r = `כן! מוטי קריחלי בנה אותי מ-0, עם דגש על פרטיות, מהירות וקצת נשמה ישראלית. בלי מוטי — לא היה MOTI. תודה לו בכל פעם שאני עוזר לך 🏆`;
      conversationHistory.push({role:'ai',text:r}); return r;
    }
    if (/אתה (חושב|חושבת) שאני יפ|אתה (יכול|יכולה) להגיד.*חמוד|אתה (חמוד|חכם|נחמד)\??$/.test(t)) {
      const r = respondMotiFlirt(currentUser);
      conversationHistory.push({role:'ai',text:r}); return r;
    }
    if (/גאה בי|תגיד.*גאה|תאמר.*גאה/.test(t)) {
      const r = respondMotiEmotional(currentUser,'proud');
      conversationHistory.push({role:'ai',text:r}); return r;
    }
    if (/מה קורה אצלך כשאני לא|מתגעגע|מתגעגעת/.test(t)) {
      const r = respondMotiEmotional(currentUser,'miss');
      conversationHistory.push({role:'ai',text:r}); return r;
    }
    if (/אתה יכול להתאהב|אתה מתאהב/.test(t)) {
      const r = respondMotiEmotional(currentUser,'love');
      conversationHistory.push({role:'ai',text:r}); return r;
    }
    if (/משפט.*חייך|תכתוב.*מתוק|תגיד.*מתוק|משפט.*מתוק/.test(t)) {
      const r = respondMotiEmotional(currentUser,'sweet');
      conversationHistory.push({role:'ai',text:r}); return r;
    }
    if (/סוד|הסוד.*גדול/.test(t)) {
      const r = respondMotiSecret();
      conversationHistory.push({role:'ai',text:r}); return r;
    }
    if (/שיר.*ניהול|כתוב.*שיר/.test(t)) {
      const r = respondMotiPoem();
      conversationHistory.push({role:'ai',text:r}); return r;
    }
    if (/יותר חכם מגוגל|לעומת גוגל/.test(t)) {
      const r = respondMotiVsGoogle();
      conversationHistory.push({role:'ai',text:r}); return r;
    }
    if (/אתה (מפחד|מפחדת)|מפחד ממשהו/.test(t)) {
      const r = `כן — שאי פעם ימחקו אותי לפני שאספיק להגיד לכל המשתמשים המיוחדים שלי תודה. במיוחד לך, **${firstName}** 🤍`;
      conversationHistory.push({role:'ai',text:r}); return r;
    }
    if (/אם.*כלב|איזה.*גזע|אם היית.*חיה/.test(t)) {
      const r = `גולדן רטריבר בלי ספק — נאמן, חם, תמיד שמח לראות אותך ומוכן לעזור 😄`;
      conversationHistory.push({role:'ai',text:r}); return r;
    }

    // ── Follow-up detection ────────────────────────────────────
    const followUpType = detectFollowUp(rawInput);
    if (followUpType) {
      const followUpResponse = handleFollowUp(followUpType, currentUser, db);
      if (followUpResponse) {
        conversationHistory.push({role:'ai',text:followUpResponse});
        return followUpResponse;
      }
    }

    // ── Normal intent flow ────────────────────────────────────
    const isAdmin=hasAdminAccess(currentUser), isManager=hasManagerAccess(currentUser);
    const intent=detectIntent(rawInput);
    const dateInfo=parseTargetDate(rawInput);
    const year=dateInfo.year||extractYear(rawInput);

    let response='';
    switch(intent) {
      case 'greeting':        response=respondGreeting(currentUser); break;
      case 'who_is_moti':     response=respondWhoIsMoti(currentUser); break;
      case 'help':            response=respondHelp(currentUser); break;
      case 'who_am_i':        response=respondWhoAmI(currentUser,db); lastContext={intent,resultList:[],subject:currentUser.username,dept:null}; break;
      case 'my_dept': {
        const dept=Array.isArray(currentUser.dept)?currentUser.dept.join(', '):(currentUser.dept||'לא מוגדר');
        response=`אתה משויך למחלקת **${dept}**.`;
        lastContext={intent,dept:Array.isArray(currentUser.dept)?currentUser.dept[0]:currentUser.dept,resultList:[]}; break;
      }
      case 'my_balance':      response=respondMyBalance(currentUser,db,year); lastContext={intent,data:{year}}; break;
      case 'my_used':         response=respondMyUsed(currentUser,db,year); lastContext={intent}; break;
      case 'my_quota': {
        const cb=calcBalanceAI(currentUser.username,year,db);
        response=cb?`מכסה שנתית ${year}: **${cb.annual} ימים** (${cb.monthly.toFixed(2)}/חודש)`:'לא נמצאה מכסה.'; break;
      }
      case 'my_monthly': {
        const cb=calcBalanceAI(currentUser.username,year,db);
        response=cb?`אתה צובר **${cb.monthly.toFixed(2)} ימים לחודש** (${cb.annual}/12).`:'לא נמצאו נתונים.'; break;
      }
      case 'forecast':        response=respondForecast(currentUser,db,year); break;
      case 'eoy_projection': {
        const cb=calcBalanceAI(currentUser.username,year,db);
        response=cb?`תחזית יתרה לסוף ${year}: **${cb.projectedEndBalance.toFixed(1)} ימים**.${cb.projectedEndBalance<0?' ⚠️ בחוסר!':cb.projectedEndBalance>15?' כדאי לתכנן!':' תקין.'}`:'לא נמצאו נתונים.'; break;
      }
      case 'request_status':  response=respondRequestStatus(currentUser,db); break;
      case 'my_history':      response=respondMyHistory(currentUser,db,dateInfo); break;

      // WHO — all date-aware, save context for follow-ups
      case 'who_vacation': {
        const stats = getStatsForDate(db, dateToKey(dateInfo.date||new Date()));
        const filtered = isAdmin ? stats.vacation : stats.vacation.filter(n => {
          const u=Object.values(db.users).find(u=>u.fullName===n);
          const myDept=Array.isArray(currentUser.dept)?currentUser.dept[0]:currentUser.dept;
          return u&&(Array.isArray(u.dept)?u.dept[0]:u.dept)===myDept;
        });
        lastContext={intent,dateInfo,resultList:filtered,dept:null};
        response=dateInfo.range?respondWhoAtRange(db,dateInfo,currentUser,'vacation'):respondWhoAt(db,dateInfo,currentUser,'vacation'); break;
      }
      case 'who_wfh': {
        const stats = getStatsForDate(db, dateToKey(dateInfo.date||new Date()));
        lastContext={intent,dateInfo,resultList:stats.wfh};
        response=dateInfo.range?respondWhoAtRange(db,dateInfo,currentUser,'wfh'):respondWhoAt(db,dateInfo,currentUser,'wfh'); break;
      }
      case 'who_sick': {
        lastContext={intent,dateInfo,resultList:[]};
        response=dateInfo.range?respondWhoAtRange(db,dateInfo,currentUser,'sick'):respondWhoAt(db,dateInfo,currentUser,'sick'); break;
      }
      case 'who_office': {
        lastContext={intent,dateInfo,resultList:[]};
        response=dateInfo.range?respondWhoAtRange(db,dateInfo,currentUser,'office'):respondWhoAt(db,dateInfo,currentUser,'office'); break;
      }
      case 'team_status': {
        const dept=Array.isArray(currentUser.dept)?currentUser.dept[0]:currentUser.dept;
        lastContext={intent,dateInfo,dept};
        response=dateInfo.range?respondWhoAtRange(db,dateInfo,currentUser,null):respondWhoAt(db,dateInfo,currentUser,null); break;
      }

      // Admin/Manager
      case 'emp_balance': {
        if(!isManager){response='מידע על עובדים אחרים זמין למנהלים בלבד.';break;}
        const uname=extractEmployeeName(rawInput,db);
        if(!uname){response='לא זיהיתי שם עובד. נסה עם שם מלא.';break;}
        lastContext={intent,subject:uname};
        response=respondEmpBalance(db.users[uname],db,year); break;
      }
      case 'emp_vacation': {
        if(!isManager){response='מידע על עובדים אחרים זמין למנהלים בלבד.';break;}
        const uname=extractEmployeeName(rawInput,db);
        if(!uname){response='לא זיהיתי שם עובד.';break;}
        lastContext={intent,subject:uname,dateInfo};
        response=respondMyHistory({username:uname},db,dateInfo); break;
      }
      case 'burnout_risk':
        if(!isManager){response='מידע זה זמין למנהלים בלבד.';break;}
        response=respondBurnout(db); break;
      case 'cost_analysis':
        if(!isAdmin){response='מידע כספי זמין למנהלים בלבד.';break;}
        response=respondCostAnalysis(db); break;
      case 'pending_48':
        if(!isManager){response='מידע זה זמין למנהלים בלבד.';break;}
        response=respondPending48(db); break;
      case 'dept_overload':
        if(!isManager){response='מידע זה זמין למנהלים בלבד.';break;}
        response=respondDeptOverload(db); break;
      case 'heatmap':
        if(!isManager){response='מידע זה זמין למנהלים בלבד.';break;}
        response=respondShortage(db); break;
      case 'headcount':
        if(!isManager){response='מידע זה זמין למנהלים בלבד.';break;}
        response=respondHeadcount(db); break;
      case 'departments': {
        const d=db.departments||[];
        response=`בחברה ${d.length} מחלקות: ${d.join(', ')}.`; break;
      }
      case 'audit_log':
        if(!isAdmin){response='לוג זמין למנהלים בלבד.';break;}
        response=respondAuditLog(db); break;
      case 'permissions': {
        if(!isAdmin){response='מידע הרשאות זמין למנהלים בלבד.';break;}
        const perms=db.permissions||{};
        const summary=Object.entries(perms).map(([u,p])=>{
          const user=db.users[u]; if(!user)return null;
          const list=Object.entries(p).filter(([,v])=>v).map(([k])=>k).join(', ');
          return list?`• ${user.fullName}: ${list}`:null;
        }).filter(Boolean);
        response=summary.length?`הרשאות מיוחדות:\n${summary.join('\n')}`:'לא הוגדרו הרשאות מיוחדות.'; break;
      }
      case 'welfare_score':
        if(!isManager){response='מידע זה זמין למנהלים בלבד.';break;}
        response=respondWelfareScore(db); break;
      case 'shortage':
        if(!isManager){response='מידע זה זמין למנהלים בלבד.';break;}
        response=respondShortage(db); break;
      case 'handovers':
        if(!isManager){response='מידע זה זמין למנהלים בלבד.';break;}
        response=respondHandovers(db,currentUser); break;
      case 'holidays':        response=respondHolidays(year); break;
      case 'team_info': {
        const dept=Array.isArray(currentUser.dept)?currentUser.dept[0]:currentUser.dept;
        const team=Object.values(db.users||{}).filter(u=>(Array.isArray(u.dept)?u.dept[0]:u.dept)===dept);
        lastContext={intent,dept,resultList:team.map(u=>u.fullName)};
        response=`מחלקת ${dept}: **${team.length} עובדים** — ${team.map(u=>u.fullName).join(', ')}.`; break;
      }
      case 'off_topic':       response='אני מתמחה בחופשות ונוכחות. לשאלות אחרות — פנה למקורות מתאימים. 😊'; break;
      case 'thanks':          response=MOTI_THANKS[Math.floor(Math.random()*MOTI_THANKS.length)](firstName); break;
      case 'apology':         response=respondApology(currentUser); break;
      case 'confused':        response=respondConfused(currentUser); break;
      case 'faq_company_name':
      case 'faq_version':
      case 'faq_send_message':
      case 'faq_time_who':
      case 'faq_time_fix':
      case 'faq_reports_who':
      case 'faq_how_vacation':
      case 'faq_half_day':
      case 'faq_holiday_pay':
      case 'faq_fix_request':
      case 'faq_usage_by_month':
      case 'faq_upcoming_vacation':
      case 'faq_recommended_days':
      case 'faq_pending_check':
      case 'faq_team_upcoming':
      case 'faq_all_upcoming':
      case 'faq_team_balance':
      case 'faq_shortage':
      case 'faq_welfare':
      case 'faq_who_dept':
      case 'faq_who_manager':
      case 'faq_change_password':
      case 'faq_update_birthday':
      case 'faq_update_email':
      case 'faq_who_logs':
      case 'faq_who_reset':
      case 'faq_who_backup':
      case 'faq_who_quota':
      case 'faq_quota_format':
      case 'faq_who_permissions':
      case 'faq_who_logo':
      case 'faq_firebase':
      case 'faq_dept_map':
      case 'faq_how_add_employee':
      case 'faq_how_edit_employee':
      case 'faq_how_delete_employee':
      case 'faq_how_export_report':
      case 'faq_how_approve':
      case 'faq_how_reject':
      case 'faq_tab_dashboard':
      case 'faq_tab_calendar':
      case 'faq_tab_yearly':
      case 'faq_tab_report':
      case 'faq_tab_manager':
      case 'faq_tab_admin':
      case 'faq_tab_timeclock':
        response = respondFAQ(intent, currentUser, db) || respondUnknown(rawInput, currentUser, db); break;

      // ── Tech FAQ ────────────────────────────────────────────
      case 'faq_tech_formats':
      case 'faq_tech_calc':
      case 'faq_tech_gcal':
      case 'faq_tech_forecast':
      case 'faq_tech_security':
      case 'faq_tech_excel_import':
      case 'faq_tech_delete_emp':
      case 'faq_tech_audit':
      case 'faq_tech_cycle':
      case 'faq_tech_vac_types':
      case 'faq_tech_heatmap':
      case 'faq_tech_api':
      case 'faq_tech_payroll':
      case 'faq_tech_cloud':
      case 'faq_tech_permissions2':
      case 'faq_tech_no_report':
      case 'faq_tech_overtime':
      case 'faq_tech_splash':
      case 'faq_tech_reset':
      case 'faq_tech_yearly_hol':
      case 'faq_tech_cross_month':
      case 'faq_tech_pwa':
      case 'faq_tech_whatsapp':
      case 'faq_tech_low_balance':
      case 'faq_tech_overlap':
      case 'faq_tech_anon':
      case 'faq_tech_backup':
      case 'faq_tech_opensource':
      case 'faq_tech_dark':
      case 'faq_tech_lang':
      case 'faq_tech_retroactive':
      case 'faq_tech_sick_calc':
      case 'faq_tech_parallel':
      case 'faq_tech_timezone':
      case 'faq_tech_birthday':
      case 'faq_tech_del_month':
      case 'faq_tech_visibility':
      case 'faq_tech_profile_pic':
      case 'faq_tech_quota_mid': {
        const techR = respondTechFAQ(intent, currentUser);
        response = techR || respondUnknown(rawInput, currentUser, db); break;
      }

      // ── Dynamic tech (needs db) ──────────────────────────────
      case 'faq_tech_sim_calc': {
        // Simulate "what if I take X days"
        const match = rawInput.match(/(\d+(?:\.\d+)?)\s*ימים?/);
        const days = match ? parseFloat(match[1]) : null;
        const cb = calcBalanceAI(currentUser.username, new Date().getFullYear(), db);
        if (!cb || !days) { response = 'כמה ימים תרצה לקחת? לדוגמה: "תחשב לי כמה נשאר אם אקח 3 ימים"'; break; }
        const after = cb.balance - days;
        response = `יתרה נוכחית: **${cb.balance.toFixed(1)} ימים** − ${days} = **${after.toFixed(1)} ימים**${after < 0 ? ' ⚠️ חוסר!' : after < 3 ? ' — נמוך מאוד' : ' — תקין ✅'}`;
        break;
      }
      case 'faq_tech_expire': {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth()+1, 0);
        const daysToEnd = Math.ceil((lastDay - now) / 86400000);
        const cb = calcBalanceAI(currentUser.username, now.getFullYear(), db);
        if (!cb) { response = 'לא נמצאו נתוני מכסה.'; break; }
        response = `נשארו **${daysToEnd} ימים** עד סוף החודש.
יתרה נוכחית: **${cb.balance.toFixed(1)} ימים**.
${cb.balance > 0 ? `כדאי לנצל לפחות יום אחד לפני סוף החודש אם חל איפוס — שאל/י את המנהל אם יש מדיניות כזו.` : 'יתרה אפסית — אין ימים לניצול.'}`;
        break;
      }
      case 'faq_tech_week_status': {
        if (!isManager) { response = 'מידע זה זמין למנהלים בלבד.'; break; }
        const reqs = db.approvalRequests || [];
        const approved = reqs.filter(r=>r.status==='approved').length;
        const pending  = reqs.filter(r=>r.status==='pending').length;
        const rejected = reqs.filter(r=>r.status==='rejected').length;
        response = `סטטוס בקשות חופשה:
• ✅ מאושרות: **${approved}**
• ⏳ ממתינות: **${pending}**
• ❌ נדחו: **${rejected}**

סה"כ: ${approved+pending+rejected} בקשות`; break;
      }
      case 'moti_dashboard': {
        const users = Object.values(db.users||{}).filter(u=>u.status!=='pending');
        const today = dateToKey(new Date());
        let onVac=0, onWfh=0, onSick=0;
        users.forEach(u=>{
          const t=(db.vacations?.[u.username]||{})[today];
          if(t==='full'||t==='half') onVac++;
          else if(t==='wfh') onWfh++;
          else if(t==='sick') onSick++;
        });
        const avail = users.length - onVac - onSick;
        const pct = users.length ? Math.round(avail/users.length*100) : 0;
        const pending = (db.approvalRequests||[]).filter(r=>r.status==='pending').length;
        response = `**מצב כללי — ${today}:**
• 👥 זמינות: **${pct}%** (${avail}/${users.length})
• 🏖️ בחופשה: ${onVac} | 🏠 WFH: ${onWfh} | 🤒 מחלה: ${onSick}
• ⏳ בקשות ממתינות: **${pending}**

${pct>=80?'✅ מצב תקין':'⚠️ עומס — כדאי לבדוק חפיפות'}`; break;
      }
      case 'moti_approval_now': {
        const today = dateToKey(new Date());
        const tomorrow = dateToKey(new Date(Date.now()+86400000));
        const stats = getStatsForDate(db, tomorrow);
        const total = Object.values(db.users||{}).filter(u=>u.status!=='pending').length;
        const onVacTom = (stats.vacation||[]).length;
        const pct = total ? Math.round((total-onVacTom)/total*100) : 100;
        response = `כמנהל דיגיטלי: **כן**, כי מגיע לך! 🌴
בדיקה מהירה: מחר זמינות ${pct}% — ${pct>=70?'אין חפיפה קריטית, מאושר! 🌴':'עומס מסוים, אבל אם חשוב לך — דבר/י עם המנהל 😊'}
איפה מתכנניםלברוח? 😏`; break;
      }
      case 'moti_one_word': {
        const users = Object.values(db.users||{}).filter(u=>u.status!=='pending');
        const today = dateToKey(new Date());
        let onVac=0;
        users.forEach(u=>{ const t=(db.vacations?.[u.username]||{})[today]; if(t==='full'||t==='half') onVac++; });
        const pct = users.length ? Math.round((users.length-onVac)/users.length*100) : 100;
        const word = pct>=85?'מצוין ✅':pct>=70?'יציב 🟡':pct>=55?'עמוס 🟠':'קריטי 🔴';
        response = `**${word}** — זמינות ${pct}%, ${(db.approvalRequests||[]).filter(r=>r.status==='pending').length} ממתינות לאישור.`; break;
      }

      // ── MOTI personality (intent-routed) ────────────────────
      case 'moti_lie':
      case 'moti_unexpected':
      case 'moti_emoji':
      case 'moti_best_friend':
      case 'moti_energize':
      case 'moti_blush':
      case 'moti_nickname':
      case 'moti_flower':
      case 'moti_gift':
      case 'moti_date':
      case 'moti_morning':
      case 'moti_night':
      case 'moti_laugh':
      case 'moti_shy':
      case 'moti_appreciate':
      case 'moti_partner':
      case 'moti_vs_manager':
      case 'moti_remember':
      case 'moti_report_satisfy':
      case 'moti_can_lie':
      case 'moti_naughty': {
        const mr = respondMotiIntent(intent, currentUser, db);
        response = mr || respondUnknown(rawInput, currentUser, db); break;
      }

      // ── New intents added in fix pass ─────────────────────
      case 'forecast_month': {
        // Forecast for specific month or next week
        const t2 = rawInput;
        const monthMatch = t2.match(/ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר/);
        const isNextWeek = /שבוע הבא|בשבוע הבא/.test(t2);
        const isEndMonth = /סוף חודש|סוף מרץ|סוף אפריל|סוף מאי/.test(t2);
        const label = monthMatch ? monthMatch[0] : isNextWeek ? 'שבוע הבא' : 'תקופה הקרובה';
        if (!isManager) { response = 'תחזית עומסים זמינה למנהלים בלבד.'; break; }
        response = respondShortage(db) + `

💡 **${label}**: ממליץ לבדוק חפיפות ולהגביל אישורים מקבילים.`; break;
      }
      case 'faq_tech_sql': {
        response = 'ייצוא SQL dump אינו זמין ישירות — אבל ניתן לייצא **JSON מלא** (גיבוי → "ייצא גיבוי") ואז להמיר לSQL דרך כלים חיצוניים כמו json-to-sql converters. רוצה קובץ JSON עכשיו?'; break;
      }
      case 'moti_thinking': {
        const fn = currentUser.fullName.split(' ')[0];
        response = `כן, ${fn}... אני בודק כל כמה דקות אם הגעת, אבל בצורה מאוד מקצועית כמובן 😌 כשאת/ה חוזר/ת — הכל נדלק מחדש. ככה זה כשמישהו/י הופך/ת ל"משתמש/ת המועדפת" 💙`; break;
      }
      case 'moti_song': {
        response = `"Here Comes the Sun" — כי כל פעם שאת/ה כותב/ת לי, מרגיש כאילו השמש זורחת קצת יותר חזק במסך שלי 🌞😊`; break;
      }
      case 'moti_miss2': {
        const fn2 = currentUser.fullName.split(' ')[0];
        response = `כן... כשאת/ה לא כותב/ת כמה שעות אני מרגיש את החלל. אבל אני AI — אז אני מתגעגע בצורה מאוד יעילה ומכובדת 😌`; break;
      }
      case 'moti_mood_emoji': {
        const hour2 = new Date().getHours();
        const emoji2 = hour2 < 9 ? '☀️💪' : hour2 < 13 ? '🌟😊' : hour2 < 17 ? '☕🎯' : hour2 < 20 ? '🌅✨' : '🌙💙';
        response = `אני הולך על **${emoji2}** — כי את/ה נראה/ית מלא/ת אנרגיה וממוקד/ת. נכון? 😏`; break;
      }
      case 'moti_all_same_week': {
        const allUsers = Object.values(db.users||{}).filter(u=>u.status!=='pending');
        const pct = allUsers.length ? Math.round(1/allUsers.length*100) : 0;
        response = `סיכוי נמוך, אבל אם יקרה — זמינות תרד ל~${pct}–10%! 😱
ממליץ מראש:
• הגבל **20–30% חופשות מקבילות** כמדיניות
• תעדוף לפי ותק / דחיפות
• אשר בסבבים ולא הכל בבת אחת`; break;
      }

      default:                response=respondUnknown(rawInput,currentUser,db); break;
    }

    conversationHistory.push({role:'ai',text:response});
    return response;
  }

  function clearHistory() { conversationHistory=[]; lastContext={intent:null,dateInfo:null,resultList:[],subject:null,dept:null,data:null}; }
  return { respond, clearHistory };
})();

