import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";
import { typeLabel } from "@/lib/org-types";
import { notifyActivated } from "@/lib/notify";
import { siteUrl } from "@/lib/mail";

type Reg = {
  id: string;
  org_name: string;
  org_type: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
};
type Org = {
  id: string;
  name: string;
  status: string;
  timezone: string;
  org_type: string;
  created_at: string;
};

const DONE: Record<string, string> = {
  approved: "Organization approved and its platform admin has been emailed ✓",
  rejected: "Registration rejected and the person has been emailed.",
  active: "Organization activated ✓",
  suspended: "Organization suspended.",
};

function date(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" });
}

export default async function SuperadminPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: isSuper } = await supabase.rpc("is_superadmin");
  if (!isSuper) notFound();
  const sp = await searchParams;

  const [regRes, orgRes] = await Promise.all([
    supabase
      .from("org_registrations")
      .select(
        "id, org_name, org_type, contact_name, contact_email, contact_phone, status, rejection_reason, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("organizations")
      .select("id, name, status, timezone, org_type, created_at")
      .order("created_at", { ascending: false }),
  ]);
  const regs = (regRes.data ?? []) as Reg[];
  const orgs = (orgRes.data ?? []) as Org[];
  const waiting = regs.filter((r) => r.status === "pending");
  const decided = regs.filter((r) => r.status !== "pending").slice(0, 10);

  async function setStatus(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    const status = String(formData.get("status"));
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("platform_set_status", {
      org: id,
      new_status: status,
    });
    if (error)
      redirect(`/superadmin?error=${encodeURIComponent(error.message)}`);
    if (status === "active") {
      const r = data as { name: string; emails: string[] };
      await notifyActivated({
        site: await siteUrl(),
        orgName: r.name,
        emails: r.emails ?? [],
      });
    }
    revalidatePath("/superadmin");
    redirect(`/superadmin?done=${status}`);
  }

  return (
    <main className="page max-w-3xl">
      <h1 className="text-2xl font-semibold">Superadmin</h1>
      <p className="muted text-sm">
        Approve organizations for their platform admins, and manage every
        organization on KlokIt.
      </p>

      {sp.done && DONE[sp.done] && (
        <p className="alert alert-ok mt-4">{DONE[sp.done]}</p>
      )}
      {sp.error && <p className="alert alert-error mt-4">{sp.error}</p>}

      <h2 className="mt-6 flex items-center gap-2 text-lg font-medium">
        Waiting for approval
        <span className="neu-badge badge-warn">{waiting.length}</span>
      </h2>
      <ul className="mt-3 flex flex-col gap-4">
        {waiting.length === 0 && (
          <li className="neu-inset muted">No registrations are waiting.</li>
        )}
        {waiting.map((r) => (
          <li key={r.id} className="neu-raised flex flex-col gap-3">
            <div>
              <div className="font-medium">{r.org_name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <span className="neu-badge badge-blue">{typeLabel(r.org_type)}</span>
                <span className="muted">registered {date(r.created_at)}</span>
              </div>
              <div className="muted mt-2 break-all text-sm">
                {r.contact_name} · {r.contact_email}
                {r.contact_phone ? ` · ${r.contact_phone}` : ""}
              </div>
            </div>
            <div>
              <Link
                href={`/superadmin/registrations/${r.id}`}
                className="neu-btn neu-btn-sm neu-btn-primary"
              >
                Review and decide
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-medium">Organizations</h2>
      <ul className="mt-3 flex flex-col gap-4">
        {orgs.length === 0 && (
          <li className="neu-inset muted">No organizations yet.</li>
        )}
        {orgs.map((o) => (
          <li key={o.id} className="neu-raised flex flex-col gap-3">
            <div>
              <div className="font-medium">{o.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
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
                <span className="neu-badge badge-blue">{typeLabel(o.org_type)}</span>
                <span className="muted">
                  {o.timezone} · since {date(o.created_at)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/superadmin/orgs/${o.id}`}
                className="neu-btn neu-btn-sm"
              >
                Settings
              </Link>
              <form action={setStatus} className="flex gap-3">
                <input type="hidden" name="id" value={o.id} />
                {o.status !== "active" && (
                  <SubmitButton
                    name="status"
                    value="active"
                    className="neu-btn neu-btn-sm neu-btn-success"
                    pendingText="Working…"
                  >
                    Activate
                  </SubmitButton>
                )}
                {o.status !== "suspended" && (
                  <SubmitButton
                    name="status"
                    value="suspended"
                    className="neu-btn neu-btn-sm neu-btn-danger"
                    pendingText="Working…"
                  >
                    Suspend
                  </SubmitButton>
                )}
              </form>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-medium">Recent decisions</h2>
      <ul className="mt-3 flex flex-col gap-4 text-sm">
        {decided.length === 0 && (
          <li className="neu-inset muted">No decisions yet.</li>
        )}
        {decided.map((r) => (
          <li key={r.id} className="neu-inset flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`neu-badge ${
                  r.status === "approved" ? "badge-ok" : "badge-bad"
                }`}
              >
                {r.status}
              </span>
              <span className="font-medium">{r.org_name}</span>
              <span className="muted">{r.contact_email}</span>
            </div>
            {r.rejection_reason && (
              <div className="muted">Reason: {r.rejection_reason}</div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}