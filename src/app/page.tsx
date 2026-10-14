import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Membership = {
  role: string;
  organizations: { id: string; name: string; status: string } | null;
};
type OrgRow = { organization_id: string };

const NIL = "00000000-0000-0000-0000-000000000000";

function count(rows: OrgRow[], orgId: string) {
  return rows.filter((r) => r.organization_id === orgId).length;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="neu-inset flex flex-col items-center gap-1 text-center">
      <span className={`text-2xl font-semibold ${tone ?? ""}`}>{value}</span>
      <span className="muted text-xs">{label}</span>
    </div>
  );
}

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Accept any invitations waiting for this email address
  await supabase.rpc("claim_invites");

  const [memRes, raRes, paRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("role, organizations(id, name, status)")
      .eq("user_id", user!.id),
    supabase
      .from("room_members")
      .select("organization_id")
      .eq("user_id", user!.id)
      .eq("role", "room_admin"),
    supabase.rpc("is_platform_admin"),
  ]);

  const memberships = (
    (memRes.data ?? []) as unknown as Membership[]
  ).filter((m) => m.organizations);
  const roomAdminOrgs = new Set(
    ((raRes.data ?? []) as unknown as OrgRow[]).map((r) => r.organization_id)
  );
  const ids = memberships.length
    ? memberships.map((m) => m.organizations!.id)
    : [NIL];

  const nowIso = new Date().toISOString();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [roomsRes, openRes, recentRes, pendingRes] = await Promise.all([
    supabase.from("rooms").select("organization_id").in("organization_id", ids),
    supabase
      .from("attendance_sessions")
      .select("organization_id")
      .in("organization_id", ids)
      .lte("starts_at", nowIso)
      .gte("expires_at", nowIso),
    supabase
      .from("attendance_events")
      .select("organization_id")
      .in("organization_id", ids)
      .gte("occurred_at", since),
    supabase
      .from("attendance_events")
      .select("organization_id")
      .in("organization_id", ids)
      .eq("status", "pending_review"),
  ]);

  const rooms = (roomsRes.data ?? []) as unknown as OrgRow[];
  const openNow = (openRes.data ?? []) as unknown as OrgRow[];
  const recent = (recentRes.data ?? []) as unknown as OrgRow[];
  const pendingRows = (pendingRes.data ?? []) as unknown as OrgRow[];

  return (
    <main className="page max-w-4xl">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="muted mt-1 text-sm">Signed in as {user?.email}</p>

      {memberships.length === 0 && (
        <section className="neu-card mt-6 flex flex-col gap-3">
          <h2 className="text-lg font-medium">Get started</h2>
          <p className="muted text-sm">
            You are not part of any organization yet. Register one, or ask an
            administrator to invite your email address to a room.
          </p>
          <div>
            <Link href="/register-org" className="neu-btn neu-btn-primary">
              Register an organization
            </Link>
          </div>
        </section>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {memberships.map((m) => {
          const o = m.organizations;
          if (!o) return null;
          const isAdmin = m.role === "org_admin";
          const isRoomAdmin = roomAdminOrgs.has(o.id);
          const canManage = isAdmin || isRoomAdmin;
          const open = count(openNow, o.id);
          const pending = count(pendingRows, o.id);

          return (
            <section key={o.id} className="neu-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{o.name}</h2>
                <span className="flex gap-2">
                  <span className="neu-badge badge-blue">
                    {isAdmin ? "admin" : isRoomAdmin ? "room admin" : "member"}
                  </span>
                  <span
                    className={`neu-badge ${
                      o.status === "active"
                        ? "badge-ok"
                        : o.status === "suspended"
                        ? "badge-bad"
                        : "badge-warn"
                    }`}
                  >
                    {o.status}
                  </span>
                </span>
              </div>

              {o.status !== "active" ? (
                <p className="alert alert-warn mt-4">
                  This organization is not active. It is either waiting for
                  approval or has been suspended.
                </p>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Rooms" value={count(rooms, o.id)} />
                    <Stat
                      label="Sessions open now"
                      value={open}
                      tone={open > 0 ? "text-ok" : ""}
                    />
                    <Stat label="Records, last 24h" value={count(recent, o.id)} />
                    {canManage && (
                      <Stat
                        label="Pending review"
                        value={pending}
                        tone={pending > 0 ? "text-warn" : ""}
                      />
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/org/${o.id}`}
                      className="neu-btn neu-btn-primary"
                    >
                      Open
                    </Link>
                    {canManage && (
                      <Link href={`/org/${o.id}/sessions`} className="neu-btn">
                        Sessions
                      </Link>
                    )}
                    <Link href={`/org/${o.id}/reports`} className="neu-btn">
                      Reports
                    </Link>
                  </div>
                </>
              )}

              {!canManage && (
                <p className="muted mt-4 text-sm">
                  To clock in or out, scan the QR code shown in your room.
                </p>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {memberships.length > 0 && (
          <Link href="/register-org" className="neu-btn">
            Register another organization
          </Link>
        )}
        {paRes.data && (
          <Link href="/platform" className="neu-btn">
            Platform admin
          </Link>
        )}
      </div>
    </main>
  );
}