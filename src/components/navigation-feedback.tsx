"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavigationFeedback() {
  const pathname = usePathname();
  const [nav, setNav] = useState<{ id: number; from: string } | null>(null);
  const [slowId, setSlowId] = useState<number | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      const a = target?.closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      if (url.pathname.endsWith("/export")) return; // CSV download

      const id = Date.now();
      setNav({ id, from: window.location.pathname });
      window.setTimeout(() => setSlowId(id), 350);
      // Safety net: never leave the overlay up forever
      window.setTimeout(
        () => setNav((n) => (n && n.id === id ? null : n)),
        10000
      );
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Still on the page we left from means the next page has not arrived yet
  const pending = nav !== null && nav.from === pathname;
  const slow = nav !== null && pending && slowId === nav.id;

  if (!pending) return null;
  return (
    <>
      <div className="nav-bar" aria-hidden="true" />
      {slow && (
        <div className="nav-overlay" role="status" aria-live="polite">
          <div className="nav-spinner">
            <span className="spinner" aria-hidden="true" />
          </div>
          <span className="sr-only">Loading…</span>
        </div>
      )}
    </>
  );
}