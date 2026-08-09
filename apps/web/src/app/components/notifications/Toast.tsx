'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration === 0) return;

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        onClose(toast.id);
      }, 300);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const iconMap = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  const colorMap = {
    success: 'from-[#0d7e4d] to-[#d4af37]',
    error: 'from-[#ce1126] to-red-600',
    info: 'from-blue-500 to-blue-600',
    warning: 'from-yellow-500 to-yellow-600',
  };

  const bgColorMap = {
    success: 'bg-[#0d7e4d]/10 border-[#0d7e4d]',
    error: 'bg-red-100 border-red-500',
    info: 'bg-blue-100 border-blue-500',
    warning: 'bg-yellow-100 border-yellow-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -20, x: 20 }}
      transition={{ duration: 0.3 }}
      className={`${bgColorMap[toast.type]} border-2 rounded-lg p-4 shadow-lg max-w-sm w-full`}
    >
      <div className="flex gap-4 items-start">
        <div className="text-3xl flex-shrink-0">{iconMap[toast.type]}</div>
        <div className="flex-1">
          <h4 className={`font-black text-lg mb-1 bg-gradient-to-r ${colorMap[toast.type]} bg-clip-text text-transparent`}>
            {toast.title}
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed">
            {toast.message}
          </p>
        </div>
        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(() => {
              onClose(toast.id);
            }, 300);
          }}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      {toast.duration !== 0 && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: (toast.duration || 5000) / 1000, ease: 'linear' }}
          className={`h-1 bg-gradient-to-r ${colorMap[toast.type]} rounded-full mt-3`}
          style={{ transformOrigin: 'left' }}
        />
      )}
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed top-6 right-6 z-[9999] space-y-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onClose={onClose} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Hook for using toasts
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (
    type: ToastType,
    title: string,
    message: string,
    duration?: number
  ) => {
    const id = `${Date.now()}-${Math.random()}`;
    const newToast: ToastMessage = { id, type, title, message, duration };
    setToasts((prev) => [...prev, newToast]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const success = (title: string, message: string, duration?: number) =>
    addToast('success', title, message, duration);

  const error = (title: string, message: string, duration?: number) =>
    addToast('error', title, message, duration);

  const info = (title: string, message: string, duration?: number) =>
    addToast('info', title, message, duration);

  const warning = (title: string, message: string, duration?: number) =>
    addToast('warning', title, message, duration);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    warning,
  };
}
