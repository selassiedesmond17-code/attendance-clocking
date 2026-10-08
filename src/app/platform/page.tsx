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
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/" className="text-sm underline">
        ← Back
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Platform admin</h1>
      <p className="text-sm text-gray-600">
        Organizations registered on the platform.
      </p>

      <ul className="mt-6 flex flex-col gap-2">
        {(orgs ?? []).length === 0 && (
          <li className="text-gray-600">No organizations yet.</li>
        )}
        {(orgs ?? []).map((o) => (
          <li key={o.id} className="rounded border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{o.name}</div>
                <div className="text-sm text-gray-500">
                  {o.status} · {o.timezone}
                </div>
              </div>
              <form action={setStatus} className="flex gap-2">
                <input type="hidden" name="id" value={o.id} />
                {o.status !== "active" && (
                  <button
                    name="status"
                    value="active"
                    className="rounded bg-green-700 px-3 py-1 text-sm text-white"
                  >
                    Approve
                  </button>
                )}
                {o.status !== "suspended" && (
                  <button
                    name="status"
                    value="suspended"
                    className="rounded bg-red-700 px-3 py-1 text-sm text-white"
                  >
                    Suspend
                  </button>
                )}
              </form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}