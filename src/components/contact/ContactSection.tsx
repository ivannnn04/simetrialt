"use client";

import { useActionState, useState } from "react";
import { submitContact } from "@/actions/leads";
import { DotButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIMES = ["14:00", "15:00", "16:00", "17:00"];

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

/** Figma "Schedule a call" booking widget (node 4217:46387). Selection is passed into the contact form. */
function BookingWidget({ onBook }: { onBook: (text: string) => void }) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [day, setDay] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const summary = day && time ? `${day} ${MONTHS[month]} ${year}, ${time}` : null;

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-center gap-2 rounded-t-[8px] border-x border-t border-line px-6 py-4">
        <CalendarIcon />
        <p className="text-[16px] font-semibold leading-none tracking-[-0.04em] text-ink">Meeting booking</p>
      </div>
      <div className="flex flex-col border border-line sm:flex-row">
        <div className="flex flex-col items-center gap-3 border-b border-line px-4 pb-3 pt-4 sm:w-[300px] sm:border-b-0 sm:border-r">
          <div className="flex items-center gap-4 text-[14px] font-semibold leading-none tracking-[-0.04em] text-[#1f1f1f]">
            <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setDay(null); }} className="bg-transparent">
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setDay(null); }} className="bg-transparent">
              {[today.getFullYear(), today.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-7 gap-[2px] text-center text-[12px] leading-none tracking-[-0.04em] text-secondary">
            {WEEKDAYS.map((d) => <span key={d} className="w-9">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-[2px]">
            {cells.map((d, i) => (
              <button
                key={i}
                type="button"
                disabled={d === null}
                onClick={() => setDay(d)}
                className={cn(
                  "size-9 rounded-full text-[13px] leading-[1.3] tracking-[-0.04em]",
                  d === null ? "invisible" : d === day ? "bg-[#0073d9] text-white" : "text-[#1f1f1f] hover:bg-line/60"
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center gap-3 p-6">
          <p className="text-[14px] font-semibold leading-none tracking-[-0.04em] text-ink">Available Times</p>
          <div className="flex w-full flex-col gap-1">
            {TIMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTime(t)}
                className={cn(
                  "h-10 w-full rounded-[10px] border text-[18px] font-medium leading-none tracking-[-0.04em]",
                  t === time ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-ink"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col rounded-b-[8px] border-x border-b border-line px-6 py-4">
        <DotButton
          className="w-full"
          disabled={!summary}
          onClick={() => summary && onBook(`Consultation request: ${summary}`)}
        >
          Book a consultation
        </DotButton>
      </div>
    </div>
  );
}

type FieldErrors = Partial<Record<"firstName" | "email" | "phone" | "message", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client-side checks so errors render in the Figma "error" input state instead of browser bubbles. */
function validate(form: HTMLFormElement): FieldErrors {
  const data = new FormData(form);
  const get = (k: string) => String(data.get(k) ?? "").trim();
  const errors: FieldErrors = {};
  if (!get("firstName")) errors.firstName = "Please enter your first name";
  const email = get("email");
  if (email && !EMAIL_RE.test(email)) errors.email = "Please enter a valid email address";
  const phone = get("phone");
  if (phone && !/^[+\d][\d\s()-]{5,}$/.test(phone)) errors.phone = "Please enter a valid phone number";
  if (!get("message")) errors.message = "Please tell us about your project";
  return errors;
}

export function ContactSection({ initialMessage = "" }: { initialMessage?: string }) {
  const [state, formAction, pending] = useActionState(submitContact, undefined);
  const [details, setDetails] = useState(initialMessage);
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-16 px-4 pb-[120px] pt-20 md:px-10 lg:flex-row lg:gap-[180px]">
      <form
        action={formAction}
        id="contact-form"
        noValidate
        onSubmit={(e) => {
          const next = validate(e.currentTarget);
          setErrors(next);
          if (Object.keys(next).length > 0) {
            e.preventDefault();
            const first = Object.keys(next)[0];
            e.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
          }
        }}
        onInput={(e) => {
          const name = (e.target as HTMLElement).getAttribute("name") as keyof FieldErrors | null;
          if (name && errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
        }}
        className="flex flex-1 flex-col justify-between gap-12"
      >
        <div className="flex flex-col gap-12">
          <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-secondary">Contact form</p>
          {state?.message ? (
            <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-ink">{state.message}</p>
          ) : (
            <div className="flex flex-col gap-10">
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <div className="flex flex-col gap-10 sm:flex-row sm:gap-4">
                <Field name="firstName" label="First name" required autoComplete="given-name" className="flex-1" error={errors.firstName} />
                <Field name="lastName" label="Last name" autoComplete="family-name" className="flex-1" />
              </div>
              <Field name="email" type="email" label="Your email" autoComplete="email" error={errors.email} />
              <Field name="phone" type="tel" label="Phone" autoComplete="tel" error={errors.phone} />
              <Field
                multiline
                name="message"
                label="Project Details"
                required
                error={errors.message}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
              {state?.error && <p className="text-[14px] leading-none tracking-[-0.04em] text-[#fb3b30]">{state.error}</p>}
            </div>
          )}
        </div>
        {!state?.message && (
          <DotButton type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Submit"}
          </DotButton>
        )}
      </form>

      <div className="flex flex-col gap-6 lg:w-[452px] lg:shrink-0">
        <p className="text-[18px] leading-[1.3] tracking-[-0.04em] text-secondary">Schedule a call</p>
        <BookingWidget
          onBook={(text) => {
            setDetails((d) => (d ? `${d}\n${text}` : text));
            document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </div>
    </div>
  );
}
