import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/report-filters";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ orgId: string; roomId: string }>;
}) {
  const { orgId, roomId } = await params;
  if (!UUID_RE.test(orgId) || !UUID_RE.test(roomId)) notFound();
  const supabase = await createClient();

  const [roomRes, adminRes, manageRes] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, name, department_id, latitude, longitude, radius_m")
      .eq("id", roomId)
      .eq("organization_id", orgId)
      .single(),
    supabase.rpc("is_org_admin", { org: orgId }),
    supabase.rpc("can_manage_room", { p_room: roomId }),
  ]);
  const room = roomRes.data;
  if (!room) notFound();
  if (!manageRes.data) redirect(`/org/${orgId}/sessions`);

  const { data: dept } = await supabase
    .from("departments")
    .select("id, name")
    .eq("id", room.department_id)
    .single();
  const isOrgAdmin = Boolean(adminRes.data);
  const hasLocation = room.latitude !== null && room.longitude !== null;
  const path = `/org/${orgId}/rooms/${roomId}`;

  return (
    <main className="page max-w-xl">
      <div className="neu-card flex flex-col gap-4">
        <div>
          {dept && (
            <Link
              href={`/org/${orgId}/departments/${dept.id}`}
              className="neu-link text-sm"
            >
              {dept.name}
            </Link>
          )}
          <h1 className="mt-1 text-2xl font-semibold">{room.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className={`neu-badge ${hasLocation ? "badge-ok" : "badge-warn"}`}>
              {hasLocation
                ? `Location set (${room.radius_m} m)`
                : "No location set"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`${path}/sessions`} className="neu-btn neu-btn-primary">
            Attendance sessions
          </Link>
          <Link href={`/org/${orgId}/reports?room=${roomId}`} className="neu-btn">
            Reports
          </Link>
          {isOrgAdmin && (
            <Link href={`${path}/location`} className="neu-btn">
              Location
            </Link>
          )}
        </div>
        <p className="muted text-sm">
          People are added to departments, and everyone in this room&apos;s
          department can join its sessions.
        </p>
      </div>
    </main>
  );
}