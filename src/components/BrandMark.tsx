/**
 * Original CharityCheck brand mark: a burgundy public-record document viewed
 * through a magnifying glass. Deliberately not a shield or a check mark —
 * CharityCheck does not certify organizations or their tax status.
 *
 * Decorative in use: the adjacent "CharityCheck" wordmark carries the name,
 * so the SVG stays out of the accessibility tree.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="5" y="4" width="26" height="36" rx="5" fill="#922c4e" />
      <path
        d="M12 14h12M12 21h12M12 28h7"
        stroke="#faf7f0"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="32" cy="32" r="9" fill="#faf7f0" stroke="#642236" strokeWidth="3" />
      <path d="M38.5 38.5 45 45" stroke="#642236" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  )
}
