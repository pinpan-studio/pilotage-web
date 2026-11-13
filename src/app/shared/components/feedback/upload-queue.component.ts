import { Component, OnDestroy, booleanAttribute, computed, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, Subscription } from 'rxjs';
import { MEDIA_ICON, mediaKind } from '../media/media.utils';

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error' | 'canceled';
export interface UploadItem { id: string; file: File; progress: number; status: UploadStatus; error?: string; }

/**
 * Fonction d'envoi fournie par l'hôte : émet la progression (0–100) puis se termine, ou lève une erreur.
 * Se désabonner annule l'envoi. Par défaut le composant simule un envoi (UI Kit statique).
 */
export type Uploader = (file: File) => Observable<number>;

/** Envoi simulé (progression pseudo-aléatoire ; échec si le nom contient « erreur »). */
export const simulatedUploader: Uploader = (file) => new Observable<number>((sub) => {
  let p = 0;
  const fail = /erreur|error/i.test(file.name);
  const speed = 4 + Math.random() * 10 + Math.max(0, 6 - file.size / 500_000);
  const t = setInterval(() => {
    p = Math.min(100, p + speed * (0.6 + Math.random()));
    if (fail && p > 55) { clearInterval(t); sub.error(new Error('Le serveur a refusé le fichier (démo)')); return; }
    sub.next(Math.round(p));
    if (p >= 100) { clearInterval(t); sub.complete(); }
  }, 160);
  return () => clearInterval(t);
});

/**
 * File d'envoi multiple : zone de dépôt (glisser-déposer, clic, coller), validation taille / type,
 * progression par fichier et globale, envois parallèles limités, annuler, réessayer, retirer,
 * vider les terminés. L'envoi réel est délégué à `uploader`.
 *
 * ```html
 * <app-upload-queue accept="image/*,application/pdf" [maxSize]="10_000_000" [uploader]="api.upload" (completed)="onDone($event)" />
 * ```
 */
@Component({
  selector: 'app-upload-queue',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  templateUrl: './upload-queue.component.html',
  styleUrls: ['./upload-queue.component.scss'],
})
export class UploadQueueComponent implements OnDestroy {
  accept = input('');
  /** Taille maximale par fichier (octets). */
  maxSize = input(25 * 1024 * 1024);
  maxFiles = input(20);
  concurrency = input(2);
  autoStart = input(true, { transform: booleanAttribute });
  uploader = input<Uploader>(simulatedUploader);
  hint = input('');

  completed = output<File[]>();
  rejected = output<{ file: File; reason: string }[]>();

  items = signal<UploadItem[]>([]);
  dragging = signal(false);
  rejections = signal<{ name: string; reason: string }[]>([]);
  private subs = new Map<string, Subscription>();
  private seq = 0;

  active = computed(() => this.items().filter((i) => i.status !== 'canceled'));
  totalBytes = computed(() => this.active().reduce((s, i) => s + i.file.size, 0));
  totalProgress = computed(() => {
    const t = this.totalBytes();
    return t ? Math.round((this.active().reduce((s, i) => s + (i.file.size * (i.status === 'done' ? 100 : i.progress)) / 100, 0) / t) * 100) : 0;
  });
  counts = computed(() => {
    const c = { queued: 0, uploading: 0, done: 0, error: 0, canceled: 0 };
    this.items().forEach((i) => c[i.status]++);
    return c;
  });
  busy = computed(() => this.counts().uploading + this.counts().queued > 0);
  acceptLabel = computed(() => this.hint() || `${this.accept() ? this.accept().split(',').join(', ') + ' · ' : ''}max ${this.size(this.maxSize())} par fichier`);

  icon(i: UploadItem): string { return MEDIA_ICON[mediaKind(i.file.name, i.file.type)]; }
  size(b: number): string { return b >= 1048576 ? `${(b / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`; }

  browse(): void {
    const el = document.createElement('input');
    el.type = 'file';
    el.multiple = true;
    if (this.accept()) el.accept = this.accept();
    el.onchange = () => this.add(Array.from(el.files ?? []));
    el.click();
  }
  onDrop(e: DragEvent): void { e.preventDefault(); this.dragging.set(false); this.add(Array.from(e.dataTransfer?.files ?? [])); }
  onPaste(e: ClipboardEvent): void { const f = Array.from(e.clipboardData?.files ?? []); if (f.length) { e.preventDefault(); this.add(f); } }

  private accepts(f: File): boolean {
    const rules = this.accept().split(',').map((r) => r.trim().toLowerCase()).filter(Boolean);
    if (!rules.length) return true;
    const name = f.name.toLowerCase(), type = f.type.toLowerCase();
    return rules.some((r) => (r.startsWith('.') ? name.endsWith(r) : r.endsWith('/*') ? type.startsWith(r.slice(0, -1)) : type === r));
  }

  add(files: File[]): void {
    const rej: { file: File; reason: string }[] = [];
    const room = this.maxFiles() - this.active().length;
    const ok = files.filter((f, k) => {
      if (k >= room) { rej.push({ file: f, reason: `limite de ${this.maxFiles()} fichiers atteinte` }); return false; }
      if (!this.accepts(f)) { rej.push({ file: f, reason: 'type non autorisé' }); return false; }
      if (f.size > this.maxSize()) { rej.push({ file: f, reason: `dépasse ${this.size(this.maxSize())}` }); return false; }
      return true;
    });
    this.rejections.set(rej.map((r) => ({ name: r.file.name, reason: r.reason })));
    if (rej.length) this.rejected.emit(rej);
    this.items.update((l) => [...ok.map((file) => ({ id: 'u' + ++this.seq, file, progress: 0, status: 'queued' as UploadStatus })), ...l]);
    if (this.autoStart()) this.pump();
  }

  /** Lance les envois en attente dans la limite de `concurrency`. */
  pump(): void {
    const running = this.counts().uploading;
    const next = this.items().filter((i) => i.status === 'queued').reverse().slice(0, Math.max(0, this.concurrency() - running));
    next.forEach((it) => this.start(it));
  }
  private patch(id: string, p: Partial<UploadItem>): void { this.items.update((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i))); }
  private start(it: UploadItem): void {
    this.patch(it.id, { status: 'uploading', progress: 0, error: undefined });
    const sub = this.uploader()(it.file).subscribe({
      next: (p) => this.patch(it.id, { progress: p }),
      error: (e) => { this.subs.delete(it.id); this.patch(it.id, { status: 'error', error: e?.message ?? 'Échec de l’envoi' }); this.pump(); },
      complete: () => {
        this.subs.delete(it.id);
        this.patch(it.id, { status: 'done', progress: 100 });
        this.pump();
        if (!this.busy()) this.completed.emit(this.items().filter((i) => i.status === 'done').map((i) => i.file));
      },
    });
    this.subs.set(it.id, sub);
  }
  cancel(it: UploadItem): void {
    this.subs.get(it.id)?.unsubscribe();
    this.subs.delete(it.id);
    if (it.status === 'uploading' || it.status === 'queued') this.patch(it.id, { status: 'canceled' });
    this.pump();
  }
  retry(it: UploadItem): void { this.patch(it.id, { status: 'queued', progress: 0, error: undefined }); this.pump(); }
  remove(it: UploadItem): void { this.cancel(it); this.items.update((l) => l.filter((i) => i.id !== it.id)); }
  clearDone(): void { this.items.update((l) => l.filter((i) => i.status !== 'done' && i.status !== 'canceled')); }
  cancelAll(): void { this.items().filter((i) => i.status === 'uploading' || i.status === 'queued').forEach((i) => this.cancel(i)); }
  retryAll(): void { this.items().filter((i) => i.status === 'error').forEach((i) => this.patch(i.id, { status: 'queued', progress: 0 })); this.pump(); }

  ngOnDestroy(): void { this.subs.forEach((s) => s.unsubscribe()); }
}
