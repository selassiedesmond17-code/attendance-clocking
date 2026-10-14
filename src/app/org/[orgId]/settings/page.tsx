import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/report-filters";
import SubmitButton from "@/components/submit-button";

const ZONES = [
  "Africa/Accra",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { orgId } = await params;
  if (!UUID_RE.test(orgId)) notFound();
  const sp = await searchParams;
  const path = `/org/${orgId}/settings`;
  const supabase = await createClient();

  const [orgRes, adminRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, status, timezone")
      .eq("id", orgId)
      .single(),
    supabase.rpc("is_org_admin", { org: orgId }),
  ]);
  const org = orgRes.data;
  if (!org || !adminRes.data) notFound();

  const zones = ZONES.includes(org.timezone) ? ZONES : [org.timezone, ...ZONES];

  async function save(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const timezone = String(formData.get("timezone") ?? "");
    if (name.length < 2 || name.length > 100) {
      redirect(`${path}?error=${encodeURIComponent("Enter a name of 2 to 100 characters")}`);
    }
    let validZone = true;
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone: timezone });
    } catch {
      validZone = false;
    }
    if (!validZone) {
      redirect(`${path}?error=${encodeURIComponent("That time zone is not valid")}`);
    }
    const supabase = await createClient();
    const { error } = await supabase
      .from("organizations")
      .update({ name, timezone })
      .eq("id", orgId);
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    redirect(`${path}?saved=1`);
  }

  return (
    <main className="page max-w-md">

      <div className="neu-card mt-3 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <span
            className={`neu-badge ${
              org.status === "active" ? "badge-ok" : "badge-warn"
            }`}
          >
            {org.status}
          </span>
        </div>

        {sp.saved && <p className="alert alert-ok">Settings saved ✓</p>}
        {sp.error && <p className="alert alert-error">{sp.error}</p>}

        <form action={save} className="flex flex-col gap-4">
          <label className="field">
            Organization name
            <input
              name="name"
              required
              defaultValue={org.name}
              className="neu-input mt-1"
            />
          </label>
          <label className="field">
            Time zone
            <select
              name="timezone"
              defaultValue={org.timezone}
              className="neu-input mt-1"
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <p className="muted text-sm">
            Changing the time zone changes how times are shown and how new
            session times are read. Records already saved keep their exact
            moment.
          </p>
          <SubmitButton
            className="neu-btn neu-btn-primary"
            pendingText="Saving…"
          >
            Save settings
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}