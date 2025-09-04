import FormData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAIL_API_KEY || '',
});

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from = 'Alliance Customer Service <noreply@alliancechemical.com>',
}: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}) {
  try {
    const recipients = Array.isArray(to) ? to : [to];
    
    const messageData = {
      from,
      to: recipients,
      subject,
      text: text || '',
      html: html || text || '',
    };

    const result = await mg.messages.create(
      process.env.MAILGUN_DOMAIN || 'alliancechemical.com',
      messageData
    );

    return { success: true, id: result.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}