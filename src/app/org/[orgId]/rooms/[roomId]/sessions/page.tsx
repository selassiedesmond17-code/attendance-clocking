import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function fmt(iso: string, tz: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  });
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
    });
    if (error) redirect(`${base}?error=${encodeURIComponent(error.message)}`);
    redirect(`${base}/${data}`);
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <Link href={`/org/${orgId}/rooms/${roomId}`} className="text-sm underline">
        ← Back to {room.name}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Attendance sessions</h1>

      <h2 className="mt-6 text-lg font-medium">New session</h2>
      <p className="text-sm text-gray-600">
        Times are in the organization&apos;s time zone ({tz}).
      </p>
      <form action={createSession} className="mt-2 flex flex-col gap-3">
        <input
          name="title"
          required
          placeholder="Title, e.g. Morning shift"
          className="rounded border p-2"
        />
        <label className="text-sm">
          Starts
          <input
            type="datetime-local"
            name="start"
            required
            className="mt-1 block w-full rounded border p-2"
          />
        </label>
        <label className="text-sm">
          Ends (session expires)
          <input
            type="datetime-local"
            name="end"
            required
            className="mt-1 block w-full rounded border p-2"
          />
        </label>
        <label className="text-sm">
          <input type="checkbox" name="allow_in" defaultChecked /> Clock-in
          allowed
        </label>
        <label className="text-sm">
          <input type="checkbox" name="allow_out" defaultChecked /> Clock-out
          allowed
        </label>
        <button className="rounded bg-black p-2 text-white">
          Create session
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <h2 className="mt-8 text-lg font-medium">Past and upcoming</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {(sessions ?? []).length === 0 && (
          <li className="text-gray-600">No sessions yet.</li>
        )}
        {(sessions ?? []).map((s) => (
          <li key={s.id}>
            <Link
              href={`${base}/${s.id}`}
              className="block rounded border p-3 hover:bg-gray-50"
            >
              <div className="font-medium">{s.title}</div>
              <div className="text-sm text-gray-500">
                {fmt(s.starts_at, tz)} → {fmt(s.expires_at, tz)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}