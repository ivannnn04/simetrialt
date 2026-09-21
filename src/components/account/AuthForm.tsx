"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginCustomerAction, registerAction } from "@/actions/account";
import { DotButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const [state, action, pending] = useActionState(mode === "login" ? loginCustomerAction : registerAction, undefined);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (form: HTMLFormElement): FieldErrors => {
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? "").trim();
    const e: FieldErrors = {};
    if (mode === "register" && !get("name")) e.name = "Please enter your name";
    if (!get("email")) e.email = "Please enter your email";
    else if (!EMAIL_RE.test(get("email"))) e.email = "Please enter a valid email address";
    if (!get("password")) e.password = "Please enter your password";
    else if (mode === "register" && get("password").length < 8) e.password = "Password must be at least 8 characters";
    return e;
  };

  return (
    <form
      action={action}
      noValidate
      onSubmit={(ev) => {
        const nextErrors = validate(ev.currentTarget);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) ev.preventDefault();
      }}
      onInput={(ev) => {
        const name = (ev.target as HTMLElement).getAttribute("name") as keyof FieldErrors | null;
        if (name && errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
      }}
      className="flex w-full max-w-[452px] flex-col gap-12"
    >
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-10">
        {mode === "register" && (
          <>
            <Field name="name" label="Full name" required autoComplete="name" error={errors.name} />
            <Field name="company" label="Company / studio (optional)" autoComplete="organization" />
          </>
        )}
        <Field name="email" type="email" label="Email" required autoComplete="email" error={errors.email} />
        <Field
          name="password"
          type="password"
          label={mode === "register" ? "Password (min. 8 characters)" : "Password"}
          required
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          error={errors.password}
        />
        {state?.error && <p className="text-[14px] text-[#fb3b30]">{state.error}</p>}
      </div>
      <div className="flex flex-col gap-6">
        <DotButton type="submit" className="w-full" disabled={pending}>
          {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </DotButton>
        <p className="text-[14px] tracking-[-0.04em] text-secondary">
          {mode === "login" ? (
            <>
              New to Simetria?{" "}
              <Link href={`/account/register?next=${encodeURIComponent(next)}`} className="text-black underline">Create an account</Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href={`/account/login?next=${encodeURIComponent(next)}`} className="text-black underline">Sign in</Link>
            </>
          )}
        </p>
      </div>
    </form>
  );
}
