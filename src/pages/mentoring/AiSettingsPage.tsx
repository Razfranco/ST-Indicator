import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { type AiSettings } from "../../lib/mentoringAi";
import {
  Section,
  Field,
  inputClass,
} from "../../components/BusinessFormControls";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
export function AiSettingsPage() {
  const { user, profile } = useAuth();
  const [settings, setSettings] = useState<AiSettings | null>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("mentoring_ai_settings")
      .select("*")
      .eq("id", "default")
      .single()
      .then((r) => {
        if (cancelled) return;
        if (r.error)
          setError(
            "לא ניתן לטעון את הגדרות הסיכום. בדוק שהכנת מסד הנתונים הושלמה.",
          );
        else setSettings(r.data);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (profile?.role !== "admin")
    return <p>הגדרות הסיכום מנוהלות על ידי מנהל.</p>;
  async function importText(file: File, field: "instructions" | "examples") {
    if (!/\.(txt|md)$/i.test(file.name) || file.size > 600000) {
      setError(
        "צרף קובץ TXT או Markdown עד 200KB. ניתן להעתיק טקסט ממסמך אחר.",
      );
      return;
    }
    const text = await file.text();
    const max = field === "instructions" ? 60000 : 140000;
    if (text.length > max) {
      setError("הטקסט ארוך מדי. יש לצמצם ל־" + max + " תווים.");
      return;
    }
    setSettings((s) => (s ? { ...s, [field]: text } : s));
    setSaved(false);
  }
  async function uploadSources(files: FileList) {
    if (!settings) return;
    setSaving(true);
    setError("");
    setSaved(false);
    const documents = [...settings.source_documents];
    try {
      for (const file of Array.from(files)) {
        if (!/\.(pdf|md|txt)$/i.test(file.name) || file.size > 20_000_000)
          throw Error("ניתן לשמור מסמכי PDF, MD ו־TXT עד 20MB למסמך.");
        const bytes = await file.arrayBuffer(),
          hash = await crypto.subtle.digest("SHA-256", bytes),
          sha256 = Array.from(new Uint8Array(hash), (v) =>
            v.toString(16).padStart(2, "0"),
          ).join("");
        if (documents.some((d) => d.sha256 === sha256)) continue;
        const path =
          crypto.randomUUID() +
          "." +
          file.name.split(".").at(-1)!.toLowerCase();
        const r = await supabase.storage
          .from("mentoring-materials")
          .upload(path, file, { upsert: false });
        if (r.error) throw Error("העלאת מסמך המקור נכשלה.");
        documents.push({
          name: file.name,
          path,
          kind: file.name.split(".").at(-1)!.toLowerCase(),
          sha256,
        });
      }
      setSettings({ ...settings, source_documents: documents });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function openSource(path: string) {
    const r = await supabase.storage
      .from("mentoring-materials")
      .createSignedUrl(path, 300);
    if (r.error) setError("פתיחת המסמך נכשלה.");
    else window.open(r.data.signedUrl, "_blank", "noopener,noreferrer");
  }
  async function save() {
    if (!settings || !user) return;
    setSaving(true);
    setError("");
    setSaved(false);
    const r = await supabase
      .from("mentoring_ai_settings")
      .update({
        instructions: settings.instructions.trim(),
        examples: settings.examples,
        style_ready: settings.style_ready,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
        source_documents: settings.source_documents,
      })
      .eq("id", "default")
      .select("*")
      .single();
    if (r.error) setError("שמירת ההגדרות נכשלה.");
    else {
      setSettings(r.data);
      setSaved(true);
    }
    setSaving(false);
  }
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">הנחיות סיכום</h2>
      <p className="text-sm text-muted-foreground">
        הגדר את המבנה, סגנון הכתיבה וכללי הסיכום. ניתן לייבא את קובץ ההנחיות
        והדוגמאות מהמודל שמכיר את דרך העבודה שלך. כל גרסה שומרת עותק של ההנחיות
        ששימשו אותה; שינויים יחולו רק על עיבודים חדשים.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {saved && <p role="status">ההנחיות נשמרו.</p>}
      {settings && (
        <Section title="סגנון ותוכן">
          <Field
            label="שמירת מסמכי המקור"
            hint="PDF, MD או TXT. הקבצים נשמרים באחסון פרטי לעיון הצוות. הטקסט המשמש את המודל מופיע בשדות ההנחיות והדוגמאות למטה."
          >
            <input
              type="file"
              accept=".pdf,.md,.txt"
              multiple
              disabled={saving}
              onChange={(e) => {
                if (e.target.files) void uploadSources(e.target.files);
              }}
              className={inputClass}
            />
          </Field>
          {settings.source_documents.map((d) => (
            <Button
              key={d.path}
              variant="outline"
              disabled={saving}
              onClick={() => void openSource(d.path)}
            >
              {d.name}
            </Button>
          ))}
          <Field
            label="ייבוא קובץ הנחיות"
            hint="TXT או MD. אפשר גם להדביק טקסט בשדה למטה."
          >
            <input
              type="file"
              accept=".md,.txt,text/plain"
              disabled={saving}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importText(f, "instructions");
              }}
              className={inputClass}
            />
          </Field>
          <Field label="הנחיות לסיכום" required hint="עד 60,000 תווים">
            <textarea
              className={inputClass}
              rows={12}
              maxLength={60000}
              disabled={saving}
              value={settings.instructions}
              onChange={(e) => {
                setSettings({ ...settings, instructions: e.target.value });
                setSaved(false);
              }}
            />
          </Field>
          <Field label="ייבוא סיכומים לדוגמה">
            <input
              type="file"
              accept=".md,.txt,text/plain"
              disabled={saving}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importText(f, "examples");
              }}
              className={inputClass}
            />
          </Field>
          <Field
            label="סיכומים לדוגמה"
            hint="עד 140,000 תווים. עדיף להסיר פרטים מזהים שאינם נחוצים; הדוגמאות יישלחו ל־OpenAI יחד עם התמליל."
          >
            <textarea
              className={inputClass}
              rows={12}
              maxLength={140000}
              disabled={saving}
              value={settings.examples}
              onChange={(e) => {
                setSettings({ ...settings, examples: e.target.value });
                setSaved(false);
              }}
            />
          </Field>
          <Label className="flex items-center gap-2">
            <Checkbox
              checked={settings.style_ready}
              disabled={saving}
              onCheckedChange={(value) => {
                setSettings({ ...settings, style_ready: value === true });
                setSaved(false);
              }}
            />
            ההנחיות והדוגמאות האישיות מוכנות לשימוש
          </Label>
          <Button
            disabled={saving || !settings.instructions.trim()}
            onClick={() => void save()}
          >
            {saving ? "שומר…" : "שמירת הנחיות"}
          </Button>
        </Section>
      )}
    </div>
  );
}
