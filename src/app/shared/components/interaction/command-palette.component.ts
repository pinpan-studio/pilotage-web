import { Component, ElementRef, Injectable, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { KbdComponent, ShortcutService } from './shortcut.service';

export interface PaletteCommand {
  id: string;
  label: string;
  group?: string;
  icon?: string;
  /** Texte secondaire (chemin, description). */
  hint?: string;
  keywords?: string[];
  /** Raccourci affiché (et déclenché globalement si `global`). */
  shortcut?: string;
  route?: string;
  action?: () => void;
}

const RECENT_KEY = 'kit-palette-recent';

/** Score de correspondance approchée (sous-séquence, bonus début de mot / consécutif) + positions surlignées. */
export function fuzzyMatch(text: string, query: string): { score: number; hits: number[] } | null {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const t = norm(text), q = norm(query).replace(/\s+/g, ' ').trim();
  if (!q) return { score: 0, hits: [] };
  const direct = t.indexOf(q);
  if (direct >= 0) return { score: 1000 - direct * 2 + (direct === 0 || t[direct - 1] === ' ' ? 200 : 0), hits: Array.from({ length: q.length }, (_, i) => direct + i) };
  const chars = q.replace(/ /g, '');
  const wordStart = (i: number) => i === 0 || /[\s\-/·(]/.test(t[i - 1]);
  let best: { score: number; hits: number[] } | null = null;
  // Essaie chaque point de départ possible ; à chaque caractère, préfère un début de mot proche.
  for (let start = t.indexOf(chars[0]); start >= 0; start = t.indexOf(chars[0], start + 1)) {
    const hits = [start];
    let score = 10 + (wordStart(start) ? 20 : -15), ti = start + 1, ok = true;
    for (const ch of chars.slice(1)) {
      const next = t.indexOf(ch, ti);
      if (next < 0) { ok = false; break; }
      let ws = -1;
      for (let k = next; k < t.length; k++) if (t[k] === ch && wordStart(k)) { ws = k; break; }
      const pick = next === ti ? next : ws >= 0 && ws - next < 12 ? ws : next;
      score += 10 + (pick === ti ? 30 : 0) + (wordStart(pick) ? 20 : 0) - Math.min(10, (pick - ti) * 0.5);
      hits.push(pick); ti = pick + 1;
    }
    if (ok && (!best || score > best.score)) best = { score, hits };
  }
  return best && { score: best.score - t.length * 0.3, hits: best.hits };
}

/**
 * Palette de commandes (⌘K / Ctrl+K) : recherche approchée insensible aux accents dans toutes les
 * commandes enregistrées (navigation, actions), groupes, récents, navigation clavier complète.
 *
 * ```ts
 * palette.register([{ id: 'new-client', label: 'Nouveau client', group: 'Actions', icon: 'person_add', action: () => … }]);
 * palette.enableHotkey();   // ⌘K / Ctrl+K
 * ```
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private dialog = inject(MatDialog);
  private shortcuts = inject(ShortcutService);
  private router = inject(Router);
  private ref: MatDialogRef<CommandPaletteComponent> | null = null;
  private hotkey = false;
  readonly commands = signal<PaletteCommand[]>([]);
  readonly recent = signal<string[]>(this.loadRecent());

  register(cmds: PaletteCommand[]): () => void {
    this.commands.update((l) => [...l.filter((c) => !cmds.some((n) => n.id === c.id)), ...cmds]);
    return () => this.commands.update((l) => l.filter((c) => !cmds.includes(c)));
  }

  enableHotkey(): void {
    if (this.hotkey) return;
    this.hotkey = true;
    this.shortcuts.register({ keys: 'mod+k', description: 'Ouvrir la palette de commandes', group: 'Général', allowInInput: true, action: () => this.toggle() });
  }

  toggle(): void { this.ref ? this.ref.close() : this.open(); }
  open(): void {
    if (this.ref) return;
    this.ref = this.dialog.open(CommandPaletteComponent, {
      width: '640px', maxWidth: 'calc(100vw - 32px)', position: { top: '12vh' }, panelClass: 'kit-palette-panel', autoFocus: false, restoreFocus: true,
    });
    this.ref.afterClosed().subscribe(() => (this.ref = null));
  }

  run(c: PaletteCommand): void {
    this.ref?.close();
    this.recent.update((r) => [c.id, ...r.filter((x) => x !== c.id)].slice(0, 5));
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(this.recent())); } catch { /* stockage indisponible */ }
    if (c.route) void this.router.navigateByUrl(c.route);
    c.action?.();
  }

  private loadRecent(): string[] {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
  }
}

interface Row { cmd: PaletteCommand; hits: number[]; group: string; }

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [MatIconModule, KbdComponent],
  template: `
    <div class="cp">
      <div class="cp-search">
        <mat-icon>search</mat-icon>
        <input #inp placeholder="Rechercher une page, une action…" [value]="query()" (input)="query.set($any($event.target).value); active.set(0)"
          (keydown)="onKey($event)" aria-label="Rechercher une commande" role="combobox" aria-expanded="true" aria-controls="cp-list" />
        <app-kbd keys="esc" />
      </div>
      <div class="cp-list" id="cp-list" role="listbox" #list>
        @for (r of rows(); track r.cmd.id; let i = $index) {
          @if (i === 0 || rows()[i - 1].group !== r.group) { <div class="cp-group">{{ r.group }}</div> }
          <div class="cp-item" role="option" [class.active]="i === active()" [attr.aria-selected]="i === active()" [attr.data-i]="i"
            (click)="svc.run(r.cmd)" (mousemove)="active.set(i)">
            <span class="cp-ic"><mat-icon>{{ r.cmd.icon || 'chevron_right' }}</mat-icon></span>
            <span class="cp-text">
              <span class="cp-label">@for (p of parts(r); track $index) { <span [class.hl]="p.hl">{{ p.t }}</span> }</span>
              @if (r.cmd.hint) { <span class="cp-hint">{{ r.cmd.hint }}</span> }
            </span>
            @if (r.cmd.shortcut) { <app-kbd [keys]="r.cmd.shortcut" /> }
            @if (i === active()) { <mat-icon class="cp-enter">keyboard_return</mat-icon> }
          </div>
        } @empty {
          <div class="cp-empty"><mat-icon>search_off</mat-icon><strong>Aucun résultat</strong><span>Essayez un autre mot-clé.</span></div>
        }
      </div>
      <div class="cp-foot">
        <span><app-kbd keys="up" /><app-kbd keys="down" /> naviguer</span>
        <span><app-kbd keys="enter" /> ouvrir</span>
        <span class="spacer"></span>
        <span>{{ rows().length }} résultat(s)</span>
      </div>
    </div>
  `,
})
export class CommandPaletteComponent {
  readonly svc = inject(CommandPaletteService);
  private inp = viewChild.required<ElementRef<HTMLInputElement>>('inp');
  private list = viewChild.required<ElementRef<HTMLElement>>('list');
  query = signal('');
  active = signal(0);

  rows = computed<Row[]>(() => {
    const q = this.query().trim();
    const cmds = this.svc.commands();
    if (!q) {
      const recent = this.svc.recent().map((id) => cmds.find((c) => c.id === id)).filter((c): c is PaletteCommand => !!c);
      return [
        ...recent.map((cmd) => ({ cmd, hits: [], group: 'Récents' })),
        ...cmds.filter((c) => !recent.includes(c)).map((cmd) => ({ cmd, hits: [], group: cmd.group ?? 'Commandes' })),
      ];
    }
    return cmds
      .map((cmd) => {
        const m = fuzzyMatch(cmd.label, q);
        const k = m ? null : fuzzyMatch(`${cmd.hint ?? ''} ${(cmd.keywords ?? []).join(' ')}`, q);
        return m ? { cmd, hits: m.hits, score: m.score + 50, group: cmd.group ?? 'Commandes' } : k && k.score > 0 ? { cmd, hits: [], score: k.score / 2, group: cmd.group ?? 'Commandes' } : null;
      })
      .filter((r): r is Row & { score: number } => !!r)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      // Groupes ordonnés selon leur meilleur résultat (le tri reste stable à l'intérieur d'un groupe).
      .map((r, _i, all) => ({ ...r, rank: all.findIndex((x) => x.group === r.group) }))
      .sort((a, b) => a.rank - b.rank);
  });

  constructor() { setTimeout(() => this.inp().nativeElement.focus(), 30); }

  parts(r: Row): { t: string; hl: boolean }[] {
    const set = new Set(r.hits), out: { t: string; hl: boolean }[] = [];
    for (let i = 0; i < r.cmd.label.length; i++) {
      const hl = set.has(i), last = out[out.length - 1];
      if (last && last.hl === hl) last.t += r.cmd.label[i]; else out.push({ t: r.cmd.label[i], hl });
    }
    return out;
  }

  onKey(e: KeyboardEvent): void {
    const n = this.rows().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.active.set((this.active() + 1) % Math.max(1, n)); this.scroll(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.set((this.active() - 1 + n) % Math.max(1, n)); this.scroll(); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = this.rows()[this.active()]; if (r) this.svc.run(r.cmd); }
  }
  private scroll(): void {
    setTimeout(() => this.list().nativeElement.querySelector(`[data-i="${this.active()}"]`)?.scrollIntoView({ block: 'nearest' }));
  }
}
