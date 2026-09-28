import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function Campo({
  id,
  label,
  requerido,
  error,
  ayuda,
  className,
  children,
}: {
  id: string;
  label: string;
  requerido?: boolean;
  error?: string;
  ayuda?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Field data-invalid={!!error || undefined} className={cn("gap-1.5", className)}>
      <FieldLabel htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        {label}
        {requerido && <span className="-ml-1 text-destructive">*</span>}
      </FieldLabel>
      {children}
      {ayuda && !error && <FieldDescription className="text-xs">{ayuda}</FieldDescription>}
      {error && <FieldError className="text-xs">{error}</FieldError>}
    </Field>
  );
}
