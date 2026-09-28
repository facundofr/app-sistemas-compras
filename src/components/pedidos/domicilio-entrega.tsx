"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DOMICILIO_OTRO } from "@/lib/constants";

/**
 * Domicilio de entrega como en el formulario de Google: direcciones fijas o «Otro» con texto libre.
 * El valor final viaja en un input oculto `domicilioEntrega`.
 */
export function DomicilioEntrega({
  opciones,
  defaultValue,
  invalid,
}: {
  opciones: string[];
  defaultValue?: string;
  invalid?: boolean;
}) {
  const esOtro = !!defaultValue && !opciones.includes(defaultValue);
  const [opcion, setOpcion] = useState(esOtro ? DOMICILIO_OTRO : (defaultValue ?? ""));
  const [otro, setOtro] = useState(esOtro ? defaultValue : "");
  const otroRef = useRef<HTMLInputElement>(null);
  const valor = opcion === DOMICILIO_OTRO ? otro.trim() : opcion;

  return (
    <>
      <input type="hidden" name="domicilioEntrega" value={valor} />
      <RadioGroup
        id="domicilioEntrega"
        value={opcion}
        onValueChange={(v) => {
          setOpcion(v);
          if (v === DOMICILIO_OTRO) requestAnimationFrame(() => otroRef.current?.focus());
        }}
        aria-invalid={invalid || undefined}
        className="flex min-h-9 flex-wrap items-center gap-x-6 gap-y-3"
      >
        {opciones.map((o, i) => (
          <div key={o} className="flex items-center gap-2">
            <RadioGroupItem value={o} id={`dom-${i}`} aria-invalid={invalid || undefined} />
            <Label htmlFor={`dom-${i}`} className="font-normal">
              {o}
            </Label>
          </div>
        ))}
        <div className="flex min-w-60 flex-1 items-center gap-2">
          <RadioGroupItem value={DOMICILIO_OTRO} id="dom-otro" aria-invalid={invalid || undefined} />
          <Label htmlFor="dom-otro" className="font-normal">
            Otro:
          </Label>
          <Input
            ref={otroRef}
            value={otro}
            onChange={(e) => setOtro(e.target.value)}
            onFocus={() => setOpcion(DOMICILIO_OTRO)}
            maxLength={200}
            placeholder="Escribí la dirección"
            aria-label="Otro domicilio"
            className="h-8 flex-1"
          />
        </div>
      </RadioGroup>
    </>
  );
}
