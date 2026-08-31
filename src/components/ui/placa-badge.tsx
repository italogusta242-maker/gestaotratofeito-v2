import { formatPlaca, isPlacaMercosul } from "@/lib/format-placa";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const sizeMap: Record<Size, { wrap: string; brasil: string; text: string; border: string }> = {
  sm: { wrap: "w-[76px]", brasil: "text-[6px] py-[1px]", text: "text-[11px] py-0.5", border: "border" },
  md: { wrap: "w-[112px]", brasil: "text-[8px] py-[2px]", text: "text-base py-1", border: "border-2" },
  lg: { wrap: "w-[160px]", brasil: "text-[10px] py-[3px]", text: "text-2xl py-1.5", border: "border-2" },
};

interface PlacaBadgeProps {
  placa: string;
  size?: Size;
  className?: string;
}

export function PlacaBadge({ placa, size = "sm", className }: PlacaBadgeProps) {
  const s = sizeMap[size];
  const mercosul = isPlacaMercosul(placa);
  const texto = formatPlaca(placa);

  if (mercosul) {
    return (
      <div
        className={cn(
          "inline-flex flex-col overflow-hidden rounded-[3px] border-slate-800 bg-white shadow-sm select-none whitespace-nowrap text-center leading-none",
          s.wrap,
          s.border,
          className,
        )}
      >
        <div className={cn("bg-[#1e3a8a] font-semibold uppercase tracking-[0.15em] text-white", s.brasil)}>
          Brasil
        </div>
        <div className={cn("font-bold tracking-wider text-slate-900", s.text)}>{texto}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-[3px] border-slate-700 bg-slate-200 font-bold tracking-wider text-slate-900 shadow-sm select-none whitespace-nowrap leading-none",
        s.wrap,
        s.border,
        s.text,
        className,
      )}
    >
      {texto}
    </div>
  );
}
