import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";

export default async function RegisterOrgPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function register(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const timezone = String(formData.get("timezone") ?? "UTC");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("register_organization", {
      org_name: name,
      org_timezone: timezone,
    });
    if (error) {
      redirect(`/register-org?error=${encodeURIComponent(error.message)}`);
    }
    redirect(`/org/${data}`);
  }

  return (
    <main className="page max-w-md">
      <Link href="/" className="neu-back">
        ← Back
      </Link>
      <div className="neu-card mt-3 flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Register an organization</h1>
        <form action={register} className="flex flex-col gap-4">
          <input
            name="name"
            required
            placeholder="Organization name"
            aria-label="Organization name"
            className="neu-input"
          />
          <label className="field">
            Time zone
            <select name="timezone" className="neu-input mt-1">
              <option>Africa/Accra</option>
              <option>Africa/Lagos</option>
              <option>Europe/London</option>
              <option>America/New_York</option>
              <option>UTC</option>
            </select>
          </label>
          <SubmitButton className="neu-btn neu-btn-primary" pendingText="Registering…">Register</SubmitButton>
        </form>
        {error && <p className="alert alert-error">{error}</p>}
        <p className="muted text-sm">
          New organizations are reviewed before they are activated.
        </p>
      </div>
    </main>
  );
}