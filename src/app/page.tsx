import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Item = {
  role: string;
  organizations: { id: string; name: string; status: string } | null;
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Accept any invitations waiting for this email address
  await supabase.rpc("claim_invites");
  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");

  const { data } = await supabase
    .from("memberships")
    .select("role, organizations(id, name, status)")
    .eq("user_id", user!.id);

  const items = (data ?? []) as unknown as Item[];

  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your organizations</h1>
        <form action="/auth/signout" method="post">
          <button className="text-sm underline">Sign out</button>
        </form>
      </div>
      <p className="mt-1 text-sm text-gray-600">Signed in as {user?.email}</p>

      <ul className="mt-6 flex flex-col gap-2">
        {items.length === 0 && (
          <li className="text-gray-600">
            You are not part of any organization yet.
          </li>
        )}
        {items.map(
          (m) =>
            m.organizations && (
              <li key={m.organizations.id}>
                <Link
                  href={`/org/${m.organizations.id}`}
                  className="flex justify-between rounded border p-3 hover:bg-gray-50"
                >
                  <span>{m.organizations.name}</span>
                  <span className="text-sm text-gray-500">
                    {m.role === "org_admin" ? "admin" : "member"} ·{" "}
                    {m.organizations.status}
                  </span>
                </Link>
              </li>
            )
        )}
      </ul>

      <div className="mt-6 flex gap-3">
        <Link
          href="/register-org"
          className="rounded bg-black px-4 py-2 text-white"
        >
          Register an organization
        </Link>
        {isPlatformAdmin && (
          <Link href="/platform" className="rounded border px-4 py-2">
            Platform admin
          </Link>
        )}
      </div>
    </main>
  );
}