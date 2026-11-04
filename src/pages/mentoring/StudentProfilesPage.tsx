import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useStudents } from "../../lib/useStudents";
import { useMentorshipMeetings } from "../../lib/useMentorshipMeetings";
import { mentoringRequest, type StudentProfile } from "../../lib/mentoringAi";
import {
  Section,
  Field,
  inputClass,
} from "../../components/BusinessFormControls";
import { Button } from "../../components/ui/button";
const kinds = {
  baseline: "נקודת התחלה",
  pattern: "דפוס חוזר",
  improvement: "התקדמות",
  regression: "נסיגה הדורשת בירור",
  change: "שינוי",
};
const dimensions = {
  mental_report: "התנהלות מנטלית מדווחת",
  behavior: "הרגלי מסחר",
  performance: "ביצועים מדווחים",
  risk_management: "ניהול סיכון",
};
export function StudentProfilesPage() {
  const { students } = useStudents(),
    { meetings } = useMentorshipMeetings(),
    [params, setParams] = useSearchParams();
  const selected = params.get("student") ?? students[0]?.id ?? "";
  const [profiles, setProfiles] = useState<StudentProfile[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sources, setSources] = useState<
      { id: string; meeting_id: string; reviewed_at: string | null }[]
    >([]);
  const refresh = useCallback(async () => {
    const [r, s] = await Promise.all([
      supabase
        .from("mentoring_student_profiles")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("meeting_ai_runs")
        .select("id,meeting_id,reviewed_at")
        .not("reviewed_at", "is", null),
    ]);
    if (r.error || s.error) throw Error("לא ניתן לטעון את פרופילי הליווי.");
    setProfiles(r.data);
    setSources(s.data ?? []);
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setError((e as Error).message));
  }, [refresh]);
  const history = profiles.filter((p) => p.student_id === selected),
    current = history.find((p) => p.status === "completed"),
    studentMeetings = meetings
      .filter((m) => m.student_id === selected)
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  async function generate() {
    setBusy(true);
    setError("");
    try {
      await mentoringRequest({ action: "profile", studentId: selected });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function acknowledge() {
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      await mentoringRequest({ action: "review_profile", id: current.id });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">פרופילי ליווי וארכיון מפגשים</h2>
      <p className="text-sm text-muted-foreground">
        תצפיות לאורך זמן מסיכומים שנבדקו בלבד, עם ציטוטי מקור. זו תמונת ליווי
        למסחר ולא אבחון פסיכולוגי. ביצועים המוזכרים בשיחה הם דיווחים ואינם אימות
        מול חשבון המסחר. מוצגות רק פגישות שיש לך הרשאה לצפות בהן.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Field label="תלמיד">
        <select
          className={inputClass}
          value={selected}
          onChange={(e) => setParams({ student: e.target.value })}
        >
          {students.map((s) => (
            <option value={s.id} key={s.id}>
              {s.display_name}
            </option>
          ))}
        </select>
      </Field>
      <Button disabled={!selected || busy} onClick={() => void generate()}>
        {busy ? "מעבד…" : "עדכון פרופיל מהסיכומים הבדוקים"}
      </Button>
      {current?.result ? (
        <Section title="תמונת מצב">
          <p className="whitespace-pre-wrap">{current.result.overview}</p>
          <p className="text-xs text-muted-foreground">
            עודכן: {new Date(current.created_at).toLocaleString("he-IL")} ·
            מבוסס על {current.source_runs.length} פגישות
          </p>
          {!current.reviewed_at && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
              תצפיות חדשות ממתינות לבדיקת מנטור. בדוק את המקורות לפני הסקת
              מסקנות.
            </p>
          )}
          {current.result.observations.map((o, i) => (
            <div
              key={i}
              className="space-y-2 rounded-lg border border-border p-4"
            >
              <p className="text-sm font-semibold">
                {dimensions[o.dimension]} · {kinds[o.kind]}
              </p>
              <p>{o.statement}</p>
              <p className="text-xs text-muted-foreground">
                רמת ביסוס שהמודל העריך:{" "}
                {o.confidence === "high"
                  ? "גבוהה"
                  : o.confidence === "medium"
                    ? "בינונית"
                    : "מוגבלת"}
                ; דורשת בדיקת מנטור
              </p>
              {o.evidence.map((e, j) => {
                const source = sources.find((s) => s.id === e.run_id),
                  meeting = meetings.find((m) => m.id === source?.meeting_id);
                return (
                  <blockquote
                    key={j}
                    className="border-e-2 border-primary pe-3 text-sm"
                  >
                    <p>״{e.quote}״</p>
                    {source && (
                      <Link
                        className="underline"
                        to={
                          "/mentoring/meetings/" + source.meeting_id + "/edit"
                        }
                      >
                        לסיכום המקור
                        {meeting
                          ? " · " +
                            new Date(meeting.starts_at).toLocaleDateString(
                              "he-IL",
                            )
                          : ""}
                      </Link>
                    )}
                  </blockquote>
                );
              })}
            </div>
          ))}
          {current.result.open_questions.length > 0 && (
            <div>
              <h3 className="font-semibold">מה עוד כדאי לברר</h3>
              <ul className="list-inside list-disc">
                {current.result.open_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void acknowledge()}
          >
            סימון שהתצפיות נבדקו
          </Button>
          {current.reviewed_at && (
            <p className="text-xs text-muted-foreground">
              נבדק: {new Date(current.reviewed_at).toLocaleString("he-IL")}
            </p>
          )}
        </Section>
      ) : (
        <p className="text-sm text-muted-foreground">
          עדיין אין פרופיל שמור. שמור סיכום לאחר בדיקת מנטור ואז עדכן את
          הפרופיל.
        </p>
      )}
      {history.length > 1 && (
        <details>
          <summary className="cursor-pointer font-semibold">
            היסטוריית פרופילים ({history.length})
          </summary>
          {history
            .filter((p) => p.id !== current?.id)
            .map((p) => (
              <details className="my-2 rounded-lg border p-3" key={p.id}>
                <summary>
                  {new Date(p.created_at).toLocaleString("he-IL")} ·{" "}
                  {p.status === "completed"
                    ? "הושלם"
                    : p.status === "failed"
                      ? "נדרש ניסיון נוסף"
                      : "בעיבוד"}
                </summary>
                <p className="mt-2 whitespace-pre-wrap">{p.result?.overview}</p>
                {p.result?.observations.map((o, i) => (
                  <p key={i} className="mt-2 text-sm">
                    {kinds[o.kind]}: {o.statement}
                  </p>
                ))}
              </details>
            ))}
        </details>
      )}
      <Section title="ארכיון הפגישות והחומרים">
        {studentMeetings.length ? (
          studentMeetings.map((m) => (
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"
              key={m.id}
            >
              <div>
                <p>{new Date(m.starts_at).toLocaleString("he-IL")}</p>
                <p className="text-sm text-muted-foreground">
                  {m.topic || "מפגש ליווי"}
                </p>
              </div>
              <Link
                className="underline"
                to={"/mentoring/meetings/" + m.id + "/edit"}
              >
                הקלטה, תמליל וסיכום
              </Link>
            </div>
          ))
        ) : (
          <p>אין פגישות להצגה.</p>
        )}
      </Section>
    </div>
  );
}
