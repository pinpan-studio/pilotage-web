import { Component, DestroyRef, Injectable, computed, inject, input, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface Shortcut {
  /** Combinaison (« mod+k », « shift+? », « g c » pour une séquence). `mod` = ⌘ sur macOS, Ctrl ailleurs. */
  keys: string;
  description: string;
  group?: string;
  action: (e: KeyboardEvent) => void;
  /** Actif même quand le focus est dans un champ de saisie. */
  allowInInput?: boolean;
}

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Libellés affichables d'une combinaison (« mod+shift+k » → ['⌘', '⇧', 'K']). */
export function keyLabels(combo: string): string[] {
  const map: Record<string, string> = IS_MAC
    ? { mod: '⌘', ctrl: '⌃', alt: '⌥', shift: '⇧', enter: '↵', escape: 'Échap', esc: 'Échap', backspace: '⌫', up: '↑', down: '↓', left: '←', right: '→', space: 'Espace', tab: '⇥' }
    : { mod: 'Ctrl', ctrl: 'Ctrl', alt: 'Alt', shift: 'Maj', enter: 'Entrée', escape: 'Échap', esc: 'Échap', backspace: '⌫', up: '↑', down: '↓', left: '←', right: '→', space: 'Espace', tab: 'Tab' };
  return combo.split('+').map((k) => map[k.toLowerCase()] ?? (k.length === 1 || /^f\d{1,2}$/i.test(k) ? k.toUpperCase() : k));
}

/**
 * Registre global des raccourcis clavier : combinaisons (mod+k) et séquences (g puis c), ignorées dans
 * les champs de saisie sauf exception, aide listant tous les raccourcis (touche « ? »).
 *
 * ```ts
 * const off = shortcuts.register({ keys: 'mod+k', description: 'Rechercher', group: 'Général', action: () => palette.open() });
 * // … off() pour désinscrire (ou automatique avec `registerFor(destroyRef, …)`).
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ShortcutService {
  private document = inject(DOCUMENT);
  private dialog = inject(MatDialog);
  private list = signal<Shortcut[]>([]);
  readonly all = this.list.asReadonly();
  private pending: string | null = null;
  private pendingTimer?: ReturnType<typeof setTimeout>;
  private helpOpen = false;

  constructor() {
    this.document.addEventListener('keydown', (e) => this.onKey(e), true);
    this.register({ keys: 'shift+?', description: 'Afficher les raccourcis clavier', group: 'Général', action: () => this.openHelp() });
  }

  register(...s: Shortcut[]): () => void {
    this.list.update((l) => [...l, ...s]);
    return () => this.list.update((l) => l.filter((x) => !s.includes(x)));
  }
  /** Inscription liée au cycle de vie d'un composant. */
  registerFor(ref: DestroyRef, ...s: Shortcut[]): void { ref.onDestroy(this.register(...s)); }

  private combo(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.metaKey || e.ctrlKey) parts.push(IS_MAC ? (e.metaKey ? 'mod' : 'ctrl') : 'mod');
    if (e.altKey) parts.push('alt');
    const key = e.key === ' ' ? 'space' : e.key.toLowerCase();
    // « ? » implique déjà Maj : on garde shift uniquement pour les touches dont il ne change pas le caractère.
    if (e.shiftKey && (key.length > 1 || key === '?' || /[a-z0-9]/.test(key))) parts.push('shift');
    parts.push(key === 'arrowup' ? 'up' : key === 'arrowdown' ? 'down' : key === 'arrowleft' ? 'left' : key === 'arrowright' ? 'right' : key);
    return parts.join('+');
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat || ['Shift', 'Control', 'Meta', 'Alt'].includes(e.key)) return;
    const t = e.target as HTMLElement;
    const inInput = !!t?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
    const c = this.combo(e);
    const seq = this.pending ? `${this.pending} ${c}` : null;
    const match = (k: string) => k.toLowerCase().replace(/\s+/g, ' ') === c || (seq !== null && k.toLowerCase() === seq);
    const hit = [...this.list()].reverse().find((s) => match(s.keys) && (s.allowInInput || !inInput));
    clearTimeout(this.pendingTimer);
    if (hit) { e.preventDefault(); this.pending = null; hit.action(e); return; }
    // Début de séquence possible (« g » de « g c »)
    if (!inInput && this.list().some((s) => s.keys.toLowerCase().startsWith(c + ' '))) {
      this.pending = c;
      this.pendingTimer = setTimeout(() => (this.pending = null), 1200);
    } else this.pending = null;
  }

  openHelp(): void {
    if (this.helpOpen) return;
    this.helpOpen = true;
    this.dialog.open(ShortcutHelpComponent, { width: '560px', maxWidth: '94vw', panelClass: 'kit-shortcut-panel', autoFocus: false })
      .afterClosed().subscribe(() => (this.helpOpen = false));
  }
}

/** Touche(s) de clavier stylées, adaptées à la plateforme (⌘ / Ctrl). */
@Component({
  selector: 'app-kbd',
  standalone: true,
  template: `@for (seq of sequences(); track $index; let last = $last) {@for (k of seq; track $index) {<kbd>{{ k }}</kbd>}@if (!last) {<span class="then">puis</span>}}`,
  styles: [`
    :host { display: inline-flex; align-items: center; gap: 3px; vertical-align: middle; }
    kbd { min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
      border-radius: 5px; border: 1px solid var(--border-color); border-bottom-width: 2px; background: var(--card-bg); color: var(--text-secondary);
      font: 600 11px 'Inter', sans-serif; line-height: 1; }
    .then { font-size: 11px; color: var(--text-muted); margin: 0 2px; }
  `],
})
export class KbdComponent {
  keys = input.required<string>();
  sequences = computed(() => this.keys().trim().split(/\s+/).map(keyLabels));
}

@Component({
  selector: 'app-shortcut-help',
  standalone: true,
  imports: [MatDialogModule, MatIconModule, KbdComponent],
  template: `
    <div class="sh-head"><mat-icon>keyboard</mat-icon><h2>Raccourcis clavier</h2><span class="spacer"></span>
      <button type="button" mat-dialog-close aria-label="Fermer"><mat-icon>close</mat-icon></button></div>
    <div class="sh-body">
      @for (g of groups(); track g.name) {
        <h3>{{ g.name }}</h3>
        <ul>@for (s of g.items; track s.keys) { <li><span>{{ s.description }}</span><app-kbd [keys]="s.keys" /></li> }</ul>
      }
    </div>
    <div class="sh-foot">Appuyez sur <app-kbd keys="shift+?" /> à tout moment pour afficher cette aide.</div>
  `,
  styles: [`
    :host { display: block; color: var(--text-primary); }
    .sh-head { display: flex; align-items: center; gap: 10px; padding: 18px 20px 10px;
      > mat-icon { color: var(--primary-color); }
      h2 { margin: 0; font: 600 18px 'Outfit', sans-serif; }
      .spacer { flex: 1; }
      button { width: 34px; height: 34px; border: none; border-radius: 50%; background: transparent; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center;
        &:hover { background: var(--hover-bg); } } }
    .sh-body { padding: 0 20px 8px; max-height: 60vh; overflow-y: auto; }
    h3 { margin: 14px 0 6px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--border-color); font-size: 13.5px; }
    .sh-foot { padding: 12px 20px 16px; font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
  `],
})
export class ShortcutHelpComponent {
  private svc = inject(ShortcutService);
  groups = computed(() => {
    const map = new Map<string, Shortcut[]>();
    for (const s of this.svc.all()) {
      const g = s.group ?? 'Général';
      if (!map.has(g)) map.set(g, []);
      if (!map.get(g)!.some((x) => x.keys === s.keys)) map.get(g)!.push(s);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  });
}
