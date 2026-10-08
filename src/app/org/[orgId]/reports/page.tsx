import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  parseFilters,
  UUID_RE,
  STATUSES,
  type ReportRow,
} from "@/lib/report-filters";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  if (!UUID_RE.test(orgId)) notFound();
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : null;
  };
  const filters = parseFilters(get);

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, timezone")
    .eq("id", orgId)
    .single();
  if (!org) notFound();

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("name");

  const { data, error } = await supabase.rpc("attendance_report", {
    p_org: orgId,
    ...filters,
    p_limit: 1000,
  });
  const rows = (data ?? []) as ReportRow[];

  const qs = new URLSearchParams();
  for (const k of ["from", "to", "room", "email", "status"]) {
    const v = get(k);
    if (v) qs.set(k, v);
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <Link href={`/org/${orgId}`} className="text-sm underline">
        ← Back to {org.name}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Attendance report</h1>
      <p className="text-sm text-gray-600">
        Times are shown in {org.timezone}. You see the records your role
        allows.
      </p>

      <form method="get" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="text-sm">
          From
          <input
            type="date"
            name="from"
            defaultValue={get("from") ?? ""}
            className="mt-1 block w-full rounded border p-2"
          />
        </label>
        <label className="text-sm">
          To
          <input
            type="date"
            name="to"
            defaultValue={get("to") ?? ""}
            className="mt-1 block w-full rounded border p-2"
          />
        </label>
        <label className="text-sm">
          Room
          <select
            name="room"
            defaultValue={get("room") ?? ""}
            className="mt-1 block w-full rounded border p-2"
          >
            <option value="">All rooms</option>
            {(rooms ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Person (email contains)
          <input
            name="email"
            defaultValue={get("email") ?? ""}
            className="mt-1 block w-full rounded border p-2"
          />
        </label>
        <label className="text-sm">
          Status
          <select
            name="status"
            defaultValue={get("status") ?? ""}
            className="mt-1 block w-full rounded border p-2"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className="rounded bg-black px-4 py-2 text-white">
            Apply
          </button>
          <Link href={`/org/${orgId}/reports`} className="px-2 py-2 text-sm underline">
            Clear
          </Link>
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error.message}</p>}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {rows.length} record{rows.length === 1 ? "" : "s"}
          {rows.length === 1000 && " (showing the latest 1000, narrow the filters)"}
        </p>
        <a
          href={`/org/${orgId}/reports/export?${qs.toString()}`}
          className="rounded border px-3 py-1 text-sm"
        >
          Download CSV
        </a>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Date</th>
              <th className="p-2">Time</th>
              <th className="p-2">Room</th>
              <th className="p-2">Session</th>
              <th className="p-2">Person</th>
              <th className="p-2">Action</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-3 text-gray-600">
                  No records match.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.event_id} className="border-b">
                <td className="p-2">{r.local_date}</td>
                <td className="p-2">{r.local_time}</td>
                <td className="p-2">{r.room_name}</td>
                <td className="p-2">{r.session_title}</td>
                <td className="p-2">{r.user_email ?? "Unknown"}</td>
                <td className="p-2">
                  {r.action === "clock_in" ? "Clock in" : "Clock out"}
                </td>
                <td className="p-2">
                  {r.status === "corrected" ? (
                    <span className="rounded bg-amber-100 px-1">corrected</span>
                  ) : (
                    r.status.replace("_", " ")
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}