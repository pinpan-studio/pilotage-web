/** Utilitaires communs aux composants média. */

/** 75 → « 1:15 », 3725 → « 1:02:05 ». */
export function formatMediaTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export type MediaKind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'other';

/** Déduit le type d'aperçu à partir du type MIME ou, à défaut, de l'extension. */
export function mediaKind(name = '', mime = ''): MediaKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (mime.startsWith('image/') || /^(png|jpe?g|gif|webp|svg|avif|bmp)$/.test(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('video/') || /^(mp4|webm|ogv|mov|m4v)$/.test(ext)) return 'video';
  if (mime.startsWith('audio/') || /^(mp3|wav|ogg|oga|m4a|aac|flac|opus)$/.test(ext)) return 'audio';
  if (mime.startsWith('text/') || /^(txt|csv|json|md|log|xml)$/.test(ext)) return 'text';
  return 'other';
}

export const MEDIA_ICON: Record<MediaKind, string> = {
  image: 'image', pdf: 'picture_as_pdf', video: 'movie', audio: 'audiotrack', text: 'description', other: 'insert_drive_file',
};

/** Pics normalisés (0–1) d'un fichier audio, calculés localement via Web Audio. */
export async function computePeaks(blob: Blob, bars = 64): Promise<number[]> {
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return pseudoPeaks(String(blob.size), bars);
  const ctx = new Ctx();
  try {
    const buf: AudioBuffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    const ch = buf.getChannelData(0);
    const step = Math.floor(ch.length / bars) || 1;
    const peaks = Array.from({ length: bars }, (_, i) => {
      let max = 0;
      for (let j = i * step; j < Math.min(ch.length, (i + 1) * step); j += 8) max = Math.max(max, Math.abs(ch[j]));
      return max;
    });
    const top = Math.max(...peaks) || 1;
    return peaks.map((p) => Math.max(0.08, p / top));
  } catch {
    return pseudoPeaks(String(blob.size), bars);
  } finally {
    void ctx.close?.();
  }
}

/** Forme d'onde décorative déterministe (quand le fichier n'est pas décodable). */
export function pseudoPeaks(seed: string, bars = 64): number[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Array.from({ length: bars }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const r = ((h >>> 0) % 1000) / 1000;
    return 0.2 + 0.8 * Math.abs(Math.sin(i / 5 + r)) * (0.55 + r * 0.45);
  });
}
