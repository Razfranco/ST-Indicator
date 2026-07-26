# ST Indicator — PWA

אפליקציית web (PWA) למעקב ביצועים של אינדיקטור מסחר יומי. עובדת בדפדפן (Mac) וכ"אפליקציה" באייפון (Add to Home Screen), עם סנכרון מלא ובזמן אמת בין מכשירים דרך Supabase — יומן משותף לכל השותפים המאושרים.

**סטאק:** React + Vite + TypeScript, Tailwind CSS v4, Supabase (DB + Auth + Realtime), Recharts, vite-plugin-pwa.

## שלב 1 — יצירת פרויקט Supabase (חינמי)

1. היכנס/י ל-[supabase.com](https://supabase.com) והירשם/י (חינמי).
2. New Project → תן/י שם, סיסמה ל-DB, ואזור קרוב אליך.
3. לאחר שהפרויקט נוצר: **Settings → API**.
4. העתק/י משם:
   - `Project URL` → זה `VITE_SUPABASE_URL`
   - `anon public` key → זה `VITE_SUPABASE_ANON_KEY`

## שלב 2 — הרצת ה-SQL migrations

יש להריץ את כל קובצי ה-SQL שבתיקייה `supabase/migrations/`, **לפי הסדר המספרי** (0001, 0002, 0003, 0004...). לכל אחד: **SQL Editor → New query** בדשבורד של Supabase, הדבקת כל תוכן הקובץ, ולחיצה על **Run**. כל קובץ הוא שאילתה נפרדת — לא מחליפים קובץ קודם, מריצים כל אחד בתורו.

- `0001_trades.sql` — טבלת `trades` הבסיסית
- `0002_simplify_trades.sql` — עדכון השדות בטופס ההזנה
- `0003_enable_realtime.sql` — הפעלת סנכרון בזמן אמת בין מכשירים
- `0004_multi_user_admin.sql` — מערכת משתמשים מרובים: יומן משותף, אישור מנהל לכל משתמש חדש

אחרי הרצת 0004: המשתמש הקיים היחיד באפליקציה הופך אוטומטית **למנהל מאושר**. כל מי שנרשם אחרי זה מתחיל כ"ממתין לאישור" ולא רואה נתונים עד שהמנהל יאשר אותו דרך לשונית "ניהול" באפליקציה.

## שלב 3 — הגדרת משתני סביבה

בקובץ `.env` שבשורש הפרויקט (כבר קיים עם placeholders), מלא/י:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxxxxxxxxxxx...
```

> `.env` כבר ב-`.gitignore` ולא יעלה ל-git.

## שלב 4 — יצירת המשתמש שלך (המנהל)

**חשוב: צור/י את המשתמש הראשון שלך *לפני* הרצת `0004_multi_user_admin.sql`** — כך שהוא יזוהה כמשתמש הקיים היחיד וייהפך אוטומטית למנהל מאושר. אם כבר הרצת את 0004 לפני יצירת משתמש, פשוט הירשם/י ואז עדכן/י ידנית בטבלת `profiles` (ב-Table Editor): `role = admin`, `approved = true`.

1. הרץ/י את האפליקציה (ראה שלב 5) ולחץ/י "אין לך חשבון? הרשמה", הזן/י אימייל וסיסמה.
2. אם הופעל אימות אימייל (ברירת מחדל ב-Supabase): **Authentication → Users** בדשבורד, מצא/י את המשתמש ואשר/י אותו ידנית (או בדוק/י את תיבת הדואר לקישור האימות).

הרשמה נשארת פתוחה לכולם בכוונה — כך שותפים יכולים ליצור חשבון בעצמם. כל משתמש חדש נכנס במצב "ממתין לאישור" ולא רואה נתונים עד שתאשר/י אותו דרך לשונית **ניהול** באפליקציה (מוצגת רק למנהלים).

## שלב 5 — הרצה מקומית

```bash
npm install
npm run dev
```

פתח/י את הכתובת שתוצג (בד"כ `http://localhost:5173`). התחבר/י עם המשתמש שיצרת.

## שלב 6 — דיפלוי ל-Vercel (חינמי)

1. דחוף/י את הפרויקט ל-GitHub (repo פרטי מומלץ).
2. ב-[vercel.com](https://vercel.com): New Project → יבוא מה-repo.
3. Vercel יזהה אוטומטית שזה פרויקט Vite. הוסף/י את משתני הסביבה תחת **Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy.
5. **באייפון:** פתח/י את כתובת ה-Vercel ב-Safari → כפתור שיתוף → "הוסף למסך הבית". האפליקציה תיפתח כמו אפליקציה רגילה, במסך מלא.

## פקודות שימושיות

```bash
npm run dev       # שרת פיתוח מקומי
npm run build     # build לפרודקשן (כולל service worker)
npm run preview   # תצוגה מקדימה של ה-build המקומי
npm run lint       # בדיקת lint
```

## מבנה תיקיות

```
src/
  components/   רכיבים משותפים (Layout, ProtectedRoute, AdminRoute, StatTile)
  context/      AuthContext (session + profile/הרשאות)
  lib/          חיבור Supabase, קבועים, חישובים, hooks (useTrades, useProfiles — עם realtime)
  pages/        מסכי האפליקציה (Login, עסקאות, טופס עסקה, דשבורד, דוח שבועי, ניהול)
  types/        טיפוסי TypeScript התואמים לסכמת ה-DB
supabase/
  migrations/   קובצי SQL להרצה ב-Supabase SQL Editor, לפי סדר
```
