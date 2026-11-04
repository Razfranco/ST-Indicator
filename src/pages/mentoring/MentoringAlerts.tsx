import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import type { StudentProfile } from "../../lib/mentoringAi";
export function MentoringAlerts() {
  const [pending, setPending] = useState<StudentProfile[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const r = await supabase
        .from("mentoring_student_profiles")
        .select("*")
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      if (cancelled || r.error) return;
      const seen = new Set<string>();
      setPending(
        r.data.filter((p) => {
          if (seen.has(p.student_id)) return false;
          seen.add(p.student_id);
          return (
            !p.reviewed_at &&
            p.result?.observations.some((o) => o.kind !== "baseline")
          );
        }),
      );
    }
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  if (!pending.length) return null;
  return (
    <div className="rounded-md border border-sky-300 bg-sky-50 p-3 text-sm">
      <p className="font-semibold">
        יש {pending.length} פרופילי ליווי עם התקדמות או שינוי שממתינים לבדיקה
      </p>
      <Link
        className="underline"
        to={"/mentoring/profiles?student=" + pending[0].student_id}
      >
        לבדיקת התצפיות והמקורות
      </Link>
    </div>
  );
}
