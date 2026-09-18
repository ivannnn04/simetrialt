"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginCustomerAction, registerAction } from "@/actions/account";
import { DotButton } from "@/components/ui/Button";

const inputCls =
  "w-full border-b border-line bg-transparent pb-2 text-[18px] font-medium leading-none tracking-[-0.04em] text-ink placeholder:text-secondary focus:border-black focus:outline-none";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const [state, action, pending] = useActionState(mode === "login" ? loginCustomerAction : registerAction, undefined);
  return (
    <form action={action} className="flex w-full max-w-[452px] flex-col gap-12">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-10">
        {mode === "register" && (
          <>
            <input name="name" placeholder="Full name" required className={inputCls} />
            <input name="company" placeholder="Company / studio (optional)" className={inputCls} />
          </>
        )}
        <input name="email" type="email" placeholder="Email" required autoComplete="email" className={inputCls} />
        <input
          name="password"
          type="password"
          placeholder={mode === "register" ? "Password (min. 8 characters)" : "Password"}
          required
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          className={inputCls}
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
