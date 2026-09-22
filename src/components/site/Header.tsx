import { HeaderClient } from "@/components/site/HeaderClient";

type Props = { variant?: "overlay" | "solid" };

/** Site header. Albums are front-end only for now, so no account lookup happens here. */
export function SiteHeader({ variant = "solid" }: Props) {
  return <HeaderClient variant={variant} />;
}
