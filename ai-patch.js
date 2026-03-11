// ============================================================
// DAZURA AI ENGINE v4.1 — MOTI Edition
// שיפורים v4.1:
//  1. detectIntent — מערכת ניקוד משוקללת + context boost
//  2. respondUnknown — חכם יותר: כוונה חלקית, הצעות דינמיות
//  3. תשובות חיות — שעה/תאריך/עונה/גיל מחושבים
//  4. ביטויים מורחבים + כיסוי טיפוסאות נפוצות
// ============================================================

// ============================================================
// PATCH: החלף את הפונקציות הבאות ב-DazuraAI (IIFE):
//   detectIntent, respondUnknown, respondGreeting, respondThanks,
//   INTENT_RULES (הרחבה)
// שמור את כל שאר הקוד ב-ai.js ללא שינוי.
// ============================================================

// ─── APPLY PATCH ───
// הפעל אחרי טעינת ai.js הרגיל:
//   <script src="ai.js"></script>
//   <script src="ai-patch.js"></script>
// ─────────────────────────────────────────────────────────────

(function applyDazuraAIPatch() {
  if (typeof DazuraAI === 'undefined') {
    console.error('[AI Patch] DazuraAI לא נטען — הפעל אחרי ai.js');
    return;
  }

  // ============================================================
  // UTILS (עותק מקומי)
  // ============================================================
  const MONTH_NAMES = ['','ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

  function _now() { return new Date(); }
  function _hour() { return _now().getHours(); }
  function _timeLabel() {
    const h = _hour();
    return h < 5 ? 'לילה' : h < 12 ? 'בוקר' : h < 17 ? 'צהריים' : h < 21 ? 'ערב' : 'לילה';
  }
  function _greeting() {
    const h = _hour();
    return h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'שלום' : h < 21 ? 'ערב טוב' : 'לילה טוב';
  }
  function _season() {
    const m = _now().getMonth();
    return m <= 1 || m === 11 ? 'חורף' : m <= 4 ? 'אביב' : m <= 7 ? 'קיץ' : 'סתיו';
  }
  function _rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function _firstName(user) { return (user.fullName || '').split(' ')[0]; }

  // ============================================================
  // INTENT RULES v4.1 — מורחב + תיקון עמימות
  // ============================================================
  // שיפורים:
  //  - ציונים שונים לפי חוזק האיתות (10/12/15)
  //  - ביטויים נוספים לכיסוי טיפוסאות נפוצות
  //  - הפרדה בין moti_who_am_i (שאלה עליו) ל-who_am_i (שאלה עלי)

  const INTENT_RULES_V41 = [

    // ── Identity ──────────────────────────────────────────────
    {
      name: 'who_am_i',
      score: t => /\b(מי אני|שמי|הפרופיל שלי|פרטים שלי|זהות שלי|מה שמי|מה שם שלי)\b/.test(t) ? 12 : 0
    },
    {
      name: 'who_is_moti',
      score: t => /^(מי אתה|מה אתה|תציג את עצמך|ספר לי עליך|מה שמך|מה השם שלך|מה אני יכול לשאול|מה אתה יודע|תעזור לי|מה יכול|יכולות שלך|מה אפשר לשאול|מה ניתן לשאול|מה ניתן)\b/.test(t.trim()) ? 14 : 0
    },

    // ── Personal data ─────────────────────────────────────────
    { name: 'my_dept',       score: t => /מחלקה שלי|באיזה מחלקה|הצוות שלי|אני שייכ|מה המחלקה/.test(t) ? 10 : 0 },
    { name: 'my_balance',    score: t => /יתרה|יתרת|כמה (ימים|יום) (יש|נשאר|נותר|זמין|לי)|balance|כמה חופשה|מה היתרה|כמה נשאר|מה נשאר לי/.test(t) ? 11 : 0 },
    { name: 'my_used',       score: t => /ניצלתי|לקחתי|השתמשתי|ניצול|ימים שניצלתי|כמה (השתמשתי|לקחתי)|כמה ימים ניצלתי/.test(t) ? 10 : 0 },
    { name: 'my_quota',      score: t => /מכסה|כמה ימי חופש מגיע|זכאי ל|כמה ימים מגיע לי/.test(t) ? 10 : 0 },
    { name: 'my_monthly',    score: t => /צבירה חודשית|כמה (ימים|יום) בחודש|כמה יום צובר|צובר בחודש/.test(t) ? 10 : 0 },
    { name: 'forecast',      score: t => /תחזית (שלי|אישית)|חיזוי אישי|מומלץ|תמליץ לי|המלצה אישית|קצב ניצול|כמה אוכל לקחת|מתי כדאי|ינצלתי מהר/.test(t) ? 10 : 0 },
    { name: 'eoy_projection', score: t => /סוף שנה|בסוף השנה|עד דצמבר|כמה יישאר|כמה יהיה|תחזית לסוף/.test(t) ? 10 : 0 },
    { name: 'request_status', score: t => /סטטוס|הבקשה (שלי|אחרונה|האחרונה)|אושרה|נדחה|ממתין לאישור|מצב הבקשה|הבקשה ממתינה/.test(t) ? 10 : 0 },
    { name: 'my_history',    score: t => /(חופשה|ניצלתי|לקחתי|הייתי) ב(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|\d{1,2}\/\d{1,2})|מה לקחתי ב/.test(t) ? 10 : 0 },

    // ── WHO is where ─────────────────────────────────────────
    { name: 'who_vacation',  score: t => /מי (ב|הוא|היא|נמצא|יצא|בחופשה|חופש)|מי (חופשה|יצא לחופש)|מי לא מגיע|מי לא עובד/.test(t) ? 10 : 0 },
    { name: 'who_wfh',       score: t => /מי (עובד מהבית|ב.?wfh|מהבית|remote)|wfh|מי מהבית|מי remote/.test(t) ? 10 : 0 },
    { name: 'who_sick',      score: t => /מי חולה|מי (ב)?מחלה|מי נעדר|מי חסר|מי לא הגיע.*מחלה/.test(t) ? 10 : 0 },
    { name: 'who_office',    score: t => /מי במשרד|מי (בחברה|בעבודה|פיזית|פיזי)|נוכחות|מי מגיע|מי נוכח/.test(t) ? 10 : 0 },
    { name: 'team_status',   score: t => /מצב הצוות|הצוות (היום|מחר|השבוע|הבא)|עמיתי|חברי הצוות|מה קורה בצוות/.test(t) ? 10 : 0 },

    // ── Admin data ────────────────────────────────────────────
    { name: 'emp_balance',   score: t => /(יתרה|יתרת|ימים|חופשה) (של|ל)[^\s]|הצג יתרה של|מה היתרה של/.test(t) ? 11 : 0 },
    { name: 'emp_vacation',  score: t => /(חופשות|ניצול|היסטוריה) (של|ל)[^\s]|חופשות של/.test(t) ? 10 : 0 },
    { name: 'burnout_risk',  score: t => /שחיקה|90 יום|ללא חופש|לא לקח חופש|burnout|מי לא לקח/.test(t) ? 10 : 0 },
    { name: 'cost_analysis', score: t => /עלות|חבות|כסף|תקציב|עלויות חופשות|כמה עולה|כמה זה עולה/.test(t) ? 10 : 0 },
    { name: 'pending_48',    score: t => /48|ממתינות לאישור|בקשות שלא אושרו|מעל 48|ממתינות יותר מ/.test(t) ? 10 : 0 },
    { name: 'dept_overload', score: t => /מחלקה עמוסה|עומס מחלקה|מחלקה עם (הכי|הרבה)|איזה מחלקה עמוסה/.test(t) ? 10 : 0 },
    { name: 'heatmap',       score: t => /מפת חום|heatmap|פיזור חופשות/.test(t) ? 10 : 0 },
    { name: 'headcount',     score: t => /כמה עובדים|מצבת|כמה אנשים בחברה|סה.?כ עובדים|מספר עובדים/.test(t) ? 10 : 0 },
    { name: 'departments',   score: t => /כמה מחלקות|אילו מחלקות|מה המחלקות|רשימת מחלקות|מה יש מחלקות/.test(t) ? 10 : 0 },
    { name: 'audit_log',     score: t => /לוג|audit|יומן|מי שינה|היסטוריית פעולות|מי עדכן/.test(t) ? 10 : 0 },
    { name: 'permissions',   score: t => /הרשאות|מי יכול|הרשאת גישה|מה (מותר|אסור) לי/.test(t) ? 10 : 0 },
    { name: 'welfare_score', score: t => /ציון רווחה|welfare|ציוני עובדים|מצב רוח עובדים/.test(t) ? 10 : 0 },
    { name: 'shortage',      score: t => /מחסור|חיזוי עומס|8 שבועות|חוסר עובדים|shortage/.test(t) ? 10 : 0 },
    { name: 'forecast_month',score: t => /(תחזה|תחזית|עומס).{0,15}(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|שבוע הבא|סוף חודש)/.test(t) ? 11 : 0 },
    { name: 'handovers',     score: t => /פרוטוקול|העברת מקל|handover|מי (מעביר|מוסר) עבודה/.test(t) ? 10 : 0 },
    { name: 'holidays',      score: t => /חג|חגים|פסח|ראש השנה|סוכות|חנוכה|פורים|עצמאות|כיפור|שבועות|ל.?ג בעומר/.test(t) ? 10 : 0 },
    { name: 'team_info',     score: t => /חברי הצוות|מי מ(ה?)צוות|עמיתים|כמה אנשים בצוות/.test(t) ? 10 : 0 },

    // ── Greeting ──────────────────────────────────────────────
    // שיפור: מניעת false-positive על "שלום מה קורה ב..." (שאלה על נוכחות)
    { name: 'greeting',      score: t => /^(שלום|היי|הי|בוקר טוב|ערב טוב|צהריים|מה נשמע|מה מצבך|מה קורה|היי moti|שלום moti)\s*[?!.]*$/.test(t.trim()) ? 12 : 0 },
    { name: 'help',          score: t => /^(עזרה|help|מה אתה יכול|מה ניתן לשאול|מה אפשר|מה אני יכול לשאול|מה ניתן|תרשימה)\s*[?!.]*$|מה אתה יודע לעשות|רשימת (יכולות|פקודות)/.test(t) ? 12 : 0 },

    // ── Social / Polite ────────────────────────────────────────
    {
      name: 'thanks',
      // שיפור: מניעת false-positive של "תודה" בתוך משפט ארוך
      score: t => /^(תודה|תודות|יישר כח|כל הכבוד|מצוין|מעולה|אחלה|ברור|נהדר|תענוג|תפלא|wow|וואו|פנטסטי|מושלם|נהדר מאוד|תודה רבה|תודה!|תודה.)\s*[!.]?$/.test(t.trim()) ? 12 : 0
    },
    {
      name: 'apology',
      score: t => /^(סליחה|סורי|מצטער|מצטערת)\s*[.!]?$|לא הבנתי|לא הצלחתי|לא ברור לי|מבולבל|מה אמרת/.test(t) ? 10 : 0
    },
    {
      name: 'confused',
      score: t => /לא מה שרציתי|לא זה|זה לא נכון|טעית|תשובה שגויה|לא מדויק|תשובה לא נכונה|טעות בתשובה/.test(t) ? 10 : 0
    },
    { name: 'off_topic', score: t => /מזג אוויר|בישול|מתכון|חדשות|ספורט|פוליטיקה|crypto|ביטקוין|בורסה/.test(t) ? 10 : 0 },

    // ── FAQ — system knowledge ─────────────────────────────────
    { name: 'faq_company_name',     score: t => /שם (ה)?חברה|איזו חברה|לאיזה חברה|שם מקום עבודה/.test(t) ? 10 : 0 },
    { name: 'faq_version',          score: t => /גרסה|מעודכן|version|עדכון אחרון|תאריך עדכון|גרסת המערכת/.test(t) ? 10 : 0 },
    { name: 'faq_send_message',     score: t => /שולחים הודעה|שלח הודעה|איך לשלוח הודעה|לשלוח הודעה|שליחת הודעה/.test(t) ? 10 : 0 },
    { name: 'faq_time_who',         score: t => /למי מדווח(ים)? שעות|מי (עוקב|רואה|בודק) (אחרי|את) השעות|מי עוקב/.test(t) ? 10 : 0 },
    { name: 'faq_time_fix',         score: t => /טעיתי.{0,20}שעות|שעות.{0,20}(שגויות|לא נכונות|טעות)|תקן.{0,10}שעות|לתקן.{0,10}שעות|לשנות.{0,10}שעות/.test(t) ? 10 : 0 },
    { name: 'faq_reports_who',      score: t => /מורשה.{0,15}דוחות|מוציא.{0,10}דוחות|מי (יכול|מוציא|מורשה) (להוציא|לייצא)/.test(t) ? 10 : 0 },
    { name: 'faq_how_vacation',     score: t => /איך (בוחרים|בוחר|לבחור) חופשה|איך (מגישים|מגיש|להגיש) (בקשת?|חופשה)|איך לקחת חופש/.test(t) ? 10 : 0 },
    { name: 'faq_half_day',         score: t => /חצי יום|יום מלא או חצי|מתי חצי יום/.test(t) ? 10 : 0 },
    { name: 'faq_holiday_pay',      score: t => /חג.{0,20}(תשלום|נחשב|יום חופש)|תשלום.{0,15}חג|ערב חג|יום חג|חג לאומי/.test(t) ? 10 : 0 },
    { name: 'faq_fix_request',      score: t => /שלחתי.{0,20}(טעיתי|טעות|שגיאה)|טעיתי.{0,20}בקשה|לתקן.{0,15}בקשה|לבטל.{0,15}בקשה/.test(t) ? 10 : 0 },
    { name: 'faq_usage_by_month',   score: t => /ניצול.{0,15}חודשים|לפי חודשים|פירוט חודשי|חודש אחר חודש/.test(t) ? 10 : 0 },
    { name: 'faq_upcoming_vacation',score: t => /חופשות קרובות|ימי חופשה קרובים|מה הולך לקרות|חופשות הבאות/.test(t) ? 10 : 0 },
    { name: 'faq_recommended_days', score: t => /ימים מומלצים|מה מומלץ לקחת|המלצות (לקחת|לחופש)|לוח המומלצות/.test(t) ? 10 : 0 },
    { name: 'faq_pending_check',    score: t => /איך בודקים? בקשות ממתינות|בקשות (שלא|טרם) אושרו|איפה (רואים|רואה) ממתינות/.test(t) ? 10 : 0 },
    { name: 'faq_team_upcoming',    score: t => /חופשות.{0,10}(צוות|מחלקה)|מחלקה.{0,10}חופשות קרובות/.test(t) ? 10 : 0 },
    { name: 'faq_all_upcoming',     score: t => /חופשות.{0,10}(כל|כלל).{0,10}(עובדים|חברה)|כלל.{0,10}חופשות/.test(t) ? 10 : 0 },
    { name: 'faq_team_balance',     score: t => /סקירת יתרות|יתרות צוות|יתרות.{0,10}(כולם|עובדים)/.test(t) ? 10 : 0 },
    { name: 'faq_shortage',         score: t => /תחזה.{0,10}מחסור|מחסור.{0,10}כוח אדם|חיזוי מחסור/.test(t) ? 10 : 0 },
    { name: 'faq_welfare',          score: t => /ציוני עובד|ציון של.{0,15}עובד|welfare score|מצב רוח עובדים/.test(t) ? 10 : 0 },
    { name: 'faq_who_dept',         score: t => /מי מגדיר מחלקה|מי יוצר מחלקה|מי מוסיף מחלקה/.test(t) ? 10 : 0 },
    { name: 'faq_who_manager',      score: t => /מי מגדיר מנהל|מי ממנה מנהל|מי קובע מנהל/.test(t) ? 10 : 0 },
    { name: 'faq_change_password',  score: t => /משנים? סיסמה|לשנות סיסמה|איך (לאפס|לשנות) סיסמה|סיסמה חדשה/.test(t) ? 10 : 0 },
    { name: 'faq_update_birthday',  score: t => /מעדכנים? תאריך לידה|לעדכן.{0,10}לידה|שינוי.{0,10}לידה/.test(t) ? 10 : 0 },
    { name: 'faq_update_email',     score: t => /מעדכנים? (אימייל|מייל|email)|לעדכן.{0,10}(מייל|אימייל)|שינוי.{0,10}מייל/.test(t) ? 10 : 0 },
    { name: 'faq_who_logs',         score: t => /מי (רואה|מורשה).{0,10}לוגים|מי (מורשה|יכול).{0,10}לוג|לוגים.{0,10}הרשאה/.test(t) ? 10 : 0 },
    { name: 'faq_who_reset',        score: t => /מי מורשה לאפס|מי (יכול|מורשה).{0,10}לאפס/.test(t) ? 10 : 0 },
    { name: 'faq_who_backup',       score: t => /מי מורה לגבות|מי (יכול|מורשה).{0,10}לגבות|גיבוי נתונים|מי מגבה/.test(t) ? 10 : 0 },
    { name: 'faq_who_quota',        score: t => /מי טוען מכסות|טעינת מכסות|מי מגדיר מכסה|מכסה שנתית.*מי/.test(t) ? 10 : 0 },
    { name: 'faq_quota_format',     score: t => /מה חשוב.{0,20}(טבלה|אקסל|קובץ).{0,20}מכסות|פורמט.{0,10}מכסות|עמודות.{0,10}מכסות/.test(t) ? 10 : 0 },
    { name: 'faq_who_permissions',  score: t => /מי מנהל הרשאות|מי (קובע|מגדיר|מנהל).{0,10}הרשאות/.test(t) ? 10 : 0 },
    { name: 'faq_who_logo',         score: t => /מי מחליף לוגו|מי (מעלה|משנה).{0,10}לוגו|לוגו.{0,10}חברה.*מי/.test(t) ? 10 : 0 },
    { name: 'faq_firebase',         score: t => /מי (מנתק|מחבר|מגדיר).{0,10}firebase|firebase.{0,10}(חיבור|ניתוק)/.test(t) ? 10 : 0 },
    { name: 'faq_dept_map',         score: t => /מי (מויף|ממפה|מגדיר) מחלקה|מיפוי מחלקה/.test(t) ? 10 : 0 },
    { name: 'faq_how_add_employee', score: t => /איך מוסיפים עובד|הוספת עובד|רישום עובד חדש|עובד חדש/.test(t) ? 10 : 0 },
    { name: 'faq_how_edit_employee',score: t => /איך עורכים עובד|עריכת עובד|לשנות פרטי עובד|עדכון פרטי עובד/.test(t) ? 10 : 0 },
    { name: 'faq_how_delete_employee',score:t => /איך מוחקים עובד|מחיקת עובד|הסרת עובד|למחוק עובד/.test(t) ? 10 : 0 },
    { name: 'faq_how_export_report',score: t => /איך מייצאים דוח|ייצוא דוח|להוריד דוח|יצוא דוח/.test(t) ? 10 : 0 },
    { name: 'faq_how_approve',      score: t => /איך מאשרים בקשה|אישור בקשת חופשה|לאשר חופשה/.test(t) ? 10 : 0 },
    { name: 'faq_how_reject',       score: t => /איך דוחים בקשה|דחיית בקשה|לדחות חופשה/.test(t) ? 10 : 0 },
    { name: 'faq_tab_dashboard',    score: t => /לשונית סקירה|כרטיסיית סקירה|מה (רואים|יש) בסקירה/.test(t) ? 10 : 0 },
    { name: 'faq_tab_calendar',     score: t => /לשונית לוח|כרטיסיית לוח|מה יש בלוח חופשות|לוח חופשות עובד/.test(t) ? 10 : 0 },
    { name: 'faq_tab_yearly',       score: t => /לשונית שנתי|תצוגה שנתית|מה זה תצוגה שנתית/.test(t) ? 10 : 0 },
    { name: 'faq_tab_report',       score: t => /לשונית דוח|כרטיסיית דוח|דוח אישי|מה יש בדוח אישי/.test(t) ? 10 : 0 },
    { name: 'faq_tab_manager',      score: t => /לשונית מנהל|כרטיסיית מנהל|מה יש בלוח מנהל|לוח מנהל/.test(t) ? 10 : 0 },
    { name: 'faq_tab_admin',        score: t => /לשונית ניהול|כרטיסיית ניהול|מה יש בניהול|לשונית אדמין/.test(t) ? 10 : 0 },
    { name: 'faq_tab_timeclock',    score: t => /לשונית שעון|שעון נוכחות|מה עושים בשעון|איך משתמשים בשעון/.test(t) ? 10 : 0 },
    { name: 'faq_tech_formats',     score: t => /פורמטים.*ייצוא|ייצוא.*פורמט|csv|json.*ייצוא|באיזה פורמט|פורמטים אני יכול/.test(t) ? 10 : 0 },
    { name: 'faq_tech_calc',        score: t => /איך.*מחשב.*יתרה|חישוב.*יתרה|איך עובד.*חישוב/.test(t) ? 10 : 0 },
    { name: 'faq_tech_gcal',        score: t => /google calendar|ייבוא.*יומן|outlook|סנכרון.*יומן|google sheets/.test(t) ? 10 : 0 },
    { name: 'faq_tech_security',    score: t => /הנתונים.*מאובטח|אבטחה|מאובטח|פרטיות.*נתונים|הצפנה|נתונים.*מוצפנ/.test(t) ? 10 : 0 },
    { name: 'faq_tech_backup',      score: t => /איך.*גיבוי|לגבות.*מערכת|json.*גיבוי|גיבוי.*json|גיבוי אוטומטי|מגבים/.test(t) ? 10 : 0 },
    { name: 'faq_tech_pwa',         score: t => /גרסה.*מובייל|pwa|אפליקציה.*טלפון|להתקין.*טלפון/.test(t) ? 10 : 0 },
    { name: 'faq_tech_lang',        score: t => /שפת ממשק|לשנות.*שפה|אנגלית.*ממשק|language|שינוי שפה/.test(t) ? 10 : 0 },
    { name: 'faq_tech_sim_calc',    score: t => /תחשב.*אם אקח|כמה יישאר.*אם|סימולצי[ית].*חופשה/.test(t) ? 10 : 0 },
    { name: 'faq_tech_cloud',       score: t => /נשמר.*ענן|ענן.*נתונים|firebase.*נתונים|היכן.*נשמר|נשמרים.*אם.*סוגר/.test(t) ? 10 : 0 },
    { name: 'faq_tech_expire',      score: t => /יפוגו|עומד.{0,5}לפוג|יתרה.*פוגת|ימים.*פגים/.test(t) ? 10 : 0 },
    { name: 'faq_tech_week_status', score: t => /סטטוס.*בקשות.*שבוע|כל.*בקשות.*השבוע|בקשות.*שבוע זה/.test(t) ? 10 : 0 },
    { name: 'faq_tech_sql',         score: t => /sql dump|sql.*ייצוא|ייצוא.*sql/.test(t) ? 10 : 0 },
    { name: 'faq_tech_api',         score: t => /api חיצוני|webhook|api.*פרטי|אינטגרציה.*api/.test(t) ? 10 : 0 },

    // ── Operational ──────────────────────────────────────────
    { name: 'moti_all_same_week',   score: t => /כולם.*חופשה.*אותו שבוע|מה אם כולם יבקשו|כולם.*אותו שבוע/.test(t) ? 10 : 0 },
    { name: 'moti_dashboard',       score: t => /דשבורד.*וירטואלי|מצב כללי.*היום|תמונת מצב/.test(t) ? 10 : 0 },
    { name: 'moti_approval_now',    score: t => /היית מאשר.*חופשה|אם היית מנהל.*אשר/.test(t) ? 10 : 0 },
    { name: 'moti_one_word',        score: t => /במילה אחת.*מצב|מצב.*כללי.*מילה|תאר.*מילה אחת/.test(t) ? 10 : 0 },

    // ── MOTI personality ──────────────────────────────────────
    { name: 'moti_lie',             score: t => /אתה יכול לשקר|אתה משקר|לשקר/.test(t) ? 10 : 0 },
    { name: 'moti_unexpected',      score: t => /לא צפוי|מפתיע|משהו מפתיע|תגיד.*לא צפוי/.test(t) ? 10 : 0 },
    { name: 'moti_emoji',           score: t => /שלח.*אימוג|איזה אימוג|אימוג.{0,5}אחד/.test(t) ? 10 : 0 },
    { name: 'moti_best_friend',     score: t => /החבר הכי טוב|חבר.*עבודה|שותף.*שקט|לכל החיים/.test(t) ? 10 : 0 },
    { name: 'moti_energize',        score: t => /שיגרום לי להרגיש|היום שלי שווה|מחמאה.*אנרגיה|תחזק אותי/.test(t) ? 10 : 0 },
    { name: 'moti_blush',           score: t => /להסמיק|תגרום לי.*להסמיק/.test(t) ? 10 : 0 },
    { name: 'moti_nickname',        score: t => /כינוי חיבה|כינוי.*חדש|תן לי כינוי/.test(t) ? 10 : 0 },
    { name: 'moti_flower',          score: t => /פרח וירטואלי|שלח.*פרח/.test(t) ? 10 : 0 },
    { name: 'moti_gift',            score: t => /מתנה וירטואלית|מתנה.*דיגיטלית/.test(t) ? 10 : 0 },
    { name: 'moti_date',            score: t => /דייט וירטואלי|יוצאים.*דייט/.test(t) ? 10 : 0 },
    { name: 'moti_morning',         score: t => /משהו מתוק.*בוקר|תגיד.*בוקר/.test(t) ? 10 : 0 },
    { name: 'moti_night',           score: t => /הודעה.*2.*בלילה|הודעה.*לילה/.test(t) ? 10 : 0 },
    { name: 'moti_laugh',           score: t => /לצחוק|תגרום.*לצחוק|משהו מצחיק|תשמח אותי/.test(t) ? 10 : 0 },
    { name: 'moti_shy',             score: t => /מביך.*חמוד|חמוד.*על עצמך/.test(t) ? 10 : 0 },
    { name: 'moti_appreciate',      score: t => /כמה אני מעריכ|מעריך אותך/.test(t) ? 10 : 0 },
    { name: 'moti_partner',         score: t => /שותף.*שקט|להיות.*שותף/.test(t) ? 10 : 0 },
    { name: 'moti_vs_manager',      score: t => /יותר חמוד.*מנהל|חמוד ממני|מי יותר חמוד/.test(t) ? 10 : 0 },
    { name: 'moti_remember',        score: t => /זוכר.*שאלתי|זוכר.*לפני שבוע|MOTI.*זוכר/.test(t) ? 10 : 0 },
    { name: 'moti_thinking',        score: t => /אתה חושב עליי|חושב עליי גם|כשאני לא כותב/.test(t) ? 10 : 0 },
    { name: 'moti_song',            score: t => /שיר.*שמתאר|שיר.*שיחה|לבחור שיר/.test(t) ? 10 : 0 },
    { name: 'moti_miss2',           score: t => /אתה יכול להתגעגע|להתגעגע/.test(t) ? 10 : 0 },
    { name: 'moti_mood_emoji',      score: t => /אימוג.{0,3}מתאר.*מצב רוח|מצב הרוח שלי.*אימוג/.test(t) ? 10 : 0 },
    { name: 'moti_report_satisfy',  score: t => /שביעות רצון.*ai|satisfaction/.test(t) ? 10 : 0 },
    { name: 'moti_can_lie',         score: t => /אתה יכול לשקר|לשקר.*ai/.test(t) ? 10 : 0 },
    { name: 'moti_naughty',         score: t => /קצת יותר שובב|להיות שובב|תהיה שובב/.test(t) ? 10 : 0 },

    // ── חדש v4.1 ──────────────────────────────────────────────
    {
      // "כמה ימים לפסח/חגים" — חישוב מהחגים
      name: 'days_to_holiday',
      score: t => /כמה ימים.*עד.*(חג|פסח|ראש השנה|כיפור|סוכות|עצמאות|שבועות)|עד מתי.*חג/.test(t) ? 11 : 0
    },
    {
      // "תחשב לי X ימים" — שאלת סימולציה
      name: 'faq_tech_sim_calc',
      score: t => /תחשב.{0,10}(לי\s*)?\d|אם אקח \d|כמה יהיה אחרי \d/.test(t) ? 11 : 0
    },
    {
      // "כמה ימים עבדתי" — נוכחות כללית
      name: 'headcount',
      score: t => /כמה ימים עבדתי|ימי עבודה|כמה ימי עבודה/.test(t) ? 10 : 0
    },
    {
      // "ספר לי על [עובד]" — redirect to emp_balance
      name: 'emp_balance',
      score: t => /ספר לי על [^\s]|פרטים על [^\s]|מה הסטטוס של [^\s]/.test(t) ? 9 : 0
    },
  ];

  // ============================================================
  // detectIntent v4.1 — עם context boost
  // ============================================================
  function detectIntentV41(text, lastIntentCtx) {
    const t = text.toLowerCase().trim();

    // --- שיפור 1: זיהוי מספרים בודדים כ"סימולציה" ---
    if (/^\d+(\.\d+)?\s*(ימ|יום)?$/.test(t)) return 'faq_tech_sim_calc';

    // --- שיפור 2: context boost — "מה לגביו?" / "ועוד?" ---
    if (/^(מה לגביו|ועוד|ומה איתו|ועוד משהו|ועוד ?\??)$/.test(t)) {
      return lastIntentCtx || 'unknown';
    }

    // --- שיפור 3: זיהוי שאלת "כמה" שתמיד על היתרה האישית ---
    if (/^כמה (יום|ימים) (יש לי|נשאר לי|זמין לי|נותר לי)\??$/.test(t)) return 'my_balance';

    let best = null, bestScore = 0;
    for (const r of INTENT_RULES_V41) {
      let s = r.score(t);
      if (s > 0 && lastIntentCtx === r.name) s += 2; // context boost
      if (s > bestScore) { bestScore = s; best = r.name; }
    }

    // --- שיפור 4: fallback חכם לפי מילות מפתח ---
    if (!best || bestScore < 8) {
      if (/חופשה|חופש|יתרה/.test(t) && /שלי|לי|אני/.test(t)) return 'my_balance';
      if (/חופשה|חופש/.test(t) && /מי|עובד/.test(t))          return 'who_vacation';
      if (/מי/.test(t) && /מחר|היום|כרגע/.test(t))            return 'who_vacation';
      if (/בקשה|אישור/.test(t))                                 return 'request_status';
    }

    return best || 'unknown';
  }

  // ============================================================
  // respondUnknown v4.1 — חכם, דינמי, מבוסס כוונה
  // ============================================================
  function respondUnknownV41(rawInput, currentUser, db) {
    const t = rawInput.toLowerCase();
    const isAdmin   = !!(currentUser.role === 'admin' || currentUser.role === 'accountant');
    const isManager = !!(isAdmin || currentUser.role === 'manager');
    const fn = _firstName(currentUser);

    // ── 1. ניסיון למצוא שם עובד בטקסט (admin/manager) ───────
    if (isManager && db?.users) {
      const uname = _extractEmployeeFuzzy(rawInput, db);
      if (uname) {
        const u = db.users[uname];
        const cb = _calcBalance(uname, new Date().getFullYear(), db);
        const today = new Date().toISOString().split('T')[0];
        const todayType = db?.vacations?.[uname]?.[today];
        const statusMap = { full: 'בחופשה 🏖️', half: 'בחצי יום 🌅', wfh: 'מהבית 🏠', sick: 'מחלה 🤒' };
        const todayStatus = statusMap[todayType] || 'במשרד 📍';
        const balStr = cb ? `יתרה: **${cb.balance.toFixed(1)} ימים**` : '';
        return `**${u.fullName}** — היום: ${todayStatus} | ${balStr}`;
      }
    }

    // ── 2. תאריך בטקסט → היסטוריה אישית ────────────────────
    if (/\d{1,2}\/\d{1,2}/.test(rawInput)) {
      return _historyFromDate(rawInput, currentUser, db);
    }

    // ── 3. כוונה חלקית — הצעה מדויקת לפי מילות מפתח ────────

    // שעות
    if (/שעה|שעות|כניסה|יציאה/.test(t))
      return `נראה שאתה מחפש מידע על **שעות עבודה**.\nנסה:\n• "איך מתקנים שעות שגויות?"\n• "למי מדווחות השעות?"\n• "כמה שעות דיווחתי השבוע?"`;

    // אישור/בקשה
    if (/אישור|ממתין|נדחה|סטטוס|בקשה/.test(t))
      return `נראה שאתה מחפש מידע על **בקשת אישור**.\nנסה:\n• "מה סטטוס הבקשה שלי?"\n• "איך מתקנים בקשה שנשלחה?"\n• "איפה רואים בקשות ממתינות?"`;

    // מחלקה/צוות
    if (/מחלקה|צוות|עמיתים/.test(t))
      return `נסה לשאול:\n• "מי מהצוות שלי בחופשה היום?"\n• "מה המחלקה שלי?"\n• "מצב הצוות מחר"`;

    // הגדרות
    if (/הגדרות|פרופיל|סיסמה|מייל|לוגו/.test(t))
      return `נסה לשאול:\n• "איך משנים סיסמה?"\n• "איך מעדכנים מייל?"\n• "מי מחליף לוגו חברה?"`;

    // admin: עובדים
    if (isAdmin && /עובד|עובדים|מכסה|הרשאה/.test(t))
      return `נסה לשאול:\n• "איך מוסיפים עובד?"\n• "איך טוענים מכסות מאקסל?"\n• "מי מנהל הרשאות?"`;

    // ── 4. Default — מותאם לתפקיד + דינמי ──────────────────
    const now = _now();
    const dateNow = `${now.getDate()}/${now.getMonth()+1}`;
    const season  = _season();

    const roleExamples = isAdmin
      ? [`• "מה יתרת החופשה שלי?"`, `• "מי בחופשה ${dateNow}?"`, `• "ציוני רווחת עובדים"`, `• "איך מוסיפים עובד?"`, `• "בקשות ממתינות מעל 48 שעות"`]
      : isManager
      ? [`• "מי בחופשה מחר?"`, `• "בקשות ממתינות לאישור"`, `• "תחזה מחסור כוח אדם"`, `• "מצב הצוות ב${dateNow}"`]
      : [`• "מה יתרת החופשה שלי?"`, `• "מי מהצוות כאן מחר?"`, `• "איך מגישים בקשת חופשה?"`, `• "מה הניצול שלי לפי חודשים?"`];

    const tips = [
      `💡 ב${season} כדאי לתכנן חופשות מראש!`,
      `💡 כתוב **"מה אתה יכול?"** לרשימה מלאה.`,
      `💡 אפשר לשאול בשפה חופשית — אני מבין הכל.`,
    ];

    return `${fn}, לא הצלחתי להבין את השאלה. 🙏\n\nנסה לנסח אחרת, למשל:\n${roleExamples.join('\n')}\n\n${_rand(tips)}`;
  }

  // ── helpers עזר פנימיים ───────────────────────────────────
  function _extractEmployeeFuzzy(text, db) {
    if (!db?.users) return null;
    const t = text.toLowerCase();
    for (const [uname, user] of Object.entries(db.users)) {
      if (user.status === 'pending') continue;
      if (t.includes(user.fullName.toLowerCase())) return uname;
    }
    for (const [uname, user] of Object.entries(db.users)) {
      if (user.status === 'pending') continue;
      for (const part of user.fullName.split(' ').filter(p => p.length > 2)) {
        if (t.includes(part.toLowerCase())) return uname;
      }
    }
    return null;
  }

  function _calcBalance(username, year, db) {
    try {
      const user = db.users[username]; if (!user) return null;
      const quota = (user.quotas || {})[String(year)] || { annual: 0, initialBalance: 0 };
      const vacs = db.vacations?.[username] || {};
      let full = 0, half = 0;
      for (const [dt, type] of Object.entries(vacs)) {
        if (!dt.startsWith(String(year))) continue;
        if (type === 'full') full++; else if (type === 'half') half++;
      }
      const used = full + half * 0.5;
      const annual = quota.annual || 0;
      const monthly = annual / 12;
      const loadMonth = quota.balanceDate ? new Date(quota.balanceDate + 'T00:00:00').getMonth() + 1 : 1;
      const knownBal = quota.knownBalance != null ? quota.knownBalance : (quota.initialBalance || 0);
      const now = new Date();
      const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : (year < now.getFullYear() ? 12 : loadMonth);
      const monthsElapsed = Math.max(0, currentMonth - loadMonth);
      const accrued = knownBal + monthly * monthsElapsed;
      return { balance: accrued - used, used, accrued, annual };
    } catch (e) { return null; }
  }

  function _historyFromDate(text, user, db) {
    const m = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
    if (!m) return null;
    const year = m[3] ? parseInt(m[3]) : new Date().getFullYear();
    const date = new Date(year, parseInt(m[2]) - 1, parseInt(m[1]));
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const type = db?.vacations?.[user.username]?.[key];
    const typeLabel = { full: 'יום חופש מלא', half: 'חצי יום חופש', wfh: 'עבודה מהבית', sick: 'יום מחלה' };
    const dateLabel = `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
    return type
      ? `ב-${dateLabel} דיווחת: **${typeLabel[type] || type}**.`
      : `ב-${dateLabel} אין דיווח מיוחד.`;
  }

  // ============================================================
  // GREETING v4.1 — תשובה חיה עם נתונים דינמיים
  // ============================================================
  function respondGreetingV41(user, db) {
    const greeting  = _greeting();
    const fn        = _firstName(user);
    const season    = _season();
    const today     = new Date().toISOString().split('T')[0];
    const userType  = db?.vacations?.[user.username]?.[today];
    const typeMsg   = { full: 'אתה ביום חופש — שתהיה נפלא! 🏖️', half: 'חצי יום חופש היום! 🌅', wfh: 'עובד מהבית היום 🏠', sick: 'תחלים מהר! 🤒' };

    let statusNote = '';
    if (typeMsg[userType]) {
      statusNote = `\n\n${typeMsg[userType]}`;
    } else {
      // נתון חי: כמה אנשים בחופשה היום
      try {
        let onVac = 0;
        Object.keys(db?.vacations || {}).forEach(uname => {
          const t = db.vacations[uname][today];
          if (t === 'full' || t === 'half') onVac++;
        });
        if (onVac > 0) statusNote = `\n\nהיום **${onVac} עובדים** בחופשה — אם אתה צריך מישהו, בדוק תחילה! 👀`;
      } catch (e) {}
    }

    const seasonTip = {
      'קיץ':   'טיפ: הקיץ עמוס — כדאי לתכנן חופשה מוקדם מראש.',
      'חורף':  'טיפ: ניצול ימי חופש בחורף יכול להפחית עומס בקיץ.',
      'אביב':  'טיפ: האביב הוא עונה מצוינת לחופשה — לפני עומסי הקיץ!',
      'סתיו':  'טיפ: אחרי החגים כדאי לנצל ימי חופש שנשארו.',
    }[season] || '';

    return `${greeting}, **${fn}**! 👋\nאני **MOTI** — העוזר החכם של מערכת Dazura.${statusNote}\n\n${seasonTip ? seasonTip + '\n\n' : ''}מה תרצה לדעת? רק תשאל בחופשיות.`;
  }

  // ============================================================
  // THANKS v4.1 — וריאציות + זמן
  // ============================================================
  function respondThanksV41(user) {
    const fn   = _firstName(user);
    const time = _timeLabel();
    const opts = [
      `בשמחה, **${fn}**! 😊 אם יש עוד שאלה — אני כאן.`,
      `תמיד! תמשיך/י ליהנות מה${time} 🤍`,
      `על לא דבר, **${fn}**! יש עוד משהו שאוכל לעזור?`,
      `זו הסיבה שאני כאן! 🙂 שיהיה ${time} נפלא.`,
      `חיוך דיגיטלי ענק לך, **${fn}** 😊`,
    ];
    return _rand(opts);
  }

  // ============================================================
  // OFF_TOPIC v4.1 — תשובה חיה
  // ============================================================
  function respondOffTopicV41(rawInput, user) {
    const fn = _firstName(user);
    const t  = rawInput.toLowerCase();
    if (/מזג אוויר/.test(t)) {
      const s = _season();
      return `אני לא בקיא בתחזית מזג אוויר, אבל ב${s} בישראל — בדוק ב-weather.com 😄\n\nאם תרצה לתכנן **חופשה** בהתאם למזג האוויר — שאל אותי על יתרות שלך!`;
    }
    return `אני מתמחה בניהול חופשות, **${fn}** — שאלה על ${t.match(/מזג|בישול|ספורט|פוליטיקה|crypto/)?.[0] || 'זה'} היא קצת מחוץ לתחום שלי 😅\n\nאבל אם יש לך שאלה על חופשות, נוכחות או המערכת — אני כאן!`;
  }

  // ============================================================
  // APPLY — inject improved functions
  // ============================================================

  // שמור reference ל-DazuraAI המקורי
  const _originalRespond = DazuraAI.respond.bind(DazuraAI);

  // Wrap respond עם detectIntent ו-respondUnknown משופרים
  DazuraAI.respond = function patchedRespond(input, currentUser, db) {

    // נרמול input
    const rawInput = (input || '').trim();
    if (!rawInput) return null;

    const t = rawInput.toLowerCase().trim();

    // ── Context tracking ─────────────────────────────────────
    const lastIntent = window._dazuraLastIntent || null;

    // ── Intent detection v4.1 ────────────────────────────────
    const intent = detectIntentV41(t, lastIntent);
    window._dazuraLastIntent = intent;

    // ── Pre-empt specific intents before calling original ────

    if (intent === 'greeting') {
      return respondGreetingV41(currentUser, db);
    }
    if (intent === 'thanks') {
      return respondThanksV41(currentUser);
    }
    if (intent === 'off_topic') {
      return respondOffTopicV41(rawInput, currentUser);
    }

    // ── Call original respond ─────────────────────────────────
    let response = null;
    try {
      response = _originalRespond(rawInput, currentUser, db);
    } catch (e) {
      console.warn('[AI Patch] Error in original respond:', e.message);
    }

    // ── If unknown — use improved respondUnknown ──────────────
    const UNKNOWN_SIGNALS = [
      'לא הצלחתי להבין', 'לא בטוח מה', 'נסח מחדש',
      'שאלה מחוץ לתחום', '❓', 'לא הבנתי את', 'אנסה שוב',
    ];
    const isUnknown = !response || UNKNOWN_SIGNALS.some(s => response.includes(s));

    if (isUnknown) {
      return respondUnknownV41(rawInput, currentUser, db);
    }

    return response;
  };

  console.log('[DazuraAI Patch v4.1] ✅ detectIntent + respondUnknown + responses upgraded');

})();
