/**
 * Email Service
 *
 * Sends templated emails for QalNet events:
 * - Member invitations
 * - Payment notifications
 * - Draw results
 * - KYC updates
 * - Account alerts
 */

import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider, EmailOptions, ConsoleEmailProvider, SendGridEmailProvider, MailgunEmailProvider, SMTPEmailProvider } from './email-provider';
import { getEmailConfig, EMAIL_TEMPLATES, EmailTemplate } from '../../../config/email.config';

@Injectable()
export class EmailService {
  private provider: EmailProvider;
  private logger = new Logger(EmailService.name);
  private config = getEmailConfig();

  constructor() {
    this.provider = this.initializeProvider();
  }

  private initializeProvider(): EmailProvider {
    switch (this.config.provider) {
      case 'sendgrid':
        if (!this.config.apiKey) {
          throw new Error('SendGrid API key not configured');
        }
        return new SendGridEmailProvider(this.config.apiKey);

      case 'mailgun':
        if (!this.config.apiKey || !process.env.MAILGUN_DOMAIN) {
          throw new Error('Mailgun credentials not configured');
        }
        return new MailgunEmailProvider(this.config.apiKey, process.env.MAILGUN_DOMAIN);

      case 'smtp':
        if (!this.config.smtpHost || !this.config.smtpUser || !this.config.smtpPass) {
          throw new Error('SMTP credentials not configured');
        }
        return new SMTPEmailProvider({
          host: this.config.smtpHost,
          port: this.config.smtpPort || 587,
          user: this.config.smtpUser,
          pass: this.config.smtpPass,
        });

      case 'console':
      default:
        return new ConsoleEmailProvider();
    }
  }

  /**
   * Send member invitation email
   */
  async sendMemberInvitation(
    recipientEmail: string,
    recipientName: string,
    equbName: string,
    personalMessage: string | undefined,
    hostId: string,
    equbId: string,
  ): Promise<boolean> {
    const htmlContent = this.renderMemberInvitationTemplate({
      recipientName,
      equbName,
      personalMessage,
      acceptUrl: `${process.env.APP_URL}/equbs/invitations/accept?id=${equbId}`,
      rejectUrl: `${process.env.APP_URL}/equbs/invitations/reject?id=${equbId}`,
    });

    return this.sendEmail({
      to: recipientEmail,
      subject: EMAIL_TEMPLATES[EmailTemplate.MEMBER_INVITATION].subject,
      htmlContent,
    });
  }

  /**
   * Send invitation accepted notification to host
   */
  async sendInvitationAccepted(
    hostId: string,
    memberEmail: string,
    equbId: string,
  ): Promise<boolean> {
    // Get host email from database
    // For now, we'll need to fetch it from the host service
    // This will be implemented in the actual integration
    const htmlContent = this.renderInvitationAcceptedTemplate({
      memberEmail,
    });

    return this.sendEmail({
      to: '', // Will be populated from host's email
      subject: EMAIL_TEMPLATES[EmailTemplate.INVITATION_ACCEPTED].subject,
      htmlContent,
    });
  }

  /**
   * Send invitation rejected notification to host
   */
  async sendInvitationRejected(
    hostId: string,
    equbId: string,
    reason?: string,
  ): Promise<boolean> {
    const htmlContent = this.renderInvitationRejectedTemplate({
      reason,
    });

    return this.sendEmail({
      to: '', // Will be populated from host's email
      subject: EMAIL_TEMPLATES[EmailTemplate.INVITATION_REJECTED].subject,
      htmlContent,
    });
  }

  /**
   * Send member removed notification
   */
  async sendMemberRemoved(
    memberId: string,
    equbId: string,
    reason: string,
    refundIssued: boolean,
  ): Promise<boolean> {
    const htmlContent = this.renderMemberRemovedTemplate({
      reason,
      refundIssued,
    });

    return this.sendEmail({
      to: '', // Will be populated from member's email
      subject: EMAIL_TEMPLATES[EmailTemplate.MEMBER_REMOVED].subject,
      htmlContent,
    });
  }

  /**
   * Send member left notification to host
   */
  async sendMemberLeft(
    hostId: string,
    memberId: string,
    equbId: string,
    reason?: string,
  ): Promise<boolean> {
    const htmlContent = this.renderMemberLeftTemplate({
      reason,
    });

    return this.sendEmail({
      to: '', // Will be populated from host's email
      subject: EMAIL_TEMPLATES[EmailTemplate.MEMBER_LEFT].subject,
      htmlContent,
    });
  }

  /**
   * Send payment received confirmation
   */
  async sendPaymentReceived(
    memberId: string,
    amount: number,
    equbName: string,
  ): Promise<boolean> {
    const htmlContent = this.renderPaymentReceivedTemplate({
      amount,
      equbName,
    });

    return this.sendEmail({
      to: '', // Will be populated from member's email
      subject: EMAIL_TEMPLATES[EmailTemplate.PAYMENT_RECEIVED].subject,
      htmlContent,
    });
  }

  /**
   * Send payment failed alert
   */
  async sendPaymentFailed(
    memberId: string,
    amount: number,
    equbName: string,
    reason: string,
  ): Promise<boolean> {
    const htmlContent = this.renderPaymentFailedTemplate({
      amount,
      equbName,
      reason,
    });

    return this.sendEmail({
      to: '', // Will be populated from member's email
      subject: EMAIL_TEMPLATES[EmailTemplate.PAYMENT_FAILED].subject,
      htmlContent,
    });
  }

  /**
   * Send draw result notification
   */
  async sendDrawResult(
    memberId: string,
    equbName: string,
    winnerName: string,
    amount: number,
    isWinner: boolean,
  ): Promise<boolean> {
    const htmlContent = isWinner
      ? this.renderDrawWinnerTemplate({ equbName, amount })
      : this.renderDrawNotWinnerTemplate({ equbName, winnerName });

    return this.sendEmail({
      to: '', // Will be populated from member's email
      subject: EMAIL_TEMPLATES[EmailTemplate.DRAW_RESULT].subject,
      htmlContent,
    });
  }

  /**
   * Send payout processed notification
   */
  async sendPayoutProcessed(
    memberId: string,
    amount: number,
    equbName: string,
    payoutMethod: string,
  ): Promise<boolean> {
    const htmlContent = this.renderPayoutProcessedTemplate({
      amount,
      equbName,
      payoutMethod,
    });

    return this.sendEmail({
      to: '', // Will be populated from member's email
      subject: EMAIL_TEMPLATES[EmailTemplate.PAYOUT_PROCESSED].subject,
      htmlContent,
    });
  }

  /**
   * Send KYC verified notification
   */
  async sendKycVerified(memberId: string): Promise<boolean> {
    const htmlContent = this.renderKycVerifiedTemplate();

    return this.sendEmail({
      to: '', // Will be populated from member's email
      subject: EMAIL_TEMPLATES[EmailTemplate.KYC_VERIFIED].subject,
      htmlContent,
    });
  }

  /**
   * Send KYC rejected notification
   */
  async sendKycRejected(
    memberId: string,
    reason: string,
  ): Promise<boolean> {
    const htmlContent = this.renderKycRejectedTemplate({ reason });

    return this.sendEmail({
      to: '', // Will be populated from member's email
      subject: EMAIL_TEMPLATES[EmailTemplate.KYC_REJECTED].subject,
      htmlContent,
    });
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcome(
    email: string,
    firstName: string,
  ): Promise<boolean> {
    const htmlContent = this.renderWelcomeTemplate({ firstName });

    return this.sendEmail({
      to: email,
      subject: EMAIL_TEMPLATES[EmailTemplate.WELCOME].subject,
      htmlContent,
    });
  }

  /**
   * Internal method to send email via provider
   */
  private async sendEmail(options: Partial<EmailOptions>): Promise<boolean> {
    try {
      if (!options.to || options.to.trim() === '') {
        this.logger.warn('Skipping email - no recipient');
        return false;
      }

      const result = await this.provider.send({
        to: options.to,
        subject: options.subject || 'QalNet Notification',
        htmlContent: options.htmlContent || '',
      });

      if (result.success) {
        this.logger.log(`Email sent to ${options.to} (ID: ${result.messageId})`);
      } else {
        this.logger.error(`Failed to send email: ${result.error}`);
      }

      return result.success;
    } catch (error) {
      this.logger.error('Email service error:', error);
      return false;
    }
  }

  // =========================================================================
  // TEMPLATE RENDERERS
  // =========================================================================

  private renderMemberInvitationTemplate(data: {
    recipientName: string;
    equbName: string;
    personalMessage?: string;
    acceptUrl: string;
    rejectUrl: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0066ff 0%, #0052cc 100%); color: white; padding: 20px; text-align: center; border-radius: 5px; }
            .content { padding: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; margin: 10px 5px; border-radius: 5px; text-decoration: none; font-weight: bold; }
            .accept { background: #28a745; color: white; }
            .reject { background: #6c757d; color: white; }
            .footer { text-align: center; color: #999; font-size: 12px; padding-top: 20px; border-top: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You're Invited!</h1>
            </div>
            <div class="content">
              <p>Hello ${data.recipientName},</p>
              <p>You've been invited to join <strong>${data.equbName}</strong> on QalNet!</p>
              ${data.personalMessage ? `<p><em>"${data.personalMessage}"</em></p>` : ''}
              <p>Click the buttons below to accept or decline the invitation:</p>
              <div style="text-align: center;">
                <a href="${data.acceptUrl}" class="button accept">Accept Invitation</a>
                <a href="${data.rejectUrl}" class="button reject">Decline Invitation</a>
              </div>
            </div>
            <div class="footer">
              <p>© 2026 QalNet. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private renderInvitationAcceptedTemplate(data: {
    memberEmail: string;
  }): string {
    return `
      <p>Good news! <strong>${data.memberEmail}</strong> has accepted your Equb invitation.</p>
    `;
  }

  private renderInvitationRejectedTemplate(data: {
    reason?: string;
  }): string {
    return `
      <p>Unfortunately, the member has declined your invitation.</p>
      ${data.reason ? `<p>Reason: ${data.reason}</p>` : ''}
    `;
  }

  private renderMemberRemovedTemplate(data: {
    reason: string;
    refundIssued: boolean;
  }): string {
    return `
      <p>You have been removed from an Equb.</p>
      <p>Reason: ${data.reason}</p>
      ${data.refundIssued ? '<p>Your contribution has been refunded.</p>' : ''}
    `;
  }

  private renderMemberLeftTemplate(data: {
    reason?: string;
  }): string {
    return `
      <p>A member has left your Equb.</p>
      ${data.reason ? `<p>Reason: ${data.reason}</p>` : ''}
    `;
  }

  private renderPaymentReceivedTemplate(data: {
    amount: number;
    equbName: string;
  }): string {
    return `
      <p>Your payment of <strong>ETB ${data.amount}</strong> for <strong>${data.equbName}</strong> has been received.</p>
    `;
  }

  private renderPaymentFailedTemplate(data: {
    amount: number;
    equbName: string;
    reason: string;
  }): string {
    return `
      <p>Payment of <strong>ETB ${data.amount}</strong> for <strong>${data.equbName}</strong> failed.</p>
      <p>Reason: ${data.reason}</p>
      <p>Please retry your payment.</p>
    `;
  }

  private renderDrawWinnerTemplate(data: {
    equbName: string;
    amount: number;
  }): string {
    return `
      <p>Congratulations! You won the draw for <strong>${data.equbName}</strong>!</p>
      <p>You will receive <strong>ETB ${data.amount}</strong> within 24 hours.</p>
    `;
  }

  private renderDrawNotWinnerTemplate(data: {
    equbName: string;
    winnerName: string;
  }): string {
    return `
      <p>The draw for <strong>${data.equbName}</strong> has been completed.</p>
      <p>Winner: ${data.winnerName}</p>
      <p>Better luck next round!</p>
    `;
  }

  private renderPayoutProcessedTemplate(data: {
    amount: number;
    equbName: string;
    payoutMethod: string;
  }): string {
    return `
      <p>Your payout of <strong>ETB ${data.amount}</strong> for <strong>${data.equbName}</strong> has been processed.</p>
      <p>Payment method: ${data.payoutMethod}</p>
    `;
  }

  private renderKycVerifiedTemplate(): string {
    return `<p>Your identity has been successfully verified on QalNet. You can now participate in all equbs.</p>`;
  }

  private renderKycRejectedTemplate(data: {
    reason: string;
  }): string {
    return `
      <p>Unfortunately, your KYC verification was not approved.</p>
      <p>Reason: ${data.reason}</p>
      <p>Please contact support for more information.</p>
    `;
  }

  private renderWelcomeTemplate(data: {
    firstName: string;
  }): string {
    return `
      <p>Welcome to QalNet, ${data.firstName}!</p>
      <p>We're excited to help you save with your community through Equbs.</p>
      <p>Get started today and join your first Equb!</p>
    `;
  }
}
