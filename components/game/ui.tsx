import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-lg px-5 text-base font-medium " +
  "transition-[background-color,border-color,color,transform] duration-150 ease-out active:translate-y-px " +
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-55 aria-disabled:active:translate-y-0 " +
  "disabled:cursor-not-allowed disabled:opacity-55";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-strong aria-disabled:hover:bg-accent",
  secondary:
    "border border-line bg-surface-2 text-fg hover:border-line-strong hover:bg-surface-3 aria-disabled:hover:bg-surface-2",
  ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg aria-disabled:hover:bg-transparent",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Odak kaybolmasın diye `disabled` yerine `aria-disabled`; tıklama yine engellenir. */
  busy?: boolean;
};

export function Button({
  variant = "secondary",
  busy,
  className = "",
  onClick,
  type,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      aria-disabled={busy || undefined}
      onClick={(e) => {
        if (busy) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={`${base} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}

export function Kbd({ children }: { children: string }) {
  return (
    <kbd
      aria-hidden="true"
      className="hidden min-w-6 rounded border border-line px-1.5 text-center font-sans text-xs leading-5 font-medium text-fg-subtle sm:inline-block"
    >
      {children}
    </kbd>
  );
}
