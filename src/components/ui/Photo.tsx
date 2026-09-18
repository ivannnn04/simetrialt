import { cn } from "@/lib/cn";
import { PLACEHOLDER_IMAGE } from "@/lib/placeholder";

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
 * While PLACEHOLDER_IMAGE is set, it is used for every slot.
 */
export function Photo({ src, tone = "dark", position = "center", className, children }: Props) {
  const image = PLACEHOLDER_IMAGE ?? src;
  return (
    <div
      className={cn("relative bg-cover", className)}
      style={{ backgroundImage: `url(${image}), ${tones[tone]}`, backgroundPosition: position }}
    >
      {children}
    </div>
  );
}
