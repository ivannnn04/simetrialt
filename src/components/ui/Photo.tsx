import { cn } from "@/lib/cn";

type Props = {
  /** Public path, e.g. /images/home/hero.jpg. If the file is missing the tone gradient shows instead. */
  src: string;
  tone?: "dark" | "light";
  position?: string;
  className?: string;
  children?: React.ReactNode;
};

const tones = {
  dark: "linear-gradient(165deg, #4b4641 0%, #2b2825 55%, #171615 100%)",
  light: "linear-gradient(165deg, #efeae1 0%, #ddd4c7 100%)",
};

/**
 * Photo area with a graceful fallback: the image is layered over a tonal gradient,
 * so a missing file degrades to a flat warm block instead of a broken image icon.
 */
export function Photo({ src, tone = "dark", position = "center", className, children }: Props) {
  return (
    <div
      className={cn("relative bg-cover", className)}
      style={{ backgroundImage: `url(${src}), ${tones[tone]}`, backgroundPosition: position }}
    >
      {children}
    </div>
  );
}
