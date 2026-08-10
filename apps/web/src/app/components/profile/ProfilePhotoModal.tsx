'use client';

import { useEffect, useRef, useState } from 'react';

interface ProfilePhotoModalProps {
  open: boolean;
  currentPhoto: string | null;
  onClose: () => void;
  onSave: (photo: string | null) => Promise<void>;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export default function ProfilePhotoModal({ open, currentPhoto, onClose, onSave }: ProfilePhotoModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleClose = () => {
    setPreview(null);
    onClose();
  };

  const onPick = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(preview);
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(null);
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} aria-hidden="true" />

      <div className="relative w-full max-w-sm bg-card rounded-card border border-slate-200 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-900">Profile Photo</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-6 text-center">
          <div className="mx-auto w-36 h-36 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center ring-4 ring-brand-100">
            {(preview ?? currentPhoto) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview ?? currentPhoto ?? ''}
                alt="Profile preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <svg viewBox="0 0 24 24" className="w-14 h-14 text-slate-300" {...stroke}>
                <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-4 7c-4.4 0-8 2.4-8 5.3V21h16v-1.7C20 16.4 16.4 14 12 14Z" />
              </svg>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Upload a square image (JPG or PNG). It will appear on your profile and in the header.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors"
            >
              {preview ? 'Choose different photo' : 'Upload photo'}
            </button>

            {preview && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Photo'}
              </button>
            )}

            {currentPhoto && !preview && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={saving}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-bold text-danger-600 hover:bg-danger-50 transition-colors"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
