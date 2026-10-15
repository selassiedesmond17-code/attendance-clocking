import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";
import ConfigMatrix from "@/components/config-matrix";
import { UUID_RE } from "@/lib/report-filters";
import {
  ORG_TYPES,
  parseConfigForm,
  resolveConfig,
  typeLabel,
} from "@/lib/org-types";

export default async function SuperadminOrgPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { orgId } = await params;
  if (!UUID_RE.test(orgId)) notFound();
  const sp = await searchParams;
  const path = `/superadmin/orgs/${orgId}`;
  const supabase = await createClient();
  const { data: isSuper } = await supabase.rpc("is_superadmin");
  if (!isSuper) notFound();

  const [orgRes, adminsRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, status, timezone, org_type, profile_fields")
      .eq("id", orgId)
      .single(),
    supabase.rpc("platform_org_admins", { p_org: orgId }),
  ]);
  const org = orgRes.data;
  if (!org) notFound();
  const cfg = resolveConfig(org.profile_fields, org.org_type);
  const admins = ((adminsRes.data ?? []) as { email: string }[]).map(
    (r) => r.email
  );

  async function save(formData: FormData) {
    "use server";
    const type = String(formData.get("type") ?? "");
    if (!ORG_TYPES.some((t) => t.value === type)) {
      redirect(`${path}?error=${encodeURIComponent("Choose a valid type")}`);
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("platform_configure_org", {
      p_org: orgId,
      p_type: type,
      p_fields: parseConfigForm(formData, type),
    });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    revalidatePath("/superadmin");
    redirect(`${path}?saved=1`);
  }

  return (
    <main className="page max-w-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{org.name}</h1>
        <span
          className={`neu-badge ${
            org.status === "active"
              ? "badge-ok"
              : org.status === "suspended"
              ? "badge-bad"
              : "badge-warn"
          }`}
        >
          {org.status}
        </span>
      </div>
      <p className="muted mt-1 break-all text-sm">
        {typeLabel(org.org_type)} · {org.timezone}
        {admins.length > 0 && <> · platform admin: {admins.join(", ")}</>}
      </p>

      {sp.saved && <p className="alert alert-ok mt-4">Settings saved ✓</p>}
      {sp.error && <p className="alert alert-error mt-4">{sp.error}</p>}

      <form action={save} className="neu-card mt-6 flex flex-col gap-5">
        <ConfigMatrix type={org.org_type} cfg={cfg} />
        <SubmitButton className="neu-btn neu-btn-primary" pendingText="Saving…">
          Save settings
        </SubmitButton>
      </form>
    </main>
  );
}