import Link from "next/link";
import { cn } from "@/lib/cn";

export const inputCls = "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-zinc-800">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, "leading-relaxed", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, props.className)} />;
}

export function PrimaryButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={cn("rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50", className)}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={cn("rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50", className)}>
      {children}
    </button>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
      {children}
    </Link>
  );
}

export function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl bg-white p-5 shadow-sm", className)}>
      {title && <h2 className="mb-4 text-base font-medium">{title}</h2>}
      {children}
    </section>
  );
}

export function PageTitle({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold">{children}</h1>
      {actions}
    </div>
  );
}

export function Badge({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "green" | "blue" | "amber" }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-600",
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return <span className={cn("rounded-full px-2 py-0.5 text-xs", tones[tone])}>{children}</span>;
}

export function Notice({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "green" | "red" }) {
  const tones = { zinc: "bg-zinc-100 text-zinc-700", green: "bg-green-50 text-green-800", red: "bg-red-50 text-red-700" };
  return <p className={cn("rounded-md px-3 py-2 text-sm", tones[tone])}>{children}</p>;
}
