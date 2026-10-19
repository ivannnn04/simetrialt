"use client";

import { cn } from "@/lib/cn";

/** Submit button that asks for confirmation first (used for destructive actions). */
export function ConfirmButton({
  message,
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { message: string }) {
  return (
    <button
      {...rest}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={cn("rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50", className)}
    >
      {children}
    </button>
  );
}
