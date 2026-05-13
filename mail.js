import { BrevoClient } from "@getbrevo/brevo";

const client = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
});

export async function send2FACodeEmail(to, code) {
  try {
    const result = await client.transactionalEmails.sendTransacEmail({
      sender: {
        email: "carelliarthur@gmail.com",
        name: "Auth App",
      },

      to: [
        {
          email: to,
        },
      ],

      subject: "Seu código de verificação",

      textContent: `Seu código de verificação é: ${code}`,
    });

    console.log("Email enviado:", result);
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    throw error;
  }
}