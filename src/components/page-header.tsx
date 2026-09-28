import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-[13.5px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Stat({
  valor,
  label,
  tono,
  mono,
}: {
  valor: React.ReactNode;
  label: string;
  tono?: "alerta" | "apagado";
  mono?: boolean;
}) {
  return (
    <div className="min-w-[112px] rounded-xl border bg-card px-4 py-2.5 shadow-[0_1px_2px_rgb(18_24_31/0.05),0_8px_24px_-14px_rgb(18_24_31/0.2)] dark:shadow-none">
      <div
        className={cn(
          "font-heading text-[19px] leading-tight font-bold tabular",
          mono && "font-mono text-[17px] font-semibold",
          tono === "alerta" && "text-destructive",
          tono === "apagado" && "text-muted-foreground",
        )}
      >
        {valor}
      </div>
      <div className="mt-0.5 text-[10.5px] font-medium tracking-[0.06em] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}

export function Stats({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2.5">{children}</div>;
}
