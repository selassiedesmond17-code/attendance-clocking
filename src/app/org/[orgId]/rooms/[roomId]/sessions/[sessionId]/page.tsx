import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

type Ev = {
  id: string;
  user_id: string;
  action: string;
  status: string;
  occurred_at: string;
};

function fmt(iso: string, tz: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toLocalInput(iso: string, tz: string) {
  return new Date(iso)
    .toLocaleString("sv-SE", { timeZone: tz })
    .replace(" ", "T")
    .slice(0, 16);
}

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; roomId: string; sessionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { orgId, roomId, sessionId } = await params;
  const { error } = await searchParams;
  const base = `/org/${orgId}/rooms/${roomId}/sessions`;
  const path = `${base}/${sessionId}`;
  const supabase = await createClient();

  const { data: canManage } = await supabase.rpc("can_manage_room", {
    p_room: roomId,
  });
  if (!canManage) notFound();

  const { data: session } = await supabase
    .from("attendance_sessions")
    .select(
      "id, title, token, starts_at, expires_at, allow_clock_in, allow_clock_out"
    )
    .eq("id", sessionId)
    .eq("room_id", roomId)
    .eq("organization_id", orgId)
    .single();
  if (!session) notFound();

  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", orgId)
    .single();
  const tz = org?.timezone ?? "UTC";

  const { data: members } = await supabase
    .from("room_members")
    .select("user_id, email, role")
    .eq("room_id", roomId)
    .order("created_at");

  const { data: events } = await supabase
    .from("attendance_events")
    .select("id, user_id, action, status, occurred_at")
    .eq("session_id", sessionId);

  const { data: audit } = await supabase
    .from("attendance_audit")
    .select(
      "id, changed_by_email, changed_at, reason, change_type, old_values, new_values"
    )
    .eq("session_id", sessionId)
    .order("changed_at", { ascending: false });

  // The QR code contains only the session link, nothing personal
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const link = `${proto}://${host}/s/${session.token}`;
  const qrSvg = await QRCode.toString(link, {
    type: "svg",
    margin: 1,
    width: 240,
  });

  const byUser = new Map<string, { in?: Ev; out?: Ev }>();
  for (const e of (events ?? []) as Ev[]) {
    if (e.status === "rejected") continue;
    const row = byUser.get(e.user_id) ?? {};
    if (e.action === "clock_in") row.in = e;
    else row.out = e;
    byUser.set(e.user_id, row);
  }

  const ended = Date.now() > new Date(session.expires_at).getTime();

  async function toggle(formData: FormData) {
    "use server";
    const field = String(formData.get("field"));
    if (field !== "allow_clock_in" && field !== "allow_clock_out") return;
    const value = formData.get("value") === "true";
    const supabase = await createClient();
    const { error } = await supabase
      .from("attendance_sessions")
      .update({ [field]: value })
      .eq("id", sessionId);
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    redirect(path);
  }

  async function endNow() {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase
      .from("attendance_sessions")
      .update({ expires_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    redirect(path);
  }

  async function correct(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("correct_event", {
      p_event: String(formData.get("event_id")),
      p_new_local: String(formData.get("new_time")),
      p_reason: String(formData.get("reason") ?? ""),
    });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    redirect(path);
  }

  async function addClockOut(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_missing_clock_out", {
      p_session: sessionId,
      p_user: String(formData.get("user_id")),
      p_local: String(formData.get("new_time")),
      p_reason: String(formData.get("reason") ?? ""),
    });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    redirect(path);
  }

  const evCell = (ev?: Ev) =>
    ev ? (
      <div>
        <div>
          {fmt(ev.occurred_at, tz)}
          {ev.status === "corrected" && (
            <span className="ml-1 rounded bg-amber-100 px-1 text-xs">
              corrected
            </span>
          )}
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer underline">Correct</summary>
          <form action={correct} className="mt-1 flex flex-col gap-1">
            <input type="hidden" name="event_id" value={ev.id} />
            <input
              type="datetime-local"
              name="new_time"
              required
              defaultValue={toLocalInput(ev.occurred_at, tz)}
              className="rounded border p-1"
            />
            <input
              name="reason"
              required
              placeholder="Reason"
              className="rounded border p-1"
            />
            <button className="rounded bg-black px-2 py-1 text-white">
              Save correction
            </button>
          </form>
        </details>
      </div>
    ) : (
      <span className="text-gray-400">—</span>
    );

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href={base} className="text-sm underline">
        ← All sessions
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{session.title}</h1>
      <p className="text-sm text-gray-600">
        {fmt(session.starts_at, tz)} → {fmt(session.expires_at, tz)} ({tz}){" "}
        {ended && <strong>· ended</strong>}
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <section className="mt-6 flex flex-wrap gap-6">
        <div>
          <div
            className="w-60 rounded border bg-white p-1"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="mt-1 max-w-60 break-all text-xs text-gray-500">
            {link}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <form action={toggle}>
            <input type="hidden" name="field" value="allow_clock_in" />
            <input
              type="hidden"
              name="value"
              value={String(!session.allow_clock_in)}
            />
            <button className="rounded border px-3 py-1 text-sm">
              {session.allow_clock_in ? "Close clock-in" : "Open clock-in"}
            </button>
          </form>
          <form action={toggle}>
            <input type="hidden" name="field" value="allow_clock_out" />
            <input
              type="hidden"
              name="value"
              value={String(!session.allow_clock_out)}
            />
            <button className="rounded border px-3 py-1 text-sm">
              {session.allow_clock_out ? "Close clock-out" : "Open clock-out"}
            </button>
          </form>
          {!ended && (
            <form action={endNow}>
              <button className="rounded bg-red-700 px-3 py-1 text-sm text-white">
                End session now
              </button>
            </form>
          )}
        </div>
      </section>

      <h2 className="mt-8 text-lg font-medium">Attendance</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Person</th>
              <th className="p-2">Clock in</th>
              <th className="p-2">Clock out</th>
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => {
              const row = byUser.get(m.user_id) ?? {};
              return (
                <tr key={m.user_id} className="border-b align-top">
                  <td className="p-2">{m.email ?? "Unknown"}</td>
                  <td className="p-2">{evCell(row.in)}</td>
                  <td className="p-2">
                    {row.out ? (
                      evCell(row.out)
                    ) : row.in ? (
                      <div>
                        {ended && (
                          <div className="text-amber-700">
                            Missing clock-out
                          </div>
                        )}
                        <details className="text-sm">
                          <summary className="cursor-pointer underline">
                            Add clock-out
                          </summary>
                          <form
                            action={addClockOut}
                            className="mt-1 flex flex-col gap-1"
                          >
                            <input
                              type="hidden"
                              name="user_id"
                              value={m.user_id}
                            />
                            <input
                              type="datetime-local"
                              name="new_time"
                              required
                              defaultValue={toLocalInput(
                                session.expires_at,
                                tz
                              )}
                              className="rounded border p-1"
                            />
                            <input
                              name="reason"
                              required
                              placeholder="Reason"
                              className="rounded border p-1"
                            />
                            <button className="rounded bg-black px-2 py-1 text-white">
                              Save
                            </button>
                          </form>
                        </details>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-lg font-medium">Correction history</h2>
      <ul className="mt-2 flex flex-col gap-2 text-sm">
        {(audit ?? []).length === 0 && (
          <li className="text-gray-600">No corrections.</li>
        )}
        {(audit ?? []).map((a) => (
          <li key={a.id} className="rounded border p-3">
            <div>
              {a.change_type === "missing_clock_out_added"
                ? "Missing clock-out added"
                : "Time corrected"}{" "}
              by {a.changed_by_email} · {fmt(a.changed_at, tz)}
            </div>
            <div className="text-gray-600">
              {a.old_values?.occurred_at
                ? fmt(a.old_values.occurred_at, tz)
                : "none"}{" "}
              → {fmt(a.new_values.occurred_at, tz)}
            </div>
            <div className="text-gray-600">Reason: {a.reason}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}