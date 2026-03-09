// ============================================================
// DAZURA AI ENGINE v3.0 — ai.js
// Smart HR assistant — precise, context-aware, permission-based
// ============================================================

const DazuraAI = (() => {

  let conversationHistory = [];
  const MAX_HISTORY = 12;

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
    { name:'my_dept',       score: t=>/מחלקה שלי|באיזה מחלקה|הצוות שלי|אני ב/.test(t)?10:0 },
    { name:'my_balance',    score: t=>/יתרה|יתרת|כמה (ימים|יום) (יש|נשאר|נותר|זמין)|balance|כמה חופשה|מה היתרה/.test(t)?10:0 },
    { name:'my_used',       score: t=>/ניצלתי|לקחתי|השתמשתי|ניצול|ימים שניצלתי|כמה (השתמשתי|לקחתי)/.test(t)?10:0 },
    { name:'my_quota',      score: t=>/מכסה|כמה ימי חופש מגיע|זכאי ל/.test(t)?10:0 },
    { name:'my_monthly',    score: t=>/צבירה חודשית|כמה (ימים|יום) בחודש/.test(t)?10:0 },
    { name:'forecast',      score: t=>/תחזית|חיזוי|מומלץ|תמליץ|המלצה|קצב ניצול|כמה אוכל לקחת|מתי כדאי/.test(t)?10:0 },
    { name:'eoy_projection',score: t=>/סוף שנה|בסוף השנה|עד דצמבר|כמה יישאר/.test(t)?10:0 },
    { name:'request_status',score: t=>/סטטוס|הבקשה (שלי|אחרונה)|אושרה|נדחה|ממתין לאישור|מצב הבקשה/.test(t)?10:0 },
    { name:'my_history',    score: t=>/(חופשה|ניצלתי|לקחתי|הייתי) ב(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|\d{1,2}\/\d{1,2})/.test(t)?10:0 },
    // WHO + any date
    { name:'who_vacation',  score: t=>/מי (ב|הוא|היא|נמצא|יצא|בחופשה|חופש)|מי חופשה|מי יצא לחופש/.test(t)?10:0 },
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
    { name:'handovers',     score: t=>/פרוטוקול|העברת מקל|handover/.test(t)?10:0 },
    { name:'holidays',      score: t=>/חג|חגים|פסח|ראש השנה|סוכות|חנוכה|פורים|עצמאות|כיפור|שבועות/.test(t)?10:0 },
    { name:'team_info',     score: t=>/חברי הצוות|מי מ(ה?)צוות|עמיתים/.test(t)?10:0 },
    { name:'greeting',      score: t=>/^(שלום|היי|הי|בוקר|ערב|צהריים|מה נשמע|מה מצבך|מה קורה)\s*/.test(t)?10:0 },
    { name:'help',          score: t=>/עזרה|help|מה אתה יכול|מה ניתן לשאול|מה אפשר/.test(t)?10:0 },
    { name:'off_topic',     score: t=>/מזג אוויר|בישול|מתכון|חדשות|ספורט|פוליטיקה|crypto|ביטקוין/.test(t)?10:0 },
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
  function respondWhoAt(db, dateInfo, currentUser, filterType) {
    const isAdmin=hasAdminAccess(currentUser), isManager=hasManagerAccess(currentUser);
    const dateStr=dateToKey(dateInfo.date||new Date());
    const label=dateInfo.label;
    const allStats=getStatsForDate(db,dateStr);

    // Employee: only own team
    if (!isAdmin&&!isManager) {
      const dept=Array.isArray(currentUser.dept)?currentUser.dept[0]:currentUser.dept;
      const myTeam=Object.values(db.users).filter(u=>{
        const d=Array.isArray(u.dept)?u.dept[0]:u.dept;
        return d===dept&&u.username!==currentUser.username&&u.status!=='pending';
      });
      if (!myTeam.length) return `אין עמיתים נוספים במחלקת ${dept}.`;
      return `מצב הצוות ${label} (${dept}):\n`+myTeam.map(u=>{
        const type=(db.vacations?.[u.username]||{})[dateStr];
        return `• ${u.fullName}: ${type?TYPE_STATUS[type]:'במשרד'}`;
      }).join('\n');
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
      return t.list.length?`**${t.label}**${scope} (${t.list.length}):\n${t.list.map(n=>`• ${n}`).join('\n')}`:t.empty+scope+'.';
    }
    // All
    const lines=[];
    if(stats.office.length)   lines.push(`📍 **במשרד (${stats.office.length}):** ${stats.office.join(', ')}`);
    if(stats.wfh.length)      lines.push(`🏠 **מהבית (${stats.wfh.length}):** ${stats.wfh.join(', ')}`);
    if(stats.vacation.length) lines.push(`🏖️ **בחופשה (${stats.vacation.length}):** ${stats.vacation.join(', ')}`);
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
    if (filterType&&seen[filterType]) {
      const arr=[...seen[filterType]];
      return arr.length?`**${filterType==='vacation'?'בחופשה':filterType==='wfh'?'WFH':'מחלה'} ב${dateInfo.label} (${arr.length}):**\n${arr.map(n=>`• ${n}`).join('\n')}`:(`אין נעדרים ב${dateInfo.label}.`);
    }
    const lines=[];
    if(seen.vacation.size)lines.push(`🏖️ **בחופשה ב${dateInfo.label} (${seen.vacation.size}):** ${[...seen.vacation].join(', ')}`);
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

      default:
        return null;
    }
  }

  function respondGreeting(user) {
    const h=new Date().getHours(), g=h<12?'בוקר טוב':h<17?'שלום':'ערב טוב';
    return `${g} ${user.fullName}! מה תרצה לדעת?`;
  }

  function respondHelp(user) {
    const a=hasAdminAccess(user);
    return `**מה אני יכול לעשות:**\n• יתרת חופשה, ניצול, תחזית\n• מי בחופשה / WFH / מחלה — **היום, מחר, יום שלישי, 15/3 וכו'**\n• מצב הצוות שלך\n• סטטוס בקשת אישור | לוח חגים`
      +(a?`\n\n**מנהל:**\n• נתוני עובד לפי שם | ניתוח שחיקה\n• עלויות | עומס מחלקות | תחזית מחסור\n• בקשות ממתינות | לוג | פרוטוקולי העברת מקל`:'')
      +'\n\n**כתוב בחופשיות — מבין עברית טבעית!**';
  }

  function respondUnknown(rawInput, currentUser, db) {
    if (hasAdminAccess(currentUser)) {
      const uname=extractEmployeeName(rawInput,db);
      if(uname)return respondEmpBalance(db.users[uname],db,new Date().getFullYear());
    }
    if (/\d{1,2}\/\d{1,2}/.test(rawInput)) {
      return respondMyHistory(currentUser,db,parseTargetDate(rawInput));
    }
    return `לא הבנתי. לדוגמה:\n• "מה יתרת החופשה שלי?"\n• "מי בחופשה מחר?"\n• "מי עובד מהבית ביום שלישי?"\n• "כמה ניצלתי ביוני?"`;
  }

  // ============================================================
  // MAIN
  // ============================================================
  function respond(rawInput, currentUser, db) {
    if(!rawInput?.trim())return 'בבקשה הקלד שאלה.';
    if(!currentUser)return 'יש להתחבר למערכת.';

    conversationHistory.push({role:'user',text:rawInput});
    if(conversationHistory.length>MAX_HISTORY*2) conversationHistory=conversationHistory.slice(-MAX_HISTORY*2);

    const isAdmin=hasAdminAccess(currentUser), isManager=hasManagerAccess(currentUser);
    const intent=detectIntent(rawInput);
    const dateInfo=parseTargetDate(rawInput);
    const year=dateInfo.year||extractYear(rawInput);

    let response='';
    switch(intent) {
      case 'greeting':        response=respondGreeting(currentUser); break;
      case 'help':            response=respondHelp(currentUser); break;
      case 'who_am_i':        response=respondWhoAmI(currentUser,db); break;
      case 'my_dept': {
        const dept=Array.isArray(currentUser.dept)?currentUser.dept.join(', '):(currentUser.dept||'לא מוגדר');
        response=`אתה משויך למחלקת **${dept}**.`; break;
      }
      case 'my_balance':      response=respondMyBalance(currentUser,db,year); break;
      case 'my_used':         response=respondMyUsed(currentUser,db,year); break;
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

      // WHO — all date-aware
      case 'who_vacation':
        response=dateInfo.range?respondWhoAtRange(db,dateInfo,currentUser,'vacation'):respondWhoAt(db,dateInfo,currentUser,'vacation'); break;
      case 'who_wfh':
        response=dateInfo.range?respondWhoAtRange(db,dateInfo,currentUser,'wfh'):respondWhoAt(db,dateInfo,currentUser,'wfh'); break;
      case 'who_sick':
        response=dateInfo.range?respondWhoAtRange(db,dateInfo,currentUser,'sick'):respondWhoAt(db,dateInfo,currentUser,'sick'); break;
      case 'who_office':
        response=dateInfo.range?respondWhoAtRange(db,dateInfo,currentUser,'office'):respondWhoAt(db,dateInfo,currentUser,'office'); break;
      case 'team_status':
        response=dateInfo.range?respondWhoAtRange(db,dateInfo,currentUser,null):respondWhoAt(db,dateInfo,currentUser,null); break;

      // Admin/Manager
      case 'emp_balance': {
        if(!isManager){response='מידע על עובדים אחרים זמין למנהלים בלבד.';break;}
        const uname=extractEmployeeName(rawInput,db);
        if(!uname){response='לא זיהיתי שם עובד. נסה עם שם מלא.';break;}
        response=respondEmpBalance(db.users[uname],db,year); break;
      }
      case 'emp_vacation': {
        if(!isManager){response='מידע על עובדים אחרים זמין למנהלים בלבד.';break;}
        const uname=extractEmployeeName(rawInput,db);
        if(!uname){response='לא זיהיתי שם עובד.';break;}
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
        response=`מחלקת ${dept}: **${team.length} עובדים** — ${team.map(u=>u.fullName).join(', ')}.`; break;
      }
      case 'off_topic':       response='אני מוגבל לנושאי חופשות ונוכחות.'; break;

      // ── FAQ — all cases routed to respondFAQ ──────────────
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
        response = respondFAQ(intent, currentUser, db) || respondUnknown(rawInput, currentUser, db); break;
      default:                response=respondUnknown(rawInput,currentUser,db); break;
    }

    conversationHistory.push({role:'ai',text:response});
    return response;
  }

  function clearHistory() { conversationHistory=[]; }
  return { respond, clearHistory };
})();
