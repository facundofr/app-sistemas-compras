import { cn } from "@/lib/utils";

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-2 font-heading text-[17px] font-bold tracking-tight text-white">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full bg-gold shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold)_28%,transparent)]"
        />
        <span className="truncate">Pedidos Sistemas</span>
      </div>
      {!compact && <p className="mt-0.5 truncate pl-[18px] text-[11.5px] tracking-wide text-[#8b93a0]">Grupo Cober · Compras</p>}
    </div>
  );
}
