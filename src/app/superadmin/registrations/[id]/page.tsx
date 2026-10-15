import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";
import ConfigMatrix from "@/components/config-matrix";
import { UUID_RE } from "@/lib/report-filters";
import {
  ORG_TYPES,
  parseConfigForm,
  presetFor,
  typeLabel,
} from "@/lib/org-types";
import {
  notifyRegistrationApproved,
  notifyRegistrationRejected,
} from "@/lib/notify";
import { siteUrl } from "@/lib/mail";

export default async function ReviewRegistrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const sp = await searchParams;
  const path = `/superadmin/registrations/${id}`;
  const supabase = await createClient();
  const { data: isSuper } = await supabase.rpc("is_superadmin");
  if (!isSuper) notFound();

  const { data: reg } = await supabase
    .from("org_registrations")
    .select(
      "id, org_name, org_type, timezone, contact_name, contact_email, contact_phone, status, rejection_reason, created_at"
    )
    .eq("id", id)
    .single();
  if (!reg) notFound();

  async function approve(formData: FormData) {
    "use server";
    const type = String(formData.get("type") ?? "");
    if (!ORG_TYPES.some((t) => t.value === type)) {
      redirect(`${path}?error=${encodeURIComponent("Choose a valid type")}`);
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("approve_registration", {
      p_reg: id,
      p_type: type,
      p_fields: parseConfigForm(formData, type),
    });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    const r = data as { org_name: string; email: string; contact_name: string };
    await notifyRegistrationApproved({
      site: await siteUrl(),
      to: r.email,
      name: r.contact_name,
      orgName: r.org_name,
    });
    revalidatePath("/superadmin");
    redirect("/superadmin?done=approved");
  }

  async function reject(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const reason = String(formData.get("reason") ?? "");
    const { data, error } = await supabase.rpc("reject_registration", {
      p_reg: id,
      p_reason: reason,
    });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    const r = data as { org_name: string; email: string; contact_name: string };
    await notifyRegistrationRejected({
      to: r.email,
      name: r.contact_name,
      orgName: r.org_name,
      reason: reason.trim(),
    });
    revalidatePath("/superadmin");
    redirect("/superadmin?done=rejected");
  }

  const pending = reg.status === "pending";

  return (
    <main className="page max-w-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{reg.org_name}</h1>
        <span
          className={`neu-badge ${
            reg.status === "approved"
              ? "badge-ok"
              : reg.status === "rejected"
              ? "badge-bad"
              : "badge-warn"
          }`}
        >
          {reg.status}
        </span>
      </div>

      <section className="neu-card mt-4 flex flex-col gap-1 text-sm">
        <div>
          <span className="muted">Requested type: </span>
          {typeLabel(reg.org_type)}
        </div>
        <div>
          <span className="muted">Time zone: </span>
          {reg.timezone}
        </div>
        <div className="break-all">
          <span className="muted">Registered by: </span>
          {reg.contact_name} · {reg.contact_email}
          {reg.contact_phone ? ` · ${reg.contact_phone}` : ""}
        </div>
        <div>
          <span className="muted">Date: </span>
          {new Date(reg.created_at).toLocaleString("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
        {reg.rejection_reason && (
          <div>
            <span className="muted">Rejection reason: </span>
            {reg.rejection_reason}
          </div>
        )}
      </section>

      {sp.error && <p className="alert alert-error mt-4">{sp.error}</p>}

      {pending ? (
        <>
          <form action={approve} className="neu-card mt-6 flex flex-col gap-5">
            <ConfigMatrix type={reg.org_type} cfg={presetFor(reg.org_type)} />
            <SubmitButton
              className="neu-btn neu-btn-success"
              pendingText="Approving…"
            >
              Approve and create the organization
            </SubmitButton>
            <p className="muted text-sm">
              Approving creates the organization and emails {reg.contact_name}{" "}
              so they can sign in as its platform admin.
            </p>
          </form>

          <form action={reject} className="neu-card mt-6 flex flex-col gap-3">
            <h2 className="text-lg font-medium">Reject instead</h2>
            <input
              name="reason"
              required
              minLength={3}
              maxLength={300}
              placeholder="Reason (the person will see this)"
              aria-label="Reason for rejecting"
              className="neu-input"
            />
            <div>
              <SubmitButton
                className="neu-btn neu-btn-danger"
                pendingText="Rejecting…"
              >
                Reject registration
              </SubmitButton>
            </div>
          </form>
        </>
      ) : (
        <p className="alert alert-info mt-6">
          This registration has already been decided.
        </p>
      )}
    </main>
  );
}