import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site/Header";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { AuthForm } from "@/components/account/AuthForm";
import { currentCustomer, pendingVerification } from "@/lib/customer-auth";
import { getT } from "@/i18n/server";

type Props = { mode: "login" | "register"; searchParams: Promise<{ next?: string }> };

export async function AuthPage({ mode, searchParams }: Props) {
  const { next: rawNext } = await searchParams;
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/account/albums";
  if (await currentCustomer()) redirect(next);
  const t = (await getT()).auth;
  // registration started in this browser but the email code not entered yet → show the code step again
  const pending = await pendingVerification();
  const title = mode === "login" ? t.loginTitle : t.registerTitle;
  const text = mode === "login" ? t.loginText : t.registerText;
  return (
    <div className="flex w-full flex-col bg-cream pb-10 md:pb-[120px]">
      <section className="flex w-full flex-col gap-16 lg:gap-[100px]">
        <SiteHeader variant="solid" />
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-4 md:px-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-6 lg:w-[640px]">
            <Breadcrumbs items={[{ label: t.home, href: "/" }, { label: t.account }]} />
            <h1 className="text-[44px] font-medium leading-[0.92] min-[400px]:text-[56px] tracking-[-0.04em] text-black md:text-[80px] xl:text-[105px]">{title}</h1>
            <p className="max-w-[420px] text-[16px] leading-[1.3] tracking-[-0.04em] text-body">{text}</p>
          </div>
          <AuthForm mode={mode} next={next} pending={pending} />
        </div>
      </section>
    </div>
  );
}
