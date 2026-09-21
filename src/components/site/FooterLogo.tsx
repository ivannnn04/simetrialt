import { LOGO_PATHS, LOGO_VIEWBOX } from "@/data/logo-paths";

/** Footer wordmark (Figma footer): scales to the full container width. */
export function FooterLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Simetria"
      role="img"
    >
      {LOGO_PATHS.map((d, i) => (
        <path key={i} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}
