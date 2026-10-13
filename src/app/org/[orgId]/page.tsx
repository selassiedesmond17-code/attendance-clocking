import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";

export default async function OrgPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, status, timezone")
    .eq("id", orgId)
    .single();
  if (!org) notFound();

  const { data: isOrgAdmin } = await supabase.rpc("is_org_admin", {
    org: orgId,
  });

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("created_at");

  async function addRoom(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    const supabase = await createClient();
    await supabase.from("rooms").insert({ organization_id: orgId, name });
    revalidatePath(`/org/${orgId}`);
  }

  return (
    <main className="page max-w-2xl">
      <Link href="/" className="neu-back">
        ← Back
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{org.name}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        <span
          className={`neu-badge ${
            org.status === "active" ? "badge-ok" : "badge-warn"
          }`}
        >
          {org.status}
        </span>
        <span className="muted">Time zone: {org.timezone}</span>
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href={`/org/${orgId}/reports`} className="neu-btn">
          Attendance reports
        </Link>
      </div>

      {org.status !== "active" ? (
        <p className="alert alert-warn mt-6">
          This organization is not active. It is either waiting for approval or
          has been suspended.
        </p>
      ) : (
        <section className="neu-card mt-6">
          <h2 className="text-lg font-medium">Rooms</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {(rooms ?? []).length === 0 && (
              <li className="neu-inset muted">No rooms yet.</li>
            )}
            {(rooms ?? []).map((r) => (
              <li key={r.id}>
                <Link href={`/org/${orgId}/rooms/${r.id}`} className="neu-row">
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>

          {isOrgAdmin && (
            <form action={addRoom} className="mt-6 flex gap-3">
              <input
                name="name"
                required
                placeholder="New room name"
                aria-label="New room name"
                className="neu-input"
              />
              <SubmitButton className="neu-btn neu-btn-primary" pendingText="Adding…">Add</SubmitButton>
            </form>
          )}
        </section>
      )}
    </main>
  );
}