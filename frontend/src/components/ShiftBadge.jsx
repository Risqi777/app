import { SHIFT_META } from "../lib/api";
import { cn } from "../lib/utils";

export function ShiftBadge({ shift, small = false }) {
  if (!shift) return <span className="text-slate-300 text-xs">—</span>;
  const meta = SHIFT_META[shift] || { code: shift, label: shift, cls: "bg-slate-100 text-slate-700 border-slate-300" };
  return (
    <span
      data-testid={`shift-cell-${shift.replace(/\s+/g, "-")}`}
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-bold tracking-wide",
        small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        meta.cls,
      )}
      title={meta.label}
    >
      {meta.code}
    </span>
  );
}
