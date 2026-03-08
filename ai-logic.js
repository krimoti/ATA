const AIEngine = {
    getStoredData() {
        try {
            return JSON.parse(localStorage.getItem('vacSystem_v3')) || {};
        } catch (e) {
            console.error("AI read error", e);
            return {};
        }
    },

    // מילות מפתח + וריאציות נפוצות
    patterns: {
        todayStatus: [
            /מי (במשרד|נמצא|בעבודה|היום)/i,
            /מי (לא|אין) (נמצא|בעבודה)/i,
            /סטטוס (היום|עכשיו)/i
        ],
        vacationBalance: [
            /כמה (חופש|ימי חופשה|יתרה)/i,
            /(יתרת |נותרו |נשארו ).*חופשה/i
        ],
        whoOnVacation: [
            /מי (בחופש|בחופשה|לא פה|לא בעבודה)/i
        ]
    },

    ask(question, currentUserId = null) {
        const db = this.getStoredData();
        const q = question.trim().toLowerCase();

        // 1. זיהוי כוונה
        if (this.matchAny(q, this.patterns.todayStatus)) {
            return this.getTodayStatus(db);
        }

        if (this.matchAny(q, this.patterns.whoOnVacation)) {
            return this.getWhoOnVacationToday(db);
        }

        // 2. שאלות עם שם עובד
        const mentionedName = this.extractName(q, db);
        if (mentionedName) {
            if (this.matchAny(q, this.patterns.vacationBalance)) {
                return this.getUserVacationBalance(db, mentionedName);
            }
        }

        // fallback
        return this.getHelpfulFallback(q);
    },

    matchAny(text, regexArray) {
        return regexArray.some(r => r.test(text));
    },

    extractName(q, db) {
        const words = q.split(/\s+/);
        for (let word of words) {
            const clean = word.replace(/[.,!?]/g, '');
            for (let uid in db.users || {}) {
                const name = (db.users[uid].name || '').toLowerCase();
                if (name.includes(clean) || clean.includes(name)) {
                    return db.users[uid].name;
                }
            }
        }
        return null;
    },

    getTodayStatus(db) {
        const today = this.getTodayKey();
        let inOffice = 0, vacation = 0, wfh = 0, sick = 0;

        Object.keys(db.users || {}).forEach(uid => {
            const status = ((db.vacations || {})[uid] || {})[today];
            if (status === 'full' || status === 'half') vacation++;
            else if (status === 'wfh') wfh++;
            else if (status === 'sick') sick++;
            else inOffice++;
        });

        return `סטטוס להיום (${today}):\n\n` +
               `🏢 במשרד: ${inOffice} עובדים\n` +
               `🌴 בחופשה: ${vacation} עובדים\n` +
               `🏠 עבודה מהבית: ${wfh} עובדים\n` +
               `🤒 בחופשת מחלה: ${sick} עובדים`;
    },

    getWhoOnVacationToday(db) {
        const today = this.getTodayKey();
        const onVac = [];

        Object.keys(db.users || {}).forEach(uid => {
            const status = ((db.vacations || {})[uid] || {})[today];
            if (status === 'full' || status === 'half') {
                onVac.push(db.users[uid].name);
            }
        });

        if (onVac.length === 0) return "אף אחד לא בחופשה היום 🎉";
        return `בחופשה היום: ${onVac.join(", ")}`;
    },

    getUserVacationBalance(db, name) {
        const user = Object.values(db.users || {}).find(u => 
            u.name.toLowerCase() === name.toLowerCase()
        );

        if (!user) return `לא מצאתי עובד בשם "${name}"`;

        const quota = (db.quotas?.[user.id]?.annual || 0);
        const used  = (db.usage?.[user.id]?.used || 0);

        return `${name}:\n` +
               `מכסה שנתית: ${quota} ימים\n` +
               `נוצל עד כה: ${used} ימים\n` +
               `יתרה נוכחית: **${quota - used}** ימים`;
    },

    getTodayKey() {
        const d = new Date();
        return d.getFullYear() + '-' +
               String(d.getMonth()+1).padStart(2,'0') + '-' +
               String(d.getDate()).padStart(2,'0');
    },

    getHelpfulFallback(q) {
        return "לא הבנתי בדיוק את השאלה 😅\n\n" +
               "אפשר לנסות לשאול לדוגמה:\n" +
               "• מי בחופשה היום?\n" +
               "• מה יתרת החופשה של דנה?\n" +
               "• סטטוס היום במשרד";
    }
};
