import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformNotice() {
  const supabase = await createClient();
  const { data: isSuper } = await supabase.rpc("is_superadmin");
  if (!isSuper) return null;
  const { count } = await supabase
    .from("org_registrations")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (!count) return null;
  return (
    <div className="alert alert-warn mt-4 flex flex-wrap items-center justify-between gap-3">
      <span>
        {count} registration{count === 1 ? " is" : "s are"} waiting for your
        approval.
      </span>
      <Link href="/superadmin" className="neu-btn neu-btn-sm neu-btn-primary">
        Review
      </Link>
    </div>
  );
}