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
    <main className="mx-auto max-w-xl p-6">
      <Link href={`/org/${orgId}`} className="text-sm underline">
        ← Back to rooms
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{room.name}</h1>
       {canManage && (
        <Link
          href={`${path}/sessions`}
          className="mt-3 inline-block rounded border px-3 py-1 text-sm"
        >
          Attendance sessions
        </Link>
      )}
      <h2 className="mt-6 text-lg font-medium">People in this room</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {(members ?? []).length === 0 && (
          <li className="text-gray-600">No one has joined yet.</li>
        )}
        {(members ?? []).map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded border p-3"
          >
            <span>
              {m.email ?? "Unknown"}{" "}
              <span className="text-sm text-gray-500">
                ({m.role === "room_admin" ? "room admin" : "user"})
              </span>
            </span>
            {canManage && (isOrgAdmin || m.role === "user") && (
              <form action={removeMember}>
                <input type="hidden" name="id" value={m.id} />
                <button className="text-sm text-red-700 underline">
                  Remove
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <>
          <h2 className="mt-6 text-lg font-medium">Waiting to join</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {(invites ?? []).length === 0 && (
              <li className="text-gray-600">No pending invitations.</li>
            )}
            {(invites ?? []).map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between rounded border border-dashed p-3"
              >
                <span>
                  {i.email}{" "}
                  <span className="text-sm text-gray-500">
                    ({i.role === "room_admin" ? "room admin" : "user"})
                  </span>
                </span>
                {(isOrgAdmin || i.role === "user") && (
                  <form action={removeInvite}>
                    <input type="hidden" name="id" value={i.id} />
                    <button className="text-sm text-red-700 underline">
                      Cancel
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>

          <h2 className="mt-6 text-lg font-medium">Add people</h2>
          <p className="text-sm text-gray-600">
            Paste one or more email addresses, separated by commas, spaces or
            new lines. They join the room the next time they sign in.
          </p>
          <form action={invite} className="mt-2 flex flex-col gap-2">
            <textarea
              name="emails"
              required
              rows={4}
              placeholder="alice@example.com, bob@example.com"
              className="rounded border p-2"
            />
            {canMakeRoomAdmins ? (
              <select name="role" className="rounded border p-2">
                <option value="user">User</option>
                <option value="room_admin">Room admin</option>
              </select>
            ) : (
              <input type="hidden" name="role" value="user" />
            )}
            <button className="rounded bg-black p-2 text-white">
              Send invitations
            </button>
          </form>
        </>
      )}
    </main>
  );
}