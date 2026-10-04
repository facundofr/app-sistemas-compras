"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraOffIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { rutaEquipo } from "@/lib/equipos";
import { destinoDesdeTexto, rutaRecibir } from "@/lib/qr-texto";

// BarcodeDetector todavía no está en los tipos de TypeScript.
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = {
  new (o: { formats: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

/** Lector nativo (Chrome en Android) o, si no hay, jsQR sobre un canvas (Safari en iPhone). */
async function crearLector(): Promise<(video: HTMLVideoElement) => Promise<string | null>> {
  const Nativo = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (Nativo && (await Nativo.getSupportedFormats?.())?.includes("qr_code")) {
    const det = new Nativo({ formats: ["qr_code"] });
    return async (video) => (await det.detect(video))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return async (video) => {
    // Achicar el cuadro acelera mucho la lectura y un QR impreso se sigue leyendo bien.
    const escala = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * escala);
    canvas.height = Math.round(video.videoHeight * escala);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

function mensajeError(e: unknown) {
  const nombre = e instanceof DOMException ? e.name : "";
  if (nombre === "NotAllowedError")
    return "No hay permiso para usar la cámara. Habilitalo en la configuración del navegador para este sitio.";
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") return "No se encontró una cámara en este dispositivo.";
  if (nombre === "NotReadableError") return "La cámara está en uso por otra aplicación.";
  return "No se pudo abrir la cámara.";
}

export function EscanerQr({ seguidoInicial = false }: { seguidoInicial?: boolean }) {
  const router = useRouter();
  // Modo «recibir varios»: después de cada confirmación se vuelve solo al lector.
  const [seguido, setSeguido] = useState(seguidoInicial);
  const seguidoRef = useRef(seguido);
  useEffect(() => {
    seguidoRef.current = seguido;
  }, [seguido]);
  // Etiqueta de pedido → confirmar la entrega; de equipo → su ficha del inventario.
  const destino = (d: { tipo: "pedido" | "equipo"; id: number }) =>
    d.tipo === "equipo" ? rutaEquipo(d.id) : rutaRecibir(d.id) + (seguidoRef.current ? "?seguido=1" : "");
  const video = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<"iniciando" | "leyendo" | "abriendo" | "error">("iniciando");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [manual, setManual] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let activo = true;
    let ultimoInvalido = "";

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          window.isSecureContext
            ? "Este navegador no permite usar la cámara."
            : "La cámara solo funciona entrando a la app por https://.",
        );
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const v = video.current;
      if (!activo || !v) return;
      v.srcObject = stream;
      await v.play();
      const leer = await crearLector();
      setEstado("leyendo");

      while (activo) {
        if (v.readyState >= v.HAVE_ENOUGH_DATA) {
          const texto = await leer(v).catch(() => null);
          if (texto && activo) {
            const id = destinoDesdeTexto(texto);
            if (id) {
              activo = false;
              navigator.vibrate?.(60);
              setEstado("abriendo");
              router.push(destino(id));
              return;
            }
            if (texto !== ultimoInvalido) {
              ultimoInvalido = texto;
              setAviso("Ese código no es una etiqueta de pedido ni de equipo.");
            }
          }
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    iniciar().catch((e) => {
      if (!activo) return;
      setError(e instanceof DOMException ? mensajeError(e) : e instanceof Error ? e.message : mensajeError(e));
      setEstado("error");
    });

    return () => {
      activo = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  const idManual = destinoDesdeTexto(manual);

  return (
    <div className="space-y-5">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-[#0b0f14]">
        <video ref={video} muted playsInline className="size-full object-cover" />

        {estado === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-[13px] text-white/85">
            <CameraOffIcon className="size-9 opacity-70" />
            {error}
          </div>
        ) : (
          <>
            {/* Marco de enfoque */}
            <div aria-hidden className="pointer-events-none absolute inset-[14%] rounded-2xl shadow-[0_0_0_100vmax_rgb(0_0_0/0.45)]">
              {["top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
                <span key={c} className={`absolute size-10 border-gold ${c}`} />
              ))}
            </div>
            {estado !== "leyendo" && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white">
                <Loader2Icon className="size-5 animate-spin" />
                {estado === "abriendo" ? "Abriendo pedido..." : "Abriendo la cámara..."}
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-center text-[13px] text-muted-foreground" aria-live="polite">
        {aviso || "Apuntá a la etiqueta del paquete. Se abre sola al leerla."}
      </p>

      <label className="mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <span>
          <span className="block text-[13.5px] font-semibold">Recibir varios seguidos</span>
          <span className="block text-[12px] text-muted-foreground">Al confirmar cada uno, vuelve solo al lector.</span>
        </span>
        <Switch checked={seguido} onCheckedChange={setSeguido} />
      </label>

      <form
        className="mx-auto flex max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (idManual) router.push(destino(idManual));
        }}
      >
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="O escribí el código: PED-00042 o EQ-00007"
          inputMode="text"
          autoCapitalize="characters"
          aria-label="Código de la etiqueta"
        />
        <Button type="submit" variant="outline" disabled={!idManual}>
          <SearchIcon /> Ir
        </Button>
      </form>
    </div>
  );
}
