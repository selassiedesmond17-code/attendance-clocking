import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";
import { UUID_RE } from "@/lib/report-filters";
import { FIELD_KEYS, fieldLabel, resolveConfig } from "@/lib/org-types";
import { addableRoles, deptRoleText, parseRoleChoice } from "@/lib/dept";

const PARAM: Record<string, string> = {
  phone: "p_phone",
  id_number: "p_id_number",
  department: "p_department",
  class_name: "p_class",
  group_name: "p_group",
  level: "p_level",
  job_title: "p_job_title",
};

type DM = {
  id: string;
  department_id: string;
  role: string;
  title: string | null;
  email: string | null;
};

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; userId: string }>;
  searchParams: Promise<{ saved?: string; role?: string; error?: string }>;
}) {
  const { orgId, userId } = await params;
  if (!UUID_RE.test(orgId) || !UUID_RE.test(userId)) notFound();
  const sp = await searchParams;
  const path = `/org/${orgId}/people/${userId}`;
  const supabase = await createClient();

  const [orgRes, adminRes, editRes, profRes, dmRes, deptRes, memRes] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, org_type, profile_fields, status")
        .eq("id", orgId)
        .single(),
      supabase.rpc("is_org_admin", { org: orgId }),
      supabase.rpc("can_edit_person", { p_org: orgId, p_user: userId }),
      supabase
        .from("org_profiles")
        .select(
          "full_name, phone, id_number, department, class_name, group_name, level, job_title"
        )
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("department_members")
        .select("id, department_id, role, title, email")
        .eq("organization_id", orgId)
        .eq("user_id", userId),
      supabase.from("departments").select("id, name").eq("organization_id", orgId),
      supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  const org = orgRes.data;
  if (!org || !editRes.data) notFound();
  const isOrgAdmin = Boolean(adminRes.data);
  const dms = (dmRes.data ?? []) as DM[];
  const deptName = new Map(
    ((deptRes.data ?? []) as { id: string; name: string }[]).map((d) => [
      d.id,
      d.name,
    ])
  );
  const p = (profRes.data ?? {}) as Record<string, string | null>;
  const email = dms.find((d) => d.email)?.email ?? null;
  const isPlatformTarget = memRes.data?.role === "org_admin";
  const who = isPlatformTarget || dms.some((d) => d.role === "admin") ? "admin" : "user";
  const cfg = resolveConfig(org.profile_fields, org.org_type)[who];
  const roles = addableRoles(org.org_type, "platform");

  async function saveProfile(formData: FormData) {
    "use server";
    const args: Record<string, string> = {
      p_org: orgId,
      p_user: userId,
      p_full_name: String(formData.get("full_name") ?? ""),
    };
    for (const k of FIELD_KEYS) args[PARAM[k]] = String(formData.get(`f_${k}`) ?? "");
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_update_profile", args);
    revalidatePath(path);
    redirect(`${path}?${error ? `error=${encodeURIComponent(error.message)}` : "saved=1"}`);
  }

  async function changeRole(formData: FormData) {
    "use server";
    const { role, title } = parseRoleChoice(String(formData.get("who") ?? "user"));
    const supabase = await createClient();
    const { error } = await supabase.rpc("change_department_role", {
      p_member: String(formData.get("member_id")),
      p_role: role,
      p_title: title,
    });
    revalidatePath(path);
    redirect(`${path}?${error ? `error=${encodeURIComponent(error.message)}` : "role=1"}`);
  }

  async function removeFromDepartment(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_department_member", {
      p_member: String(formData.get("member_id")),
    });
    revalidatePath(path);
    redirect(error ? `${path}?error=${encodeURIComponent(error.message)}` : path);
  }

  async function removeFromOrganization() {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_person_from_org", {
      p_org: orgId,
      p_user: userId,
    });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    revalidatePath(`/org/${orgId}`);
    redirect(`/org/${orgId}`);
  }

  return (
    <main className="page max-w-2xl">
      <p className="muted text-sm">{org.name}</p>
      <h1 className="text-2xl font-semibold">{p.full_name ?? email ?? "Person"}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        {email && <span className="muted break-all">{email}</span>}
        {isPlatformTarget && <span className="neu-badge badge-blue">platform admin</span>}
      </p>

      {sp.saved && <p className="alert alert-ok mt-4">Details saved ✓</p>}
      {sp.role && <p className="alert alert-ok mt-4">Role updated ✓</p>}
      {sp.error && <p className="alert alert-error mt-4">{sp.error}</p>}

      <form action={saveProfile} className="neu-card mt-6 flex flex-col gap-4">
        <h2 className="text-lg font-medium">Details</h2>
        <label className="field">
          Full name <span className="text-warn">(required)</span>
          <input
            name="full_name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={p.full_name ?? ""}
            className="neu-input mt-1"
          />
        </label>
        {FIELD_KEYS.filter((k) => cfg[k] !== "hidden").map((k) => (
          <label key={k} className="field">
            {fieldLabel(org.org_type, k, who)}
            <input
              name={`f_${k}`}
              type={k === "phone" ? "tel" : "text"}
              maxLength={100}
              defaultValue={p[k] ?? ""}
              className="neu-input mt-1"
            />
          </label>
        ))}
        <p className="muted text-sm">
          The person still has to fill in anything the organization marks as
          required before they can clock in.
        </p>
        <SubmitButton className="neu-btn neu-btn-primary" pendingText="Saving…">
          Save details
        </SubmitButton>
      </form>

      <section className="neu-card mt-6 flex flex-col gap-4">
        <h2 className="text-lg font-medium">Departments and roles</h2>
        {dms.length === 0 && (
          <p className="neu-inset muted">Not in any department you can see.</p>
        )}
        {dms.map((d) => (
          <div key={d.id} className="neu-raised flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{deptName.get(d.department_id) ?? "Department"}</span>
              <span className={`neu-badge ${d.role === "user" ? "" : "badge-blue"}`}>
                {deptRoleText(org.org_type, d.role, d.title)}
              </span>
            </div>
            {isOrgAdmin && (
              <div className="flex flex-wrap items-end gap-3">
                <form action={changeRole} className="flex flex-1 flex-wrap items-end gap-2">
                  <input type="hidden" name="member_id" value={d.id} />
                  <label className="field flex-1">
                    Change role
                    <select
                      name="who"
                      defaultValue={d.role === "assistant" ? `assistant:${d.title ?? ""}` : d.role}
                      className="neu-input mt-1"
                    >
                      {roles.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SubmitButton className="neu-btn neu-btn-sm neu-btn-primary" pendingText="…">
                    Save role
                  </SubmitButton>
                </form>
                <form action={removeFromDepartment}>
                  <input type="hidden" name="member_id" value={d.id} />
                  <SubmitButton className="neu-btn neu-btn-sm neu-btn-danger" pendingText="…">
                    Remove from department
                  </SubmitButton>
                </form>
              </div>
            )}
          </div>
        ))}
        {isOrgAdmin && (
          <p className="muted text-sm">
            To add this person to another department, open that department and
            add their email.
          </p>
        )}
      </section>

      {isOrgAdmin && !isPlatformTarget && (
        <form
          action={removeFromOrganization}
          className="neu-card mt-6 flex flex-col gap-3 border-2 border-red-500"
        >
          <h2 className="text-lg font-medium text-red-600">Remove from the organization</h2>
          <p className="text-sm">
            This removes the person from every department and from the
            organization, so they can no longer sign in to it. Their past
            attendance records and name stay for history.
          </p>
          <label className="field flex items-center gap-2">
            <input type="checkbox" required /> I understand
          </label>
          <div>
            <SubmitButton className="neu-btn neu-btn-danger" pendingText="Removing…">
              Remove from the organization
            </SubmitButton>
          </div>
        </form>
      )}
    </main>
  );
}