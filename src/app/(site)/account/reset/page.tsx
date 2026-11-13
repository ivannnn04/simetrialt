import { AccountShell } from "@/components/account/AccountShell";
import { ResetPasswordForm } from "@/components/account/PasswordReset";
import { customerForResetToken } from "@/lib/password-reset";
import { getT } from "@/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getT()).auth.resetMeta, robots: { index: false } };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const t = (await getT()).auth;
  const token = (await searchParams).token ?? "";
  const valid = token ? Boolean(await customerForResetToken(token).catch(() => null)) : false;
  return (
    <AccountShell title={t.resetTitle} text={t.resetText}>
      <ResetPasswordForm token={token} valid={valid} />
    </AccountShell>
  );
}
