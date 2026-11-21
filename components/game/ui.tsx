import type { ButtonHTMLAttributes, CSSProperties } from "react";

/**
 * primary: dolu mühür · secondary: çerçeve mühür · dashed: kesik çizgili mühür (kâğıt üstünde)
 * ghost: altı çizili metin · quiet: oda üstünde ince çerçeveli düğme
 */
type Variant = "primary" | "secondary" | "dashed" | "ghost" | "quiet";

const variants: Record<Variant, string> = {
  primary: "stamp stamp-solid",
  secondary: "stamp stamp-outline",
  dashed: "stamp stamp-dashed",
  ghost: "btn-ghost",
  quiet: "btn-quiet",
};

/** Mühür boyu (yalnız mühür türlerinde): md taban, lg ekran eylemi, xl açılış eylemi. */
type Size = "md" | "lg" | "xl";

const sizes: Record<Size, string> = { md: "", lg: "stamp-lg", xl: "stamp-xl" };

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Mühür eğimi, derece. */
  tilt?: number;
  /** Odak kaybolmasın diye `disabled` yerine `aria-disabled`; tıklama yine engellenir. */
  busy?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  tilt,
  busy,
  className = "",
  style,
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
      className={`${variants[variant]} ${sizes[size]} ${className}`}
      style={tilt === undefined ? style : ({ ...style, "--tilt": `${tilt}deg` } as CSSProperties)}
      {...rest}
    />
  );
}

export function Kbd({ children }: { children: string }) {
  return (
    <kbd aria-hidden="true" className="kbd hidden sm:inline-block">
      {children}
    </kbd>
  );
}

/** Sayaç çentikleri: her soru bir çizgi, beşte bir çapraz. */
export function Tally({ count, label }: { count: number; label: string }) {
  const groups = Math.floor(count / 5);
  const rest = count % 5;
  const step = 7;
  const groupWidth = 4 * step + 10;
  const width = Math.max(groups * groupWidth + rest * step, 1);
  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height="28"
      viewBox={`0 0 ${width} 28`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      className="max-w-full shrink-0"
    >
      {Array.from({ length: groups }, (_, g) => {
        const x = g * groupWidth + 3;
        return (
          <path
            key={g}
            d={`M${x} 4v20M${x + step} 4v20M${x + 2 * step} 4v20M${x + 3 * step} 4v20M${x - 3} 21L${x + 3 * step + 4} 7`}
          />
        );
      })}
      {rest > 0 && (
        <path
          d={Array.from(
            { length: rest },
            (_, i) => `M${groups * groupWidth + 3 + i * step} 4v20`,
          ).join("")}
        />
      )}
    </svg>
  );
}
