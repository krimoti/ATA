// ai-logic.js - מנוע העזר למערכת Dazura

const AIEngine = {
    // פונקציית העזר לשליפת הנתונים מהכספת של script.js
    getStoredData: function() {
        try {
            return JSON.parse(localStorage.getItem('vacSystem_v3')) || {};
        } catch(e) {
            console.error("AI Engine: Error reading DB", e);
            return {};
        }
    },

    // פונקציה שמפענחת שאלה חופשית ומחזירה תשובה מהנתונים
    ask: function(question) {
        const db = this.getStoredData();
        const q = question.toLowerCase();

        // דוגמה ללוגיקה של "מי נמצא היום?"
        if (q.includes("מי נמצא") || q.includes("מי במשרד")) {
            return this.getAttendanceStatus(db);
        }

        // דוגמה ללוגיקה של "יתרת חופשה"
        if (q.includes("כמה חופש") || q.includes("יתרה")) {
            return "כדי לענות במדויק, עליי לדעת את שם העובד. נסה לשאול: 'מה יתרת החופשה של [שם]'";
        }

        return "אני מבין את השאלה, אך זקוק לפרטים נוספים כדי לשלוף נתונים מה-DB.";
    },

    getAttendanceStatus: function(db) {
        const now = new Date();
        const todayKey = now.getFullYear() + '-' + 
                         String(now.getMonth()+1).padStart(2,'0') + '-' + 
                         String(now.getDate()).padStart(2,'0');
        
        let report = { inOffice: [], vacation: [], wfh: [], sick: [] };
        
        Object.keys(db.users || {}).forEach(uId => {
            const user = db.users[uId];
            const status = ((db.vacations || {})[uId] || {})[todayKey];
            
            if (status === 'full' || status === 'half') report.vacation.push(user.name);
            else if (status === 'wfh') report.wfh.push(user.name);
            else if (status === 'sick') report.sick.push(user.name);
            else report.inOffice.push(user.name);
        });

        return `סטטוס להיום (${todayKey}):\n` + 
               `🏠 במשרד: ${report.inOffice.join(', ') || 'אין'}\n` +
               `🌴 בחופשה: ${report.vacation.length}\n` +
               `💻 עבודה מהבית: ${report.wfh.length}`;
    }
};