import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/report-filters";

const NIL = "00000000-0000-0000-0000-000000000000";

type SessionRow = {
  id: string;
  title: string;
  room_id: string;
  starts_at: string;
  expires_at: string;
};

function fmt(iso: string, tz: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function OrgSessionsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  if (!UUID_RE.test(orgId)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [orgRes, adminRes, roomsRes, mineRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, timezone, status")
      .eq("id", orgId)
      .single(),
    supabase.rpc("is_org_admin", { org: orgId }),
    supabase
      .from("rooms")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name"),
    supabase
      .from("room_members")
      .select("room_id")
      .eq("organization_id", orgId)
      .eq("user_id", user!.id)
      .eq("role", "room_admin"),
  ]);

  const org = orgRes.data;
  if (!org) notFound();
  const isOrgAdmin = Boolean(adminRes.data);
  const adminRoomIds = new Set(
    ((mineRes.data ?? []) as { room_id: string }[]).map((r) => r.room_id)
  );
  const manageable = (
    (roomsRes.data ?? []) as { id: string; name: string }[]
  ).filter((r) => isOrgAdmin || adminRoomIds.has(r.id));
  if (!isOrgAdmin && manageable.length === 0) notFound();

  const tz = org.timezone ?? "UTC";
  const roomName = new Map(manageable.map((r) => [r.id, r.name]));
  const ids = manageable.length ? manageable.map((r) => r.id) : [NIL];

  const { data } = await supabase
    .from("attendance_sessions")
    .select("id, title, room_id, starts_at, expires_at")
    .in("room_id", ids)
    .order("starts_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as SessionRow[];

  const now = Date.now();
  const t = (iso: string) => new Date(iso).getTime();
  const openNow = rows.filter((s) => t(s.starts_at) <= now && t(s.expires_at) >= now);
  const upcoming = rows
    .filter((s) => t(s.starts_at) > now)
    .sort((a, b) => t(a.starts_at) - t(b.starts_at));
  const ended = rows.filter((s) => t(s.expires_at) < now).slice(0, 20);

  const list = (items: SessionRow[], label: string, color: string) => (
    <ul className="mt-3 flex flex-col gap-4">
      {items.map((s) => (
        <li key={s.id}>
          <Link
            href={`/org/${orgId}/rooms/${s.room_id}/sessions/${s.id}`}
            className="neu-row"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{s.title}</span>
              <span className={`neu-badge ${color}`}>{label}</span>
            </div>
            <div className="muted mt-1 text-sm">
              {roomName.get(s.room_id) ?? "Room"} · {fmt(s.starts_at, tz)} →{" "}
              {fmt(s.expires_at, tz)}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <main className="page max-w-2xl">

      <h1 className="mt-3 text-2xl font-semibold">Sessions</h1>
      <p className="muted text-sm">Times are shown in {tz}.</p>

      {org.status !== "active" && (
        <p className="alert alert-warn mt-4">This organization is not active.</p>
      )}

      <section className="neu-card mt-6">
        <h2 className="text-lg font-medium">Start a new session</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {manageable.length === 0 && (
            <p className="muted text-sm">Add a room first, then create sessions in it.</p>
          )}
          {manageable.map((r) => (
            <Link
              key={r.id}
              href={`/org/${orgId}/rooms/${r.id}/sessions`}
              className="neu-btn neu-btn-sm neu-btn-primary"
            >
              + {r.name}
            </Link>
          ))}
        </div>
      </section>

      {openNow.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-medium">Open now</h2>
          {list(openNow, "Open now", "badge-ok")}
        </>
      )}
      {upcoming.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-medium">Upcoming</h2>
          {list(upcoming, "Upcoming", "badge-blue")}
        </>
      )}
      <h2 className="mt-8 text-lg font-medium">Recently ended</h2>
      {ended.length === 0 ? (
        <p className="neu-inset muted mt-3">No ended sessions yet.</p>
      ) : (
        list(ended, "Ended", "")
      )}
    </main>
  );
}