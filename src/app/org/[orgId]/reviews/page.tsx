import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/report-filters";
import { ActionBadge } from "@/components/badges";
import SubmitButton from "@/components/submit-button";

type Pending = {
  id: string;
  user_id: string;
  user_email: string | null;
  action: string;
  occurred_at: string;
  room_id: string;
  session_id: string;
  gps_result: string;
  distance_m: number | null;
  accuracy_m: number | null;
  review_note: string | null;
  review_requested_at: string | null;
};

function fmt(iso: string, tz: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function gpsText(e: Pending, radius?: number) {
  if (e.gps_result === "unavailable") {
    return "Location unavailable (permission denied, switched off, or not supported).";
  }
  const parts: string[] = [];
  if (e.distance_m !== null) parts.push(`about ${e.distance_m} m from the room centre`);
  if (e.accuracy_m !== null) parts.push(`phone accuracy ±${e.accuracy_m} m`);
  if (radius) parts.push(`allowed radius ${radius} m`);
  return `Location too imprecise to confirm: ${parts.join(", ")}.`;
}

export default async function ReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { orgId } = await params;
  if (!UUID_RE.test(orgId)) notFound();
  const sp = await searchParams;
  const path = `/org/${orgId}/reviews`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [orgRes, adminRes, mineRes, roomsRes, pendingRes, recentRes] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, timezone")
        .eq("id", orgId)
        .single(),
      supabase.rpc("is_org_admin", { org: orgId }),
      supabase
        .from("room_members")
        .select("room_id")
        .eq("organization_id", orgId)
        .eq("user_id", user!.id)
        .eq("role", "room_admin"),
      supabase
        .from("rooms")
        .select("id, name, radius_m")
        .eq("organization_id", orgId),
      supabase
        .from("attendance_events")
        .select(
          "id, user_id, user_email, action, occurred_at, room_id, session_id, gps_result, distance_m, accuracy_m, review_note, review_requested_at"
        )
        .eq("organization_id", orgId)
        .eq("status", "pending_review")
        .order("occurred_at"),
      supabase
        .from("attendance_audit")
        .select("id, changed_by_email, changed_at, reason, change_type")
        .eq("organization_id", orgId)
        .in("change_type", ["review_approved", "review_rejected"])
        .order("changed_at", { ascending: false })
        .limit(10),
    ]);

  const org = orgRes.data;
  if (!org) notFound();
  if (!adminRes.data && (mineRes.data ?? []).length === 0) notFound();
  const tz = org.timezone ?? "UTC";

  const rooms = (roomsRes.data ?? []) as {
    id: string;
    name: string;
    radius_m: number;
  }[];
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const pending = (pendingRes.data ?? []) as unknown as Pending[];
  const recent = (recentRes.data ?? []) as {
    id: string;
    changed_by_email: string | null;
    changed_at: string;
    reason: string;
    change_type: string;
  }[];

  const sessionIds = [...new Set(pending.map((p) => p.session_id))];
  const { data: sess } = sessionIds.length
    ? await supabase
        .from("attendance_sessions")
        .select("id, title")
        .in("id", sessionIds)
    : { data: [] };
  const sessionTitle = new Map(
    ((sess ?? []) as { id: string; title: string }[]).map((s) => [s.id, s.title])
  );

  async function review(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("review_event", {
      p_event: String(formData.get("event_id")),
      p_decision: String(formData.get("decision")),
      p_reason: String(formData.get("reason") ?? ""),
    });
    redirect(
      `${path}?${error ? `error=${encodeURIComponent(error.message)}` : "done=1"}`
    );
  }

  return (
    <main className="page max-w-2xl">
      <h1 className="text-2xl font-semibold">Reviews</h1>
      <p className="muted text-sm">
        Attempts where the location could not be confirmed. Times are shown in{" "}
        {tz}. Approved attempts keep their original time.
      </p>

      {sp.done && <p className="alert alert-ok mt-4">Decision saved ✓</p>}
      {sp.error && <p className="alert alert-error mt-4">{sp.error}</p>}

      <h2 className="mt-6 flex items-center gap-2 text-lg font-medium">
        Waiting for a decision
        <span className="neu-badge badge-warn">{pending.length}</span>
      </h2>
      <ul className="mt-3 flex flex-col gap-6">
        {pending.length === 0 && (
          <li className="neu-inset muted">Nothing is waiting for review.</li>
        )}
        {pending.map((p) => {
          const room = roomById.get(p.room_id);
          const own = p.user_id === user!.id;
          return (
            <li key={p.id} className="neu-card flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="break-all font-medium">
                  {p.user_email ?? "Unknown"}
                </span>
                <ActionBadge action={p.action} />
              </div>
              <div className="muted text-sm">
                {room?.name ?? "Room"} ·{" "}
                {sessionTitle.get(p.session_id) ?? "Session"} · attempted{" "}
                {fmt(p.occurred_at, tz)}
              </div>
              <p className="alert alert-warn">{gpsText(p, room?.radius_m)}</p>
              {p.review_note ? (
                <div className="neu-inset text-sm">
                  <span className="muted">Their explanation: </span>
                  {p.review_note}
                </div>
              ) : (
                <p className="muted text-sm">
                  No explanation yet. They have not requested a review.
                </p>
              )}

              {own ? (
                <p className="alert alert-info">
                  This is your own attempt. Another admin needs to review it.
                </p>
              ) : (
                <form action={review} className="flex flex-col gap-3">
                  <input type="hidden" name="event_id" value={p.id} />
                  <input
                    name="reason"
                    required
                    minLength={3}
                    placeholder="Reason for your decision"
                    aria-label="Reason for your decision"
                    className="neu-input"
                  />
                  <div className="flex flex-wrap gap-3">
                    <SubmitButton
                      name="decision"
                      value="approve"
                      className="neu-btn neu-btn-success"
                      pendingText="Saving…"
                    >
                      Approve
                    </SubmitButton>
                    <SubmitButton
                      name="decision"
                      value="reject"
                      className="neu-btn neu-btn-danger"
                      pendingText="Saving…"
                    >
                      Reject
                    </SubmitButton>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      <h2 className="mt-8 text-lg font-medium">Recent decisions</h2>
      <ul className="mt-3 flex flex-col gap-4 text-sm">
        {recent.length === 0 && (
          <li className="neu-inset muted">No decisions yet.</li>
        )}
        {recent.map((r) => (
          <li key={r.id} className="neu-inset flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`neu-badge ${
                  r.change_type === "review_approved" ? "badge-ok" : "badge-bad"
                }`}
              >
                {r.change_type === "review_approved" ? "Approved" : "Rejected"}
              </span>
              <span className="muted">
                by {r.changed_by_email} · {fmt(r.changed_at, tz)}
              </span>
            </div>
            <div className="muted">Reason: {r.reason}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}