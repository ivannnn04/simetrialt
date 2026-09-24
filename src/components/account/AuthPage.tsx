import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site/Header";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { AuthForm } from "@/components/account/AuthForm";
import { currentCustomer } from "@/lib/customer-auth";

type Props = { mode: "login" | "register"; searchParams: Promise<{ next?: string }> };

export async function AuthPage({ mode, searchParams }: Props) {
  const { next: rawNext } = await searchParams;
  const next = rawNext && rawNext.startsWith("/") ? rawNext : "/account/albums";
  if (await currentCustomer()) redirect(next);
  const title = mode === "login" ? "Sign in" : "Create your account";
  const text =
    mode === "login"
      ? "Access your albums, save products from the catalogue and organise them by project."
      : "Save products from the catalogue into collections organised by project, and share them with your team.";
  return (
    <div className="flex w-full flex-col bg-cream pb-10 md:pb-[120px]">
      <section className="flex w-full flex-col gap-16 lg:gap-[100px]">
        <SiteHeader variant="solid" />
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-4 md:px-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-6 lg:w-[640px]">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account" }]} />
            <h1 className="text-[56px] font-medium leading-[0.92] tracking-[-0.04em] text-black md:text-[80px] xl:text-[105px]">{title}</h1>
            <p className="max-w-[420px] text-[16px] leading-[1.3] tracking-[-0.04em] text-body">{text}</p>
          </div>
          <AuthForm mode={mode} next={next} />
        </div>
      </section>
    </div>
  );
}
