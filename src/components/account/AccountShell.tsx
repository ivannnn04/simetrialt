import { SiteHeader } from "@/components/site/Header";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { getT } from "@/i18n/server";

/** Page frame of the account pages: big title and text on the left, the form on the right. */
export async function AccountShell({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  const t = (await getT()).auth;
  return (
    <div className="flex w-full flex-col bg-cream pb-10 md:pb-[120px]">
      <section className="flex w-full flex-col gap-16 lg:gap-[100px]">
        <SiteHeader variant="solid" />
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-4 md:px-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-6 lg:w-[640px]">
            <Breadcrumbs items={[{ label: t.home, href: "/" }, { label: t.account, href: "/account/login" }, { label: title }]} />
            <h1 className="text-[44px] font-medium leading-[0.92] min-[400px]:text-[56px] tracking-[-0.04em] text-black md:text-[80px] xl:text-[105px]">{title}</h1>
            <p className="max-w-[420px] text-[16px] leading-[1.3] tracking-[-0.04em] text-body">{text}</p>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
