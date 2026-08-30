// ========================================================================
// LOTTERY SOUNDS
// Tiny Web-Audio utility that synthesises spin ticks + a win chime on the
// client with zero dependencies. All methods are no-ops if the AudioContext
// is unavailable (SSR / privacy-restricted browsers), so it's safe to call
// unconditionally.
// ========================================================================

'use client';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    // Browsers only allow audio after a user gesture — resume lazily.
    if (ctx.state === 'suspended') void ctx.resume();
  }
  return ctx;
}

/** Short "tick" used while the wheel is spinning past segment dividers. */
export function playTick(): void {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'square';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.06);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.07);
}

/** Triumphant arpeggio played when a real winner is revealed. */
export function playWin(): void {
  const ac = getCtx();
  if (!ac) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const t = ac.currentTime + i * 0.12;
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  });
}