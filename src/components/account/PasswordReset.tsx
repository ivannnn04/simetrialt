"use client";

import Link from "@/components/ui/Link";
import { useActionState, useState } from "react";
import { forgotPasswordAction, resetPasswordAction } from "@/actions/account";
import { DotButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useT } from "@/i18n/client";

/** "Forgot password?": asks for the account email and sends the reset link. */
export function ForgotPasswordForm() {
  const t = useT().auth;
  const [state, action, pending] = useActionState(forgotPasswordAction, undefined);
  return (
    <form action={action} className="flex w-full max-w-[452px] flex-col gap-12">
      <div className="flex flex-col gap-10">
        <Field name="email" type="email" label={t.email} required autoComplete="email" autoFocus />
        {state?.error && <p role="alert" className="text-[14px] text-[#fb3b30]">{state.error}</p>}
        {state?.notice && <p role="status" className="text-[14px] leading-[1.4] tracking-[-0.03em] text-black">{state.notice}</p>}
      </div>
      <div className="flex flex-col gap-6">
        <DotButton type="submit" className="w-full" disabled={pending}>
          {pending ? t.wait : t.sendLink}
        </DotButton>
        <Link href="/account/login" className="self-start text-[14px] tracking-[-0.04em] text-black underline">{t.backToSignIn}</Link>
      </div>
    </form>
  );
}

/** Opened from the emailed link: the new password, typed twice. */
export function ResetPasswordForm({ token, valid }: { token: string; valid: boolean }) {
  const t = useT().auth;
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);
  const [error, setError] = useState<string | null>(null);
  if (!valid) {
    return (
      <div className="flex w-full max-w-[452px] flex-col gap-8">
        <p role="alert" className="text-[16px] leading-[1.4] tracking-[-0.03em] text-[#fb3b30]">{t.resetLinkInvalid}</p>
        <Link href="/account/forgot" className="self-start text-[14px] tracking-[-0.04em] text-black underline">{t.requestNewLink}</Link>
      </div>
    );
  }
  return (
    <form
      action={action}
      noValidate
      onSubmit={(ev) => {
        const data = new FormData(ev.currentTarget);
        const password = String(data.get("password") ?? "");
        const msg = password.length < 8 ? t.passwordShort : password !== String(data.get("confirm") ?? "") ? t.passwordMismatch : null;
        setError(msg);
        if (msg) ev.preventDefault();
      }}
      onInput={() => setError(null)}
      className="flex w-full max-w-[452px] flex-col gap-12"
    >
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-10">
        <Field name="password" type="password" label={t.newPassword} required autoComplete="new-password" autoFocus />
        <Field name="confirm" type="password" label={t.confirmPassword} required autoComplete="new-password" />
        {(error ?? state?.error) && <p role="alert" className="text-[14px] text-[#fb3b30]">{error ?? state?.error}</p>}
      </div>
      <DotButton type="submit" className="w-full" disabled={pending}>
        {pending ? t.wait : t.savePassword}
      </DotButton>
    </form>
  );
}
