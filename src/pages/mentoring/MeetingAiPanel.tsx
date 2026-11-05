import { prepareRecording, validateLocalRecording, type PreparedRecording } from "../../lib/recordingCompression";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  mentoringRequest,
  summaryText,
  aiError,
  downloadSummaryPdf,
  downloadBlob,
  type AiRun,
  type TranscriptVersion,
  type SummaryReview,
} from "../../lib/mentoringAi";
import {
  Section,
  Field,
  inputClass,
} from "../../components/BusinessFormControls";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { toast } from "../../components/ui/toast";
const statusLabel: Record<AiRun["status"], string> = {
  uploaded: "ההקלטה ממתינה לעיבוד",
  transcribing: "מתמלל את ההקלטה",
  transcribed: "התמליל נשמר; ממתין לסיכום",
  summarizing: "מפיק סיכום",
  completed: "הסיכום מוכן לבדיקה",
  failed: "העיבוד נעצר",
};
export function MeetingAiPanel({
  meetingId,
  consentSaved,
  hasSavedTranscript,
  onCopyTranscript,
}: {
  meetingId: string;
  consentSaved: boolean;
  hasSavedTranscript: boolean;
  onCopyTranscript: (text: string) => void;
}) {
  const [runs, setRuns] = useState<AiRun[]>([]),
    [selectedId, setSelectedId] = useState(""),
    [loading, setLoading] = useState(true),
    [ready, setReady] = useState(false),
    [backgroundReady, setBackgroundReady] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [review, setReview] = useState("");
  const [audioUrl, setAudioUrl] = useState(""),
    [versions, setVersions] = useState<TranscriptVersion[]>([]),
    [reviews, setReviews] = useState<SummaryReview[]>([]),
    [profileNotice, setProfileNotice] = useState("");
  const mounted = useRef(true);
  const compressionController = useRef<AbortController | null>(null);
  const preparedCache = useRef<{ original: File; prepared: PreparedRecording } | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      compressionController.current?.abort();
    };
  }, []);
  const load = useCallback(async () => {
    const r = await supabase
      .from("meeting_ai_runs")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false });
    if (r.error)
      throw Error(
        "לא ניתן לטעון את תוצאות העיבוד. ייתכן שהכנת המסד טרם הושלמה.",
      );
    const [v, history] = await Promise.all([
      supabase
        .from("meeting_transcript_versions")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("meeting_summary_reviews")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("reviewed_at", { ascending: false }),
    ]);
    if (mounted.current) {
      setRuns(r.data as AiRun[]);
      setVersions(v.data ?? []);
      setReviews(history.data ?? []);
    }
    return r.data as AiRun[];
  }, [meetingId]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([load(), mentoringRequest<{ ready: boolean; backgroundReady?: boolean }>()])
      .then(([rows, health]) => {
        if (!cancelled) {
          setSelectedId(rows[0]?.id ?? "");
          setReady(health.ready);
          setBackgroundReady(!!health.backgroundReady);
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);
  const selected = runs.find((r) => r.id === selectedId);
  useEffect(() => {
    setAudioUrl("");
  }, [selected?.id]);
  const selectedSummaryText = selected?.summary ? summaryText(selected.summary) : "";
  useEffect(() => {
    setReview(selected?.reviewed_text ?? selectedSummaryText);
  }, [selected?.id, selected?.reviewed_text, selectedSummaryText]);
  useEffect(() => {
    if (!backgroundReady || !runs.some(r => r.queue_state === 'waiting' || r.queue_state === 'running')) return;
    const timer = window.setInterval(() => { void load().catch(() => undefined); }, 8000);
    return () => window.clearInterval(timer);
  }, [backgroundReady, runs, load]);
  async function enqueueRun(id: string) {
    setProgress('שומר משימה בתור העיבוד…');
    await mentoringRequest<AiRun>({ action: 'enqueue', id });
    if (mounted.current) {
      await load();
      toast.add({ title: 'ההעלאה הושלמה והעיבוד נשמר בתור. אפשר לסגור את המסך.', type: 'success' });
    }
  }
  async function processRun(id: string) {
    for (let step = 0; step < 2; step++) {
      if (mounted.current)
        setProgress(step === 0 ? "מכין את השמע ומתמלל את ההקלטה…" : "מפיק סיכום מהתמליל…");
      const r = await mentoringRequest<AiRun>({ action: "process", id });
      if (mounted.current) await load();
      if (r.status === "completed") return;
    }
  }
  async function start(fromTranscript: boolean) {
    if (!consentSaved) {
      setError(aiError("consent_required"));
      return;
    }
    if (!fromTranscript) {
      try { if (!file) throw new Error('בחרו הקלטה.'); validateLocalRecording(file) }
      catch (e) { setError((e as Error).message); return }
    }
    setBusy(true);
    setError("");
    setProgress("מכין עיבוד חדש…");
    try {
      let uploadFile = file;
      if (!fromTranscript) {
        const controller = new AbortController();
        compressionController.current = controller;
        setCompressing(file!.size > 50_000_000);
        setProgress(file!.size > 50_000_000 ? 'מכין דחיסה במכשיר… יש להשאיר את המסך פתוח.' : 'מכין העלאה…');
        const prepared = preparedCache.current?.original === file
          ? preparedCache.current.prepared
          : await prepareRecording(file!, {
            signal: controller.signal,
            onProgress: p => { if (mounted.current) setProgress(`מכווץ את ההקלטה במכשיר… ${Math.floor(p * 100)}% — יש להשאיר את המסך פתוח.`) },
          });
        if (!mounted.current || controller.signal.aborted) return;
        preparedCache.current = { original: file!, prepared };
        uploadFile = prepared.file;
        setCompressionInfo(prepared.compressed ? `ההקלטה כווצה מ־${(prepared.originalBytes / 1_000_000).toFixed(1)}MB ל־${(uploadFile.size / 1_000_000).toFixed(1)}MB. הגרסה המכווצת, במלוא אורך השיחה וללא הווידאו, היא שתישמר בפלטפורמה.` : '');
        setCompressing(false);
        compressionController.current = null;
      }
      const run = await mentoringRequest<AiRun>({
        action: "create",
        id: crypto.randomUUID(),
        meetingId,
        fromTranscript,
        ...(!fromTranscript ? { filename: uploadFile!.name, bytes: uploadFile!.size } : {}),
      });
      setSelectedId(run.id);
      await load();
      if (!fromTranscript) {
        setProgress("מעלה הקלטה לאחסון פרטי…");
        const r = await supabase.storage
          .from("mentoring-recordings")
          .upload(run.recording_path!, uploadFile!, {
            upsert: false,
            contentType: uploadFile!.type || "application/octet-stream",
          });
        if (r.error)
          throw Error(
            "העלאת ההקלטה לא הושלמה. אפשר להתחיל מחדש; לא בוצע תמלול.",
          );
      }
      if (backgroundReady) await enqueueRun(run.id);
      else {
        await processRun(run.id);
        if (mounted.current) toast.add({ title: "התמליל וטיוטת הסיכום נשמרו", type: "success" });
      }
    } catch (e) {
      if (mounted.current) {
        setError((e as Error).message);
        await load().catch(() => undefined);
      }
    } finally {
      if (mounted.current) {
        setBusy(false);
        setCompressing(false);
        compressionController.current = null;
        setProgress("");
      }
    }
  }
  async function resume() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      if (backgroundReady) await enqueueRun(selected.id);
      else await processRun(selected.id);
    } catch (e) {
      setError((e as Error).message);
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  async function saveReview() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await mentoringRequest({
        action: "review",
        id: selected.id,
        text: review,
      });
      await load();
      toast.add({ title: "הסיכום הבדוק נשמר", type: "success" });
      setProfileNotice("מעדכן פרופיל ליווי לפי הסיכומים הבדוקים…");
      try {
        const m = await supabase
          .from("mentorship_meetings")
          .select("student_id")
          .eq("id", meetingId)
          .single();
        if (m.error) throw m.error;
        await mentoringRequest({
          action: "profile",
          studentId: m.data.student_id,
        });
        setProfileNotice(
          "פרופיל הליווי עודכן. התצפיות וההתראות ממתינות לבדיקה בלשונית פרופילי ליווי.",
        );
      } catch {
        setProfileNotice(
          "הסיכום נשמר. עדכון הפרופיל טרם הושלם; אפשר להפעיל אותו מלשונית פרופילי ליווי.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function playAudio() {
    if (!selected?.recording_path) return;
    setError("");
    const r = await supabase.storage
      .from("mentoring-recordings")
      .createSignedUrl(selected.recording_path, 300);
    if (r.error) setError("לא ניתן לטעון את ההקלטה.");
    else setAudioUrl(r.data.signedUrl);
  }
  async function pdf(id: string) {
    setBusy(true);
    setError("");
    try {
      await downloadSummaryPdf(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="הקלטה וסיכום פגישה">
      <p className="text-sm text-muted-foreground">
        ההקלטה והתמליל יועברו ל־OpenAI לצורך העיבוד. התוצאות נשמרות בפגישה
        כטיוטה פרטית למנטור ולמנהלים; הן אינן נשלחות לתלמיד אוטומטית. בדוק את
        הדיוק לפני שימוש.
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertDescription role="alert">{error}</AlertDescription>
        </Alert>
      )}
      {loading ? (
        <p>טוען…</p>
      ) : (
        <>
          {!ready && (
            <p className="text-sm text-muted-foreground">
              חיבור שירות העיבוד עדיין לא הופעל.
            </p>
          )}
          {!consentSaved && (
            <p className="text-sm text-muted-foreground">
              יש לסמן הסכמה להקלטה/תמלול ולשמור את הפגישה לפני העיבוד.
            </p>
          )}
          <Field
            label="הקלטת הפגישה"
            hint="MP3, M4A, MP4, WAV, WEBM, MPEG — אפשר לבחור קובץ עד 100MB. מעל 50MB השמע יכווץ במכשיר לפני ההעלאה; בפלטפורמה תישמר הגרסה המכווצת ללא הווידאו. שמרו אצלכם את קובץ המקור."
          >
            <input
              type="file"
              accept=".mp3,.m4a,.mp4,.wav,.webm,.mpeg,.mpga"
              disabled={busy}
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); preparedCache.current = null; setCompressionInfo(""); setError("") }}
              className={inputClass}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!ready || busy || !consentSaved || !file}
              onClick={() => void start(false)}
            >
              העלאה, תמלול וסיכום
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!ready || busy || !consentSaved || !hasSavedTranscript}
              onClick={() => void start(true)}
            >
              סיכום מהתמליל השמור
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {backgroundReady
              ? 'יש להשאיר את המסך פתוח עד שהדחיסה, ההעלאה והוספת המשימה לתור הושלמו. לאחר הודעת האישור אפשר לסגור את המסך; השרת ימשיך לתמלל ולסכם. פוש בסיום יישלח למכשירים שבהם הפעלת התראות, לפי הגדרות החשבון.'
              : 'השאר את המסך פתוח עד סיום שני השלבים. אם העיבוד נקטע, השלבים שהושלמו נשמרים וניתן להמשיך מהם.'}
            {' '}כל עיבוד חדש יוצר גרסה נוספת ושימוש ב־API.
          </p>
          {compressionInfo && <p className="text-sm text-muted-foreground">{compressionInfo}</p>}
          {busy && <p role="status">{progress || "שומר…"}</p>}
          {compressing && <Button type="button" variant="outline" onClick={() => compressionController.current?.abort()}>ביטול דחיסה</Button>}
          {runs.length > 0 && (
            <Field label="גרסאות עיבוד">
              <select
                className={inputClass}
                value={selectedId}
                disabled={busy}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.created_at).toLocaleString("he-IL")} ·{" "}
                    {statusLabel[r.status]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {selected && (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <p className="font-medium">{selected.queue_state === 'waiting' ? 'בתור לעיבוד בשרת — אפשר לסגור את המסך' : selected.queue_state === 'running' ? statusLabel[selected.status] + ' בשרת — אפשר לסגור את המסך' : statusLabel[selected.status]}</p>
              {selected.recording_path && (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void playAudio()}
                  >
                    טעינת ההקלטה לניגון
                  </Button>
                  {audioUrl && (
                    <audio
                      controls
                      src={audioUrl}
                      className="w-full"
                      preload="none"
                    />
                  )}
                </div>
              )}
              {selected.summary && selected.summary.review_notes.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                  <p className="font-semibold">
                    הערות פנימיות למנטור — אינן נכללות במסמך לתלמיד
                  </p>
                  <ul className="list-inside list-disc">
                    {selected.summary.review_notes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.summary?.sufficient_source === false && (
                <p role="alert" className="text-destructive">
                  אין מספיק תוכן אמין להפקת סיכום למסירה. בדוק את התמליל והפק
                  גרסה חדשה.
                </p>
              )}
              {!selected.style_ready && (
                <p className="text-sm text-muted-foreground">
                  סגנון סיכום ראשוני — טרם הוגדרו ההנחיות והדוגמאות האישיות שלך.
                </p>
              )}
              {selected.error_code && (
                <p role="alert" className="text-sm text-destructive">
                  {aiError(selected.error_code)}
                </p>
              )}
              {selected.status !== "completed" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !ready || !consentSaved || selected.queue_state === 'waiting' || selected.queue_state === 'running'}
                  onClick={() => void resume()}
                >
                  המשך עיבוד / ניסיון נוסף
                </Button>
              )}
              {selected.transcript_text && (
                <details>
                  <summary className="cursor-pointer font-medium">
                    תמליל ההקלטה
                  </summary>
                  <p className="my-3 max-h-96 overflow-auto whitespace-pre-wrap text-sm">
                    {selected.transcript_text}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onCopyTranscript(selected.transcript_text!)}
                  >
                    העתקה לשדה תמליל הפגישה לבדיקה ושמירה
                  </Button>
                </details>
              )}
              {selected.summary && (
                <>
                  <Field
                    label="סיכום לעריכה ובדיקה"
                    hint="זהו סיכום של התמליל וההנחיות שנשמרו בזמן יצירת הגרסה. שינוי תמליל או הנחיות אינו משנה גרסה קיימת."
                  >
                    <textarea
                      rows={16}
                      className={inputClass}
                      maxLength={60000}
                      value={review}
                      disabled={busy}
                      onChange={(e) => setReview(e.target.value)}
                    />
                  </Field>
                  <Button
                    type="button"
                    disabled={
                      busy ||
                      !review.trim() ||
                      selected.summary.sufficient_source === false
                    }
                    onClick={() => void saveReview()}
                  >
                    שמירת סיכום לאחר בדיקה
                  </Button>
                  {selected.reviewed_at && (
                    <p className="text-xs text-muted-foreground">
                      נבדק ונשמר:{" "}
                      {new Date(selected.reviewed_at).toLocaleString("he-IL")}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {profileNotice && (
            <p role="status" className="text-sm">
              {profileNotice}
            </p>
          )}
          {(versions.length > 0 || reviews.length > 0) && (
            <details>
              <summary className="cursor-pointer font-semibold">
                ארכיון תמלילים וסיכומים
              </summary>
              <div className="my-3 space-y-3">
                {versions.map((v) => (
                  <details key={v.id} className="rounded-lg border p-3">
                    <summary className="cursor-pointer">
                      תמליל שמור ·{" "}
                      {new Date(v.uploaded_at).toLocaleString("he-IL")}
                    </summary>
                    <p className="my-3 max-h-80 overflow-auto whitespace-pre-wrap text-sm">
                      {v.transcript_text}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        downloadBlob(
                          new Blob([v.transcript_text], {
                            type: "text/plain;charset=utf-8",
                          }),
                          "תמליל פגישה.txt",
                        )
                      }
                    >
                      הורדת תמליל
                    </Button>
                  </details>
                ))}
                {reviews.map((v) => (
                  <details key={v.id} className="rounded-lg border p-3">
                    <summary className="cursor-pointer">
                      סיכום שנבדק ·{" "}
                      {new Date(v.reviewed_at).toLocaleString("he-IL")}
                    </summary>
                    <p className="my-3 max-h-80 overflow-auto whitespace-pre-wrap text-sm">
                      {v.reviewed_text}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void pdf(v.id)}
                    >
                      הורדת מסמך PDF עם הלוגו
                    </Button>
                  </details>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </Section>
  );
}
