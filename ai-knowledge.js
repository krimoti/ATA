// ============================================================
// DAZURA AI — KNOWLEDGE BASE v2.0 — DAZY Edition
// Smart • Warm • Context-aware • Bilingual (HE+EN)
// ============================================================

const DazuraKnowledge = (() => {

  // ============================================================
  // SOCIAL vs BUSINESS DETECTION
  // ============================================================
  const SOCIAL_PATTERNS = [
    /^(היי|הי|הלו|שלום|yo|hey|hi|hello)\s*[!?.]?\s*$/,
    /^(מה נשמע|מה קורה|מה המצב|מה שלומך|how are you|what'?s up|wassup)\s*[?]?\s*$/,
    /^(הכל בסדר|הכל טוב|בסדר גמור|ok|okay|fine|good|great)\s*[?!.]?\s*$/,
    /^(אני בסדר|אני טוב|אני ממש טוב|I'?m fine|I'?m good|I'?m ok|I'?m great)\s*[!.]?\s*$/,
    /^(ביי|להתראות|bye|goodbye|cya|תתראה)\s*[!.]?\s*$/,
    /^(בוקר טוב|ערב טוב|לילה טוב|צהריים טובים|שבת שלום|חג שמח)\s*[!.]?\s*$/,
    /^(good morning|good evening|good night|good afternoon)\s*[!.]?\s*$/,
    /^(כן|לא|אולי|yes|no|maybe|sure)\s*[!?.]?\s*$/,
  ];

  function isSocial(text) {
    const t = text.trim();
    return SOCIAL_PATTERNS.some(function(p) { return p.test(t); });
  }

  // ============================================================
  // LANGUAGE DETECTION
  // ============================================================
  function detectLanguage(text) {
    const heChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
    const total = text.replace(/\s/g, '').length;
    return heChars / Math.max(total, 1) > 0.25 ? 'he' : 'en';
  }

  // ============================================================
  // TIME CONTEXT
  // ============================================================
  function getTimeContext(inputText) {
    if (inputText) {
      const t = inputText.toLowerCase().trim();
      if (/שבת שלום|שבת/.test(t))        return { label:'שבת',  emoji:'✨', greeting:'שבת שלום',           greetEn:'Shabbat Shalom' };
      if (/חג שמח|מועדים לשמחה/.test(t)) return { label:'חג',   emoji:'🎉', greeting:'חג שמח',             greetEn:'Happy Holiday' };
    }
    const h = new Date().getHours();
    if (h <  6) return { label:'לילה',   emoji:'🌙', greeting:'לילה טוב',           greetEn:'Good night' };
    if (h < 12) return { label:'בוקר',   emoji:'☀️', greeting:'בוקר טוב',           greetEn:'Good morning' };
    if (h < 15) return { label:'צהריים', emoji:'🌞', greeting:'צהריים טובים',       greetEn:'Good afternoon' };
    if (h < 18) return { label:'אחהצ',   emoji:'☕', greeting:'אחר הצהריים טובים',  greetEn:'Good afternoon' };
    if (h < 21) return { label:'ערב',    emoji:'🌅', greeting:'ערב טוב',            greetEn:'Good evening' };
    return             { label:'לילה',   emoji:'🌙', greeting:'לילה טוב',           greetEn:'Good night' };
  }

  // ============================================================
  // EMOTION DETECTION
  // ============================================================
  function detectEmotion(text) {
    const t = text.toLowerCase();
    if (/תודה|מצוין|מעולה|מדהים|כיף|שמח|thanks|great|awesome|perfect/.test(t)) return 'grateful';
    if (/מתוסכל|עצבני|מעצבן|לא עובד|נמאס|frustrated|annoyed|angry/.test(t))    return 'frustrated';
    if (/לא הבנתי|מבולבל|לא ברור|confused|unclear/.test(t))                     return 'confused';
    if (/דחוף|מיד|חשוב|urgent|asap/.test(t))                                    return 'urgent';
    if (/עייף|קשה|לא בסדר|tired|hard|difficult/.test(t))                        return 'tired';
    return 'neutral';
  }

  // ============================================================
  // INTENT PATTERNS
  // ============================================================
  const INTENTS = [
    { name:'who_am_i',       score:10, patterns:[/מי אני|שמי|הפרופיל שלי|who am i|my profile/] },
    { name:'who_is_dazy',    score:12, patterns:[/^מי אתה|^מה אתה|תציג את עצמך|ספר על עצמך|who are you|what are you|what can you do/] },
    { name:'my_balance',     score:10, patterns:[/יתרה|יתרת|כמה ימים (יש|נשאר|נותר)|כמה חופשה|מה היתרה|כמה נשאר לי|balance|days left|how many days/] },
    { name:'my_used',        score:10, patterns:[/ניצלתי|לקחתי|השתמשתי|ניצול|used|took|days used/] },
    { name:'my_quota',       score:10, patterns:[/מכסה|כמה מגיע לי|זכאי ל|quota|entitlement/] },
    { name:'forecast',       score:10, patterns:[/תחזית|חיזוי|המלצה|קצב ניצול|כמה אוכל לקחת|forecast|recommendation/] },
    { name:'eoy_projection', score:10, patterns:[/סוף שנה|עד דצמבר|כמה יישאר|כמה נשאר.*השנה|end of year/] },
    { name:'faq_tech_sim_calc', score:11, patterns:[/תחשב.*אם אקח|כמה יישאר.*אם|סימולצי|if i take|calculate if/] },
    { name:'who_vacation',   score:10, patterns:[/מי (ב|יצא|נמצא|בחופשה|חופש|נופש|נהנה|נעלם|נח)|מי (לא מגיע|לא הגיע|לא כאן|לא פה)|מי נעדר|מי חסר|נעדרים היום|who is (on vacation|off|away)|who'?s out/] },
    { name:'who_wfh',        score:10, patterns:[/מי (עובד מהבית|מהבית|remote)|wfh|work from home/] },
    { name:'who_sick',       score:10, patterns:[/מי חולה|מי (ב)?מחלה|who'?s sick|sick day/] },
    { name:'who_office',     score:10, patterns:[/מי במשרד|מי בחברה|מי (כאן|פה|נמצא)|נוכחות|who'?s in|at the office/] },
    { name:'team_status',    score:10, patterns:[/מצב (הצוות|החברה|כולם)|הצוות (היום|מחר|השבוע)|מה קורה.*היום|מה המצב.*היום|מצב כללי|סקירה כללית|team status|what'?s going on|daily status/] },
    { name:'request_status', score:10, patterns:[/סטטוס|הבקשה שלי|אושרה|נדחה|ממתין לאישור|מצב הבקשה|request status|approved|rejected|pending/] },
    { name:'emp_balance',    score:10, patterns:[/(יתרה|ימים|חופשה) (של|ל)[^\s]|הצג יתרה של|balance of|days for/] },
    { name:'burnout_risk',   score:10, patterns:[/שחיקה|90 יום|ללא חופש|לא לקח חופש|burnout|no vacation/] },
    { name:'cost_analysis',  score:10, patterns:[/עלות|חבות|כסף|תקציב|cost|budget|liability/] },
    { name:'pending_48',     score:10, patterns:[/48|ממתינות לאישור|בקשות שלא אושרו|pending requests/] },
    { name:'welfare_score',  score:10, patterns:[/ציון רווחה|welfare|רווחת עובדים/] },
    { name:'shortage',       score:10, patterns:[/מחסור|חיזוי עומס|חוסר עובדים|shortage|staffing/] },
    { name:'headcount',      score:10, patterns:[/כמה עובדים|מצבת|כמה אנשים|headcount|staff count/] },
    { name:'handovers',      score:10, patterns:[/פרוטוקול|העברת מקל|handover/] },
    { name:'audit_log',      score:10, patterns:[/לוג|audit|יומן|מי שינה|audit log/] },
    { name:'holidays',       score:10, patterns:[/חג|חגים|פסח|ראש השנה|holiday/] },
    { name:'my_dept',        score:10, patterns:[/מחלקה שלי|באיזה מחלקה|my department|my team/] },
    { name:'my_history',     score:10, patterns:[/(חופשה|לקחתי|הייתי) ב(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|\d{1,2}\/\d{1,2})|vacation history/] },
    { name:'team_info',      score:10, patterns:[/חברי הצוות|מי בצוות|team members/] },
    { name:'departments',    score:10, patterns:[/כמה מחלקות|אילו מחלקות|רשימת מחלקות|departments/] },
    { name:'greeting',       score:10, patterns:[/^(שלום|היי|הי|הלו|בוקר|ערב|לילה|צהריים|שבת)|^(hi|hello|hey|good morning|good evening|good night)|מה נשמע|מה קורה|מה שלומך|how are you/] },
    { name:'help',           score:10, patterns:[/עזרה|מה אתה יכול|מה אפשר|help|what can you do|capabilities/] },
    { name:'off_topic',      score:10, patterns:[/מזג אוויר|בישול|מתכון|חדשות|ספורט|פוליטיקה|weather|cooking|news|sports|politics|bitcoin|crypto/] },
    { name:'thanks',         score:10, patterns:[/תודה|יישר כח|כל הכבוד|מצוין|מעולה|מדהים|thanks|thank you|great|awesome/] },
    { name:'apology',        score:10, patterns:[/סליחה|סורי|מצטער|לא הבנתי|sorry|my bad/] },
    { name:'confused',       score:10, patterns:[/לא מה שרציתי|לא זה|טעית|לא נכון|wrong answer|that'?s not/] },
    { name:'dazy_creator',   score:12, patterns:[/מי יצר אותך|מי בנה אותך|מי עשה אותך|who made you|who created you|who built you/] },
    { name:'dazy_laugh',     score:10, patterns:[/תגרום לי לצחוק|משהו מצחיק|בדיחה|make me laugh|joke|funny/] },
    { name:'dazy_feel',      score:10, patterns:[/איך אתה מרגיש|מה מצב רוחך|how do you feel|your mood/] },
    { name:'dazy_compliment',score:10, patterns:[/תגיד לי משהו נחמד|תעודד אותי|מחמאה|compliment|encourage me/] },
    { name:'dazy_vs_human',  score:10, patterns:[/יותר חכם מ|לעומת|compared to|better than/] },
    { name:'faq_how_vacation',   score:10, patterns:[/איך (מגישים|לבקש|לקחת) חופשה|how to request vacation|how to take time off/] },
    { name:'faq_change_password',score:10, patterns:[/לשנות סיסמה|change password|reset password/] },
    { name:'faq_how_add_employee',score:10,patterns:[/איך מוסיפים עובד|add employee|new employee/] },
    { name:'faq_how_approve',    score:10, patterns:[/איך מאשרים|how to approve/] },
    { name:'faq_time_fix',       score:10, patterns:[/לתקן שעות|fix hours|correct hours/] },
    { name:'faq_tech_security',  score:10, patterns:[/אבטחה|מאובטח|security|secure|encrypted/] },
    { name:'faq_tech_cloud',     score:10, patterns:[/נשמר.*ענן|firebase.*נתונים|where.*saved|cloud storage/] },
    { name:'faq_tech_backup',    score:10, patterns:[/גיבוי|backup|back up/] },
    { name:'faq_version',        score:10, patterns:[/גרסה|version|עדכון אחרון|last update/] },
    { name:'forecast_month',     score:11, patterns:[/(תחזית|עומס).{0,15}(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|שבוע הבא)/] },
    { name:'moti_all_same_week', score:10, patterns:[/כולם.*חופשה.*אותו שבוע|מה אם כולם יבקשו/] },
    { name:'permissions',        score:10, patterns:[/הרשאות|מי יכול|מי מורשה|permissions/] },
    { name:'heatmap',            score:10, patterns:[/מפת חום|heatmap|פיזור חופשות/] },
    { name:'dept_overload',      score:10, patterns:[/מחלקה עמוסה|עומס מחלקה|overloaded department/] },
  ];

  function detectIntent(text) {
    var t = text.toLowerCase().trim();
    var best = null, bestScore = 0, secondary = null, secondScore = 0;
    for (var i = 0; i < INTENTS.length; i++) {
      var intent = INTENTS[i];
      var matchCount = 0;
      for (var j = 0; j < intent.patterns.length; j++) {
        if (intent.patterns[j].test(t)) matchCount++;
      }
      if (matchCount > 0) {
        var score = intent.score + Math.min(matchCount - 1, 3);
        if (score > bestScore) {
          secondary = best; secondScore = bestScore;
          best = intent.name; bestScore = score;
        } else if (score > secondScore) {
          secondary = intent.name; secondScore = score;
        }
      }
    }
    return { intent: best || 'unknown', score: bestScore, secondary: secondScore > 6 ? secondary : null };
  }

  // ============================================================
  // FOLLOW-UP DETECTION — 10 סוגים
  // ============================================================
  var FOLLOW_UP = [
    { type:'more_results',   test: function(t) { return /^(מי עוד|עוד מישהו|יש עוד|more|anyone else|who else)\??$/.test(t); } },
    { type:'about_subject',  test: function(t) { return /^(ומה איתו|ומה איתה|ומה עמו|what about him|what about her|and him|and her)\??/.test(t); } },
    { type:'his_balance',    test: function(t) { return /כמה (ימים|יתרה) (יש לו|יש לה|does he have|does she have)/.test(t); } },
    { type:'tomorrow_same',  test: function(t) { return /^(מחר|ומחר|what about tomorrow|tomorrow)\??$/.test(t); } },
    { type:'next_week_same', test: function(t) { return /^(שבוע הבא|ומה בשבוע הבא|next week)\??$/.test(t); } },
    { type:'same_context',   test: function(t) { return /בהקשר|בנוגע לזה|same thing|same question/.test(t); } },
    { type:'more_dept',      test: function(t) { return /^(מי מהצוות|מי מהמחלקה|who else in|others in the team)/.test(t); } },
    { type:'ref_subject',    test: function(t) { return /^(הוא|היא|אותו|he|she|him|her)\??/.test(t); } },
    { type:'when_back',      test: function(t) { return /מתי (חוזר|חוזרת|יחזור|תחזור)|when (is|does|will).{0,10}(back|return)/.test(t); } },
    { type:'details',        test: function(t) { return /פרטים|ספר עוד|תרחיב|tell me more|more details|elaborate/.test(t); } },
  ];

  function detectFollowUp(text) {
    var t = text.trim().toLowerCase();
    for (var i = 0; i < FOLLOW_UP.length; i++) {
      if (FOLLOW_UP[i].test(t)) return FOLLOW_UP[i].type;
    }
    return null;
  }

  // ============================================================
  // SMART GUESS
  // ============================================================
  function guessIntent(text) {
    var t = text.toLowerCase();
    if (/מי|who/.test(t))                   return '"מי בחופשה היום?"';
    if (/כמה|יתרה|ימים|balance|days/.test(t)) return '"מה היתרה שלי?"';
    if (/מחר|שבוע|tomorrow|week/.test(t))   return '"מי בחופשה מחר?"';
    if (/מחלקה|צוות|team|dept/.test(t))     return '"מצב הצוות היום"';
    if (/בקשה|אישור|request/.test(t))       return '"מה סטטוס הבקשה שלי?"';
    if (/שעות|hours/.test(t))               return '"איך מתקנים שעות?"';
    return '"מה אתה יכול?"';
  }

  // ============================================================
  // SOCIAL RESPONSES
  // ============================================================
  function respondSocial(text, userName, lang) {
    var t = text.trim().toLowerCase();
    var n = userName || '';
    var tc = getTimeContext(text);
    var isEn = lang === 'en';

    if (/ביי|להתראות|bye|goodbye|cya/.test(t))
      return isEn ? 'Bye **' + n + '**! Come back anytime 👋' : 'להתראות **' + n + '**! כאן בכל עת 👋';

    if (/הכל בסדר|הכל טוב|אני בסדר|אני טוב|I'?m (fine|good|ok|great)|all good/.test(t)) {
      var opts = isEn
        ? ['Great to hear, **' + n + '**! ' + tc.emoji + ' Anything I can help with?', 'Awesome! Let me know if you need anything.', 'Perfect! Here whenever you need data.']
        : ['שמח לשמוע, **' + n + '**! ' + tc.emoji + ' אפשר לעשות משהו?', 'מצוין! אני כאן אם צריך משהו.', 'אחלה! ואם רוצה לדעת מה קורה בחברה — רק תשאל.'];
      return opts[Math.floor(Math.random() * opts.length)];
    }

    if (/^(כן|yes|yep|sure|נכון|בטח)\s*[!.]?\s*$/.test(t))
      return isEn ? 'Got it! What would you like to know?' : 'מעולה! מה תרצה לדעת?';

    if (/^(לא|no|nope)\s*[!.]?\s*$/.test(t))
      return isEn ? 'No problem! Let me know if you change your mind.' : 'בסדר! אם תצטרך משהו — אני כאן.';

    if (/בוקר טוב|good morning/.test(t)) {
      var m = isEn
        ? ['Good morning **' + n + '**! ☀️ Ready for the day?', 'Morning **' + n + '**! ☀️ What can I help with?', 'Good morning! ☀️ Let\'s make it a good one.']
        : [tc.greeting + ' **' + n + '**! ☀️ מוכן ליום?', tc.greeting + '! ☀️ בוא נראה מה קורה היום.', tc.greeting + ' **' + n + '**! ☀️ עם מה אפשר לעזור?'];
      return m[Math.floor(Math.random() * m.length)];
    }

    if (/ערב טוב|good evening/.test(t))
      return isEn ? 'Good evening **' + n + '**! 🌅 Winding down?' : tc.greeting + ' **' + n + '**! 🌅 מסיימים את היום?';

    if (/לילה טוב|good night/.test(t))
      return isEn ? 'Good night **' + n + '**! 🌙 Rest well.' : tc.greeting + ' **' + n + '**! 🌙 מנוחה טובה.';

    if (/שבת שלום/.test(t)) return 'שבת שלום **' + n + '**! ✨ תנוח/י טוב.';
    if (/חג שמח/.test(t))   return 'חג שמח **' + n + '**! 🎉';

    var greetHe = [
      tc.greeting + ' **' + n + '**! ' + tc.emoji + ' במה אפשר לעזור?',
      'היי **' + n + '**! ' + tc.emoji + ' מה אפשר לעשות בשבילך?',
      'שלום **' + n + '**! ' + tc.emoji + ' שאל בחופשיות.',
      tc.greeting + ' **' + n + '**! ' + tc.emoji + ' איך אפשר לעזור?',
      'היי! ' + tc.emoji + ' **' + n + '**, מה תרצה לדעת?',
    ];
    var greetEn = [
      tc.greetEn + ' **' + n + '**! ' + tc.emoji + ' What can I help with?',
      'Hey **' + n + '**! ' + tc.emoji + ' How can I assist?',
      'Hello **' + n + '**! ' + tc.emoji + ' Ask me anything.',
      'Hi there **' + n + '**! ' + tc.emoji + ' What\'s on your mind?',
    ];
    var pool = isEn ? greetEn : greetHe;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ============================================================
  // VACATION FLAIR
  // ============================================================
  function addVacationFlair(names, label) {
    if (!names || !names.length) return null;
    var flairs = [
      'נהנים ' + label + '! 🏖️ בא לך להצטרף? 😄',
      label + ' — יצאו לנשום אוויר צח 🌿',
      label + ' — נטענים מחדש 🔋',
      label + ' — מגיע להם! 🌴',
      label + ' — מנצלים ימי חופש בחוכמה 😎',
    ];
    return flairs[Math.floor(Math.random() * flairs.length)];
  }

  // ============================================================
  // DAZY PERSONALITY
  // ============================================================
  var DAZY_PERSONALITY = {
    creator: function(n) {
      return 'נבנתי על ידי **מוטי קריחלי** 🏆 — עם המטרה לעשות את ניהול החופשות חכם, מהיר ואנושי.\nאני **DAZY** — העוזר הדיגיטלי של Dazura.' + (n ? ' שמח להכיר, **' + n + '** 😊' : '');
    },
    whoIsDazy: function(n, isAdmin, isManager) {
      return 'אני **DAZY** — העוזר החכם של מערכת **Dazura** 🤖\n\n' +
        '**מה אני יודע לעשות:**\n' +
        '• עונה על שאלות חופשה, יתרות ונוכחות בזמן אמת\n' +
        '• מדריך אותך בכל לשונית במערכת\n' +
        '• מבין עברית ואנגלית — שאל בחופשיות\n' +
        (isManager || isAdmin ? '• מנתח עומסים, תחזיות ושחיקת עובדים\n' : '') +
        (isAdmin ? '• ניהול עובדים, הרשאות וגיבויים\n' : '') +
        '\nמחובר כ: **' + n + '**\n\nמה תרצה לדעת? 😊';
    },
    feel: function() {
      var h = new Date().getHours();
      var moods = h < 9
        ? ['מתחמם לאט לאט ☕', 'עדיין בוטים ראשונים 🌅', 'מוכן להתחיל את היום']
        : h < 14
        ? ['מלא אנרגיה! ⚡', 'ממש בפורמה 💪', 'מחכה לשאלות הבאות 😊']
        : h < 18
        ? ['קצת אחרי הצהריים... ☕', 'עדיין ערני ומוכן', 'בריצה מלאה 🚀']
        : ['ב-mode ערב 🌅', 'מסיים את היום בחיוך', 'רגוע אבל ממוקד'];
      return 'אני מרגיש: **' + moods[Math.floor(Math.random() * moods.length)] + '**\n\nכל שאלה שתשאל רק תשפר את מצב הרוח שלי 😄';
    },
    compliment: function(n) {
      var c = [
        '**' + n + '**, אתה מנהל/ת את הזמן שלך בצורה מרשימה 💪',
        'שמח שאתה/את כאן **' + n + '** — שאלות טובות עושות אותי חכם יותר 😊',
        '**' + n + '**, אתה/את תמיד שואל/ת את הדברים הנכונים!',
        'אחד הדברים שאני מעריך ב**' + n + '** — הסקרנות שלך 🌟',
      ];
      return c[Math.floor(Math.random() * c.length)];
    },
    laugh: function() {
      var j = [
        'למה עובד לא לקח חופש? כי חשב שה-"balance" הוא חשבון בנק 😄',
        'מה ההבדל בין מנהל לעובד בחופשה? המנהל בודק מיילים. העובד... גם 😅',
        'שאלו את ה-AI: "האם יש לך יום חופש?" ענה: "יש לי 0 ימים יתרה — אני לא לוקח הפסקות" 🤖',
        'כמה מתכנתים צריך לשנות נורה? אחד — אבל לוקח 3 ספרינטים לתכנן 😄',
      ];
      return j[Math.floor(Math.random() * j.length)];
    },
    offTopic: function(topic, n, isEn) {
      return isEn
        ? '**' + n + '**, ' + topic + ' is outside my expertise! I\'m a vacation management specialist 😄 Ask me about leave balances, attendance, or the system instead.'
        : '**' + n + '**, ' + topic + ' — זה לא בדיוק התחום שלי 😄 אני מומחה בניהול חופשות ונוכחות. שאל/י אותי על יתרות, מי בחופשה, או איך לנווט במערכת.';
    },
    vsHuman: function(n) {
      return '**' + n + '**, אני לא מתחרה עם בני אדם — אני עוזר להם 😊\nאני מהיר בנתונים, אבל אתה/את מחליט/ה. ביחד עובדים טוב יותר.';
    },
  };

  // ============================================================
  // THANKS — 20 וריאציות
  // ============================================================
  var THANKS_RESPONSES = [
    function(n) { return 'בשמחה **' + n + '**! 😊'; },
    function(n) { return 'תמיד בשבילך **' + n + '**!'; },
    function(n) { return 'על לא דבר! ' + getTimeContext().emoji; },
    function(n) { return 'שמח לעזור **' + n + '** 🙂'; },
    function(n) { return 'הנאה שלי!'; },
    function(n) { return 'זה מה שאני פה בשבילו **' + n + '** 😊'; },
    function(n) { return 'כיף! עוד שאלות? אני כאן.'; },
    function(n) { return '**' + n + '** — בכיף תמיד!'; },
    function(n) { return getTimeContext().emoji + ' שמח שעזרתי!'; },
    function(n) { return 'ממש שמח שזה עזר!'; },
    function(n) { return 'You\'re welcome **' + n + '**! 😊'; },
    function(n) { return 'Anytime **' + n + '**!'; },
    function(n) { return 'Happy to help! 🙂'; },
    function(n) { return 'תענוג לעבוד איתך **' + n + '**!'; },
    function(n) { return 'בכיף! אם יש עוד — אני כאן.'; },
    function(n) { return 'מושלם! שאל/י בכל עת.'; },
    function(n) { return 'שמח שהייתי שימושי **' + n + '** ' + getTimeContext().emoji; },
    function(n) { return 'אין בעד מה! תמיד כאן.'; },
    function(n) { return 'Great! Let me know if you need anything else.'; },
    function(n) { return 'זה הכיף שלי **' + n + '** 🌟'; },
  ];

  // ============================================================
  // CONFUSED — 15 וריאציות עם ניחוש
  // ============================================================
  var CONFUSED_RESPONSES = [
    function(n, hint) { return '**' + n + '**, אולי התכוונת ל: ' + hint + '? 🤔'; },
    function(n, hint) { return 'לא לגמרי הבנתי — אנסה לנחש: ' + hint + '? אם לא — נסח מחדש.'; },
    function(n)       { return 'מעניין... 🤔 נסח שוב בצורה אחרת ואנסה שוב.'; },
    function(n, hint) { return 'הבנתי חלק — אם התכוונת ל' + hint + ' רשום שוב ואענה.'; },
    function(n)       { return '**' + n + '**, ניסוח חופשי עובד — רק תגיד מה אתה צריך.'; },
    function(n, hint) { return 'אולי: ' + hint + '? אם כן — כתוב שוב ואענה מיד.'; },
    function(n)       { return 'שאלה מעניינת 🤔 — קצת מעורפלת. תוסיף מילה?'; },
    function(n)       { return 'לא הצלחתי לתפוס — כתוב **"עזרה"** לרשימת האפשרויות.'; },
    function(n, hint) { return '**' + n + '**, נשמע כמו שאלה על ' + hint + '?'; },
    function(n)       { return 'כמעט הבנתי 😄 — תנסח מחדש ואני כבר שם.'; },
    function(n, hint) { return 'Hmm, maybe you meant ' + hint + '? Try rephrasing.'; },
    function(n)       { return 'Not sure I got that — try: "who\'s on vacation?" or "my balance?"'; },
    function(n, hint) { return 'Did you mean ' + hint + '? If so, try asking that way.'; },
    function(n)       { return '**' + n + '**, I almost got it 😄 — try rephrasing.'; },
    function(n)       { return 'לא בטוח, אבל אנסה בכל זאת... שאל שוב ואגרום לזה לעבוד! 💪'; },
  ];

  // ============================================================
  // CONTEXT SLOTS
  // ============================================================
  function EMPTY_CONTEXT() {
    return {
      intent: null, dateInfo: null, resultList: [], subject: null,
      subjectName: null, dept: null, data: null, lastQuestion: null,
      turnCount: 0, lang: 'he',
    };
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  return {
    isSocial: isSocial,
    detectLanguage: detectLanguage,
    detectIntent: detectIntent,
    detectFollowUp: detectFollowUp,
    detectEmotion: detectEmotion,
    getTimeContext: getTimeContext,
    guessIntent: guessIntent,
    respondSocial: respondSocial,
    addVacationFlair: addVacationFlair,
    DAZY_PERSONALITY: DAZY_PERSONALITY,
    THANKS_RESPONSES: THANKS_RESPONSES,
    CONFUSED_RESPONSES: CONFUSED_RESPONSES,
    EMPTY_CONTEXT: EMPTY_CONTEXT,
  };

})();
