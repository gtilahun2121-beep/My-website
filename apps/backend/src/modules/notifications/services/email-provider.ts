/**
 * Email Provider Interface
 * 
 * Abstract email sending across different providers
 * (SendGrid, Mailgun, SMTP, Console for development)
 */

export interface EmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType: string;
  }>;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export abstract class EmailProvider {
  abstract send(options: EmailOptions): Promise<SendResult>;
  abstract sendBulk(recipients: EmailOptions[]): Promise<SendResult[]>;
}

/**
 * Console Email Provider - for development/testing
 * Logs emails to console instead of actually sending
 */
export class ConsoleEmailProvider extends EmailProvider {
  async send(options: EmailOptions): Promise<SendResult> {
    console.log('📧 EMAIL SENT (CONSOLE MODE)');
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    console.log('---');
    console.log(options.htmlContent);
    console.log('---\n');
    return { success: true, messageId: `console-${Date.now()}` };
  }

  async sendBulk(recipients: EmailOptions[]): Promise<SendResult[]> {
    return Promise.all(recipients.map((r) => this.send(r)));
  }
}

/**
 * SendGrid Email Provider
 */
export class SendGridEmailProvider extends EmailProvider {
  private sgMail: any;

  constructor(apiKey: string) {
    super();
    // Dynamically import SendGrid to avoid dependency if not needed
    try {
      this.sgMail = require('@sendgrid/mail').default;
      this.sgMail.setApiKey(apiKey);
    } catch (error) {
      console.error('SendGrid not installed. Run: npm install @sendgrid/mail');
      throw error;
    }
  }

  async send(options: EmailOptions): Promise<SendResult> {
    try {
      const msg = {
        to: options.to,
        from: process.env.EMAIL_FROM || 'noreply@qalnet.app',
        subject: options.subject,
        html: options.htmlContent,
        text: options.textContent,
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
      };

      const response = await this.sgMail.send(msg);
      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
      };
    } catch (error: any) {
      console.error('SendGrid error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendBulk(recipients: EmailOptions[]): Promise<SendResult[]> {
    try {
      const messages = recipients.map((r) => ({
        to: r.to,
        from: process.env.EMAIL_FROM || 'noreply@qalnet.app',
        subject: r.subject,
        html: r.htmlContent,
        text: r.textContent,
        replyTo: r.replyTo,
      }));

      const response = await this.sgMail.send(messages);
      return response.map((res: any) => ({
        success: true,
        messageId: res.headers['x-message-id'],
      }));
    } catch (error: any) {
      console.error('SendGrid bulk send error:', error);
      return recipients.map(() => ({
        success: false,
        error: error.message,
      }));
    }
  }
}

/**
 * Mailgun Email Provider
 */
export class MailgunEmailProvider extends EmailProvider {
  private mailgun: any;
  private domain: string;

  constructor(apiKey: string, domain: string) {
    super();
    try {
      this.mailgun = require('mailgun.js');
      this.domain = domain;
    } catch (error) {
      console.error('Mailgun not installed. Run: npm install mailgun.js');
      throw error;
    }
  }

  async send(options: EmailOptions): Promise<SendResult> {
    try {
      const client = this.mailgun.client({ key: process.env.EMAIL_API_KEY });
      const mg = client.domains.domain(this.domain).messages;

      const response = await mg.create({
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
        to: options.to,
        subject: options.subject,
        html: options.htmlContent,
        text: options.textContent,
        'h:Reply-To': options.replyTo,
        cc: options.cc?.join(','),
        bcc: options.bcc?.join(','),
      });

      return {
        success: true,
        messageId: response.id,
      };
    } catch (error: any) {
      console.error('Mailgun error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendBulk(recipients: EmailOptions[]): Promise<SendResult[]> {
    return Promise.all(recipients.map((r) => this.send(r)));
  }
}

/**
 * SMTP Email Provider (using Nodemailer)
 */
export class SMTPEmailProvider extends EmailProvider {
  private transporter: any;

  constructor(config: {
    host: string;
    port: number;
    user: string;
    pass: string;
  }) {
    super();
    try {
      const nodemailer = require('nodemailer');
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
    } catch (error) {
      console.error('Nodemailer not installed. Run: npm install nodemailer');
      throw error;
    }
  }

  async send(options: EmailOptions): Promise<SendResult> {
    try {
      const response = await this.transporter.sendMail({
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
        to: options.to,
        subject: options.subject,
        html: options.htmlContent,
        text: options.textContent,
        replyTo: options.replyTo,
        cc: options.cc?.join(','),
        bcc: options.bcc?.join(','),
        attachments: options.attachments,
      });

      return {
        success: true,
        messageId: response.messageId,
      };
    } catch (error: any) {
      console.error('SMTP error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendBulk(recipients: EmailOptions[]): Promise<SendResult[]> {
    return Promise.all(recipients.map((r) => this.send(r)));
  }
}
