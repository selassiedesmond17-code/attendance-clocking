import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/report-filters";
import SubmitButton from "@/components/submit-button";
import {
  FIELD_KEYS,
  fieldLabel,
  resolveConfig,
  typeLabel,
} from "@/lib/org-types";

const PARAM: Record<string, string> = {
  phone: "p_phone",
  id_number: "p_id_number",
  department: "p_department",
  class_name: "p_class",
  group_name: "p_group",
  level: "p_level",
  job_title: "p_job_title",
};

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { orgId } = await params;
  if (!UUID_RE.test(orgId)) notFound();
  const sp = await searchParams;
  const path = `/org/${orgId}/profile`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [orgRes, profRes, roleRes, missRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, org_type, profile_fields")
      .eq("id", orgId)
      .single(),
    supabase
      .from("org_profiles")
      .select(
        "full_name, phone, id_number, department, class_name, group_name, level, job_title"
      )
      .eq("organization_id", orgId)
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase.rpc("my_profile_role", { p_org: orgId }),
    supabase.rpc("my_missing_profile", { p_org: orgId }),
  ]);
  const org = orgRes.data;
  if (!org) notFound();

  const who = roleRes.data === "admin" ? "admin" : "user";
  const cfg = resolveConfig(org.profile_fields, org.org_type)[who];
  const p = (profRes.data ?? {}) as Record<string, string | null>;
  const missing = ((missRes.data ?? []) as string[]).map((k) =>
    k === "full_name" ? "Full name" : fieldLabel(org.org_type, k as (typeof FIELD_KEYS)[number], who)
  );

  async function save(formData: FormData) {
    "use server";
    const args: Record<string, string> = {
      p_org: orgId,
      p_full_name: String(formData.get("full_name") ?? ""),
    };
    for (const k of FIELD_KEYS) {
      args[PARAM[k]] = String(formData.get(`f_${k}`) ?? "");
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_my_profile", args);
    redirect(
      `${path}?${error ? `error=${encodeURIComponent(error.message)}` : "saved=1"}`
    );
  }

  return (
    <main className="page max-w-md">
      <div className="neu-card flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold">My profile</h1>
          <p className="muted mt-1 text-sm">
            {org.name} · {typeLabel(org.org_type)}
          </p>
          <span className="neu-badge badge-blue mt-2">
            {who === "admin" ? "administrator" : "user"}
          </span>
        </div>

        {sp.saved && <p className="alert alert-ok">Profile saved ✓</p>}
        {sp.error && <p className="alert alert-error">{sp.error}</p>}
        {missing.length > 0 && (
          <p className="alert alert-warn">
            Still needed: {missing.join(", ")}. You cannot clock in or out until
            these are filled in.
          </p>
        )}

        <form action={save} className="flex flex-col gap-4">
          <label className="field">
            Email
            <input
              value={user?.email ?? ""}
              readOnly
              className="neu-input mt-1 opacity-70"
            />
          </label>
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
              {fieldLabel(org.org_type, k, who)}{" "}
              {cfg[k] === "required" ? (
                <span className="text-warn">(required)</span>
              ) : (
                <span>(optional)</span>
              )}
              <input
                name={`f_${k}`}
                type={k === "phone" ? "tel" : "text"}
                required={cfg[k] === "required"}
                maxLength={100}
                defaultValue={p[k] ?? ""}
                className="neu-input mt-1"
              />
            </label>
          ))}
          <SubmitButton
            className="neu-btn neu-btn-primary"
            pendingText="Saving…"
          >
            Save profile
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}