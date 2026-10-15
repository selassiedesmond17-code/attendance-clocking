export default function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <div className="brand">
      {/* Later: replace this mark with <img src="/logo.svg" alt="" /> */}
      <span className={`brand-mark${big ? " brand-mark-lg" : ""}`}>
        <svg
          width={big ? 28 : 20}
          height={big ? 28 : 20}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </span>
      <span className={`brand-name${big ? " brand-name-lg" : ""}`}>KlokIt</span>
    </div>
  );
}