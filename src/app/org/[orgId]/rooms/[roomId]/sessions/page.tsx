import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";

function fmt(iso: string, tz: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function stateOf(startsAt: string, expiresAt: string) {
  const now = Date.now();
  if (now < new Date(startsAt).getTime())
    return { label: "Upcoming", color: "badge-blue" };
  if (now > new Date(expiresAt).getTime())
    return { label: "Ended", color: "" };
  return { label: "Open now", color: "badge-ok" };
}

export default async function SessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; roomId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { orgId, roomId } = await params;
  const { error } = await searchParams;
  const base = `/org/${orgId}/rooms/${roomId}/sessions`;
  const supabase = await createClient();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("id", roomId)
    .eq("organization_id", orgId)
    .single();
  if (!room) notFound();

  const { data: canManage } = await supabase.rpc("can_manage_room", {
    p_room: roomId,
  });
  if (!canManage) notFound();

  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", orgId)
    .single();
  const tz = org?.timezone ?? "UTC";

  const { data: sessions } = await supabase
    .from("attendance_sessions")
    .select("id, title, starts_at, expires_at")
    .eq("room_id", roomId)
    .order("starts_at", { ascending: false });

  async function createSession(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_session", {
      p_room: roomId,
      p_title: String(formData.get("title") ?? ""),
      p_start_local: String(formData.get("start") ?? ""),
      p_end_local: String(formData.get("end") ?? ""),
      p_allow_in: formData.get("allow_in") === "on",
      p_allow_out: formData.get("allow_out") === "on",
      p_require_gps: formData.get("require_gps") === "on",
      p_notice: String(formData.get("notice") ?? ""),
    });
    if (error) redirect(`${base}?error=${encodeURIComponent(error.message)}`);
    redirect(`${base}/${data}`);
  }

  return (
    <main className="page max-w-2xl">

      <h1 className="mt-3 text-2xl font-semibold">Attendance sessions</h1>

      <section className="neu-card mt-6">
        <h2 className="text-lg font-medium">New session</h2>
        <p className="muted mt-1 text-sm">
          Times are in the organization&apos;s time zone ({tz}).
        </p>
        <form action={createSession} className="mt-4 flex flex-col gap-4">
          <input
            name="title"
            required
            placeholder="Title, e.g. Morning shift"
            aria-label="Session title"
            className="neu-input"
          />
          <label className="field">
            Starts
            <input
              type="datetime-local"
              name="start"
              required
              className="neu-input mt-1"
            />
          </label>
          <label className="field">
            Ends (session expires)
            <input
              type="datetime-local"
              name="end"
              required
              className="neu-input mt-1"
            />
          </label>
          <label className="field flex items-center gap-2">
            <input type="checkbox" name="allow_in" defaultChecked /> Clock-in
            allowed
          </label>
          <label className="field flex items-center gap-2">
            <input type="checkbox" name="allow_out" defaultChecked /> Clock-out
            allowed
          </label>
             <label className="field flex items-center gap-2">
               <input type="checkbox" name="require_gps" /> Check location (GPS)
               when clocking
             </label>
             <label className="field">
               Notice for users (optional)
               <textarea
                 name="notice"
                 rows={2}
                 maxLength={300}
                 placeholder="For example: GPS is weak inside the hall today"
                 className="neu-input mt-1"
               />
             </label>
          <SubmitButton className="neu-btn neu-btn-primary" pendingText="Creating…">Create session</SubmitButton>
        </form>
        {error && <p className="alert alert-error mt-4">{error}</p>}
      </section>

      <h2 className="mt-8 text-lg font-medium">Past and upcoming</h2>
      <ul className="mt-3 flex flex-col gap-4">
        {(sessions ?? []).length === 0 && (
          <li className="neu-inset muted">No sessions yet.</li>
        )}
        {(sessions ?? []).map((s) => {
          const st = stateOf(s.starts_at, s.expires_at);
          return (
            <li key={s.id}>
              <Link href={`${base}/${s.id}`} className="neu-row">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{s.title}</span>
                  <span className={`neu-badge ${st.color}`}>{st.label}</span>
                </div>
                <div className="muted mt-1 text-sm">
                  {fmt(s.starts_at, tz)} → {fmt(s.expires_at, tz)}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}