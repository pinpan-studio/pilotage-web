import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Api } from '../../api/genere/api';
import { notificationsLister, projetsDocuments } from '../../api/genere/functions';
import { documentationVisible, icone } from '../pages/documentation';
import { NotificationDto } from '../../api/genere/models';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { filter } from 'rxjs';
import { ThemeService } from '../core/services/theme.service';
import { ThemePickerComponent } from '../shared/components/theme-picker/theme-picker.component';
import { AppNotification, CommandPaletteService, KbdComponent, NotificationCenterComponent, PaletteCommand } from '../shared/components/interaction';
import { AuthService } from '../noyau/auth.service';
import { NavigationService, ONGLETS_PROJET } from '../noyau/navigation.service';
import { EquipeService } from '../noyau/equipe.service';
import { LibellePipe } from '../noyau/pipes';

interface Entree { label: string; icon: string; path: string; exact?: boolean; badge?: number | null }
interface Groupe { label: string; icon: string; items: Entree[]; collapsible?: boolean }


/**
 * Coquille de l'application — reprend la sidenav et la barre d'outils des écrans d'exemple du UI-Kit
 * (examples/app/ex-app-shell) : carte flottante sans ombre, recherche, sections titrées, palette ⌘K,
 * centre de notifications, menu du compte.
 */
@Component({
  selector: 'app-coquille',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatSidenavModule, MatToolbarModule, MatIconModule, MatButtonModule, MatTooltipModule, MatMenuModule, MatDividerModule,
    ThemePickerComponent, NotificationCenterComponent, KbdComponent, LibellePipe],
  styleUrl: './coquille.scss',
  template: `
  <mat-sidenav-container class="kit-container">
    <mat-sidenav #sidenav class="kit-sidenav" [mode]="mobile() ? 'over' : 'side'" [opened]="!mobile()">
      <div class="sidenav-inner">
        <div class="sidenav-header">
          <span class="brand-logo brand-mark"><mat-icon>insights</mat-icon></span>
          <button type="button" class="header-text equipe-btn" [matMenuTriggerFor]="menuEquipes" aria-label="Changer d'équipe">
            <span class="app-title">{{ eq.courante()?.nom ?? 'Pilotage' }}</span><span class="app-subtitle">{{ eq.courante() ? (eq.courante()!.role | libelle) : 'Espace de travail' }} <mat-icon>unfold_more</mat-icon></span>
          </button>
          <mat-menu #menuEquipes="matMenu" class="m3-dropdown-menu">
            <div class="menu-me"><strong>Espaces de travail</strong><small>Chaque équipe a ses projets et ses membres</small></div>
            <mat-divider />
            @for (e of eq.equipes(); track e.id) {
              <button mat-menu-item (click)="!e.courante && eq.changer(e.id)"><mat-icon>{{ e.courante ? 'check' : 'workspaces' }}</mat-icon>{{ e.nom }}<span class="muted" style="margin-left: 8px; font-size: 12px">{{ e.nb_projets }} projet(s)</span></button>
            }
            <mat-divider />
            <a mat-menu-item routerLink="/parametres/equipe"><mat-icon>group</mat-icon>Gérer l'équipe</a>
            <a mat-menu-item routerLink="/parametres/equipes"><mat-icon>add</mat-icon>Créer une équipe</a>
          </mat-menu>
          @if (mobile()) { <button mat-icon-button (click)="sidenav.close()" class="close-drawer-btn" aria-label="Fermer le menu"><mat-icon>chevron_left</mat-icon></button> }
        </div>
        <div class="nav-search">
          <mat-icon>search</mat-icon>
          <input type="text" placeholder="Rechercher une page, un projet…" [value]="recherche()" (input)="recherche.set($any($event.target).value)" />
          @if (recherche()) { <button type="button" class="clear" (click)="recherche.set('')" aria-label="Effacer"><mat-icon>close</mat-icon></button> }
        </div>
        <div class="sidenav-menu-wrapper" (click)="mobile() && $any($event.target).closest('a') && sidenav.close()">
          <div class="menu-section">
            @for (n of haut; track n.path) { @if (correspond(n.label)) {
              <a class="menu-item top" [routerLink]="n.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!n.exact }"><mat-icon class="item-icon">{{ n.icon }}</mat-icon><span class="item-label">{{ n.label }}</span></a>
            } }
          </div>
          @for (g of groupes(); track g.label) { @if (groupeVisible(g)) {
            <div class="menu-section">
              @if (g.collapsible) {
                <button type="button" class="section-header clickable" (click)="basculer(g.label)"><mat-icon class="section-icon">{{ g.icon }}</mat-icon><span class="section-title">{{ g.label }}</span><span class="spacer"></span><mat-icon class="chevron" [class.open]="ouvert(g.label)">expand_more</mat-icon></button>
              } @else { <div class="section-header"><mat-icon class="section-icon">{{ g.icon }}</mat-icon><span class="section-title">{{ g.label }}</span></div> }
              @if (!g.collapsible || ouvert(g.label) || recherche()) {
                <div class="section-items">
                  @for (n of g.items; track n.path) { @if (correspond(n.label) || correspond(g.label)) {
                    <a class="menu-item" [routerLink]="n.path" routerLinkActive="active"><mat-icon class="item-icon">{{ n.icon }}</mat-icon><span class="item-label">{{ n.label }}</span>@if (n.badge) { <span class="count">{{ n.badge }}</span> }</a>
                  } }
                </div>
              }
            </div>
          } }
        </div>
      </div>
    </mat-sidenav>

    <mat-sidenav-content class="kit-main">
      <mat-toolbar class="kit-toolbar">
        <button mat-icon-button (click)="sidenav.toggle()" [attr.aria-label]="sidenav.opened ? 'Masquer le menu' : 'Afficher le menu'"><mat-icon>{{ sidenav.opened ? 'menu_open' : 'menu' }}</mat-icon></button>
        <span class="toolbar-title">@if (fil()) { <span class="crumb">{{ fil() }}</span><mat-icon class="sep">chevron_right</mat-icon> }<span class="cur">{{ titre() }}</span></span>
        <span class="spacer"></span>
        <button type="button" class="palette-btn" (click)="palette.open()" aria-label="Rechercher (⌘K)"><mat-icon>search</mat-icon><span class="pb-label">Rechercher…</span><app-kbd keys="mod+k" class="pb-kbd" /></button>
        <button mat-icon-button class="hide-sm" (click)="theme.toggle()" [matTooltip]="theme.mode() === 'light' ? 'Mode sombre' : 'Mode clair'"><mat-icon>{{ theme.mode() === 'light' ? 'dark_mode' : 'light_mode' }}</mat-icon></button>
        <app-theme-picker class="hide-sm" />
        <app-notification-center [notifications]="notifications()" [manage]="false" [settings]="false" footer="Actualiser" (viewAll)="chargerNotifications()" (open)="ouvrirNotification($event)" (readChange)="marquer($event)" />
        <button type="button" class="avatar-btn" [matMenuTriggerFor]="moi" aria-label="Mon compte">
          @if (auth.utilisateur()?.photo_url) { <img class="avatar" [src]="auth.utilisateur()!.photo_url" alt="" referrerpolicy="no-referrer" style="object-fit: cover" /> } @else { <span class="avatar">{{ initiales() }}</span> }
        </button>
        <mat-menu #moi="matMenu" xPosition="before" class="m3-dropdown-menu">
          <div class="menu-me"><strong>{{ auth.utilisateur()?.nom }}</strong><small>{{ auth.utilisateur()?.email }}</small></div>
          <mat-divider />
          <a mat-menu-item routerLink="/parametres/compte"><mat-icon>person</mat-icon>Mon compte</a>
          <a mat-menu-item routerLink="/parametres/securite"><mat-icon>shield</mat-icon>Sécurité et sessions</a>
          <button mat-menu-item (click)="palette.open()"><mat-icon>keyboard_command_key</mat-icon>Commandes<app-kbd class="menu-kbd" keys="mod+k" /></button>
          <mat-divider />
          <button mat-menu-item (click)="auth.deconnexion()"><mat-icon>logout</mat-icon>Se déconnecter</button>
        </mat-menu>
      </mat-toolbar>
      <main class="content"><router-outlet /></main>
    </mat-sidenav-content>
  </mat-sidenav-container>`,
})
export class Coquille {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly palette = inject(CommandPaletteService);
  readonly nav = inject(NavigationService);
  readonly eq = inject(EquipeService);
  private readonly router = inject(Router);
  readonly mobile = signal(false);
  readonly recherche = signal('');
  readonly titre = signal('Portefeuille');
  readonly fil = signal('');
  private readonly ouverts = signal<Record<string, boolean>>({ Projets: true });

  readonly haut: Entree[] = [{ label: 'Portefeuille', icon: 'space_dashboard', path: '/', exact: true }];
  readonly espace = computed(() => 'Espace de travail');
  readonly groupes = computed<Groupe[]>(() => {
    const g: Groupe[] = [];
    const code = this.nav.projetCourant();
    const p = this.nav.projet(code);
    if (code) g.push({ label: p?.nom ?? code, icon: 'folder_open', items: ONGLETS_PROJET.map((o) => ({ label: o.label, icon: o.icon, path: `/projets/${code}/${o.seg}`,
      badge: o.seg === 'synthese' ? (p?.nb_alertes.haute || null) : null })) });
    // Documentation importante du projet courant, directement dans le menu.
    const docs = this.docsProjet().filter((d) => d.projet === code);
    if (code && docs.length) g.push({ label: 'Documentation', icon: 'menu_book', items: [
      { label: 'Vue d’ensemble', icon: 'auto_stories', path: `/projets/${code}/documentation` },
      ...docs.map((d) => ({ label: d.titre, icon: icone(d.code), path: `/projets/${code}/documentation/${d.code}`, badge: null })) ] });
    const autres = (this.nav.projets() ?? []).filter((x) => x.code !== code);
    if (autres.length) g.push({ label: 'Projets', icon: 'folder', collapsible: true, items: autres.map((x) => ({ label: x.nom, icon: 'folder', path: `/projets/${x.code}`, badge: x.nb_alertes.haute || null })) });
    g.push({ label: 'Équipe', icon: 'groups', items: [
      { label: 'Membres et rôles', icon: 'group', path: '/parametres/equipe' },
      { label: 'Mes équipes', icon: 'workspaces', path: '/parametres/equipes' },
      { label: 'Catalogue documentaire', icon: 'library_books', path: '/parametres/catalogue' },
      { label: 'Assistants IA (MCP)', icon: 'smart_toy', path: '/parametres/claude-code' },
    ] });
    g.push({ label: 'Compte', icon: 'manage_accounts', items: [
      { label: 'Mon compte', icon: 'person', path: '/parametres/compte' },
      { label: 'Sécurité', icon: 'shield', path: '/parametres/securite' },
    ] });
    return g;
  });
  /** Documents rédigés et importants du projet courant (menu « Documentation »). */
  private readonly docsProjet = signal<{ projet: string; code: string; titre: string }[]>([]);
  private chargerDocs(code: string | null) {
    if (!code) { this.docsProjet.set([]); return; }
    this.api.invoke(projetsDocuments, { code }).then((l) => this.docsProjet.set(l.filter(documentationVisible).map((d) => ({ projet: code, code: d.code, titre: d.titre })))).catch(() => this.docsProjet.set([]));
  }
  /** « À traiter » (API, selon le rôle sur chaque projet) + alertes hautes du portefeuille. L'état « lu » est mémorisé par navigateur. */
  private readonly api = inject(Api);
  private readonly aTraiter = signal<NotificationDto[]>([]);
  private readonly lues = signal<Set<string>>(new Set(JSON.parse((() => { try { return localStorage.getItem('pilotage.notifs.lues') ?? '[]'; } catch { return '[]'; } })())));
  private static readonly ICONES: Record<string, [string, string]> = { document_en_revue: ['rate_review', 'info'], changement_a_decider: ['change_circle', 'warning'], fonctionnalite_a_valider: ['verified', 'success'],
    retour_nouveau: ['forum', 'primary'], jalon_proche: ['flag', 'warning'], action_en_retard: ['schedule', 'error'] };
  readonly notifications = computed<AppNotification[]>(() => [
    ...this.aTraiter().map((n) => ({ id: n.id, title: n.titre, message: `${n.projet_nom} — ${n.detail}`, at: new Date(n.date ?? Date.now()), read: this.lues().has(n.id),
      icon: Coquille.ICONES[n.type]?.[0] ?? 'notifications', tone: n.priorite === 'haute' ? 'error' : Coquille.ICONES[n.type]?.[1] ?? 'primary', category: 'À traiter' })),
    ...(this.nav.projets() ?? []).filter((p) => p.nb_alertes.haute).map((p) => ({
      id: 'alerte:' + p.id + ':' + p.nb_alertes.haute, title: p.nom, message: `${p.nb_alertes.haute} alerte(s) haute(s) · ${p.nb_retours_ouverts} retour(s) client ouvert(s)`,
      at: new Date(p.derniere_activite ?? Date.now()), read: this.lues().has('alerte:' + p.id + ':' + p.nb_alertes.haute), icon: 'warning', tone: 'error', category: 'Alertes' })),
  ]);
  chargerNotifications() { this.api.invoke(notificationsLister).then((l) => this.aTraiter.set(l)).catch(() => undefined); }
  marquer(e: { ids: string[]; read: boolean }) {
    const s = new Set(this.lues()); e.ids.forEach((id) => (e.read ? s.add(id) : s.delete(id))); this.lues.set(s);
    try { localStorage.setItem('pilotage.notifs.lues', JSON.stringify([...s].slice(-500))); } catch { /* stockage indisponible */ }
  }
  ouvrirNotification(n: AppNotification) {
    this.marquer({ ids: [n.id], read: true });
    const cible = this.aTraiter().find((x) => x.id === n.id);
    if (cible) this.router.navigateByUrl(cible.lien);
    else if (n.id.startsWith('alerte:')) { const p = (this.nav.projets() ?? []).find((x) => n.id.startsWith('alerte:' + x.id)); if (p) this.router.navigate(['/projets', p.code, 'synthese']); }
  }
  readonly initiales = computed(() => (this.auth.utilisateur()?.nom ?? '?').split(/\s+/).filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase());

  constructor() {
    inject(BreakpointObserver).observe('(max-width: 959.98px)').subscribe((r) => this.mobile.set(r.matches));
    this.nav.chargerProjets();
    this.eq.charger();
    this.chargerNotifications();
    effect(() => { const c = this.nav.projetCourant(); untracked(() => this.chargerDocs(c)); });
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => { const c = this.nav.projetCourant(); if (c && /\/(livrables|documentation)/.test(this.router.url)) this.chargerDocs(c); });
    const minuteur = setInterval(() => this.chargerNotifications(), 120_000);
    inject(DestroyRef).onDestroy(() => clearInterval(minuteur));
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.majTitre());
    this.majTitre();
    let desinscrire = () => {};
    effect(() => {
      desinscrire();
      const cmds: PaletteCommand[] = [
        { id: 'nav-portefeuille', label: 'Portefeuille', group: 'Aller à', icon: 'space_dashboard', route: '/' },
        ...(this.nav.projets() ?? []).flatMap((p) => ONGLETS_PROJET.map((o) => ({ id: `nav-${p.code}-${o.seg}`, label: `${p.nom} — ${o.label}`, group: 'Projets', icon: o.icon, route: `/projets/${p.code}/${o.seg}` }))),
        { id: 'nav-compte', label: 'Mon compte', group: 'Compte', icon: 'person', route: '/parametres/compte' },
        { id: 'nav-equipe', label: 'Membres et rôles de l’équipe', group: 'Équipe', icon: 'group', route: '/parametres/equipe' },
        { id: 'nav-claude', label: 'Brancher un assistant IA (MCP : Claude, Cursor, Codex, Gemini…)', group: 'Équipe', icon: 'smart_toy', route: '/parametres/claude-code' },
        { id: 'nav-nouveau-projet', label: 'Nouveau projet', group: 'Actions', icon: 'create_new_folder', route: '/projets-nouveau' },
        ...this.eq.equipes().filter((e) => !e.courante).map((e) => ({ id: `eq-${e.id}`, label: `Passer à l’équipe ${e.nom}`, group: 'Équipe', icon: 'workspaces', action: () => this.eq.changer(e.id) })),
        { id: 'nav-securite', label: 'Sécurité et sessions', group: 'Compte', icon: 'shield', route: '/parametres/securite' },
        { id: 'theme', label: 'Changer de thème clair / sombre', group: 'Actions', icon: 'contrast', action: () => this.theme.toggle() },
        { id: 'deconnexion', label: 'Se déconnecter', group: 'Compte', icon: 'logout', action: () => this.auth.deconnexion() },
      ];
      desinscrire = this.palette.register(cmds);
    });
    this.palette.enableHotkey();
    inject(DestroyRef).onDestroy(() => desinscrire());
  }

  private majTitre() {
    let r = this.router.routerState.snapshot.root; let t = 'Portefeuille'; let f = '';
    while (r) { if (r.data['titre']) t = r.data['titre']; if (r.data['fil']) f = r.data['fil']; r = r.firstChild!; }
    const code = /^\/projets\/([^/?#]+)/.exec(this.router.url)?.[1];
    if (code) f = this.nav.projet(decodeURIComponent(code))?.nom ?? decodeURIComponent(code);
    this.titre.set(t); this.fil.set(f);
  }
  correspond(l: string) { const q = this.recherche().trim().toLowerCase(); return !q || l.toLowerCase().includes(q); }
  groupeVisible(g: Groupe) { return this.correspond(g.label) || g.items.some((n) => this.correspond(n.label)); }
  ouvert(l: string) { return !!this.ouverts()[l]; }
  basculer(l: string) { this.ouverts.update((o) => ({ ...o, [l]: !o[l] })); }
}
