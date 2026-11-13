import { Component, booleanAttribute, computed, effect, input, linkedSignal, output, signal, untracked } from '@angular/core';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface AppNotification {
  id: string;
  title: string;
  message?: string;
  at: string | Date;
  read?: boolean;
  icon?: string;
  /** Couleur (token : primary, success, warning, error, info, purple). */
  tone?: string;
  /** Catégorie pour les onglets (« Alertes », « Système »…). */
  category?: string;
  /** Actions rapides affichées sous le message. */
  actions?: { id: string; label: string; primary?: boolean }[];
  avatar?: string;
}

/**
 * Centre de notifications : cloche avec compteur (pastille animée à l'arrivée), panneau déroulant avec
 * onglets Toutes / Non lues / catégories, groupement par jour, marquer comme lu (individuellement ou tout),
 * suppression, actions rapides, état vide. L'état est piloté par l'hôte via `notifications` + événements,
 * ou géré localement (`manage`).
 *
 * ```html
 * <app-notification-center [notifications]="notifs" (open)="router.navigate(…)" (action)="onAction($event)" />
 * ```
 */
@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [OverlayModule, MatIconModule, MatTooltipModule],
  template: `
    <button type="button" class="nc-bell" cdkOverlayOrigin #origin="cdkOverlayOrigin" (click)="opened.set(!opened())" [class.on]="opened()"
      [attr.aria-label]="'Notifications, ' + unread() + ' non lues'" matTooltip="Notifications">
      <mat-icon>{{ unread() ? 'notifications_active' : 'notifications' }}</mat-icon>
      @if (unread()) { <span class="nc-count" [class.ping]="ping()">{{ unread() > 99 ? '99+' : unread() }}</span> }
    </button>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="opened()" [cdkConnectedOverlayPositions]="positions"
      (overlayOutsideClick)="opened.set(false)" (detach)="opened.set(false)" (overlayKeydown)="$event.key === 'Escape' && opened.set(false)">
      <div class="kit-notif" role="dialog" aria-label="Notifications">
        <div class="nf-head">
          <strong>Notifications</strong>
          @if (unread()) { <span class="nf-badge">{{ unread() }}</span> }
          <span class="spacer"></span>
          <button type="button" class="nf-icon" (click)="markAll()" [disabled]="!unread()" matTooltip="Tout marquer comme lu"><mat-icon>done_all</mat-icon></button>
          @if (settings()) { <button type="button" class="nf-icon" (click)="settingsClick.emit()" matTooltip="Préférences"><mat-icon>settings</mat-icon></button> }
        </div>
        <div class="nf-tabs" role="tablist">
          @for (t of tabs(); track t.id) {
            <button type="button" role="tab" [class.on]="tab() === t.id" (click)="tab.set(t.id)">{{ t.label }}@if (t.count) { <em>{{ t.count }}</em> }</button>
          }
        </div>
        <div class="nf-list">
          @for (g of groups(); track g.label) {
            <div class="nf-day">{{ g.label }}</div>
            @for (n of g.items; track n.id) {
              <div class="nf-item" [class.unread]="!n.read" (click)="openItem(n)" role="button" tabindex="0" (keydown.enter)="openItem(n)">
                @if (n.avatar) { <span class="nf-av">{{ n.avatar }}</span> }
                @else { <span class="nf-ic" [style.--tone]="'var(--' + (n.tone || 'primary') + '-color)'"><mat-icon>{{ n.icon || 'notifications' }}</mat-icon></span> }
                <div class="nf-body">
                  <div class="nf-title">{{ n.title }}</div>
                  @if (n.message) { <div class="nf-msg">{{ n.message }}</div> }
                  @if (n.actions?.length) {
                    <div class="nf-actions">@for (a of n.actions; track a.id) {
                      <button type="button" [class.primary]="a.primary" (click)="$event.stopPropagation(); action.emit({ notification: n, action: a.id }); markRead(n)">{{ a.label }}</button>
                    }</div>
                  }
                  <span class="nf-time">{{ ago(n.at) }}@if (n.category) { · {{ n.category }} }</span>
                </div>
                <div class="nf-side">
                  @if (!n.read) { <span class="nf-dot" (click)="$event.stopPropagation(); markRead(n)" matTooltip="Marquer comme lu"></span> }
                  <button type="button" class="nf-del" (click)="$event.stopPropagation(); remove(n)" matTooltip="Supprimer"><mat-icon>close</mat-icon></button>
                </div>
              </div>
            }
          } @empty {
            <div class="nf-empty"><mat-icon>{{ tab() === 'unread' ? 'mark_email_read' : 'notifications_off' }}</mat-icon>
              <strong>{{ tab() === 'unread' ? 'Vous êtes à jour' : 'Aucune notification' }}</strong>
              <span>{{ tab() === 'unread' ? 'Toutes les notifications ont été lues.' : 'Les nouvelles notifications apparaîtront ici.' }}</span></div>
          }
        </div>
        @if (footer()) { <button type="button" class="nf-foot" (click)="viewAll.emit(); opened.set(false)">{{ footer() }}<mat-icon>arrow_forward</mat-icon></button> }
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: inline-block; }
    .nc-bell { position: relative; width: 40px; height: 40px; border: none; border-radius: 50%; background: transparent; color: var(--text-secondary); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      &:hover, &.on { background: var(--hover-bg); color: var(--text-primary); } }
    .nc-count { position: absolute; top: 4px; right: 3px; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 9px; border: 2px solid var(--card-bg);
      background: var(--error-color); color: #fff; font: 700 10px/14px 'Inter', sans-serif; text-align: center;
      &.ping::after { content: ''; position: absolute; inset: -2px; border-radius: inherit; background: var(--error-color); animation: nc-ping 1s ease-out 2; z-index: -1; } }
    @keyframes nc-ping { to { transform: scale(2); opacity: 0; } }
  `],
})
export class NotificationCenterComponent {
  notifications = input<AppNotification[]>([]);
  /** L'hôte ne gère pas l'état lu / supprimé : le composant le fait localement. */
  manage = input(true, { transform: booleanAttribute });
  settings = input(true, { transform: booleanAttribute });
  footer = input('Voir toutes les notifications');

  open = output<AppNotification>();
  action = output<{ notification: AppNotification; action: string }>();
  readChange = output<{ ids: string[]; read: boolean }>();
  removed = output<AppNotification>();
  settingsClick = output<void>();
  viewAll = output<void>();

  readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
  ];
  opened = signal(false);
  tab = signal('all');
  ping = signal(false);
  list = linkedSignal(() => this.notifications().map((n) => ({ ...n })));
  private seen = new Set<string>();

  constructor() {
    // Nouvelle notification non lue (après le premier rendu) : petite animation de la pastille.
    effect(() => {
      const list = this.notifications();
      const fresh = this.seen.size > 0 && list.some((n) => !n.read && !this.seen.has(n.id));
      list.forEach((n) => this.seen.add(n.id));
      if (fresh) { untracked(() => this.ping.set(false)); setTimeout(() => this.ping.set(true)); }
    });
  }

  unread = computed(() => this.list().filter((n) => !n.read).length);
  tabs = computed(() => {
    const cats = [...new Set(this.list().map((n) => n.category).filter((c): c is string => !!c))];
    return [
      { id: 'all', label: 'Toutes', count: 0 },
      { id: 'unread', label: 'Non lues', count: this.unread() },
      ...cats.map((c) => ({ id: 'cat:' + c, label: c, count: this.list().filter((n) => n.category === c && !n.read).length })),
    ];
  });
  groups = computed(() => {
    const t = this.tab();
    const items = this.list()
      .filter((n) => t === 'all' || (t === 'unread' ? !n.read : n.category === t.slice(4)))
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
    const today = new Date().toDateString(), yest = new Date(Date.now() - 864e5).toDateString();
    const map = new Map<string, AppNotification[]>();
    for (const n of items) {
      const d = new Date(n.at).toDateString();
      const label = d === today ? 'Aujourd’hui' : d === yest ? 'Hier' : 'Plus ancien';
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(n);
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  });

  ago(at: string | Date): string {
    const s = (Date.now() - +new Date(at)) / 1000;
    if (s < 60) return 'à l’instant';
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    if (s < 172800) return 'hier';
    return new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  markRead(n: AppNotification): void {
    if (n.read) return;
    if (this.manage()) this.list.update((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    this.readChange.emit({ ids: [n.id], read: true });
  }
  markAll(): void {
    const ids = this.list().filter((n) => !n.read).map((n) => n.id);
    if (this.manage()) this.list.update((l) => l.map((x) => ({ ...x, read: true })));
    this.readChange.emit({ ids, read: true });
  }
  remove(n: AppNotification): void {
    if (this.manage()) this.list.update((l) => l.filter((x) => x.id !== n.id));
    this.removed.emit(n);
  }
  openItem(n: AppNotification): void { this.markRead(n); this.open.emit(n); }
}
