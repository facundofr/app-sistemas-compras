import { Skeleton } from "@/components/ui/skeleton";

/** Mientras carga una pantalla: la forma del contenido en vez de una pantalla en blanco. */
export default function Cargando() {
  return (
    <div aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b px-4 py-3.5 last:border-0">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
