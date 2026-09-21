import { cn } from "@/lib/cn";

/**
 * Figma "Input" (node 4103:16342). Underlined field with a floating label:
 *  default — 18px grey label on the line, hover — dark label + #909090 line,
 *  active / filled — 10px label above a 14px value, error — red value, line and message.
 */
type Common = {
  label: string;
  error?: string;
  className?: string;
};

type InputFieldProps = Common & { multiline?: false } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "placeholder" | "className">;
type TextareaFieldProps = Common & { multiline: true } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "placeholder" | "className">;

export type FieldProps = InputFieldProps | TextareaFieldProps;

const control =
  "peer w-full bg-transparent pt-[14px] text-[14px] leading-[1.3] tracking-[-0.04em] outline-none placeholder:text-transparent autofill:bg-transparent";

const floating = cn(
  "pointer-events-none absolute left-0 top-0 origin-left whitespace-nowrap font-medium leading-none tracking-[-0.04em] transition-[transform,font-size,color] duration-200 ease-out",
  // default: 18px label sitting on the line
  "translate-y-[6px] text-[18px] text-secondary group-hover:text-ink",
  // active / filled: 10px label above the value
  "peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:text-secondary",
  "peer-not-placeholder-shown:translate-y-0 peer-not-placeholder-shown:text-[10px] peer-not-placeholder-shown:text-secondary"
);

export function Field(props: FieldProps) {
  const { label, error, className, ...rest } = props;
  const id = rest.id ?? rest.name;
  const lineCls = cn(
    "group relative flex w-full flex-col border-b pb-0.5 transition-colors duration-300",
    error ? "border-[#fb3b30]" : "border-line hover:border-[#909090] focus-within:border-line"
  );
  const textCls = error ? "text-[#fb3b30]" : "text-black";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={lineCls}>
        {props.multiline ? (
          <textarea
            id={id}
            placeholder=" "
            rows={1}
            {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            className={cn(control, textCls, "min-h-[18px] resize-none")}
          />
        ) : (
          <input
            id={id}
            placeholder=" "
            {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
            className={cn(control, textCls)}
          />
        )}
        <span className={floating}>{label}</span>
      </label>
      {error && <p className="text-[10px] leading-none tracking-[-0.04em] text-[#fb3b30]">{error}</p>}
    </div>
  );
}
