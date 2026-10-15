import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";
import { UUID_RE } from "@/lib/report-filters";
import { adminLabel, isEducation } from "@/lib/org-types";
import {
  addableRoles,
  canRemove,
  deptRoleText,
  parseRoleChoice,
  withArticle,
  type Power,
} from "@/lib/dept";
import { notifyAdded } from "@/lib/notify";
import { siteUrl } from "@/lib/mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Member = {
  id: string;
  user_id: string;
  role: string;
  title: string | null;
  email: string | null;
};
type Invite = { id: string; email: string; role: string; title: string | null };

export default async function DepartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; deptId: string }>;
  searchParams: Promise<{
    done?: string;
    skipped?: string;
    error?: string;
    room?: string;
  }>;
}) {
  const { orgId, deptId } = await params;
  if (!UUID_RE.test(orgId) || !UUID_RE.test(deptId)) notFound();
  const sp = await searchParams;
  const path = `/org/${orgId}/departments/${deptId}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [orgRes, deptRes, adminRes, roleRes, roomsRes, memRes, invRes, nameRes] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, status, org_type")
        .eq("id", orgId)
        .single(),
      supabase
        .from("departments")
        .select("id, name")
        .eq("id", deptId)
        .eq("organization_id", orgId)
        .single(),
      supabase.rpc("is_org_admin", { org: orgId }),
      supabase.rpc("dept_role", { p_dept: deptId }),
      supabase
        .from("rooms")
        .select("id, name")
        .eq("department_id", deptId)
        .order("name"),
      supabase
        .from("department_members")
        .select("id, user_id, role, title, email")
        .eq("department_id", deptId)
        .order("created_at"),
      supabase
        .from("department_invites")
        .select("id, email, role, title")
        .eq("department_id", deptId)
        .order("created_at"),
      supabase
        .from("org_profiles")
        .select("user_id, full_name")
        .eq("organization_id", orgId),
    ]);

  const org = orgRes.data;
  const dept = deptRes.data;
  if (!org || !dept) notFound();

  const myRole = (roleRes.data as string | null) ?? "";
  const power: Power | null = adminRes.data
    ? "platform"
    : myRole === "admin"
    ? "admin"
    : myRole === "assistant"
    ? "assistant"
    : null;
  if (!power) redirect(`/org/${orgId}/sessions`);

  const rooms = (roomsRes.data ?? []) as { id: string; name: string }[];
  const members = (memRes.data ?? []) as Member[];
  const invites = (invRes.data ?? []) as Invite[];
  const names = new Map(
    ((nameRes.data ?? []) as { user_id: string; full_name: string | null }[])
      .filter((n) => n.full_name)
      .map((n) => [n.user_id, n.full_name as string])
  );
  const roles = addableRoles(org.org_type, power);
  const active = org.status === "active";

  async function addPeople(formData: FormData) {
    "use server";
    const { role, title } = parseRoleChoice(String(formData.get("who") ?? "user"));
    const emails = [
      ...new Set(
        String(formData.get("emails") ?? "")
          .toLowerCase()
          .split(/[\s,;]+/)
          .filter((e) => EMAIL_RE.test(e))
      ),
    ].slice(0, 200);
    if (emails.length === 0) {
      redirect(
        `${path}?error=${encodeURIComponent("Enter at least one valid email address")}`
      );
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc("add_department_people", {
      p_dept: deptId,
      p_emails: emails,
      p_role: role,
      p_title: title,
    });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    const r = data as {
      added: string[];
      skipped: number;
      org_name: string;
      dept_name: string;
      org_type: string;
    };
    if (r.added.length > 0) {
      await notifyAdded({
        site: await siteUrl(),
        orgName: r.org_name,
        roomName: r.dept_name,
        by: user?.email,
        emails: r.added,
        roleText: withArticle(deptRoleText(r.org_type, role, title)),
      });
    }
    revalidatePath(path);
    redirect(`${path}?done=${r.added.length}&skipped=${r.skipped}`);
  }

  async function addRoom(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_room", {
      p_dept: deptId,
      p_name: String(formData.get("name") ?? ""),
    });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    revalidatePath(path);
    redirect(`${path}?room=1`);
  }

  async function removeMember(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_department_member", {
      p_member: String(formData.get("id")),
    });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    revalidatePath(path);
    redirect(path);
  }

  async function cancelInvite(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_department_invite", {
      p_invite: String(formData.get("id")),
    });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    revalidatePath(path);
    redirect(path);
  }

  const group = (role: string, heading: string) => {
    const list = members.filter((m) => m.role === role);
    if (list.length === 0) return null;
    return (
      <div key={role}>
        <h3 className="muted mb-2 text-sm font-semibold">
          {heading} ({list.length})
        </h3>
        <ul className="flex flex-col gap-3">
          {list.map((m) => {
            const nm = names.get(m.user_id);
            return (
              <li
                key={m.id}
                className="neu-raised flex items-center justify-between gap-3"
              >
                <span className="min-w-0">
                  <span className="block break-words font-medium">
                    {nm ?? m.email ?? "Unknown"}
                  </span>
                  {nm && (
                    <span className="muted block break-all text-xs">{m.email}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={`neu-badge ${m.role === "user" ? "" : "badge-blue"}`}
                  >
                    {deptRoleText(org.org_type, m.role, m.title)}
                  </span>
                  {canRemove(power, m.role) && m.user_id !== user!.id && (
                    <form action={removeMember}>
                      <input type="hidden" name="id" value={m.id} />
                      <SubmitButton
                        className="neu-btn neu-btn-sm neu-btn-danger"
                        pendingText="…"
                      >
                        Remove
                      </SubmitButton>
                    </form>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <main className="page max-w-2xl">
      <p className="muted text-sm">{org.name}</p>
      <h1 className="text-2xl font-semibold">{dept.name}</h1>

      {sp.done !== undefined && (
        <p className="alert alert-ok mt-4">
          {sp.done} invitation{sp.done === "1" ? "" : "s"} sent ✓
          {sp.skipped && sp.skipped !== "0"
            ? ` (${sp.skipped} skipped: already added or not a valid email)`
            : ""}
        </p>
      )}
      {sp.room && <p className="alert alert-ok mt-4">Room created ✓</p>}
      {sp.error && <p className="alert alert-error mt-4">{sp.error}</p>}
      {!active && (
        <p className="alert alert-warn mt-4">This organization is not active.</p>
      )}

      <section className="neu-card mt-6">
        <h2 className="text-lg font-medium">Rooms</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {rooms.length === 0 && (
            <p className="muted text-sm">No rooms in this department yet.</p>
          )}
          {rooms.map((r) => (
            <Link
              key={r.id}
              href={`/org/${orgId}/rooms/${r.id}`}
              className="neu-btn neu-btn-sm"
            >
              {r.name}
            </Link>
          ))}
        </div>
        {power === "platform" && active && (
          <form action={addRoom} className="mt-4 flex gap-3">
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              placeholder="New room name"
              aria-label="New room name"
              className="neu-input"
            />
            <SubmitButton
              className="neu-btn neu-btn-primary"
              pendingText="Adding…"
            >
              Add room
            </SubmitButton>
          </form>
        )}
      </section>

      <section className="neu-card mt-6 flex flex-col gap-5">
        <h2 className="text-lg font-medium">People</h2>
        {members.length === 0 && (
          <p className="neu-inset muted">No one has joined this department yet.</p>
        )}
        {group("admin", `${adminLabel(org.org_type)}s`)}
        {group("assistant", "Assistants")}
        {group("user", isEducation(org.org_type) ? "Students" : "Staff")}
      </section>

      {invites.length > 0 && (
        <section className="neu-card mt-6">
          <h2 className="text-lg font-medium">
            Waiting to join{" "}
            <span className="neu-badge badge-warn ml-1">{invites.length}</span>
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {invites.map((i) => (
              <li
                key={i.id}
                className="neu-inset flex items-center justify-between gap-3"
              >
                <span className="min-w-0 break-all">
                  {i.email}{" "}
                  <span className="neu-badge ml-1">
                    {deptRoleText(org.org_type, i.role, i.title)}
                  </span>
                </span>
                {canRemove(power, i.role) && (
                  <form action={cancelInvite}>
                    <input type="hidden" name="id" value={i.id} />
                    <SubmitButton
                      className="neu-btn neu-btn-sm neu-btn-danger"
                      pendingText="…"
                    >
                      Cancel
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {active && (
        <section className="neu-card mt-6">
          <h2 className="text-lg font-medium">Add people</h2>
          <p className="muted mt-1 text-sm">
            Paste one or more email addresses, separated by commas, spaces or
            new lines. Each person gets an email and joins the next time they
            sign in.
          </p>
          <form action={addPeople} className="mt-4 flex flex-col gap-4">
            <label className="field">
              Add as
              <select name="who" className="neu-input mt-1">
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              name="emails"
              required
              rows={4}
              placeholder="alice@example.com, bob@example.com"
              aria-label="Email addresses"
              className="neu-input"
            />
            <SubmitButton
              className="neu-btn neu-btn-primary"
              pendingText="Sending invitations…"
            >
              Send invitations
            </SubmitButton>
          </form>
        </section>
      )}
    </main>
  );
}