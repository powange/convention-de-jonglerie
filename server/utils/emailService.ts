// Service d'envoi d'emails avec support simulation/réel
import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const config = useRuntimeConfig();
  const isEmailEnabled = config.emailEnabled === 'true';
  
  try {
    if (!isEmailEnabled) {
      // Mode simulation
      console.log('📧 EMAIL SIMULÉ (SEND_EMAILS=false):', {
        to: options.to,
        subject: options.subject,
        text: options.text
      });
      console.log('🔑 CODE DANS LE CONTENU:', options.html.match(/class="code">(\d{6})</)[1]);
      return true;
    }
    
    // Mode envoi réel
    if (!config.smtpUser || !config.smtpPass) {
      console.error('❌ Variables SMTP manquantes (SMTP_USER, SMTP_PASS)');
      return false;
    }
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      }
    });

    const mailOptions = {
      from: `"Conventions de Jonglerie" <${config.smtpUser}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email envoyé à ${options.to}`);
    return true;
    
  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    return false;
  }
}

export function generateVerificationCode(): string {
  // Générer un code à 6 chiffres
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateVerificationEmailHtml(code: string, prenom: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vérification de votre compte</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .code { background: #1f2937; color: #fbbf24; padding: 15px; font-size: 28px; font-weight: bold; text-align: center; border-radius: 8px; letter-spacing: 3px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🤹 Vérification de votre compte</h1>
            </div>
            <div class="content">
                <p>Bonjour ${prenom},</p>
                
                <p>Bienvenue dans la communauté des conventions de jonglerie ! 🎪</p>
                
                <p>Pour finaliser votre inscription, veuillez utiliser le code de vérification ci-dessous :</p>
                
                <div class="code">${code}</div>
                
                <p><strong>Ce code est valide pendant 15 minutes.</strong></p>
                
                <p>Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.</p>
                
                <p>À bientôt sur la plateforme !<br>
                L'équipe des Conventions de Jonglerie</p>
            </div>
            <div class="footer">
                <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
        </div>
    </body>
    </html>
  `;
}