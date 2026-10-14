import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/report-filters";

type Person = {
  email: string;
  rooms: { id: string; name: string; role: string }[];
};

export default async function PeoplePage({
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

  const [orgRes, adminRes, roomsRes, mineRes, memRes, invRes] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name")
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
      supabase
        .from("room_members")
        .select("id, email, role, room_id")
        .eq("organization_id", orgId),
      supabase
        .from("room_invites")
        .select("id, email, role, room_id")
        .eq("organization_id", orgId),
    ]);

  const org = orgRes.data;
  if (!org) notFound();
  const isOrgAdmin = Boolean(adminRes.data);
  if (!isOrgAdmin && (mineRes.data ?? []).length === 0) notFound();

  const rooms = (roomsRes.data ?? []) as { id: string; name: string }[];
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));

  const byEmail = new Map<string, Person>();
  for (const m of (memRes.data ?? []) as {
    email: string | null;
    role: string;
    room_id: string;
  }[]) {
    const email = (m.email ?? "Unknown").toLowerCase();
    const p = byEmail.get(email) ?? { email, rooms: [] };
    p.rooms.push({
      id: m.room_id,
      name: roomName.get(m.room_id) ?? "Room",
      role: m.role,
    });
    byEmail.set(email, p);
  }
  const people = [...byEmail.values()].sort((a, b) =>
    a.email.localeCompare(b.email)
  );
  const invites = (invRes.data ?? []) as {
    id: string;
    email: string;
    role: string;
    room_id: string;
  }[];

  return (
    <main className="page max-w-2xl">

      <h1 className="mt-3 text-2xl font-semibold">People</h1>
      <p className="muted text-sm">
        Everyone in the rooms you manage. To add or remove people, open the
        room.
      </p>

      <section className="neu-card mt-6">
        <h2 className="text-lg font-medium">Manage a room</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {rooms.length === 0 && (
            <p className="muted text-sm">No rooms yet.</p>
          )}
          {rooms.map((r) => (
            <Link
              key={r.id}
              href={`/org/${orgId}/rooms/${r.id}`}
              className="neu-btn neu-btn-sm"
            >
              {r.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="neu-card mt-6">
        <h2 className="text-lg font-medium">
          Members{" "}
          <span className="neu-badge ml-1">{people.length}</span>
        </h2>
        <ul className="mt-4 flex flex-col gap-4">
          {people.length === 0 && (
            <li className="neu-inset muted">No one has joined yet.</li>
          )}
          {people.map((p) => (
            <li key={p.email} className="neu-raised flex flex-col gap-2">
              <span className="break-all font-medium">{p.email}</span>
              <span className="flex flex-wrap gap-2">
                {p.rooms.map((r) => (
                  <Link
                    key={r.id}
                    href={`/org/${orgId}/rooms/${r.id}`}
                    className={`neu-badge ${
                      r.role === "room_admin" ? "badge-blue" : ""
                    }`}
                  >
                    {r.name}
                    {r.role === "room_admin" ? " · admin" : ""}
                  </Link>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="neu-card mt-6">
        <h2 className="text-lg font-medium">
          Waiting to join{" "}
          <span className="neu-badge badge-warn ml-1">{invites.length}</span>
        </h2>
        <ul className="mt-4 flex flex-col gap-4">
          {invites.length === 0 && (
            <li className="neu-inset muted">No pending invitations.</li>
          )}
          {invites.map((i) => (
            <li key={i.id} className="neu-inset flex flex-col gap-1">
              <span className="break-all">{i.email}</span>
              <span className="muted text-sm">
                {roomName.get(i.room_id) ?? "Room"} ·{" "}
                {i.role === "room_admin" ? "room admin" : "user"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}