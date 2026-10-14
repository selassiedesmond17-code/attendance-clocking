"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icons";

type OrgItem = {
  id: string;
  name: string;
  status: string;
  isOrgAdmin: boolean;
  canManageRooms: boolean;
};

type NavData = {
  email: string | null;
  isPlatformAdmin: boolean;
  orgs: OrgItem[];
};

type MembershipRow = {
  role: string;
  organizations: { id: string; name: string; status: string } | null;
};

type Item = { href: string; label: string; icon: string; active: boolean };

const PRIMARY = ["Dashboard", "Rooms", "Sessions", "Reports"];

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [data, setData] = useState<NavData | null>(null);
  const [stored, setStored] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const lastLoad = useRef(0);
  const forced = useRef<string | null>(null);

  const hidden = pathname.startsWith("/login");
  const urlOrg = pathname.match(/^\/org\/([0-9a-fA-F-]{36})/)?.[1] ?? null;

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setData(null);
      return;
    }
    const uid = session.user.id;
    const [mem, ra, pa] = await Promise.all([
      supabase
        .from("memberships")
        .select("role, organizations(id, name, status)")
        .eq("user_id", uid),
      supabase
        .from("room_members")
        .select("organization_id")
        .eq("user_id", uid)
        .eq("role", "room_admin"),
      supabase.rpc("is_platform_admin"),
    ]);
    const roomAdminOrgs = new Set(
      ((ra.data ?? []) as { organization_id: string }[]).map(
        (r) => r.organization_id
      )
    );
    const orgs = ((mem.data ?? []) as unknown as MembershipRow[]).flatMap(
      (m) =>
        m.organizations
          ? [
              {
                id: m.organizations.id,
                name: m.organizations.name,
                status: m.organizations.status,
                isOrgAdmin: m.role === "org_admin",
                canManageRooms:
                  m.role === "org_admin" ||
                  roomAdminOrgs.has(m.organizations.id),
              },
            ]
          : []
    );
    try {
      setStored(localStorage.getItem("currentOrg"));
    } catch {
      // storage unavailable
    }
    setData({
      email: session.user.email ?? null,
      isPlatformAdmin: Boolean(pa.data),
      orgs,
    });
  }, []);

  // Keep the list fresh, without asking the database on every click
  useEffect(() => {
    if (hidden) return;
    const now = Date.now();
    const unknown =
      urlOrg !== null &&
      data !== null &&
      !data.orgs.some((o) => o.id === urlOrg);
    const forceNow = unknown && forced.current !== urlOrg;
    if (!forceNow && now - lastLoad.current < 10000) return;
    if (forceNow) forced.current = urlOrg;
    lastLoad.current = now;
    void load();
  }, [pathname, hidden, urlOrg, data, load]);

  // Remember which organization you were last in
  useEffect(() => {
    if (!urlOrg) return;
    try {
      localStorage.setItem("currentOrg", urlOrg);
    } catch {
      // storage unavailable
    }
  }, [urlOrg]);

  if (hidden) return null;

  const orgs = data?.orgs ?? [];
  const current =
    orgs.find((o) => o.id === urlOrg) ??
    orgs.find((o) => o.id === stored) ??
    orgs[0] ??
    null;

  const within = (p: string) => pathname === p || pathname.startsWith(p + "/");
  const items: Item[] = [
    { href: "/", label: "Dashboard", icon: "home", active: pathname === "/" },
  ];
  if (current) {
    const base = `/org/${current.id}`;
    const inSessions = pathname.startsWith(base) && pathname.includes("/sessions");
    items.push({
      href: base,
      label: "Rooms",
      icon: "door",
      active: (pathname === base || within(`${base}/rooms`)) && !inSessions,
    });
    if (current.canManageRooms) {
      items.push({
        href: `${base}/sessions`,
        label: "Sessions",
        icon: "clock",
        active: inSessions,
      });
      items.push({
        href: `${base}/people`,
        label: "People",
        icon: "people",
        active: within(`${base}/people`),
      });
    }
    items.push({
      href: `${base}/reports`,
      label: "Reports",
      icon: "chart",
      active: within(`${base}/reports`),
    });
    if (current.isOrgAdmin) {
      items.push({
        href: `${base}/settings`,
        label: "Settings",
        icon: "sliders",
        active: within(`${base}/settings`),
      });
    }
  }
  if (data?.isPlatformAdmin) {
    items.push({
      href: "/platform",
      label: "Platform admin",
      icon: "shield",
      active: pathname === "/platform",
    });
  }

  const primary = items.filter((i) => PRIMARY.includes(i.label));
  const secondary = items.filter((i) => !PRIMARY.includes(i.label));
  const email = data?.email ?? "";
  const initials = (email.slice(0, 2) || "?").toUpperCase();

  function switchOrg(id: string) {
    try {
      localStorage.setItem("currentOrg", id);
    } catch {
      // storage unavailable
    }
    const m = pathname.match(/^\/org\/[^/]+\/(sessions|people|reports|settings)$/);
    window.dispatchEvent(new Event("app-navigate"));    
    router.push(m ? `/org/${id}/${m[1]}` : `/org/${id}`);
    setSheet(false);
  }

  const orgSwitch =
    orgs.length > 1 ? (
      <label className="block">
        <span className="sr-only">Organization</span>
        <select
          className="neu-input"
          value={current?.id ?? ""}
          onChange={(e) => switchOrg(e.target.value)}
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    ) : current ? (
      <div className="nav-org">
        <Icon name="building" size={18} />
        <span className="min-w-0 break-words">{current.name}</span>
      </div>
    ) : null;

  return (
    <nav className="app-nav" aria-label="Main navigation">
      {/* ---------- Laptop and desktop: left sidebar ---------- */}
      <div className="nav-desktop">
        <div className="nav-account neu-inset">
          <span className="nav-avatar">{initials}</span>
          <span className="nav-email" title={email}>
            {email || "Signed in"}
          </span>
        </div>
        {orgSwitch}
        <div className="nav-list">
          {data === null ? (
            <>
              <div className="skeleton h-11 w-full" />
              <div className="skeleton h-11 w-full" />
              <div className="skeleton h-11 w-full" />
            </>
          ) : (
            items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="nav-item"
                aria-current={i.active ? "page" : undefined}
              >
                <Icon name={i.icon} size={20} />
                <span>{i.label}</span>
              </Link>
            ))
          )}
        </div>
        <div className="nav-spacer" />
        <Link
          href="/register-org"
          className="nav-item"
          aria-current={pathname === "/register-org" ? "page" : undefined}
        >
          <Icon name="plus" size={20} />
          <span>New organization</span>
        </Link>
        <form action="/auth/signout" method="post">
          <button className="nav-item">
            <Icon name="logout" size={20} />
            <span>Sign out</span>
          </button>
        </form>
      </div>

      {/* ---------- Phone: bottom bar ---------- */}
      <div className="nav-mobile">
        {primary.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="nav-tab"
            aria-current={i.active ? "page" : undefined}
          >
            <Icon name={i.icon} size={22} />
            <span>{i.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className="nav-tab"
          aria-expanded={sheet}
          aria-haspopup="dialog"
          onClick={() => setSheet((s) => !s)}
        >
          <Icon name="more" size={22} />
          <span>More</span>
        </button>
      </div>

      {sheet && (
        <>
          <div
            className="nav-sheet-backdrop"
            onClick={() => setSheet(false)}
            aria-hidden="true"
          />
          <div
            className="nav-sheet neu-card"
            role="dialog"
            aria-label="More options"
            onClick={(e) => {
              if ((e.target as Element).closest("a")) setSheet(false);
            }}
          >
            <div className="nav-account neu-inset">
              <span className="nav-avatar">{initials}</span>
              <span className="nav-email" title={email}>
                {email || "Signed in"}
              </span>
            </div>
            {orgSwitch}
            {secondary.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="nav-item"
                aria-current={i.active ? "page" : undefined}
              >
                <Icon name={i.icon} size={20} />
                <span>{i.label}</span>
              </Link>
            ))}
            <Link href="/register-org" className="nav-item">
              <Icon name="plus" size={20} />
              <span>New organization</span>
            </Link>
            <form action="/auth/signout" method="post">
              <button className="nav-item">
                <Icon name="logout" size={20} />
                <span>Sign out</span>
              </button>
            </form>
          </div>
        </>
      )}
    </nav>
  );
}