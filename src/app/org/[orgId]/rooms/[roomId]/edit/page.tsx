import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";
import { UUID_RE } from "@/lib/report-filters";

export default async function EditRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; roomId: string }>;
  searchParams: Promise<{ saved?: string; moved?: string; error?: string }>;
}) {
  const { orgId, roomId } = await params;
  if (!UUID_RE.test(orgId) || !UUID_RE.test(roomId)) notFound();
  const sp = await searchParams;
  const path = `/org/${orgId}/rooms/${roomId}/edit`;
  const supabase = await createClient();

  const [adminRes, roomRes, deptsRes, countRes] = await Promise.all([
    supabase.rpc("is_org_admin", { org: orgId }),
    supabase
      .from("rooms")
      .select("id, name, department_id")
      .eq("id", roomId)
      .eq("organization_id", orgId)
      .single(),
    supabase.from("departments").select("id, name").eq("organization_id", orgId).order("name"),
    supabase
      .from("attendance_sessions")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId),
  ]);
  if (!adminRes.data || !roomRes.data) notFound();
  const room = roomRes.data;
  const depts = (deptsRes.data ?? []) as { id: string; name: string }[];
  const current = depts.find((d) => d.id === room.department_id);
  const others = depts.filter((d) => d.id !== room.department_id);
  const sessions = countRes.count ?? 0;

  async function rename(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("rename_room", {
      p_room: roomId,
      p_name: String(formData.get("name") ?? ""),
    });
    revalidatePath(`/org/${orgId}`);
    redirect(`${path}?${error ? `error=${encodeURIComponent(error.message)}` : "saved=1"}`);
  }

  async function move(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("move_room", {
      p_room: roomId,
      p_dept: String(formData.get("dept_id")),
    });
    revalidatePath(`/org/${orgId}`);
    redirect(`${path}?${error ? `error=${encodeURIComponent(error.message)}` : "moved=1"}`);
  }

  async function remove() {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_room", { p_room: roomId });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    revalidatePath(`/org/${orgId}`);
    redirect(`/org/${orgId}`);
  }

  return (
    <main className="page max-w-xl">
      <h1 className="text-2xl font-semibold">Edit room</h1>
      <p className="muted text-sm">
        <Link href={`/org/${orgId}/rooms/${roomId}`} className="neu-link">
          {room.name}
        </Link>
        {current && <> · in {current.name}</>} · {sessions}{" "}
        {sessions === 1 ? "session" : "sessions"}
      </p>

      {sp.saved && <p className="alert alert-ok mt-4">Room renamed ✓</p>}
      {sp.moved && <p className="alert alert-ok mt-4">Room moved ✓</p>}
      {sp.error && <p className="alert alert-error mt-4">{sp.error}</p>}

      <form action={rename} className="neu-card mt-6 flex flex-col gap-4">
        <label className="field">
          Room name
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={room.name}
            className="neu-input mt-1"
          />
        </label>
        <SubmitButton className="neu-btn neu-btn-primary" pendingText="Saving…">
          Rename
        </SubmitButton>
      </form>

      {others.length > 0 && (
        <form action={move} className="neu-card mt-6 flex flex-col gap-4">
          <label className="field">
            Move to another department
            <select name="dept_id" className="neu-input mt-1">
              {others.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <p className="muted text-sm">
            Who can join and manage this room&apos;s sessions follows its
            department, so moving it changes that. Past records stay with the
            room.
          </p>
          <SubmitButton className="neu-btn" pendingText="Moving…">
            Move room
          </SubmitButton>
        </form>
      )}

      <form
        action={remove}
        className="neu-card mt-6 flex flex-col gap-3 border-2 border-red-500"
      >
        <h2 className="text-lg font-medium text-red-600">Delete this room</h2>
        {sessions > 0 ? (
          <p className="text-sm">
            This room has {sessions} attendance {sessions === 1 ? "session" : "sessions"},
            so it cannot be deleted. Its history must stay. You can rename it or
            move it instead.
          </p>
        ) : (
          <p className="text-sm">
            This room has no sessions yet, so it can be deleted safely.
          </p>
        )}
        <label className="field flex items-center gap-2">
          <input type="checkbox" required disabled={sessions > 0} /> I understand
        </label>
        <div>
          <SubmitButton
            className="neu-btn neu-btn-danger"
            pendingText="Deleting…"
            disabled={sessions > 0}
          >
            Delete room
          </SubmitButton>
        </div>
      </form>
    </main>
  );
}