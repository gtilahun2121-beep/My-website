// ========================================================================
// TOAST NOTIFICATION CONTAINER
// Displays Toast Notifications in Fixed Position
// ========================================================================

'use client';

import React, { useEffect, useState } from 'react';
import type { Toast } from '../../services/notifications';
import { ToastManager } from '../../services/notifications';

interface ToastContainerProps {
  toastManager: ToastManager;
}

const ToastNotification: React.FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (toast.duration === 0) return;

    const timer = setTimeout(onDismiss, toast.duration || 5000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '💬';
    }
  };

  const getBackgroundColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-600';
      case 'error':
        return 'bg-red-600';
      case 'warning':
        return 'bg-yellow-600';
      case 'info':
        return 'bg-blue-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <div
      className={`${getBackgroundColor(toast.type)} text-white px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 mb-3 animate-slide-in`}
      role="alert"
    >
      <span className="text-xl flex-shrink-0">{getIcon(toast.type)}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{toast.title}</p>
        {toast.message && <p className="text-sm opacity-90">{toast.message}</p>}
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {toast.actionLabel && toast.onAction && (
          <button
            onClick={toast.onAction}
            className="text-sm underline hover:opacity-80 transition-opacity"
          >
            {toast.actionLabel}
          </button>
        )}
        <button
          onClick={onDismiss}
          className="text-xl hover:opacity-80 transition-opacity"
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toastManager }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = toastManager.addListener((newToasts) => {
      setToasts(newToasts);
    });

    return unsubscribe;
  }, [toastManager]);

  return (
    <div
      className="fixed bottom-20 md:bottom-4 right-4 max-w-sm z-40 pointer-events-auto"
      role="region"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastNotification
          key={toast.id}
          toast={toast}
          onDismiss={() => toastManager.dismissToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
