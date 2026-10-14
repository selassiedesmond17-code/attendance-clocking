import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, ActionBadge } from "@/components/badges";
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
    <main className="page max-w-5xl">

      <h1 className="mt-3 text-2xl font-semibold">Attendance report</h1>
      <p className="muted text-sm">
        Times are shown in {org.timezone}. You see the records your role
        allows.
      </p>

      <form
        method="get"
        className="neu-card mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <label className="field">
          From
          <input
            type="date"
            name="from"
            defaultValue={get("from") ?? ""}
            className="neu-input mt-1"
          />
        </label>
        <label className="field">
          To
          <input
            type="date"
            name="to"
            defaultValue={get("to") ?? ""}
            className="neu-input mt-1"
          />
        </label>
        <label className="field">
          Room
          <select
            name="room"
            defaultValue={get("room") ?? ""}
            className="neu-input mt-1"
          >
            <option value="">All rooms</option>
            {(rooms ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Person (email contains)
          <input
            name="email"
            defaultValue={get("email") ?? ""}
            className="neu-input mt-1"
          />
        </label>
        <label className="field">
          Status
          <select
            name="status"
            defaultValue={get("status") ?? ""}
            className="neu-input mt-1"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3">
          <button className="neu-btn neu-btn-primary">Apply</button>
          <Link href={`/org/${orgId}/reports`} className="neu-btn">
            Clear
          </Link>
        </div>
      </form>

      {error && <p className="alert alert-error mt-4">{error.message}</p>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="muted text-sm">
          {rows.length} record{rows.length === 1 ? "" : "s"}
          {rows.length === 1000 &&
            " (showing the latest 1000, narrow the filters)"}
        </p>
        <a
          href={`/org/${orgId}/reports/export?${qs.toString()}`}
          className="neu-btn neu-btn-success"
        >
          Download CSV
        </a>
      </div>

      <div className="neu-card mt-3 overflow-x-auto">
        <table className="neu-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Room</th>
              <th>Session</th>
              <th>Person</th>
              <th>Action</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No records match.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.event_id}>
                <td className="whitespace-nowrap">{r.local_date}</td>
                <td className="whitespace-nowrap">{r.local_time}</td>
                <td>{r.room_name}</td>
                <td>{r.session_title}</td>
                <td className="break-all">{r.user_email ?? "Unknown"}</td>
                <td>
                  <ActionBadge action={r.action} />
                </td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}