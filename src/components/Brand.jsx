export function Brand({ size = 36, light = false }) {
  const text = light ? "text-white" : "text-navy-900";
  const sub = light ? "text-teal-200" : "text-teal-600";
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
        <rect width="40" height="40" rx="11" fill="#102a5c" />
        <circle cx="20" cy="20" r="11" stroke="#22c1c9" strokeWidth="2.5" />
        <path d="M20 9v11l7.5 4.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="20" cy="20" r="2.6" fill="#22c1c9" />
      </svg>
      <div className="leading-none">
        <div className={`font-display text-[15px] font-extrabold tracking-tight ${text}`}>
          OneGrasp
        </div>
        <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${sub}`}>
          Conferences
        </div>
      </div>
    </div>
  );
}
