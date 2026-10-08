export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const STATUSES = ["recorded", "pending_review", "rejected", "corrected"];

export type ReportRow = {
  event_id: string;
  occurred_at: string;
  local_date: string;
  local_time: string;
  room_id: string;
  room_name: string;
  session_id: string;
  session_title: string;
  user_email: string | null;
  action: string;
  status: string;
};

// Turns the page's filter boxes into safe values for the database function
export function parseFilters(get: (key: string) => string | null) {
  const from = get("from");
  const to = get("to");
  const room = get("room");
  const email = get("email")?.trim();
  const status = get("status");
  return {
    p_from: from && DATE_RE.test(from) ? from : null,
    p_to: to && DATE_RE.test(to) ? to : null,
    p_room: room && UUID_RE.test(room) ? room : null,
    p_email: email ? email.slice(0, 100) : null,
    p_status: status && STATUSES.includes(status) ? status : null,
  };
}