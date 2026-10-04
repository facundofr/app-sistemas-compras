import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const space = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-space" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });

export const metadata: Metadata = {
  title: { default: "Pedidos Sistemas", template: "%s · Pedidos Sistemas" },
  description: "Pedidos de compra del equipo de Sistemas — Grupo Cober",
  // «Agregar a pantalla de inicio» en iPhone: abre a pantalla completa, como una app.
  appleWebApp: { capable: true, title: "Pedidos", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Llega hasta los bordes en celulares con notch; el menú inferior y el encabezado respetan las zonas seguras.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0f141a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn("h-full antialiased", inter.variable, space.variable, plex.variable)}
    >
      <body className="min-h-full">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          {/* En el celular, por encima del menú inferior. */}
          <Toaster
            position="bottom-right"
            richColors
            closeButton
            mobileOffset={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
