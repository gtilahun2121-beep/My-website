/**
 * Email Configuration
 * 
 * Configures email service provider (SendGrid, Mailgun, etc.)
 * and email templates for QalNet notifications
 */

export interface EmailConfig {
  provider: 'sendgrid' | 'mailgun' | 'smtp' | 'console';
  from: string;
  fromName: string;
  apiKey?: string;
  apiSecret?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
}

export function getEmailConfig(): EmailConfig {
  const provider = (process.env.EMAIL_PROVIDER || 'console') as EmailConfig['provider'];

  return {
    provider,
    from: process.env.EMAIL_FROM || 'noreply@qalnet.app',
    fromName: process.env.EMAIL_FROM_NAME || 'QalNet',
    apiKey: process.env.EMAIL_API_KEY,
    apiSecret: process.env.EMAIL_API_SECRET,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
  };
}

/**
 * Email template types
 */
export enum EmailTemplate {
  MEMBER_INVITATION = 'member_invitation',
  INVITATION_ACCEPTED = 'invitation_accepted',
  INVITATION_REJECTED = 'invitation_rejected',
  MEMBER_REMOVED = 'member_removed',
  MEMBER_LEFT = 'member_left',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  DRAW_RESULT = 'draw_result',
  PAYOUT_PROCESSED = 'payout_processed',
  KYC_VERIFIED = 'kyc_verified',
  KYC_REJECTED = 'kyc_rejected',
  WELCOME = 'welcome',
  PASSWORD_RESET = 'password_reset',
}

/**
 * Email template definitions with subjects
 */
export const EMAIL_TEMPLATES = {
  [EmailTemplate.MEMBER_INVITATION]: {
    subject: 'You\'ve been invited to join an Equb on QalNet',
    templateId: 'member-invitation',
  },
  [EmailTemplate.INVITATION_ACCEPTED]: {
    subject: 'Member accepted your Equb invitation',
    templateId: 'invitation-accepted',
  },
  [EmailTemplate.INVITATION_REJECTED]: {
    subject: 'Member declined your Equb invitation',
    templateId: 'invitation-rejected',
  },
  [EmailTemplate.MEMBER_REMOVED]: {
    subject: 'You have been removed from an Equb',
    templateId: 'member-removed',
  },
  [EmailTemplate.MEMBER_LEFT]: {
    subject: 'Member left your Equb',
    templateId: 'member-left',
  },
  [EmailTemplate.PAYMENT_RECEIVED]: {
    subject: 'Payment received for your Equb',
    templateId: 'payment-received',
  },
  [EmailTemplate.PAYMENT_FAILED]: {
    subject: 'Payment failed - Action required',
    templateId: 'payment-failed',
  },
  [EmailTemplate.DRAW_RESULT]: {
    subject: 'Equb lottery draw result',
    templateId: 'draw-result',
  },
  [EmailTemplate.PAYOUT_PROCESSED]: {
    subject: 'Your Equb payout has been processed',
    templateId: 'payout-processed',
  },
  [EmailTemplate.KYC_VERIFIED]: {
    subject: 'Your identity has been verified',
    templateId: 'kyc-verified',
  },
  [EmailTemplate.KYC_REJECTED]: {
    subject: 'KYC verification rejected',
    templateId: 'kyc-rejected',
  },
  [EmailTemplate.WELCOME]: {
    subject: 'Welcome to QalNet',
    templateId: 'welcome',
  },
  [EmailTemplate.PASSWORD_RESET]: {
    subject: 'Reset your QalNet password',
    templateId: 'password-reset',
  },
};
