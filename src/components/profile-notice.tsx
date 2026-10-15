import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ProfileNotice() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_incomplete_profiles");
  const rows = (data ?? []) as {
    organization_id: string;
    organization_name: string;
  }[];
  if (rows.length === 0) return null;
  return (
    <div className="mt-4 flex flex-col gap-3">
      {rows.map((r) => (
        <div
          key={r.organization_id}
          className="alert alert-warn flex flex-wrap items-center justify-between gap-3"
        >
          <span>
            Please complete your profile for{" "}
            <strong>{r.organization_name}</strong>. You cannot clock in until
            the required details are filled in.
          </span>
          <Link
            href={`/org/${r.organization_id}/profile`}
            className="neu-btn neu-btn-sm neu-btn-primary"
          >
            Open my profile
          </Link>
        </div>
      ))}
    </div>
  );
}