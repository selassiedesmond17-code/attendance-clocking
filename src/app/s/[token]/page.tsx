import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function fmt(iso: string, tz: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function ClockPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: session } = await supabase
    .from("attendance_sessions")
    .select(
      "id, title, starts_at, expires_at, allow_clock_in, allow_clock_out, room_id, organization_id"
    )
    .eq("token", token)
    .maybeSingle();

  if (!session) {
    return (
      <main className="mx-auto max-w-sm p-6">
        <h1 className="text-xl font-semibold">Session not available</h1>
        <p className="mt-2 text-gray-600">
          We could not open this session. Make sure you are signed in with the
          email address that was added to this room.
        </p>
        <p className="mt-1 text-sm text-gray-500">Signed in as {user?.email}</p>
        <Link href="/" className="mt-4 inline-block underline">
          Go to home
        </Link>
      </main>
    );
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("name")
    .eq("id", session.room_id)
    .single();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, timezone")
    .eq("id", session.organization_id)
    .single();
  const tz = org?.timezone ?? "UTC";

  const { data: mine } = await supabase
    .from("attendance_events")
    .select("action, status, occurred_at")
    .eq("session_id", session.id)
    .eq("user_id", user!.id);

  const active = (mine ?? []).filter((e) => e.status !== "rejected");
  const myIn = active.find((e) => e.action === "clock_in");
  const myOut = active.find((e) => e.action === "clock_out");

  const now = Date.now();
  const open =
    now >= new Date(session.starts_at).getTime() &&
    now <= new Date(session.expires_at).getTime();
  const canIn = open && session.allow_clock_in && !myIn;
  const canOut = open && session.allow_clock_out && !!myIn && !myOut;

  async function clock(formData: FormData) {
    "use server";
    const action =
      formData.get("action") === "clock_out" ? "clock_out" : "clock_in";
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("clock_action", {
      p_token: token,
      p_action: action,
    });
    redirect(
      `/s/${token}?${
        error
          ? `error=${encodeURIComponent(error.message)}`
          : `done=${encodeURIComponent(String(data))}`
      }`
    );
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <p className="text-sm text-gray-500">
        {org?.name} · {room?.name}
      </p>
      <h1 className="text-2xl font-semibold">{session.title}</h1>
      <p className="text-sm text-gray-600">
        {fmt(session.starts_at, tz)} → {fmt(session.expires_at, tz)}
      </p>
      <p className="mt-1 text-sm text-gray-500">Signed in as {user?.email}</p>

      {sp.done && (
        <p className="mt-4 rounded border border-green-300 bg-green-50 p-3">
          {sp.done} ✓
        </p>
      )}
      {sp.error && (
        <p className="mt-4 rounded border border-red-300 bg-red-50 p-3">
          {sp.error}
        </p>
      )}

      <div className="mt-4 text-sm">
        <div>
          Clock in: {myIn ? fmt(myIn.occurred_at, tz) : "not yet"}
        </div>
        <div>
          Clock out: {myOut ? fmt(myOut.occurred_at, tz) : "not yet"}
        </div>
      </div>

      <form action={clock} className="mt-6 flex flex-col gap-3">
        <button
          name="action"
          value="clock_in"
          disabled={!canIn}
          className="rounded bg-green-700 p-3 text-white disabled:opacity-40"
        >
          Clock in
        </button>
        <button
          name="action"
          value="clock_out"
          disabled={!canOut}
          className="rounded bg-black p-3 text-white disabled:opacity-40"
        >
          Clock out
        </button>
      </form>
      {!open && (
        <p className="mt-3 text-sm text-gray-600">
          This session is not open right now.
        </p>
      )}
    </main>
  );
}