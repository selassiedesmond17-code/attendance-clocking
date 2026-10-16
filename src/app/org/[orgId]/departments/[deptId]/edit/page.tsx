import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";
import { UUID_RE } from "@/lib/report-filters";

export default async function EditDepartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; deptId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { orgId, deptId } = await params;
  if (!UUID_RE.test(orgId) || !UUID_RE.test(deptId)) notFound();
  const sp = await searchParams;
  const path = `/org/${orgId}/departments/${deptId}/edit`;
  const supabase = await createClient();

  const [adminRes, deptRes, roomsRes, peopleRes] = await Promise.all([
    supabase.rpc("is_org_admin", { org: orgId }),
    supabase
      .from("departments")
      .select("id, name")
      .eq("id", deptId)
      .eq("organization_id", orgId)
      .single(),
    supabase.from("rooms").select("id, name").eq("department_id", deptId).order("name"),
    supabase.from("department_members").select("id").eq("department_id", deptId),
  ]);
  if (!adminRes.data || !deptRes.data) notFound();
  const dept = deptRes.data;
  const rooms = (roomsRes.data ?? []) as { id: string; name: string }[];
  const people = (peopleRes.data ?? []).length;

  async function rename(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("rename_department", {
      p_dept: deptId,
      p_name: String(formData.get("name") ?? ""),
    });
    revalidatePath(`/org/${orgId}`);
    redirect(`${path}?${error ? `error=${encodeURIComponent(error.message)}` : "saved=1"}`);
  }

  async function remove() {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_department", { p_dept: deptId });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    revalidatePath(`/org/${orgId}`);
    redirect(`/org/${orgId}`);
  }

  return (
    <main className="page max-w-xl">
      <h1 className="text-2xl font-semibold">Edit department</h1>
      <p className="muted text-sm">
        <Link href={`/org/${orgId}/departments/${deptId}`} className="neu-link">
          {dept.name}
        </Link>{" "}
        · {people} {people === 1 ? "person" : "people"} · {rooms.length}{" "}
        {rooms.length === 1 ? "room" : "rooms"}
      </p>

      {sp.saved && <p className="alert alert-ok mt-4">Department renamed ✓</p>}
      {sp.error && <p className="alert alert-error mt-4">{sp.error}</p>}

      <form action={rename} className="neu-card mt-6 flex flex-col gap-4">
        <label className="field">
          Department name
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={dept.name}
            className="neu-input mt-1"
          />
        </label>
        <SubmitButton className="neu-btn neu-btn-primary" pendingText="Saving…">
          Rename
        </SubmitButton>
      </form>

      <section className="neu-card mt-6 flex flex-col gap-3">
        <h2 className="text-lg font-medium">Rooms in this department</h2>
        {rooms.length === 0 && <p className="neu-inset muted">No rooms.</p>}
        {rooms.map((r) => (
          <div key={r.id} className="neu-raised flex items-center justify-between gap-3">
            <span>{r.name}</span>
            <Link href={`/org/${orgId}/rooms/${r.id}/edit`} className="neu-btn neu-btn-sm">
              Edit room
            </Link>
          </div>
        ))}
      </section>

      <form
        action={remove}
        className="neu-card mt-6 flex flex-col gap-3 border-2 border-red-500"
      >
        <h2 className="text-lg font-medium text-red-600">Delete this department</h2>
        {rooms.length > 0 ? (
          <p className="text-sm">
            A department can only be deleted when it has no rooms. Move or
            delete its {rooms.length} {rooms.length === 1 ? "room" : "rooms"}{" "}
            first.
          </p>
        ) : (
          <p className="text-sm">
            This deletes the department and removes its {people}{" "}
            {people === 1 ? "person" : "people"} from it. They stay in the
            organization and can be added to another department.
          </p>
        )}
        <label className="field flex items-center gap-2">
          <input type="checkbox" required disabled={rooms.length > 0} /> I
          understand
        </label>
        <div>
          <SubmitButton
            className="neu-btn neu-btn-danger"
            pendingText="Deleting…"
            disabled={rooms.length > 0}
          >
            Delete department
          </SubmitButton>
        </div>
      </form>
    </main>
  );
}