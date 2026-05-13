import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function send2FACodeEmail(to, code) {
  try {
    const info = await transporter.sendMail({
      from: `Auth App<carelliarthur@gmail.com>`,
      to,
      subject: "Seu código de verificação",
      text: `Seu código de verificação é: ${code}`,
    });

    console.log("Email enviado:", info.messageId);
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    throw error;
  }
}