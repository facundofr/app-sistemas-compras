import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-bold tracking-tight">No encontramos esa página</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Puede que el pedido se haya eliminado o que el link esté mal escrito.
      </p>
      <Button asChild className="mt-2">
        <Link href="/">Ir al inicio</Link>
      </Button>
    </div>
  );
}
