import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envío de emails por SMTP. Se activa solo si SMTP_HOST está definido en el .env;
 * sin eso, las notificaciones se ven igual en la campanita de la app.
 */
export const emailConfigurado = () => !!process.env.SMTP_HOST;

let transporte: Transporter | null = null;
function getTransporte() {
  transporte ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporte;
}

export async function enviarEmail(m: { para: string; asunto: string; texto: string; url?: string }) {
  if (!emailConfigurado()) return;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1b2027">
  <p style="margin:0 0 12px">${escapar(m.texto).replace(/\n/g, "<br>")}</p>
  ${m.url ? `<p><a href="${escapar(m.url)}" style="display:inline-block;background:#1b7a72;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Ver en la app</a></p>` : ""}
  <p style="margin-top:24px;font-size:12px;color:#5f6874">Pedidos Sistemas · Grupo Cober</p>
</div>`;
  await getTransporte().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: m.para,
    subject: m.asunto,
    text: m.url ? `${m.texto}\n\n${m.url}` : m.texto,
    html,
  });
}

function escapar(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
