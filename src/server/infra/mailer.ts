import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type { MailConfig } from "@/server/config";

// Gmail en SMTP, TLS dès la connexion (port 465). Mot de passe d'application, jamais celui du compte.
const globalForMailer = globalThis as unknown as { mailer?: { user: string; transporter: Transporter } };

function getTransporter(config: MailConfig) {
  if (globalForMailer.mailer?.user !== config.user) {
    globalForMailer.mailer = {
      user: config.user,
      transporter: nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: config.user, pass: config.password },
        // Une requête HTTP ne reste pas bloquée sur un serveur SMTP qui ne répond pas.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      }),
    };
  }
  return globalForMailer.mailer.transporter;
}

// Texte brut uniquement : aucun HTML construit avec des données utilisateur.
export async function sendTextMail(config: MailConfig, message: { to: string; subject: string; text: string }) {
  await getTransporter(config).sendMail({
    from: { name: "Brb", address: config.user },
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}
