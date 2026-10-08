import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-semibold">Register an organization</h1>
      <form action={register} className="mt-4 flex flex-col gap-3">
        <input
          name="name"
          required
          placeholder="Organization name"
          className="rounded border p-2"
        />
        <select name="timezone" className="rounded border p-2">
          <option>Africa/Accra</option>
          <option>Africa/Lagos</option>
          <option>Europe/London</option>
          <option>America/New_York</option>
          <option>UTC</option>
        </select>
        <button className="rounded bg-black p-2 text-white">Register</button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <p className="mt-4 text-sm text-gray-600">
        New organizations are reviewed before they are activated.
      </p>
    </main>
  );
}