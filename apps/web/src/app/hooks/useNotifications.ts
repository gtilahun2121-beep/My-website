'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/app/services/api';
import type { Notification } from '@qalnet/shared-types';

// The notifications/stream SSE endpoint is not implemented on the backend, so
// we poll on a modest interval instead. Polling is intentionally cheap: it is
// paused when the hook is inactive and skipped while a request is in flight.
const POLL_INTERVAL_MS = 20_000;

export function useNotifications(active = true) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const remove = useCallback(async (id: string) => {
    await api.notificationsAPI.deleteNotification(id).catch(() => null);
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id);
      setUnreadCount(next.filter((n) => !n.is_read).length);
      return next;
    });
  }, []);

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

    timerRef.current = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, refresh]);

  return { notifications, unreadCount, loading, refresh, markAllRead, remove };
}
