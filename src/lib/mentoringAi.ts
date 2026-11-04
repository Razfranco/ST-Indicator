import { supabase } from "./supabaseClient";
export type AiSummary = {
  title: string;
  summary: string;
  action_items: { task: string; owner: string; due: string }[];
  questions: string[];
  snapshot: { label: string; value: string }[];
  sections: { heading: string; paragraphs: string[] }[];
  insights: string[];
  decisions: string[];
  closing: string;
  review_notes: string[];
  sufficient_source: boolean;
};
export type AiRun = {
  id: string;
  meeting_id: string;
  created_at: string;
  filename: string | null;
  recording_path: string | null;
  status:
    | "uploaded"
    | "transcribing"
    | "transcribed"
    | "summarizing"
    | "completed"
    | "failed";
  transcript_text: string | null;
  summary: AiSummary | null;
  reviewed_text: string | null;
  reviewed_at: string | null;
  error_code: string | null;
  locked_until: string | null;
  style_ready: boolean;
  transcription_attempts: number;
  summary_attempts: number;
  settings_version: string;
};
export type AiSettings = {
  id: string;
  instructions: string;
  examples: string;
  style_ready: boolean;
  updated_at: string;
  updated_by: string | null;
  source_documents: {
    name: string;
    path: string;
    kind: string;
    sha256: string;
  }[];
};
const endpoint = "https://sharktradebom.com/api/mentoring-ai";
const messages: Record<string, string> = {
  profile_no_sources:
    "יש לשמור לפחות סיכום אחד לאחר בדיקת מנטור כדי לבנות פרופיל.",
  profile_history_limit:
    "היסטוריית הסיכומים גדולה מכדי לעבד בפעולה אחת. המידע נשמר; נדרש עיבוד מדורג.",
  profile_invalid: "לא ניתן היה לאמת את הראיות לפרופיל. לא נוצרה התראת שינוי.",
  source_review_required:
    "התמליל סומן כלא מספיק אמין. יש לבדוק ולתקן אותו ולהפיק גרסה חדשה לפני מסירת הסיכום.",
  document_unavailable: "לא ניתן להפיק או להוריד את המסמך כרגע.",
  unauthorized: "נדרשת התחברות עם הרשאת מנטורינג.",
  not_found: "אין גישה לפגישה הזו.",
  not_configured: "חיבור התמלול והסיכום עדיין לא הופעל בשרת.",
  schema_missing: "הכנת מסד הנתונים לעיבוד טרם הושלמה.",
  consent_required:
    "יש לשמור את הפגישה עם אישור הסכמה להקלטה ולתמלול לפני העיבוד.",
  busy_or_limit:
    "העיבוד כבר מתבצע או שמוצו שלושת הניסיונות. אם העיבוד נקטע, ניתן לנסות שוב כעבור חמש דקות.",
  ai_key: "המפתח בשרת אינו מאפשר את הפעולה. פנה למנהל.",
  ai_limit:
    "OpenAI החזיר מגבלת שימוש או יתרה. התוצאות שכבר נוצרו נשמרו; ניתן לנסות שוב בהמשך.",
  ai_unavailable: "שירות העיבוד אינו זמין כרגע. ניתן לנסות שוב.",
  audio_size: "הקובץ ריק, השתנה בהעלאה או גדול מ־25MB.",
  audio_invalid: "יש להעלות את קובץ ההקלטה לפני התמלול, בפורמט נתמך.",
  transcript_invalid: "התמליל ריק או ארוך מדי לעיבוד.",
  summary_incomplete: "הסיכום לא הושלם. התמליל נשמר וניתן לנסות שוב.",
  summary_refused: "לא ניתן היה להפיק סיכום מהתוכן. התמליל נשמר.",
  summary_invalid: "תוצאת הסיכום לא תקינה; התמליל נשמר.",
  daily_limit:
    "הגעת למגבלה של 20 עיבודים חדשים ביממה. אפשר להמשיך מעיבוד שמור או להמתין.",
  rate_limited: "בוצעו פעולות רבות. יש להמתין לפני ניסיון נוסף.",
  processing_failed:
    "העיבוד לא הושלם. ניתן לנסות שוב; השלבים שכבר נשמרו לא יבוצעו מחדש.",
};
export function aiError(code: string) {
  return (
    messages[code] ?? "לא ניתן להשלים את הפעולה כרגע. בדוק את החיבור ונסה שוב."
  );
}
export async function mentoringRequest<T>(body?: unknown): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw Error(aiError("unauthorized"));
  const r = await fetch(endpoint, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + session.access_token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    credentials: "omit",
  });
  const data = await r.json().catch(() => ({ error: "unavailable" }));
  if (!r.ok) throw Error(aiError(data.error));
  return data as T;
}
export function summaryText(s: AiSummary) {
  return [
    s.title,
    "נתוני המפגש\n" +
      s.snapshot.map((v) => v.label + ": " + v.value).join("\n"),
    "סקירת השבוע\n" + s.summary,
    ...s.sections.map((v) => v.heading + "\n" + v.paragraphs.join("\n\n")),
    s.insights.length
      ? "התובנות להמשך\n" +
        s.insights.map((v, i) => i + 1 + ". " + v).join("\n")
      : "",
    s.decisions.length
      ? "החלטות על התיקים והסיכון\n" +
        s.decisions.map((v) => "• " + v).join("\n")
      : "",
    s.action_items.length
      ? "להמשך\n" +
        s.action_items
          .map(
            (a) => "□ " + [a.task, a.owner, a.due].filter(Boolean).join(" - "),
          )
          .join("\n")
      : "",
    s.questions.length
      ? "שאלות פתוחות\n" + s.questions.map((v) => "• " + v).join("\n")
      : "",
    s.closing,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type ProfileObservation = {
  dimension: "mental_report" | "behavior" | "performance" | "risk_management";
  kind: "baseline" | "pattern" | "improvement" | "regression" | "change";
  statement: string;
  evidence: { run_id: string; quote: string }[];
  confidence: "low" | "medium" | "high";
};
export type StudentProfile = {
  id: string;
  student_id: string;
  created_at: string;
  created_by: string;
  source_runs: string[];
  status: string;
  reviewed_at: string | null;
  error_code: string | null;
  result: {
    overview: string;
    observations: ProfileObservation[];
    open_questions: string[];
  } | null;
};
export type TranscriptVersion = {
  id: string;
  meeting_id: string;
  transcript_text: string;
  filename: string | null;
  uploaded_at: string;
  uploaded_by: string;
};
export type SummaryReview = {
  id: string;
  run_id: string;
  meeting_id: string;
  reviewed_text: string;
  reviewed_at: string;
  reviewed_by: string;
  pdf_path: string | null;
};
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function downloadSummaryPdf(reviewId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw Error(aiError("unauthorized"));
  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "document", id: reviewId }),
    credentials: "omit",
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({ error: "unavailable" }));
    throw Error(aiError(d.error));
  }
  downloadBlob(await r.blob(), "סיכום מפגש ליווי.pdf");
}
