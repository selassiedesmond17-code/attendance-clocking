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
    <main className="page max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Your organizations</h1>
        <form action="/auth/signout" method="post">
          <button className="neu-btn neu-btn-sm">Sign out</button>
        </form>
      </div>
      <p className="muted mt-1 text-sm">Signed in as {user?.email}</p>

      <ul className="mt-6 flex flex-col gap-4">
        {items.length === 0 && (
          <li className="neu-inset muted">
            You are not part of any organization yet.
          </li>
        )}
        {items.map(
          (m) =>
            m.organizations && (
              <li key={m.organizations.id}>
                <Link
                  href={`/org/${m.organizations.id}`}
                  className="neu-row flex items-center justify-between gap-3"
                >
                  <span className="font-medium">{m.organizations.name}</span>
                  <span className="flex gap-2">
                    <span className="neu-badge badge-blue">
                      {m.role === "org_admin" ? "admin" : "member"}
                    </span>
                    <span
                      className={`neu-badge ${
                        m.organizations.status === "active"
                          ? "badge-ok"
                          : "badge-warn"
                      }`}
                    >
                      {m.organizations.status}
                    </span>
                  </span>
                </Link>
              </li>
            )
        )}
      </ul>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/register-org" className="neu-btn neu-btn-primary">
          Register an organization
        </Link>
        {isPlatformAdmin && (
          <Link href="/platform" className="neu-btn">
            Platform admin
          </Link>
        )}
      </div>
    </main>
  );
}