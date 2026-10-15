import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
      <path d="M10 19.5v-5h4v5" />
    </>
  ),
  door: (
    <>
      <path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21" />
      <path d="M3.5 21h17" />
      <path d="M14 12v.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c.6-3.4 2.9-5.2 5.5-5.2s4.9 1.8 5.5 5.2" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6" />
      <path d="M17.5 14.9c2 .6 3.3 2.2 3.8 5.1" />
    </>
  ),
  chart: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7 15l3.5-4 3 2.5L17.5 8" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.5 3v5.5c0 4.5-3.1 8.3-7.5 9.5-4.4-1.2-7.5-5-7.5-9.5V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  building: (
    <>
      <path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h8A1.5 1.5 0 0 1 16 4.5V21" />
      <path d="M16 10h2.5a1.5 1.5 0 0 1 1.5 1.5V21M3 21h18" />
      <path d="M9 7.5h3M9 11h3M9 14.5h3" />
    </>
  ),
  check: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8.5 12l2.5 2.5L16 9.5" />
    </>
  ),
    user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-4 3.6-6 7-6s6.2 2 7 6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  logout: (
    <>
      <path d="M9 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H9" />
      <path d="M16 8l4 4-4 4M20 12H9" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
};

export default function Icon({
  name,
  size = 22,
}: {
  name: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}