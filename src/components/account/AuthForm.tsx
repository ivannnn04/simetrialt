"use client";

import Link from "@/components/ui/Link";
import { startTransition, useActionState, useEffect, useState } from "react";
import {
  cancelVerificationAction,
  loginCustomerAction,
  registerAction,
  resendCodeAction,
  verifyCodeAction,
  type AuthState,
} from "@/actions/account";
import { DotButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useT } from "@/i18n/client";

type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;
type Verify = { email: string; retryIn: number; kept: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sign-in / registration form. New accounts (and sign-ins of accounts that were never confirmed)
 * continue to a second step where the visitor enters the 6-digit code emailed to them.
 */
export function AuthForm({
  mode,
  next,
  pending: pendingVerify,
}: {
  mode: "login" | "register";
  next: string;
  pending?: { email: string; retryIn: number } | null;
}) {
  const t = useT().auth;
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? loginCustomerAction : registerAction, undefined);
  const [errors, setErrors] = useState<FieldErrors>({});
  // the code step the visitor closed with "Use a different email" ("initial" = the one restored on page load)
  const [dismissed, setDismissed] = useState<AuthState | "initial" | null>(null);

  const verify: Verify | null =
    state?.verify && dismissed !== state
      ? state.verify
      : !state?.verify && pendingVerify && dismissed !== "initial"
        ? { ...pendingVerify, kept: true }
        : null;

  const validate = (form: HTMLFormElement): FieldErrors => {
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? "").trim();
    const e: FieldErrors = {};
    if (mode === "register" && !get("name")) e.name = t.nameRequired;
    if (!get("email")) e.email = t.emailRequired;
    else if (!EMAIL_RE.test(get("email"))) e.email = t.emailInvalid;
    if (!get("password")) e.password = t.passwordRequired;
    else if (mode === "register" && get("password").length < 8) e.password = t.passwordShort;
    return e;
  };

  return (
    <>
      {verify && (
        <VerifyForm
          key={verify.email}
          {...verify}
          next={next}
          onCancel={() => {
            setDismissed(state?.verify ? state : "initial");
            void cancelVerificationAction();
          }}
        />
      )}
      {/* kept mounted while the code step is shown, so "Use a different email" returns to the filled form */}
      <form
        noValidate
        onSubmit={(ev) => {
          // submitted by hand (not via the `action` prop) so React doesn't clear the fields after an error
          ev.preventDefault();
          const nextErrors = validate(ev.currentTarget);
          setErrors(nextErrors);
          if (Object.keys(nextErrors).length > 0) return;
          const data = new FormData(ev.currentTarget);
          startTransition(() => action(data));
        }}
        onInput={(ev) => {
          const name = (ev.target as HTMLElement).getAttribute("name") as keyof FieldErrors | null;
          if (name && errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
        }}
        className={verify ? "hidden" : "flex w-full max-w-[452px] flex-col gap-12"}
      >
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-10">
          {mode === "register" && (
            <>
              <Field name="name" label={t.name} required autoComplete="name" error={errors.name} />
              <Field name="company" label={t.company} autoComplete="organization" />
            </>
          )}
          <Field name="email" type="email" label={t.email} required autoComplete="email" error={errors.email} />
          <Field
            name="password"
            type="password"
            label={mode === "register" ? t.newPassword : t.password}
            required
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            error={errors.password}
          />
          {state?.error && <p role="alert" className="text-[14px] text-[#fb3b30]">{state.error}</p>}
        </div>
        <div className="flex flex-col gap-6">
          <DotButton type="submit" className="w-full" disabled={pending}>
            {pending ? t.wait : mode === "login" ? t.signIn : t.createAccount}
          </DotButton>
          <p className="text-[14px] tracking-[-0.04em] text-secondary">
            {mode === "login" ? (
              <>
                {t.newHere}{" "}
                <Link href={`/account/register?next=${encodeURIComponent(next)}`} className="text-black underline">{t.createLink}</Link>
              </>
            ) : (
              <>
                {t.haveAccount}{" "}
                <Link href={`/account/login?next=${encodeURIComponent(next)}`} className="text-black underline">{t.signInLink}</Link>
              </>
            )}
          </p>
        </div>
      </form>
    </>
  );
}

function VerifyForm({ email, retryIn, kept, next, onCancel }: Verify & { next: string; onCancel: () => void }) {
  const t = useT().auth;
  const [state, action, pending] = useActionState(verifyCodeAction, undefined);
  const [left, setLeft] = useState(retryIn);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [hideServerError, setHideServerError] = useState(false);
  const [resendState, resend, resending] = useActionState(async () => {
    const r = await resendCodeAction();
    if (r?.verify) {
      setLeft(r.verify.retryIn);
      setHideServerError(true);
    }
    return r;
  }, undefined);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const error = codeError ?? (!hideServerError ? state?.error : undefined);

  return (
    <div className="flex w-full max-w-[452px] flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="text-[24px] font-semibold leading-[1.3] tracking-[-0.04em] text-black">{t.verifyTitle}</h2>
        <p className="text-[16px] leading-[1.4] tracking-[-0.03em] text-body">{kept ? t.verifyTextKept(email) : t.verifyText(email)}</p>
      </div>
      <form
        action={action}
        noValidate
        onSubmit={(ev) => {
          const code = String(new FormData(ev.currentTarget).get("code") ?? "").replace(/\s+/g, "");
          const bad = !/^\d{6}$/.test(code);
          setCodeError(bad ? t.codeFormat : null);
          setHideServerError(false);
          if (bad) ev.preventDefault();
        }}
        onInput={() => {
          setCodeError(null);
          setHideServerError(true);
        }}
        className="flex flex-col gap-10"
      >
        <input type="hidden" name="next" value={next} />
        <Field
          name="code"
          label={t.code}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          required
          error={error ?? undefined}
        />
        <DotButton type="submit" className="w-full" disabled={pending}>
          {pending ? t.wait : t.confirm}
        </DotButton>
      </form>
      <div className="flex flex-col gap-3 text-[14px] tracking-[-0.04em]">
        <form action={resend}>
          <button
            type="submit"
            disabled={left > 0 || resending}
            className="text-black underline disabled:cursor-not-allowed disabled:text-secondary disabled:no-underline"
          >
            {resending ? t.wait : left > 0 ? t.resendIn(left) : t.resend}
          </button>
        </form>
        {resendState?.notice && <p className="text-secondary">{resendState.notice}</p>}
        {resendState?.error && <p role="alert" className="text-[#fb3b30]">{resendState.error}</p>}
        <button type="button" onClick={onCancel} className="self-start text-secondary underline transition-colors hover:text-black">
          {t.changeEmail}
        </button>
      </div>
    </div>
  );
}
