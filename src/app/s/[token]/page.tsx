import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/badges";

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
      <main className="page max-w-md">
        <div className="neu-card flex flex-col gap-4">
          <h1 className="text-xl font-semibold">Session not available</h1>
          <p className="alert alert-warn">
            We could not open this session. Make sure you are signed in with
            the email address that was added to this room.
          </p>
          <p className="muted text-sm">Signed in as {user?.email}</p>
          <Link href="/" className="neu-btn">
            Go to home
          </Link>
        </div>
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
    <main className="page max-w-md">
      <div className="neu-card flex flex-col gap-4">
        <div>
          <p className="muted text-sm">
            {org?.name} · {room?.name}
          </p>
          <h1 className="text-2xl font-semibold">{session.title}</h1>
          <p className="muted mt-1 text-sm">
            {fmt(session.starts_at, tz)} → {fmt(session.expires_at, tz)}
          </p>
          <p className="muted mt-1 text-xs">Signed in as {user?.email}</p>
        </div>

        {sp.done && <p className="alert alert-ok">{sp.done} ✓</p>}
        {sp.error && <p className="alert alert-error">{sp.error}</p>}

        <div className="neu-inset flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="muted">Clock in</span>
            <span className="flex items-center gap-2">
              {myIn ? fmt(myIn.occurred_at, tz) : "not yet"}
              {myIn && myIn.status !== "recorded" && (
                <StatusBadge status={myIn.status} />
              )}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="muted">Clock out</span>
            <span className="flex items-center gap-2">
              {myOut ? fmt(myOut.occurred_at, tz) : "not yet"}
              {myOut && myOut.status !== "recorded" && (
                <StatusBadge status={myOut.status} />
              )}
            </span>
          </div>
        </div>

        <form action={clock} className="flex flex-col gap-4">
          <button
            name="action"
            value="clock_in"
            disabled={!canIn}
            className="neu-btn neu-btn-lg neu-btn-success"
          >
            Clock in
          </button>
          <button
            name="action"
            value="clock_out"
            disabled={!canOut}
            className="neu-btn neu-btn-lg neu-btn-primary"
          >
            Clock out
          </button>
        </form>
        {!open && (
          <p className="alert alert-info">
            This session is not open right now.
          </p>
        )}
      </div>
    </main>
  );
}