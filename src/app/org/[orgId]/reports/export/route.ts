import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseFilters, UUID_RE, type ReportRow } from "@/lib/report-filters";

// Wraps a value for CSV, and stops spreadsheet programs from running
// anything that looks like a formula
function csvCell(value: unknown) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  if (!UUID_RE.test(orgId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const filters = parseFilters((k) => url.searchParams.get(k));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_report", {
    p_org: orgId,
    ...filters,
    p_limit: 5000,
  });
  if (error) return new NextResponse(error.message, { status: 400 });

  const header = ["Date", "Time", "Room", "Session", "Person", "Action", "Status"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of (data ?? []) as ReportRow[]) {
    lines.push(
      [
        r.local_date,
        r.local_time,
        r.room_name,
        r.session_title,
        r.user_email,
        r.action === "clock_in" ? "Clock in" : "Clock out",
        r.status,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${stamp}.csv"`,
    },
  });
}