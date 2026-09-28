"use client";

import { startTransition, useActionState, useCallback, useEffect, useState } from "react";
import { Loader2Icon, PencilIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { actualizarUsuario, crearUsuario } from "@/actions/usuarios";
import type { FormState } from "@/actions/pedidos";
import { Campo } from "@/components/form/campo";
import { SelectSimple } from "@/components/form/select-simple";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Rol } from "@/db/schema";
import { ROLES } from "@/lib/constants";

type UsuarioEditable = { id: number; nombre: string; email: string; rol: Rol; activo: boolean };

const OPCIONES_ROL = Object.keys(ROLES) as Rol[];

function Formulario({ usuario, alTerminar }: { usuario?: UsuarioEditable; alTerminar: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(usuario ? actualizarUsuario : crearUsuario, {});
  const [rol, setRol] = useState<Rol>(usuario?.rol ?? "sistemas");
  const e = state.errores ?? {};

  useEffect(() => {
    if (state.ok && state.stamp) {
      toast.success(state.mensaje);
      alTerminar();
    }
  }, [state, alTerminar]);

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
      className="grid gap-4"
    >
      {usuario && <input type="hidden" name="id" value={usuario.id} />}
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Campo id="u-nombre" label="Nombre y apellido" requerido error={e.nombre}>
        <Input id="u-nombre" name="nombre" required defaultValue={usuario?.nombre} autoComplete="off" />
      </Campo>
      <Campo id="u-email" label="Email" requerido error={e.email} ayuda="Es el usuario para ingresar.">
        <Input id="u-email" name="email" type="email" required defaultValue={usuario?.email} autoComplete="off" />
      </Campo>
      <Campo id="u-rol" label="Rol" requerido error={e.rol} ayuda={ROLES[rol].descripcion}>
        <SelectSimple
          id="u-rol"
          name="rol"
          opciones={OPCIONES_ROL}
          etiquetas={Object.fromEntries(OPCIONES_ROL.map((r) => [r, ROLES[r].nombre]))}
          defaultValue={rol}
          onValueChange={(v) => setRol(v as Rol)}
          required
        />
      </Campo>
      <Campo
        id="u-password"
        label={usuario ? "Nueva contraseña" : "Contraseña inicial"}
        requerido={!usuario}
        error={e.password}
        ayuda={usuario ? "Dejala vacía para no cambiarla. Si la cambiás, se cierran sus sesiones." : "Mínimo 8 caracteres. La persona la puede cambiar después."}
      >
        <Input id="u-password" name="password" type="password" required={!usuario} minLength={8} autoComplete="new-password" />
      </Campo>
      {usuario && (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
          <div>
            <Label htmlFor="u-activo" className="text-sm">
              Usuario activo
            </Label>
            <p className="text-xs text-muted-foreground">Si lo desactivás, no puede ingresar.</p>
          </div>
          <Switch id="u-activo" name="activo" defaultChecked={usuario.activo} />
        </div>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {usuario ? "Guardar cambios" : "Crear usuario"}
        </Button>
      </DialogFooter>
    </form>
  );
}


export function UsuarioDialog({ usuario }: { usuario?: UsuarioEditable }) {
  const [open, setOpen] = useState(false);
  const cerrar = useCallback(() => setOpen(false), []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {usuario ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${usuario.nombre}`}>
            <PencilIcon />
          </Button>
        ) : (
          <Button>
            <UserPlusIcon /> Nuevo usuario
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{usuario ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          <DialogDescription>
            {usuario ? usuario.email : "Va a poder ingresar con este email y la contraseña que definas."}
          </DialogDescription>
        </DialogHeader>
        {open && <Formulario usuario={usuario} alTerminar={cerrar} />}
      </DialogContent>
    </Dialog>
  );
}
