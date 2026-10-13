import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformPage() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) notFound();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, status, timezone, created_at")
    .order("created_at", { ascending: false });

  async function setStatus(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    const status = String(formData.get("status"));
    const supabase = await createClient();
    await supabase.rpc("set_organization_status", {
      org: id,
      new_status: status,
    });
    revalidatePath("/platform");
  }

  return (
    <main className="page max-w-3xl">
      <Link href="/" className="neu-back">
        ← Back
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Platform admin</h1>
      <p className="muted text-sm">Organizations registered on the platform.</p>

      <ul className="mt-6 flex flex-col gap-4">
        {(orgs ?? []).length === 0 && (
          <li className="neu-inset muted">No organizations yet.</li>
        )}
        {(orgs ?? []).map((o) => (
          <li
            key={o.id}
            className="neu-raised flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <div className="font-medium">{o.name}</div>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span
                  className={`neu-badge ${
                    o.status === "active"
                      ? "badge-ok"
                      : o.status === "suspended"
                      ? "badge-bad"
                      : "badge-warn"
                  }`}
                >
                  {o.status}
                </span>
                <span className="muted">{o.timezone}</span>
              </div>
            </div>
            <form action={setStatus} className="flex gap-3">
              <input type="hidden" name="id" value={o.id} />
              {o.status !== "active" && (
                <button
                  name="status"
                  value="active"
                  className="neu-btn neu-btn-sm neu-btn-success"
                >
                  Approve
                </button>
              )}
              {o.status !== "suspended" && (
                <button
                  name="status"
                  value="suspended"
                  className="neu-btn neu-btn-sm neu-btn-danger"
                >
                  Suspend
                </button>
              )}
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}