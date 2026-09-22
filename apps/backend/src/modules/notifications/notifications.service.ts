import { Injectable } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { EmailService } from './services/email.service';

@Injectable()
export class NotificationsService {
    constructor(
        private readonly repo: NotificationsRepository,
        private readonly emailService: EmailService,
    ) {}

    async findByUserId(userId: string) {
        return this.repo.findByUserId(userId);
    }

    async markAsRead(id: string, userId: string) {
        return this.repo.markAsRead(id, userId);
    }

    async delete(id: string, userId: string) {
        return this.repo.deleteById(id, userId);
    }

    async cleanupExpiredUnread() {
        return this.repo.deleteExpiredUnreadForNonAdmins();
    }

    // =========================================================================
    // EMAIL NOTIFICATIONS - Member Management
    // =========================================================================

    async sendMemberInvitation(
        recipientEmail: string,
        recipientName: string,
        equbName: string,
        personalMessage: string | undefined,
        hostId: string,
        equbId: string,
    ) {
        return this.emailService.sendMemberInvitation(
            recipientEmail,
            recipientName,
            equbName,
            personalMessage,
            hostId,
            equbId,
        );
    }

    async sendInvitationAccepted(
        hostId: string,
        memberEmail: string,
        equbId: string,
    ) {
        return this.emailService.sendInvitationAccepted(hostId, memberEmail, equbId);
    }

    async sendInvitationRejected(
        hostId: string,
        equbId: string,
        reason?: string,
    ) {
        return this.emailService.sendInvitationRejected(hostId, equbId, reason);
    }

    async sendMemberRemoved(
        memberId: string,
        equbId: string,
        reason: string,
        refundIssued: boolean,
    ) {
        return this.emailService.sendMemberRemoved(memberId, equbId, reason, refundIssued);
    }

    async sendMemberLeft(
        hostId: string,
        memberId: string,
        equbId: string,
        reason?: string,
    ) {
        return this.emailService.sendMemberLeft(hostId, memberId, equbId, reason);
    }

    // =========================================================================
    // EMAIL NOTIFICATIONS - Payments
    // =========================================================================

    async sendPaymentReceived(
        memberId: string,
        amount: number,
        equbName: string,
    ) {
        return this.emailService.sendPaymentReceived(memberId, amount, equbName);
    }

    async sendPaymentFailed(
        memberId: string,
        amount: number,
        equbName: string,
        reason: string,
    ) {
        return this.emailService.sendPaymentFailed(memberId, amount, equbName, reason);
    }

    // =========================================================================
    // EMAIL NOTIFICATIONS - Draws & Payouts
    // =========================================================================

    async sendDrawResult(
        memberId: string,
        equbName: string,
        winnerName: string,
        amount: number,
        isWinner: boolean,
    ) {
        return this.emailService.sendDrawResult(
            memberId,
            equbName,
            winnerName,
            amount,
            isWinner,
        );
    }

    async sendPayoutProcessed(
        memberId: string,
        amount: number,
        equbName: string,
        payoutMethod: string,
    ) {
        return this.emailService.sendPayoutProcessed(
            memberId,
            amount,
            equbName,
            payoutMethod,
        );
    }

    // =========================================================================
    // EMAIL NOTIFICATIONS - KYC & Account
    // =========================================================================

    async sendKycVerified(memberId: string) {
        return this.emailService.sendKycVerified(memberId);
    }

    async sendKycRejected(memberId: string, reason: string) {
        return this.emailService.sendKycRejected(memberId, reason);
    }

    async sendWelcome(email: string, firstName: string) {
        return this.emailService.sendWelcome(email, firstName);
    }
}
