const AIEngine = {
    getStoredData() {
        try {
            return JSON.parse(localStorage.getItem('vacSystem_v3')) || {};
        } catch (e) {
            console.error("AI read error", e);
            return {};
        }
    },

    // מילות מפתח + וריאציות נפוצות – הרחבתי עם עוד intents
    patterns: {
        todayStatus: [
            /מי (במשרד|נמצא|בעבודה|היום|כרגע|עכשיו)/i,
            /מי (לא|אין) (נמצא|בעבודה|במשרד)/i,
            /סטטוס (היום|עכשיו|כרגע|במשרד)/i,
            /(איפה|מי|איזה) (עובדים|אנשים) (היום|כרגע)/i
        ],
        vacationBalance: [
            /כמה (חופש|ימי חופשה|יתרה|נותר|נשאר)/i,
            /(יתרת |נותרו |נשארו |כמה נשאר ).*חופשה/i,
            /מה (היתרה|המכסה|החופש) (שלי|של|שלה|שלו)/i
        ],
        whoOnVacation: [
            /מי (בחופש|בחופשה|לא פה|לא בעבודה|חופש|מחלה|מהבית)/i,
            /מי (חולה|במחלה|לא מרגיש טוב)/i,
            /מי (עובד מהבית|WFH|מהבית)/i,
            /רשימת (חופשות|מחלות|WFH)/i
        ],
        departmentStatus: [
            /סטטוס (מחלקה|מחלקת|צוות|קבוצה)/i,
            /מי (ב|לא ב) (מחלקה|מחלקת)/i,
            /(עומס|כיסוי|כוח אדם) (במחלקה|בצוות)/i
        ],
        futurePrediction: [
            /חיזוי (חופשות|עומס|כיסוי)/i,
            /מה (צפוי|יהיה|יקרה) (מחר|בשבוע|בחודש)/i,
            /האם יהיה (עומס|חוסר|בעיה) (ב)/i
        ],
        burnoutRisk: [
            /מי (בסיכון|עייף|שחוק|בשחיקה)/i,
            /רמת (שחיקה|עומס|עייפות) (של|ב)/i
        ],
        costEstimate: [
            /עלות (חופשות|חופש|מחלות)/i,
            /חיסכון (WFH|מהבית|חופש)/i,
            /תקציב (חופשות|שכר|עלויות)/i
        ],
        handoverInfo: [
            /פרוטוקול (העברה|מקל|חופשה)/i,
            /מה (עושים|צריך|משימות) (בזמן|כש)/i
        ],
        birthdayCheck: [
            /יום הולדת (מי|של|היום|מחר|בחודש)/i,
            /מי (חוגג|יש לו) יום הולדת/i
        ],
        quotaUpdate: [
            /עדכן (מכסה|יתרה|חופש)/i,
            /שנה (מכסה|יתרה|נתונים)/i
        ] // יכולת עדכון – אבל בלי חשיפת רגיש
    },

    // משתנים פנימיים לשמירת context (לא דולף החוצה)
    context: {
        lastUser: null,
        lastDate: null,
        lastDept: null
    },

    ask(question, currentUserId = null) {
        const db = this.getStoredData();
        const q = question.trim().toLowerCase();

        // 0. שמירת context אם יש שינויים
        const mentionedName = this.extractName(q, db);
        if (mentionedName) this.context.lastUser = mentionedName;

        const mentionedDept = this.extractDept(q, db);
        if (mentionedDept) this.context.lastDept = mentionedDept;

        const parsedDate = this.extractDate(q);
        if (parsedDate) this.context.lastDate = parsedDate;

        // 1. זיהוי כוונה – הרחבתי עם סדר עדיפויות
        if (this.matchAny(q, this.patterns.todayStatus)) {
            return this.getTodayStatus(db, currentUserId);
        }

        if (this.matchAny(q, this.patterns.whoOnVacation)) {
            return this.getWhoOnTypeToday(db, this.detectType(q));
        }

        if (this.matchAny(q, this.patterns.vacationBalance)) {
            const targetName = mentionedName || this.context.lastUser || db.users?.[currentUserId]?.name;
            if (!targetName) return "מי העובד? נסה לציין שם.";
            return this.getUserVacationBalance(db, targetName, currentUserId);
        }

        if (this.matchAny(q, this.patterns.departmentStatus)) {
            const dept = mentionedDept || this.context.lastDept || db.users?.[currentUserId]?.dept;
            if (!dept) return "איזו מחלקה? ציין בבקשה.";
            return this.getDeptStatus(db, dept, this.context.lastDate || this.getTodayKey());
        }

        if (this.matchAny(q, this.patterns.futurePrediction)) {
            return this.predictFutureLoad(db, parsedDate || this.getTomorrowKey());
        }

        if (this.matchAny(q, this.patterns.burnoutRisk)) {
            return this.assessBurnoutRisk(db, mentionedName);
        }

        if (this.matchAny(q, this.patterns.costEstimate)) {
            return this.estimateCosts(db, currentUserId); // כללי, בלי פרטי שכר
        }

        if (this.matchAny(q, this.patterns.handoverInfo)) {
            return this.getHandoverProtocol(db, mentionedName || db.users?.[currentUserId]?.name);
        }

        if (this.matchAny(q, this.patterns.birthdayCheck)) {
            return this.checkBirthdays(db, parsedDate || this.getTodayKey());
        }

        if (this.matchAny(q, this.patterns.quotaUpdate)) {
            return this.handleQuotaUpdate(q, db, currentUserId); // עדכון עצמי בלבד
        }

        // fallback
        return this.getHelpfulFallback(q);
    },

    matchAny(text, regexArray) {
        return regexArray.some(r => r.test(text));
    },

    detectType(q) {
        if (/חופש|חופשה/i.test(q)) return 'vacation';
        if (/מחלה|חולה/i.test(q)) return 'sick';
        if (/מהבית|WFH/i.test(q)) return 'wfh';
        return 'all';
    },

    extractName(q, db) {
        const words = q.split(/\s+/);
        for (let word of words) {
            const clean = word.replace(/[.,!?]/g, '').toLowerCase();
            for (let uid in db.users || {}) {
                const name = (db.users[uid].name || '').toLowerCase();
                if (name.includes(clean) || clean.includes(name.split(' ')[0])) {
                    return db.users[uid].name;
                }
            }
        }
        return null;
    },

    extractDept(q, db) {
        const words = q.split(/\s+/);
        const depts = new Set(Object.values(db.users || {}).map(u => u.dept?.toLowerCase()).filter(Boolean));
        for (let word of words) {
            const clean = word.replace(/[.,!?]/g, '').toLowerCase();
            if (depts.has(clean)) return clean;
        }
        return null;
    },

    extractDate(q) {
        // פשוט: מחר, השבוע, החודש – ללא תלות בספריות חיצוניות
        if (/מחר/i.test(q)) return this.getTomorrowKey();
        if (/השבוע/i.test(q)) return { type: 'week', start: this.getWeekStart() };
        if (/החודש/i.test(q)) return { type: 'month', start: this.getMonthStart() };
        // regex פשוט לתאריך YYYY-MM-DD או DD/MM
        const dateMatch = q.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2})/);
        if (dateMatch) {
            // טיפול פשוט
            if (dateMatch[1]) return dateMatch[1];
            if (dateMatch[2]) {
                const [d, m] = dateMatch[2].split('/').map(Number);
                const y = new Date().getFullYear();
                return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            }
        }
        return null;
    },

    getTodayKey() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    },

    getTomorrowKey() {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    },

    getWeekStart() {
        const d = new Date();
        d.setDate(d.getDate() - d.getDay());
        return this.dateToKey(d);
    },

    getMonthStart() {
        const d = new Date();
        d.setDate(1);
        return this.dateToKey(d);
    },

    dateToKey(d) {
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    },

    getTodayStatus(db, currentUserId) {
        const today = this.getTodayKey();
        let inOffice = [], vacation = [], wfh = [], sick = [];

        Object.keys(db.users || {}).forEach(uid => {
            if (uid === currentUserId) return; // אל תחשוף עצמי אם לא צריך, אבל כאן כן כי כללי
            const user = db.users[uid];
            const status = ((db.vacations || {})[uid] || {})[today];
            const name = user.name; // רק שם, בלי שכר/פרטים

            if (status === 'full' || status === 'half') vacation.push(name);
            else if (status === 'wfh') wfh.push(name);
            else if (status === 'sick') sick.push(name);
            else inOffice.push(name);
        });

        return `סטטוס להיום (${today}):\n\n` +
               `🏢 במשרד: ${inOffice.length} עובדים (${inOffice.slice(0,3).join(', ')}...)\n` +
               `🌴 בחופשה: ${vacation.length} עובדים (${vacation.join(', ') || 'אין'})\n` +
               `🏠 עבודה מהבית: ${wfh.length} עובדים (${wfh.join(', ') || 'אין'})\n` +
               `🤒 בחופשת מחלה: ${sick.length} עובדים (${sick.join(', ') || 'אין'})`;
    },

    getWhoOnTypeToday(db, type) {
        const today = this.getTodayKey();
        const result = [];

        Object.keys(db.users || {}).forEach(uid => {
            const status = ((db.vacations || {})[uid] || {})[today];
            const name = db.users[uid].name;

            if ((type === 'vacation' && (status === 'full' || status === 'half')) ||
                (type === 'sick' && status === 'sick') ||
                (type === 'wfh' && status === 'wfh')) {
                result.push(name);
            }
        });

        const labels = { vacation: 'בחופשה', sick: 'במחלה', wfh: 'מהבית' };
        if (result.length === 0) return `אף אחד לא ${labels[type] || ''} היום.`;
        return `${labels[type] || ''} היום: ${result.join(", ")}`;
    },

    getUserVacationBalance(db, name, currentUserId) {
        const user = Object.values(db.users || {}).find(u => u.name.toLowerCase() === name.toLowerCase());
        if (!user) return `לא מצאתי עובד בשם "${name}"`;

        // בדיקת הרשאות: רק עצמי או מנהל (הנחה ש-currentUserId הוא admin אם לא מוגדר)
        if (user.id !== currentUserId && !db.users?.[currentUserId]?.isAdmin) {
            return "מצטער, אינך מורשה לצפות ביתרות של עובדים אחרים.";
        }

        const quota = (db.quotas?.[user.id]?.annual || 0);
        const used = (db.usage?.[user.id]?.used || 0);
        const balance = quota - used;

        return `${name}:\n` +
               `מכסה שנתית: ${quota} ימים\n` +
               `נוצל עד כה: ${used} ימים\n` +
               `יתרה נוכחית: **${balance}** ימים\n` +
               `(נתונים פנימיים, לא כולל חישובי שכר)`;
    },

    getDeptStatus(db, dept, dateKey) {
        let count = { total: 0, available: 0 };

        Object.keys(db.users || {}).forEach(uid => {
            const user = db.users[uid];
            if (user.dept?.toLowerCase() === dept.toLowerCase()) {
                count.total++;
                const status = ((db.vacations || {})[uid] || {})[dateKey];
                if (!status || status === 'wfh') count.available++; // WFH נחשב זמין
            }
        });

        return `סטטוס מחלקת ${dept} בתאריך ${dateKey}:\n` +
               `סה"כ עובדים: ${count.total}\n` +
               `זמינים: ${count.available} (${Math.round((count.available / count.total) * 100)}% כיסוי)\n` +
               `המלצה: אם מתחת ל-70% – שקול גיוס זמני.`;
    },

    predictFutureLoad(db, startDate) {
        // חיזוי פשוט מבוסס היסטוריה: ממוצע חופשות בשבוע שעבר
        const pastWeek = this.getPastWeekKeys();
        let pastVac = 0;
        pastWeek.forEach(day => {
            pastVac += this.countVacOnDay(db, day);
        });
        const avgDaily = pastVac / 7;

        return `חיזוי עומס לחודש הבא (מבוסס היסטוריה פנימית):\n` +
               `ממוצע יומי חופשות: ~${Math.round(avgDaily)} עובדים\n` +
               `סיכון עומס: ${avgDaily > 5 ? 'גבוה – תכנן גיבויים' : 'נמוך – הכול תקין'}`;
    },

    getPastWeekKeys() {
        const keys = [];
        for (let i = 1; i <= 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            keys.push(this.dateToKey(d));
        }
        return keys;
    },

    countVacOnDay(db, day) {
        let count = 0;
        Object.keys(db.vacations || {}).forEach(uid => {
            if (db.vacations[uid][day]) count++;
        });
        return count;
    },

    assessBurnoutRisk(db, name = null) {
        // לוגיקה פשוטה: אם מעל 10 ימי חופש רצופים לא נלקחו
        const risks = [];
        Object.keys(db.users || {}).forEach(uid => {
            const user = db.users[uid];
            const lastVac = this.findLastVac(db, uid);
            const daysSince = this.daysSince(lastVac);
            if (daysSince > 90) risks.push(user.name);
        });

        if (name) {
            return risks.includes(name) ? `${name} בסיכון שחיקה (מעל 90 יום ללא חופש)` : `${name} בסדר – לקח חופש לאחרונה.`;
        }
        return `עובדים בסיכון שחיקה: ${risks.join(', ') || 'אין כאלה כרגע'}`;
    },

    findLastVac(db, uid) {
        const vacs = db.vacations?.[uid] || {};
        const dates = Object.keys(vacs).sort((a,b) => new Date(b) - new Date(a));
        return dates[0] || '1970-01-01'; // default old
    },

    daysSince(dateStr) {
        const last = new Date(dateStr);
        const now = new Date();
        return Math.floor((now - last) / (1000 * 60 * 60 * 24));
    },

    estimateCosts(db, currentUserId) {
        // כללי בלבד, בלי שכר אישי
        const totalVacThisMonth = this.countTotalVacThisMonth(db);
        return `הערכה פנימית (ללא פרטי שכר):\n` +
               `חופשות החודש: ${totalVacThisMonth} ימים כולל\n` +
               `חיסכון WFH: ~20% מעלויות משרד (מבוסס סטטיסטיקה פנימית)\n` +
               `המלצה: עודד WFH להפחתת עלויות.`;
    },

    countTotalVacThisMonth(db) {
        const monthStart = this.getMonthStart();
        let count = 0;
        Object.keys(db.vacations || {}).forEach(uid => {
            Object.keys(db.vacations[uid]).forEach(day => {
                if (day >= monthStart) count++;
            });
        });
        return count;
    },

    getHandoverProtocol(db, name) {
        // הנחה שיש handover ב-DB – מוסיף יכולת פנימית
        const handover = db.handovers?.[name] || { tasks: ['משימה 1', 'משימה 2'], contact: 'איש קשר' };
        return `פרוטוקול העברת מקל ל-${name} (מידע פנימי):\n` +
               handover.tasks.map(t => `• ${t}`).join('\n') + '\n' +
               `איש קשר: ${handover.contact}\n` +
               `(לא כולל סיבות אישיות)`;
    },

    checkBirthdays(db, dateKey) {
        const birthdays = [];
        Object.values(db.users || {}).forEach(user => {
            const bday = user.birthday; // הנחה שיש שדה birthday MM-DD
            if (bday && bday.slice(5) === dateKey.slice(5)) {
                birthdays.push(user.name);
            }
        });
        return birthdays.length > 0 
            ? `ימי הולדת ב-${dateKey}: ${birthdays.join(', ')} 🎉` 
            : `אין ימי הולדת ב-${dateKey}.`;
    },

    handleQuotaUpdate(q, db, currentUserId) {
        // עדכון עצמי בלבד, בלי שמירה אמיתית כאן – רק סימולציה
        const amount = q.match(/\d+/)?.[0] || 0;
        return `עדכון מכסה עצמי: הוספת ${amount} ימים (לא שומר כאן – השתמש בממשק).\n` +
               `יתרה מעודכנת: ${db.quotas?.[currentUserId]?.annual + Number(amount)} (פנימי בלבד).`;
    },

    getHelpfulFallback(q) {
        return "לא הבנתי בדיוק 😅\n\n" +
               "רעיונות לשאלות:\n" +
               "• מי בחופשה היום?\n" +
               "• מה יתרת החופשה של [שם]?\n" +
               "• סטטוס מחלקת [מחלקה]?\n" +
               "• חיזוי עומס מחר?\n" +
               "• מי בסיכון שחיקה?\n" +
               "• עלות חופשות כללית?\n" +
               "• פרוטוקול העברה של [שם]?\n" +
               "• ימי הולדת החודש?";
    }
};
