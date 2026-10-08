import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
    <main className="mx-auto max-w-xl p-6">
      <Link href="/" className="text-sm underline">
        ← Back
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{org.name}</h1>
      <p className="text-sm text-gray-600">
        Status: {org.status} · Time zone: {org.timezone}
      </p>

      {org.status !== "active" ? (
        <p className="mt-6 rounded border border-amber-300 bg-amber-50 p-3">
          This organization is not active. It is either waiting for approval or
          has been suspended.
        </p>
      ) : (
        <>
          <h2 className="mt-6 text-lg font-medium">Rooms</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {(rooms ?? []).length === 0 && (
              <li className="text-gray-600">No rooms yet.</li>
            )}
            {(rooms ?? []).map((r) => (
              <li key={r.id}>
                <Link
                  href={`/org/${orgId}/rooms/${r.id}`}
                  className="block rounded border p-3 hover:bg-gray-50"
                >
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>

          {isOrgAdmin && (
            <form action={addRoom} className="mt-4 flex gap-2">
              <input
                name="name"
                required
                placeholder="New room name"
                className="flex-1 rounded border p-2"
              />
              <button className="rounded bg-black px-4 text-white">Add</button>
            </form>
          )}
        </>
      )}
    </main>
  );
}