import { Component, computed, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export type AuditAction = 'create' | 'update' | 'delete' | 'status' | 'comment' | 'login' | 'export';
export interface AuditChange { field: string; label?: string; before?: unknown; after?: unknown; }
export interface AuditEntry {
  id: string;
  at: string | Date;
  user: { name: string; initials?: string; color?: string };
  action: AuditAction;
  /** Objet concerné (« Client CLI-1043 »). */
  target?: string;
  changes?: AuditChange[];
  comment?: string;
  /** Contexte technique (IP, appareil). */
  meta?: string;
}

const ACTIONS: Record<AuditAction, { label: string; icon: string; tone: string }> = {
  create: { label: 'a créé', icon: 'add_circle', tone: 'success' },
  update: { label: 'a modifié', icon: 'edit', tone: 'info' },
  delete: { label: 'a supprimé', icon: 'delete', tone: 'error' },
  status: { label: 'a changé le statut de', icon: 'swap_horiz', tone: 'warning' },
  comment: { label: 'a commenté', icon: 'chat', tone: 'purple' },
  login: { label: 's’est connecté', icon: 'login', tone: 'primary' },
  export: { label: 'a exporté', icon: 'download', tone: 'primary' },
};

/**
 * Historique des modifications (audit log) : fil chronologique groupé par jour, filtre par action et
 * par auteur, détail champ par champ « avant → après » repliable, commentaires.
 *
 * ```html
 * <app-audit-log [entries]="historique" />
 * ```
 */
@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatTooltipModule],
  template: `
    <div class="al-filters">
      <button type="button" class="chip" [class.on]="!action()" (click)="action.set(null)">Tout <em>{{ entries().length }}</em></button>
      @for (a of usedActions(); track a) {
        <button type="button" class="chip" [class.on]="action() === a" (click)="action.set(action() === a ? null : a)">
          <mat-icon [style.color]="'var(--' + meta(a).tone + '-color)'">{{ meta(a).icon }}</mat-icon>{{ actionName[a] }}<em>{{ count(a) }}</em></button>
      }
      <span class="spacer"></span>
      <div class="al-users">
        @for (u of users(); track u.name) {
          <button type="button" class="av" [class.off]="user() && user() !== u.name" [style.background]="u.color || 'var(--primary-color)'"
            (click)="user.set(user() === u.name ? null : u.name)" [matTooltip]="u.name">{{ initials(u) }}</button>
        }
      </div>
    </div>

    @for (g of groups(); track g.day) {
      <div class="al-day">{{ g.label }}</div>
      <ol class="al-list">
        @for (e of g.items; track e.id) {
          <li class="al-item">
            <span class="al-dot" [style.--tone]="'var(--' + meta(e.action).tone + '-color)'"><mat-icon>{{ meta(e.action).icon }}</mat-icon></span>
            <div class="al-main">
              <div class="al-line">
                <span class="av sm" [style.background]="e.user.color || 'var(--primary-color)'">{{ initials(e.user) }}</span>
                <span><strong>{{ e.user.name }}</strong> {{ meta(e.action).label }} @if (e.target) { <strong class="tgt">{{ e.target }}</strong> }</span>
                <span class="spacer"></span>
                <time [attr.datetime]="e.at" [matTooltip]="(e.at | date: 'EEEE d MMMM y, HH:mm:ss') ?? ''">{{ e.at | date: 'HH:mm' }}</time>
              </div>
              @if (e.comment) { <blockquote>{{ e.comment }}</blockquote> }
              @if (e.changes?.length) {
                <button type="button" class="al-toggle" (click)="toggle(e.id)">
                  <mat-icon [class.open]="isOpen(e.id)">chevron_right</mat-icon>{{ e.changes!.length }} champ(s) modifié(s)
                  @if (!isOpen(e.id)) { <span class="muted">· {{ fieldNames(e) }}</span> }
                </button>
                @if (isOpen(e.id)) {
                  <table class="al-changes">
                    <thead><tr><th>Champ</th><th>Avant</th><th></th><th>Après</th></tr></thead>
                    <tbody>
                      @for (c of e.changes; track c.field) {
                        <tr>
                          <td class="f">{{ c.label || c.field }}</td>
                          <td><span class="old" [class.none]="isNone(c.before)">{{ fmt(c.before) }}</span></td>
                          <td class="arrow"><mat-icon>arrow_forward</mat-icon></td>
                          <td><span class="new" [class.none]="isNone(c.after)">{{ fmt(c.after) }}</span></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              }
              @if (e.meta) { <span class="al-meta"><mat-icon>devices</mat-icon>{{ e.meta }}</span> }
            </div>
          </li>
        }
      </ol>
    } @empty {
      <div class="al-empty"><mat-icon>history</mat-icon>Aucune activité pour ce filtre.</div>
    }
  `,
  styleUrls: ['./audit-log.component.scss'],
})
export class AuditLogComponent {
  entries = input<AuditEntry[]>([]);

  readonly actionName: Record<AuditAction, string> = { create: 'Créations', update: 'Modifications', delete: 'Suppressions', status: 'Statuts', comment: 'Commentaires', login: 'Connexions', export: 'Exports' };
  action = signal<AuditAction | null>(null);
  user = signal<string | null>(null);
  private open = signal<Set<string>>(new Set());

  usedActions = computed(() => [...new Set(this.entries().map((e) => e.action))]);
  users = computed(() => [...new Map(this.entries().map((e) => [e.user.name, e.user])).values()]);
  filtered = computed(() => this.entries()
    .filter((e) => (!this.action() || e.action === this.action()) && (!this.user() || e.user.name === this.user()))
    .sort((a, b) => +new Date(b.at) - +new Date(a.at)));
  groups = computed(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const e of this.filtered()) {
      const d = new Date(e.at);
      const k = d.toDateString();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    const today = new Date().toDateString(), yest = new Date(Date.now() - 864e5).toDateString();
    return [...map.entries()].map(([day, items]) => ({
      day, items,
      label: day === today ? 'Aujourd’hui' : day === yest ? 'Hier' : new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    }));
  });

  meta(a: AuditAction) { return ACTIONS[a]; }
  count(a: AuditAction): number { return this.entries().filter((e) => e.action === a).length; }
  initials(u: { name: string; initials?: string }): string { return u.initials ?? u.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase(); }
  isOpen(id: string): boolean { return this.open().has(id); }
  toggle(id: string): void { this.open.update((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  fieldNames(e: AuditEntry): string { return e.changes!.map((c) => c.label || c.field).join(', '); }
  isNone(v: unknown): boolean { return v === null || v === undefined || v === ''; }
  fmt(v: unknown): string {
    if (this.isNone(v)) return 'vide';
    if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
    if (typeof v === 'number') return v.toLocaleString('fr-FR');
    if (Array.isArray(v)) return v.join(', ');
    return String(v);
  }
}
