import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";
import { UUID_RE } from "@/lib/report-filters";

type Dept = { id: string; name: string };
type Room = { id: string; name: string; department_id: string };
type Person = { department_id: string; role: string };

export default async function DepartmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { orgId } = await params;
  if (!UUID_RE.test(orgId)) notFound();
  const sp = await searchParams;
  const path = `/org/${orgId}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [orgRes, adminRes, mineRes, deptRes, roomRes, peopleRes] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, status, timezone")
        .eq("id", orgId)
        .single(),
      supabase.rpc("is_org_admin", { org: orgId }),
      supabase
        .from("department_members")
        .select("department_id, role")
        .eq("organization_id", orgId)
        .eq("user_id", user!.id),
      supabase
        .from("departments")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("rooms")
        .select("id, name, department_id")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("department_members")
        .select("department_id, role")
        .eq("organization_id", orgId),
    ]);

  const org = orgRes.data;
  if (!org) notFound();
  const isOrgAdmin = Boolean(adminRes.data);
  const mine = (mineRes.data ?? []) as Person[];
  const managerDepts = new Set(
    mine.filter((m) => m.role !== "user").map((m) => m.department_id)
  );
  // People who only clock in have no use for this page
  if (!isOrgAdmin && managerDepts.size === 0) redirect(`${path}/sessions`);

  const depts = ((deptRes.data ?? []) as Dept[]).filter(
    (d) => isOrgAdmin || managerDepts.has(d.id)
  );
  const rooms = (roomRes.data ?? []) as Room[];
  const people = (peopleRes.data ?? []) as Person[];
  const active = org.status === "active";

  async function addDepartment(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_department", {
      p_org: orgId,
      p_name: String(formData.get("name") ?? ""),
    });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    revalidatePath(path);
    redirect(`${path}?done=department`);
  }

  async function addRoom(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_room", {
      p_dept: String(formData.get("dept_id")),
      p_name: String(formData.get("name") ?? ""),
    });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    revalidatePath(path);
    redirect(`${path}?done=room`);
  }

  return (
    <main className="page max-w-3xl">
      <h1 className="text-2xl font-semibold">Departments</h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{org.name}</span>
        <span className={`neu-badge ${active ? "badge-ok" : "badge-warn"}`}>
          {org.status}
        </span>
        <span className="muted">Time zone: {org.timezone}</span>
      </p>

      {sp.done === "department" && (
        <p className="alert alert-ok mt-4">Department created ✓</p>
      )}
      {sp.done === "room" && <p className="alert alert-ok mt-4">Room created ✓</p>}
      {sp.error && <p className="alert alert-error mt-4">{sp.error}</p>}
      {!active && (
        <p className="alert alert-warn mt-4">
          This organization is not active. It is either waiting for approval or
          has been suspended.
        </p>
      )}

      {isOrgAdmin && active && (
        <form action={addDepartment} className="neu-card mt-6 flex gap-3">
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            placeholder="New department name, for example Computer Science"
            aria-label="New department name"
            className="neu-input"
          />
          <SubmitButton
            className="neu-btn neu-btn-primary"
            pendingText="Adding…"
          >
            Add
          </SubmitButton>
        </form>
      )}

      <ul className="mt-6 flex flex-col gap-6">
        {depts.length === 0 && (
          <li className="neu-inset muted">
            {isOrgAdmin
              ? "No departments yet. Create your first one above."
              : "You are not managing any department yet."}
          </li>
        )}
        {depts.map((d) => {
          const dRooms = rooms.filter((r) => r.department_id === d.id);
          const count = people.filter((p) => p.department_id === d.id).length;
          return (
            <li key={d.id} className="neu-card flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                  href={`${path}/departments/${d.id}`}
                  className="text-lg font-semibold hover:underline"
                >
                  {d.name}
                </Link>
                <span className="flex gap-2">
                  <span className="neu-badge badge-blue">
                    {count} {count === 1 ? "person" : "people"}
                  </span>
                  <span className="neu-badge">
                    {dRooms.length} {dRooms.length === 1 ? "room" : "rooms"}
                  </span>
                </span>
              </div>

              {dRooms.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {dRooms.map((r) => (
                    <Link
                      key={r.id}
                      href={`${path}/rooms/${r.id}`}
                      className="neu-btn neu-btn-sm"
                    >
                      {r.name}
                    </Link>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`${path}/departments/${d.id}`}
                  className="neu-btn neu-btn-sm neu-btn-primary"
                >
                  People and rooms
                </Link>
                {isOrgAdmin && active && (
                  <form action={addRoom} className="flex flex-1 gap-2">
                    <input type="hidden" name="dept_id" value={d.id} />
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={100}
                      placeholder="New room name"
                      aria-label={`New room in ${d.name}`}
                      className="neu-input"
                    />
                    <SubmitButton
                      className="neu-btn neu-btn-sm"
                      pendingText="Adding…"
                    >
                      Add room
                    </SubmitButton>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}