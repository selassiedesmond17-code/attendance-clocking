export function StatusBadge({ status }: { status: string }) {
  const color =
    (
      {
        recorded: "badge-ok",
        corrected: "badge-blue",
        pending_review: "badge-warn",
        rejected: "badge-bad",
      } as Record<string, string>
    )[status] ?? "";
  return (
    <span className={`neu-badge ${color}`}>{status.replace("_", " ")}</span>
  );
}

export function ActionBadge({ action }: { action: string }) {
  return action === "clock_in" ? (
    <span className="neu-badge badge-ok">Clock in</span>
  ) : (
    <span className="neu-badge badge-blue">Clock out</span>
  );
}