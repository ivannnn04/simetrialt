import { SiteHeader } from "@/components/site/Header";

/** Inner pages: solid header plus a centered content column. */
export default function InnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader variant="solid" />
      <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-10 md:px-10">{children}</div>
    </>
  );
}
