'use client';

import { motion } from 'framer-motion';

interface FormErrorProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
}

export default function FormError({ title = 'Error', message, onDismiss }: FormErrorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-brand-100 border-l-4 border-brand-500 text-brand-700 p-4 rounded flex items-start justify-between gap-3"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div>
          <p className="font-bold text-sm">{title}</p>
          <p className="text-xs">{message}</p>
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-brand-500 hover:text-brand-700 font-bold text-xl leading-none"
        >
          ✕
        </button>
      )}
    </motion.div>
  );
}
