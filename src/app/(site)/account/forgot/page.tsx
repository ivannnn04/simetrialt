import { AccountShell } from "@/components/account/AccountShell";
import { ForgotPasswordForm } from "@/components/account/PasswordReset";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).auth.forgotMeta };
}

export default async function ForgotPasswordPage() {
  const t = (await getT()).auth;
  return (
    <AccountShell title={t.forgotTitle} text={t.forgotText}>
      <ForgotPasswordForm />
    </AccountShell>
  );
}
