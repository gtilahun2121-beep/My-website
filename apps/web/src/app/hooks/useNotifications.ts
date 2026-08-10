'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/app/services/api';
import type { Notification } from '@qalnet/shared-types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000';

function getApiBase(): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
}

export function useNotifications(active = true) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.notificationsAPI.getNotifications();
      setNotifications(data || []);
      setUnreadCount((data || []).filter((n) => !n.is_read).length);
    } catch {
      // ignore — unauthenticated or network error
    } finally {
      setLoading(false);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;
    await Promise.all(
      unread.map((n) => api.notificationsAPI.markAsRead(n.id).catch(() => null)),
    );
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [notifications]);

  useEffect(() => {
    if (!active) return;
    api.notificationsAPI
      .getNotifications()
      .then((data) => {
        setNotifications(data || []);
        setUnreadCount((data || []).filter((n) => !n.is_read).length);
      })
      .catch(() => {
        // ignore — unauthenticated or network error
      })
      .finally(() => setLoading(false));

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!token || typeof EventSource === 'undefined') return;

    const source = new EventSource(`${getApiBase()}/notifications/stream?token=${token}`);
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const next = JSON.parse(event.data) as Notification;
        setNotifications((prev) => [
          next,
          ...prev.filter((n) => n.id !== next.id),
        ]);
        setUnreadCount((c) => c + 1);
      } catch {
        // ignore malformed events
      }
    };
    source.onerror = () => source.close();

    return () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, [active]);

  return { notifications, unreadCount, loading, refresh, markAllRead };
}
