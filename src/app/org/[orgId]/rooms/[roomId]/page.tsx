import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function RoomPage({
  params,
}: {
  params: Promise<{ orgId: string; roomId: string }>;
}) {
  const { orgId, roomId } = await params;
  const supabase = await createClient();
  const path = `/org/${orgId}/rooms/${roomId}`;

  const { data: room } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("id", roomId)
    .eq("organization_id", orgId)
    .single();
  if (!room) notFound();

  const { data: isOrgAdmin } = await supabase.rpc("is_org_admin", {
    org: orgId,
  });
  const { data: isRoomAdmin } = await supabase.rpc("is_room_admin", {
    room: roomId,
  });
  const canManage = Boolean(isOrgAdmin || isRoomAdmin);
  const canMakeRoomAdmins = Boolean(isOrgAdmin);

  const { data: members } = await supabase
    .from("room_members")
    .select("id, email, role")
    .eq("room_id", roomId)
    .order("created_at");

  const { data: invites } = await supabase
    .from("room_invites")
    .select("id, email, role")
    .eq("room_id", roomId)
    .order("created_at");

  async function invite(formData: FormData) {
    "use server";
    const raw = String(formData.get("emails") ?? "");
    const role = formData.get("role") === "room_admin" ? "room_admin" : "user";
    const emails = [
      ...new Set(
        raw
          .toLowerCase()
          .split(/[\s,;]+/)
          .filter((e) => EMAIL_RE.test(e))
      ),
    ].slice(0, 200);
    if (emails.length === 0) return;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const rows = emails.map((email) => ({
      organization_id: orgId,
      room_id: roomId,
      email,
      role,
      invited_by: user?.id,
    }));
    await supabase
      .from("room_invites")
      .upsert(rows, { onConflict: "room_id,email", ignoreDuplicates: true });
    revalidatePath(path);
  }

  async function removeMember(formData: FormData) {
    "use server";
    const supabase = await createClient();
    await supabase
      .from("room_members")
      .delete()
      .eq("id", String(formData.get("id")));
    revalidatePath(path);
  }

  async function removeInvite(formData: FormData) {
    "use server";
    const supabase = await createClient();
    await supabase
      .from("room_invites")
      .delete()
      .eq("id", String(formData.get("id")));
    revalidatePath(path);
  }

  return (
    <main className="page max-w-2xl">

      <h1 className="mt-2 text-2xl font-semibold">{room.name}</h1>
      {canManage && (
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`${path}/sessions`} className="neu-btn">
            Attendance sessions
          </Link>
          <Link href={`/org/${orgId}/reports?room=${roomId}`} className="neu-btn">
            Reports
          </Link>
        </div>
      )}

      <section className="neu-card mt-6">
        <h2 className="text-lg font-medium">People in this room</h2>
        <ul className="mt-4 flex flex-col gap-4">
          {(members ?? []).length === 0 && (
            <li className="neu-inset muted">No one has joined yet.</li>
          )}
          {(members ?? []).map((m) => (
            <li
              key={m.id}
              className="neu-raised flex items-center justify-between gap-3"
            >
              <span className="break-all">
                {m.email ?? "Unknown"}{" "}
                <span className="neu-badge badge-blue ml-1">
                  {m.role === "room_admin" ? "room admin" : "user"}
                </span>
              </span>
              {canManage && (isOrgAdmin || m.role === "user") && (
                <form action={removeMember}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="neu-btn neu-btn-sm neu-btn-danger">
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      {canManage && (
        <>
          <section className="neu-card mt-6">
            <h2 className="text-lg font-medium">Waiting to join</h2>
            <ul className="mt-4 flex flex-col gap-4">
              {(invites ?? []).length === 0 && (
                <li className="neu-inset muted">No pending invitations.</li>
              )}
              {(invites ?? []).map((i) => (
                <li
                  key={i.id}
                  className="neu-inset flex items-center justify-between gap-3"
                >
                  <span className="break-all">
                    {i.email}{" "}
                    <span className="neu-badge badge-blue ml-1">
                      {i.role === "room_admin" ? "room admin" : "user"}
                    </span>
                  </span>
                  {(isOrgAdmin || i.role === "user") && (
                    <form action={removeInvite}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className="neu-btn neu-btn-sm neu-btn-danger">
                        Cancel
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="neu-card mt-6">
            <h2 className="text-lg font-medium">Add people</h2>
            <p className="muted mt-1 text-sm">
              Paste one or more email addresses, separated by commas, spaces or
              new lines. They join the room the next time they sign in.
            </p>
            <form action={invite} className="mt-4 flex flex-col gap-4">
              <textarea
                name="emails"
                required
                rows={4}
                placeholder="alice@example.com, bob@example.com"
                aria-label="Email addresses"
                className="neu-input"
              />
              {canMakeRoomAdmins ? (
                <label className="field">
                  Role
                  <select name="role" className="neu-input mt-1">
                    <option value="user">User</option>
                    <option value="room_admin">Room admin</option>
                  </select>
                </label>
              ) : (
                <input type="hidden" name="role" value="user" />
              )}
              <button className="neu-btn neu-btn-primary">
                Send invitations
              </button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}