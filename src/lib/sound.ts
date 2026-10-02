/**
 * Sonidos opcionales (apagados por defecto, CLAUDE.md): tonos cortos con Web Audio, sin archivos.
 */
export type SoundKind = "right" | "wrong" | "level" | "chest";

let ctx: AudioContext | null = null;

const NOTES: Record<SoundKind, readonly [number, number][]> = {
  right: [[660, 0.06], [880, 0.08]],
  wrong: [[220, 0.12]],
  level: [[523, 0.08], [659, 0.08], [784, 0.12]],
  chest: [[440, 0.06], [554, 0.06], [659, 0.06], [880, 0.12]],
};

export function playSound(kind: SoundKind, enabled: boolean): void {
  if (!enabled || typeof window === "undefined" || typeof AudioContext === "undefined") return;
  try {
    ctx ??= new AudioContext();
    let t = ctx.currentTime;
    for (const [freq, dur] of NOTES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    }
  } catch {
    // Sin audio disponible: se ignora en silencio (es solo adorno).
  }
}
