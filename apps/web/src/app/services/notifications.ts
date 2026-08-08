// ========================================================================
// NOTIFICATION & MESSAGING SERVICE
// ========================================================================

import type { Notification, AlertCategory, NotificationChannel } from '../data';

// ========================================================================
// NOTIFICATION CATEGORIZATION
// ========================================================================

export const NOTIFICATION_RULES = {
  OPERATIONAL_ALERTS: {
    category: 'operational' as AlertCategory,
    examples: [
      'payment_deadline_24h',
      'payment_deadline_6h',
      'auto_debit_30m',
      'payment_successful',
      'payout_received',
      'system_maintenance',
    ],
  },

  SOCIAL_TRUST_ALERTS: {
    category: 'social_trust' as AlertCategory,
    examples: [
      'peer_guarantor_request',
      'approval_status_update',
      'trust_score_levelup',
      'member_joined_pool',
      'member_left_pool',
    ],
  },

  SYSTEM_POLICY_ALERTS: {
    category: 'system_policy' as AlertCategory,
    examples: [
      'terms_of_service_update',
      'privacy_policy_update',
      'feature_release',
      'scheduled_maintenance',
      'security_alert',
    ],
  },
};

// ========================================================================
// NOTIFICATION TEMPLATE ENGINE
// ========================================================================

interface NotificationTemplate {
  titleKey: string;
  bodyKey: string;
  channels: NotificationChannel[];
  priority: 'high' | 'medium' | 'low';
  delayMs?: number;
}

export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  // Operational Alerts
  payment_deadline_24h: {
    titleKey: 'notification.payment_due_soon',
    bodyKey: 'notification.payment_due_in_24h',
    channels: ['telegram', 'push', 'sms'],
    priority: 'high',
  },

  payment_deadline_6h: {
    titleKey: 'notification.urgent_payment',
    bodyKey: 'notification.payment_due_in_6h',
    channels: ['telegram', 'push', 'sms'],
    priority: 'high',
    delayMs: 0,
  },

  auto_debit_30m: {
    titleKey: 'notification.auto_debit_soon',
    bodyKey: 'notification.auto_debit_in_30m',
    channels: ['telegram', 'push'],
    priority: 'high',
    delayMs: 0,
  },

  payment_successful: {
    titleKey: 'notification.payment_confirmed',
    bodyKey: 'notification.payment_processed',
    channels: ['telegram', 'push', 'in_app'],
    priority: 'medium',
  },

  payout_received: {
    titleKey: 'notification.payout_ready',
    bodyKey: 'notification.your_payout_available',
    channels: ['telegram', 'push', 'sms'],
    priority: 'high',
  },

  // Social & Trust Alerts
  peer_guarantor_request: {
    titleKey: 'notification.guarantor_request',
    bodyKey: 'notification.peer_needs_guarantee',
    channels: ['telegram', 'push', 'in_app'],
    priority: 'high',
  },

  trust_score_levelup: {
    titleKey: 'notification.trust_improved',
    bodyKey: 'notification.new_tier_unlocked',
    channels: ['telegram', 'push', 'in_app'],
    priority: 'medium',
  },

  // System & Policy Alerts
  terms_of_service_update: {
    titleKey: 'notification.tos_updated',
    bodyKey: 'notification.review_new_terms',
    channels: ['in_app', 'push'],
    priority: 'medium',
  },

  security_alert: {
    titleKey: 'notification.security_alert',
    bodyKey: 'notification.unusual_activity',
    channels: ['telegram', 'push', 'sms'],
    priority: 'high',
  },
};

// ========================================================================
// NOTIFICATION SERVICE
// ========================================================================

export class NotificationManager {
  private notifications: Notification[] = [];
  private listeners: Array<(notification: Notification) => void> = [];
  private sseConnection: EventSource | null = null;

  constructor() {
    this.initializeSSE();
  }

  private initializeSSE(): void {
    try {
      const token = localStorage.getItem('qalnet_access_token');
      if (!token) return;

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      this.sseConnection = new EventSource(
        `${API_BASE_URL}/notifications/stream?token=${token}`
      );

      this.sseConnection.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data) as Notification;
          this.handleNotification(notification);
        } catch (error) {
          console.error('Failed to parse SSE notification:', error);
        }
      };

      this.sseConnection.onerror = (error) => {
        console.error('SSE connection error:', error);
        this.sseConnection?.close();
      };
    } catch (error) {
      console.error('Failed to initialize SSE:', error);
    }
  }

  private handleNotification(notification: Notification): void {
    this.notifications.unshift(notification);
    this.notifyListeners(notification);
    this.triggerNotificationDelivery(notification);
  }

  private triggerNotificationDelivery(notification: Notification): void {
    if (notification.deliveredChannels.includes('push')) {
      this.sendPushNotification(notification);
    }

    if (notification.deliveredChannels.includes('telegram')) {
      // Handled by backend
      console.log('Telegram notification queued:', notification);
    }

    if (notification.deliveredChannels.includes('sms')) {
      // Handled by backend
      console.log('SMS notification queued:', notification);
    }

    if (notification.deliveredChannels.includes('in_app')) {
      this.showInAppNotification(notification);
    }
  }

  private async sendPushNotification(notification: Notification): Promise<void> {
    try {
      if (!('Notification' in window)) {
        console.warn('Notifications not supported');
        return;
      }

      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.body,
          icon: '/logo.png',
          badge: '/badge.png',
        });
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(notification.title, {
            body: notification.body,
          });
        }
      }
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  private showInAppNotification(notification: Notification): void {
    // This is typically handled by a toast or banner component
    console.log('In-app notification:', notification);
  }

  addListener(listener: (notification: Notification) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(notification: Notification): void {
    this.listeners.forEach((listener) => listener(notification));
  }

  getNotifications(): Notification[] {
    return [...this.notifications];
  }

  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.isRead).length;
  }

  markAsRead(notificationId: string): void {
    const notification = this.notifications.find((n) => n.id === notificationId);
    if (notification) {
      notification.isRead = true;
    }
  }

  getNotificationsByCategory(category: AlertCategory): Notification[] {
    return this.notifications.filter((n) => n.category === category);
  }

  clear(): void {
    this.notifications = [];
  }

  dispose(): void {
    if (this.sseConnection) {
      this.sseConnection.close();
      this.sseConnection = null;
    }
    this.listeners = [];
  }
}

// ========================================================================
// IN-APP NOTIFICATION TOASTS
// ========================================================================

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

export class ToastManager {
  private toasts: Toast[] = [];
  private listeners: Array<(toasts: Toast[]) => void> = [];

  showToast(toast: Omit<Toast, 'id'>): string {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = { ...toast, id };

    this.toasts.push(newToast);
    this.notifyListeners();

    if (toast.duration !== 0) {
      const duration = toast.duration || 5000;
      setTimeout(() => this.dismissToast(id), duration);
    }

    return id;
  }

  success(title: string, message?: string): string {
    return this.showToast({
      type: 'success',
      title,
      message,
      duration: 3000,
    });
  }

  error(title: string, message?: string): string {
    return this.showToast({
      type: 'error',
      title,
      message,
      duration: 5000,
    });
  }

  info(title: string, message?: string): string {
    return this.showToast({
      type: 'info',
      title,
      message,
      duration: 4000,
    });
  }

  warning(title: string, message?: string): string {
    return this.showToast({
      type: 'warning',
      title,
      message,
      duration: 4000,
    });
  }

  dismissToast(id: string): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notifyListeners();
  }

  dismissAll(): void {
    this.toasts = [];
    this.notifyListeners();
  }

  getToasts(): Toast[] {
    return [...this.toasts];
  }

  addListener(listener: (toasts: Toast[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.getToasts()));
  }
}

// ========================================================================
// TELEGRAM BOT INTEGRATION
// ========================================================================

export class TelegramBotService {
  private static readonly BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
  private static readonly API_BASE = 'https://api.telegram.org/bot';

  /**
   * Send a message via Telegram bot
   * Called from backend in production
   */
  static async sendMessage(
    chatId: number | string,
    text: string,
    options?: {
      parseMode?: 'HTML' | 'Markdown';
      replyMarkup?: any;
    }
  ): Promise<any> {
    if (!this.BOT_TOKEN) {
      console.warn('Telegram bot token not configured');
      return;
    }

    try {
      const response = await fetch(`${this.API_BASE}${this.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options?.parseMode || 'HTML',
          reply_markup: options?.replyMarkup,
        }),
      });

      return response.json();
    } catch (error) {
      console.error('Failed to send Telegram message:', error);
    }
  }

  /**
   * Create a Telegram group for an Equb pool
   * Handled by backend worker
   */
  static async createGroup(equbName: string): Promise<any> {
    console.log('Telegram group creation queued for:', equbName);
    // This is handled by the backend Celery worker
  }
}

// ========================================================================
// SMS GATEWAY INTEGRATION
// ========================================================================

export class SmsService {
  private static readonly PROVIDER = process.env.NEXT_PUBLIC_SMS_PROVIDER;

  /**
   * Send SMS via backend (never call directly from frontend)
   * SMS sending is rate-limited and handled by backend workers
   */
  static async sendSms(phoneNumber: string, message: string): Promise<any> {
    console.log('SMS queued for delivery:', phoneNumber);
    // This is handled by the backend SMS gateway worker
  }

  /**
   * Format phone number for SMS delivery
   */
  static formatPhoneNumber(phone: string): string {
    // Convert +251xxx or 0xxx to +251xxx format
    if (phone.startsWith('0')) {
      return '+251' + phone.slice(1);
    }
    if (!phone.startsWith('+')) {
      return '+251' + phone;
    }
    return phone;
  }
}

// ========================================================================
// USSD INTEGRATION
// ========================================================================

export class UssdService {
  private static readonly USSD_CODE = '*808#';

  static getInstructions(): string {
    return `Dial ${this.USSD_CODE} from your feature phone to access QalNet services`;
  }

  static getUssdMenu(): Record<string, string> {
    return {
      '1': 'Check Balance',
      '2': 'Make Payment',
      '3': 'View Equbs',
      '4': 'Request Extension',
      '5': 'Support',
    };
  }

  /**
   * Generate USSD session state machine responses
   * Handled by backend USSD gateway
   */
  static async processUssdInput(
    sessionId: string,
    userInput: string
  ): Promise<{ response: string; continueSession: boolean }> {
    // This is handled by the backend USSD gateway
    return {
      response: 'Invalid input. Try again.',
      continueSession: true,
    };
  }
}

export default {
  NotificationManager,
  ToastManager,
  TelegramBotService,
  SmsService,
  UssdService,
};
