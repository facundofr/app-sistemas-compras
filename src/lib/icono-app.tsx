import { ImageResponse } from "next/og";

/**
 * Ícono de la app instalada (pantalla de inicio): fondo tinta con el punto dorado de la marca.
 * Lo dibuja todo dentro del 80% central para que sirva también como ícono «maskable» de Android.
 */
export function iconoApp(tamano: number) {
  const punto = Math.round(tamano * 0.3);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#12181f",
        }}
      >
        <div
          style={{
            width: punto,
            height: punto,
            borderRadius: punto,
            background: "#c98a2c",
            boxShadow: `0 0 0 ${Math.round(tamano * 0.07)}px rgba(201,138,44,0.28)`,
          }}
        />
      </div>
    ),
    { width: tamano, height: tamano },
  );
}
