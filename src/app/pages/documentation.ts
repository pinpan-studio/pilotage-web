import { Component, ElementRef, OnDestroy, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { marked } from 'marked';
import { Api } from '../../api/genere/api';
import { projetsDocument, projetsDocuments, referentielsCatalogue } from '../../api/genere/functions';
import { DocumentDetailDto, DocumentDto } from '../../api/genere/models';
import { ancrer } from '../noyau/lecteur';
import { Chargement } from '../noyau/chargement';
import { Fichiers } from '../noyau/fichiers';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { Saisie } from '../noyau/saisie';
import { SchemasDirective } from '../noyau/schemas';
import { Statut } from '../noyau/statut';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { ProjetCourant } from './projet';

/** Teinte et icône par phase / document (couvertures des cartes, à la manière du blog du ui-kit). */
const TEINTES: Record<string, number> = { cadrage: 210, conception: 262, realisation: 160, recette: 32, deploiement: 190, cloture: 340, pilotage: 48 };
const ICONES: Record<string, string> = { TDR: 'gavel', 'NOTE-CADRAGE': 'flag', PLANNING: 'calendar_month', SFD: 'account_tree', DAT: 'hub', MCD: 'schema', SECURITE: 'security',
  'DOC-TECH': 'code_blocks', CHANGELOG: 'history', 'PLAN-RECETTE': 'checklist', 'CAHIER-RECETTE': 'fact_check', 'PV-RECETTE': 'verified', 'PLAN-DEPLOIEMENT': 'rocket_launch',
  'GUIDE-INSTALLATION': 'install_desktop', 'MANUEL-UTILISATEUR': 'menu_book', 'MANUEL-ADMIN': 'admin_panel_settings', DEX: 'dns', RAPPORTS: 'monitoring', 'CR-REUNIONS': 'groups',
  'REG-RISQUES': 'warning', 'REG-ACTIONS': 'task_alt', 'REG-CHANGEMENTS': 'change_circle', 'REG-PARTIES-PRENANTES': 'diversity_3', RACI: 'lan', MAQUETTES: 'design_services', CHARTE: 'palette' };
export const teinte = (phase: string) => TEINTES[phase] ?? 200;
export const icone = (code: string) => ICONES[code] ?? 'description';
const minutes = (md: string) => Math.max(1, Math.round(md.split(/\s+/).length / 220));
/** Documents mis en avant : rédigés, et indispensables ou remis au client. */
export const documentationVisible = (d: DocumentDto) => d.nb_versions > 0 && d.statut !== 'sans_objet' && (d.importance === 'indispensable' || d.livrable);

const STYLES_COMMUNS = `
  .cat { font: 600 11px/1.4 var(--font-body); text-transform: uppercase; letter-spacing: .06em; color: var(--mat-sys-primary); }
  .art { display: grid; place-items: center; background: hsl(var(--h) 26% 92%); } .art mat-icon { color: hsl(var(--h) 28% 38%); opacity: .75; }
  :host-context([data-mode=dark]) .art, :host-context(.dark) .art { background: hsl(var(--h) 14% 18%); } :host-context([data-mode=dark]) .art mat-icon, :host-context(.dark) .art mat-icon { color: hsl(var(--h) 30% 72%); }
  .meta { color: var(--mat-sys-on-surface-variant); font-size: 12px; }
`;

/** Documentation du projet — présentation à la manière d'un blog (examples/app/blog du ui-kit-html). */
@Component({
  selector: 'app-documentation',
  imports: [RouterLink, MatIconModule, MatButtonModule, Chargement, Statut, EmptyStateComponent, ...PIPES],
  styles: [STYLES_COMMUNS + `
    .masthead { max-width: 1180px; margin: var(--space-2) auto var(--space-8); text-align: center; }
    .masthead h1 { margin: var(--space-2) 0; font-size: clamp(28px, 4.6vw, 44px); font-weight: 700; letter-spacing: -.03em; line-height: 1.1; }
    .masthead p { margin: 0 auto; max-width: 60ch; color: var(--mat-sys-on-surface-variant); font-size: 16px; }
    .feature { max-width: 1180px; margin: 0 auto var(--space-8); display: grid; grid-template-columns: 1.15fr 1fr; overflow: hidden; text-decoration: none; color: inherit; border-radius: 20px; background: var(--card-bg, var(--mat-sys-surface-container-low)); }
    .feature:hover h2 { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; }
    .feature .art { min-height: 280px; } .feature .art mat-icon { font-size: 96px; width: 96px; height: 96px; }
    .f-body { display: flex; flex-direction: column; justify-content: center; gap: var(--space-3); padding: clamp(20px, 4vw, 44px); }
    .f-body h2 { margin: 0; font-size: clamp(22px, 3vw, 32px); font-weight: 700; letter-spacing: -.02em; line-height: 1.2; text-wrap: balance; }
    .f-body p { margin: 0; font-size: 15px; line-height: 1.6; color: var(--mat-sys-on-surface-variant); }
    .layout { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--space-8); align-items: start; }
    .cats { display: flex; gap: var(--space-2); margin-bottom: var(--space-5); overflow-x: auto; scrollbar-width: none; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--space-8) var(--space-5); }
    .post { display: flex; flex-direction: column; gap: var(--space-2); text-decoration: none; color: inherit; }
    .post .art { aspect-ratio: 16 / 10; border-radius: 14px; margin-bottom: var(--space-1); transition: transform .25s; } .post .art mat-icon { font-size: 46px; width: 46px; height: 46px; }
    .post h3 { margin: 0; font-size: 17px; line-height: 1.35; font-weight: 600; text-wrap: balance; }
    .post p { margin: 0; line-height: 1.55; font-size: 13.5px; color: var(--mat-sys-on-surface-variant); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .post:hover .art { transform: scale(1.02); } .post:hover h3 { color: var(--mat-sys-primary); }
    .side { position: sticky; top: 0; display: flex; flex-direction: column; gap: var(--space-4); }
    .side .card { padding: var(--space-5); border-radius: 18px; background: var(--card-bg, var(--mat-sys-surface-container-low)); } .side h3 { margin: 0 0 var(--space-3); font-size: 16px; font-weight: 600; }
    .ind { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 13px; } .ind a { color: inherit; text-decoration: none; flex: 1; min-width: 0; } .ind a:hover { color: var(--mat-sys-primary); }
    .ind mat-icon { font-size: 18px; width: 18px; height: 18px; } .ok { color: #2e7d32; } .ko { color: var(--mat-sys-on-surface-variant); opacity: .6; }
    .jauge { height: 6px; border-radius: 99px; background: var(--mat-sys-surface-container-highest); overflow: hidden; margin: 4px 0 12px; } .jauge span { display: block; height: 100%; background: var(--mat-sys-primary); }
    .recents ol { margin: 0; padding: 0; list-style: none; } .recents li { display: flex; gap: 12px; padding: 8px 0; } .rank { font-size: 20px; font-weight: 600; color: var(--mat-sys-on-surface-variant); min-width: 16px; }
    .recents a { font-weight: 500; line-height: 1.4; color: inherit; text-decoration: none; } .recents a:hover { color: var(--mat-sys-primary); }
    @media (max-width: 1100px) { .feature { grid-template-columns: 1fr; } .feature .art { min-height: 180px; } .layout { grid-template-columns: minmax(0, 1fr); } .side { position: static; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); } }`],
  template: `
  @if (!docs()) { <app-chargement forme="tableau-de-bord" /> }
  @else {
    <header class="masthead"><span class="text-overline">{{ p.detail()?.client || p.detail()?.code }} · documentation du projet</span><h1>{{ p.detail()?.nom }}</h1>
      <p>{{ p.detail()?.description || 'Cadrage, conception, réalisation, recette et déploiement : les documents de référence du projet, tenus à jour à partir des données de Pilotage.' }}</p></header>
    @if (une(); as d) {
      <a class="feature" [routerLink]="[d.code]"><div class="art" [style.--h]="teinte(d.phase)"><mat-icon>{{ icone(d.code) }}</mat-icon></div>
        <div class="f-body"><span class="cat">{{ phase(d.phase) }} · à la une</span><h2>{{ d.titre }}</h2><p>{{ resume(d) }}</p>
          <span class="meta">Version {{ d.version }} · <app-statut [code]="d.statut" /></span></div></a>
    }
    <div class="layout">
      <div>
        <nav class="cats" aria-label="Phases">
          <button type="button" class="chip-filter" [class.on]="!filtre()" (click)="filtre.set('')">Tous</button>
          @for (ph of phasesPresentes(); track ph) { <button type="button" class="chip-filter" [class.on]="filtre() === ph" (click)="filtre.set(ph)">{{ phase(ph) }}</button> }
        </nav>
        <div class="grid">
          @for (d of grille(); track d.id) {
            <a class="post" [routerLink]="[d.code]"><div class="art" [style.--h]="teinte(d.phase)"><mat-icon>{{ icone(d.code) }}</mat-icon></div>
              <span class="cat">{{ phase(d.phase) }}{{ d.importance === 'indispensable' ? ' · indispensable' : '' }}</span><h3>{{ d.titre }}</h3><p>{{ resume(d) }}</p>
              <small class="meta">v{{ d.version }} · {{ d.statut | libelle }}{{ d.livrable ? ' · livrable client' : '' }}</small></a>
          } @empty { <app-empty-state icon="menu_book" title="Aucun document rédigé" subtitle="Rédigez ou générez les livrables depuis l’onglet Livrables, ou demandez à l’agent : /document." /> }
        </div>
      </div>
      <aside class="side">
        <section class="card"><h3>Documents indispensables</h3>
          <div class="meta">{{ indispensablesRediges() }} / {{ indispensables().length }} rédigés</div>
          <div class="jauge"><span [style.width.%]="indispensables().length ? indispensablesRediges() / indispensables().length * 100 : 0"></span></div>
          @for (d of indispensables(); track d.id) {
            <div class="ind"><mat-icon [class]="d.nb_versions ? 'ok' : 'ko'">{{ d.nb_versions ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
              @if (d.nb_versions) { <a [routerLink]="[d.code]">{{ d.titre }}</a> } @else { <a [routerLink]="['/projets', p.code(), 'livrables', d.code]" title="À produire">{{ d.titre }}</a> }</div>
          }
        </section>
        <section class="card recents"><h3>Mis à jour récemment</h3><ol>
          @for (d of recents(); track d.id; let i = $index) { <li><span class="rank">{{ i + 1 }}</span><a [routerLink]="[d.code]">{{ d.titre }}</a></li> }</ol></section>
      </aside>
    </div>
  }`,
})
export class Documentation {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly ref = inject(ReferentielsService);
  readonly docs = signal<DocumentDto[] | null>(null);
  readonly filtre = signal('');
  readonly teinte = teinte; readonly icone = icone;
  phase = (c: string) => this.ref.phase(c);
  readonly visibles = computed(() => (this.docs() ?? []).filter(documentationVisible));
  readonly une = computed(() => this.visibles().find((d) => d.code === 'DAT') ?? this.visibles().find((d) => d.code === 'SFD') ?? this.visibles()[0] ?? null);
  readonly phasesPresentes = computed(() => [...new Set(this.visibles().map((d) => d.phase))]);
  readonly grille = computed(() => this.visibles().filter((d) => d !== this.une() && (!this.filtre() || d.phase === this.filtre())));
  readonly indispensables = computed(() => (this.docs() ?? []).filter((d) => d.importance === 'indispensable' && d.statut !== 'sans_objet'));
  readonly indispensablesRediges = computed(() => this.indispensables().filter((d) => d.nb_versions > 0).length);
  readonly recents = computed(() => [...this.visibles()].sort((a, b) => b.version.localeCompare(a.version, 'fr', { numeric: true })).slice(0, 5));
  resume(d: DocumentDto) { return d.notes || this.descriptions.get(d.code) || ''; }
  private readonly descriptions = new Map<string, string>();
  constructor() {
    effect(() => { const c = this.p.code(); if (c) this.api.invoke(projetsDocuments, { code: c }).then((l) => this.docs.set(l)); });
    this.api.invoke(referentielsCatalogue).then((c) => { for (const t of c.types) this.descriptions.set(t.code, t.description); this.docs.update((x) => (x ? [...x] : x)); }).catch(() => undefined);
  }
}

/** Lecture d'un document — mise en page d'article (examples/app/blog/mobile-money-paiement du ui-kit-html). */
@Component({
  selector: 'app-doc-article',
  imports: [RouterLink, MatIconModule, MatButtonModule, Chargement, Statut, SchemasDirective, ...PIPES],
  styles: [STYLES_COMMUNS + `
    :host { display: block; }
    .progress { position: sticky; top: 0; z-index: 5; height: 3px; margin: 0 0 4px; } .progress span { display: block; height: 100%; background: var(--mat-sys-primary); border-radius: 0 4px 4px 0; transition: width .1s linear; }
    .hero { max-width: 760px; margin: var(--space-3) auto var(--space-8); }
    .hero h1 { margin: var(--space-4) 0; font-size: clamp(28px, 5vw, 44px); font-weight: 700; letter-spacing: -.03em; line-height: 1.12; text-wrap: balance; }
    .dek { margin: 0 0 var(--space-5); font-size: clamp(16px, 2.1vw, 20px); line-height: 1.5; color: var(--mat-sys-on-surface-variant); }
    .crumbs { display: flex; align-items: center; gap: 2px; font-size: 13px; font-weight: 500; flex-wrap: wrap; } .crumbs a { color: var(--mat-sys-primary); text-decoration: none; } .crumbs span { color: var(--mat-sys-on-surface-variant); } .crumbs mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .byline { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; padding: var(--space-3) 0; }
    .ava { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 600; flex: none; }
    .who { display: flex; flex-direction: column; } .who span { font-size: 13px; color: var(--mat-sys-on-surface-variant); } .spacer { flex: 1; }
    .reading { display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: 99px; background: var(--mat-sys-surface-container-high); }
    .reading i { width: 1px; height: 18px; margin: 0 3px; background: var(--mat-sys-outline-variant); }
    .reading button { min-width: 34px; height: 30px; padding: 0 8px; border: 0; border-radius: 99px; background: none; color: var(--mat-sys-on-surface-variant); cursor: pointer; }
    .reading button.on { background: var(--mat-sys-surface); color: var(--mat-sys-on-surface); }
    .cover { max-width: 1100px; margin: 0 auto var(--space-10); height: clamp(120px, 18vw, 200px); border-radius: 22px; } .cover mat-icon { font-size: 72px; width: 72px; height: 72px; }
    .layout { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 200px minmax(0, 720px) 56px; justify-content: center; gap: var(--space-10); align-items: start; }
    .toc { position: sticky; top: 16px; } .toc ol { margin: var(--space-3) 0 0; padding: 0; list-style: none; border-left: 2px solid var(--mat-sys-outline-variant); }
    .toc li.sub a { padding-left: 26px; font-size: 12.5px; }
    .toc a { display: block; margin-left: -2px; padding: 7px 12px 7px 16px; border-left: 2px solid transparent; font-size: 13px; line-height: 1.4; color: var(--mat-sys-on-surface-variant); text-decoration: none; cursor: pointer; }
    .toc a:hover { color: var(--mat-sys-on-surface); } .toc a.on { border-left-color: var(--mat-sys-primary); color: var(--mat-sys-primary); font-weight: 600; }
    .main { min-width: 0; } .main .prose { max-width: none; } .main.lg .prose { font-size: 17px; line-height: 1.75; } .main.serif .prose { font-family: Georgia, 'Times New Roman', serif; }
    .rail { position: sticky; top: 16px; display: flex; flex-direction: column; gap: var(--space-2); }
    .rail button { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 54px; padding: 8px 0; border: 0; border-radius: 16px; background: none; color: var(--mat-sys-on-surface-variant); cursor: pointer; }
    .rail b { font-size: 11px; font-weight: 600; } .rail button:hover { background: var(--mat-sys-surface-container-high); color: var(--mat-sys-on-surface); }
    .fin { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-5); margin: var(--space-8) 0; border-radius: 18px; background: var(--mat-sys-surface-container-low); flex-wrap: wrap; }
    .fin > div { flex: 1 1 260px; } .fin p { margin: 4px 0 0; color: var(--mat-sys-on-surface-variant); font-size: 13.5px; }
    .related { max-width: 1100px; margin: 0 auto var(--space-8); padding-top: var(--space-6); } .related h2 { margin: 0 0 var(--space-5); font-size: 20px; font-weight: 600; }
    .rel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-4); }
    .rel { display: flex; gap: var(--space-4); padding: var(--space-3); border-radius: 16px; text-decoration: none; color: inherit; background: var(--mat-sys-surface-container-low); }
    .rel:hover strong { color: var(--mat-sys-primary); } .rel .art { width: 76px; flex: none; aspect-ratio: 1; border-radius: 12px; }
    .rel > div:last-child { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    @media (max-width: 1100px) { .layout { grid-template-columns: minmax(0, 720px); gap: 0; } .toc { display: none; }
      .rail { position: fixed; z-index: 10; left: 50%; bottom: 20px; top: auto; transform: translateX(-50%); flex-direction: row; padding: 4px 8px; border-radius: 99px; background: var(--mat-sys-surface-container-high); box-shadow: 0 4px 16px rgb(0 0 0 / .18); }
      .rail button { flex-direction: row; width: auto; padding: 8px 12px; gap: 6px; } }`],
  template: `
  <div class="progress" role="progressbar" aria-label="Progression de lecture" [attr.aria-valuenow]="progression()"><span [style.width.%]="progression()"></span></div>
  @if (d(); as d) {
    <header class="hero">
      <nav class="crumbs" aria-label="Fil d'Ariane"><a [routerLink]="['/projets', p.code(), 'documentation']">Documentation</a><mat-icon>chevron_right</mat-icon><span>{{ phase(d.phase) }}</span></nav>
      <h1>{{ d.titre }}</h1>
      @if (d.description) { <p class="dek">{{ d.description }}</p> }
      <div class="byline">
        <span class="ava" [style.background]="couleur(d.version_courante?.auteur ?? '')">{{ initiales(d.version_courante?.auteur ?? '?') }}</span>
        <div class="who"><strong>{{ d.version_courante?.auteur || 'Équipe projet' }}@if (d.version_courante?.auteur_type === 'agent') { · agent IA }</strong>
          <span>Version {{ d.version_courante?.numero }} du {{ d.version_courante?.cree_le | dateFr }} · {{ minutes() }} min de lecture</span></div>
        <app-statut [code]="d.statut" />
        <span class="spacer"></span>
        <div class="reading" role="group" aria-label="Réglages de lecture">
          <button type="button" [class.on]="!grand()" (click)="grand.set(false)" title="Texte standard"><span style="font: 600 12px var(--font-body)">A</span></button>
          <button type="button" [class.on]="grand()" (click)="grand.set(true)" title="Grand texte"><span style="font: 600 17px var(--font-body)">A</span></button><i></i>
          <button type="button" [class.on]="!serif()" (click)="serif.set(false)" title="Sans empattement"><span style="font: 600 14px var(--font-body)">Aa</span></button>
          <button type="button" [class.on]="serif()" (click)="serif.set(true)" title="Avec empattement"><span style="font: 600 15px Georgia, serif">Aa</span></button>
        </div>
      </div>
    </header>
    <div class="cover art" [style.--h]="teinte(d.phase)"><mat-icon>{{ icone(d.code) }}</mat-icon></div>
    <div class="layout">
      <aside class="toc" aria-label="Sommaire"><span class="text-overline">Sommaire</span><ol>
        @for (t of rendu().sommaire; track t.id) { <li [class.sub]="t.niveau === 3"><a [class.on]="actif() === t.id" (click)="aller(t.id)">{{ t.texte }}</a></li> }</ol></aside>
      <article class="main" [class.lg]="grand()" [class.serif]="serif()">
        <div #corps class="prose" appSchemas [innerHTML]="rendu().html"></div>
        <section class="fin">
          <span class="ava" style="background: var(--mat-sys-primary)"><mat-icon>description</mat-icon></span>
          <div><span class="text-overline">{{ d.code }} · {{ d.importance === 'indispensable' ? 'document indispensable' : 'document facultatif' }}{{ d.livrable ? ' · livrable client' : '' }}</span>
            <p>{{ d.versions.length }} version(s). Le contenu se modifie et se valide dans l’onglet Livrables{{ d.generable ? ' ; il peut être régénéré à partir des données du projet' : '' }}.</p></div>
          <a mat-stroked-button [routerLink]="['/projets', p.code(), 'livrables', d.code]"><mat-icon>edit_note</mat-icon>Ouvrir dans Livrables</a>
        </section>
      </article>
      <aside class="rail" aria-label="Actions">
        <button type="button" (click)="exporter('pdf')" title="Télécharger en PDF"><mat-icon>picture_as_pdf</mat-icon><b>PDF</b></button>
        <button type="button" (click)="exporter('docx')" title="Télécharger en Word"><mat-icon>description</mat-icon><b>Word</b></button>
        <button type="button" (click)="copier()" title="Copier le lien"><mat-icon>{{ copie() ? 'check' : 'ios_share' }}</mat-icon><b>Lien</b></button>
        <button type="button" (click)="haut()" title="Haut de page"><mat-icon>vertical_align_top</mat-icon><b>Haut</b></button>
      </aside>
    </div>
    @if (suite().length) {
      <section class="related"><h2>À lire ensuite</h2><div class="rel-grid">
        @for (r of suite(); track r.id) { <a class="rel" [routerLink]="['/projets', p.code(), 'documentation', r.code]"><div class="art" [style.--h]="teinte(r.phase)"><mat-icon>{{ icone(r.code) }}</mat-icon></div>
          <div><span class="cat">{{ phase(r.phase) }}</span><strong>{{ r.titre }}</strong><small class="meta">v{{ r.version }} · {{ r.statut | libelle }}</small></div></a> }
      </div></section>
    }
  } @else { <app-chargement forme="document" /> }`,
})
export class DocArticle implements OnDestroy {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly ref = inject(ReferentielsService);
  private readonly fichiers = inject(Fichiers);
  private readonly s = inject(Saisie);
  private readonly hote = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  readonly doc = input.required<string>();
  readonly d = signal<DocumentDetailDto | null>(null);
  readonly docs = signal<DocumentDto[]>([]);
  readonly grand = signal(false); readonly serif = signal(false); readonly copie = signal(false);
  readonly progression = signal(0); readonly actif = signal('');
  readonly teinte = teinte; readonly icone = icone;
  phase = (c: string) => this.ref.phase(c);
  /** Le titre est dans l'en-tête : on retire le titre de niveau 1 qui ouvre le document. */
  readonly rendu = computed(() => ancrer(marked.parse((this.d()?.version_courante?.contenu ?? '').replace(/^\s*# .*\n+/, ''), { async: false }) as string));
  readonly minutes = computed(() => minutes(this.d()?.version_courante?.contenu ?? ''));
  readonly suite = computed(() => { const v = this.docs().filter(documentationVisible); const i = v.findIndex((x) => x.code === this.doc()); return [...v.slice(i + 1), ...v.slice(0, Math.max(i, 0))].filter((x) => x.code !== this.doc()).slice(0, 3); });
  private defileur: HTMLElement | null = null;
  private readonly surDefilement = () => this.mesurer();
  constructor() {
    effect(() => { const c = this.p.code(), doc = this.doc(); if (c && doc) { this.d.set(null); this.api.invoke(projetsDocument, { code: c, doc }).then((x) => { this.d.set(x); setTimeout(() => this.attacher(), 50); }); } });
    effect(() => { const c = this.p.code(); if (c) this.api.invoke(projetsDocuments, { code: c }).then((l) => this.docs.set(l)); });
  }
  private attacher() {
    this.defileur?.removeEventListener('scroll', this.surDefilement);
    this.defileur = this.hote.closest('.content') as HTMLElement | null ?? document.scrollingElement as HTMLElement;
    this.defileur.addEventListener('scroll', this.surDefilement, { passive: true }); this.defileur.scrollTop = 0; this.mesurer();
  }
  ngOnDestroy() { this.defileur?.removeEventListener('scroll', this.surDefilement); }
  private mesurer() {
    const s = this.defileur; if (!s) return;
    const max = s.scrollHeight - s.clientHeight; this.progression.set(max > 0 ? Math.min(100, Math.round(s.scrollTop / max * 100)) : 0);
    const haut = s.getBoundingClientRect().top + 120; let cur = '';
    this.hote.querySelectorAll<HTMLElement>('.prose h2[id], .prose h3[id]').forEach((h) => { if (h.getBoundingClientRect().top < haut) cur = h.id; });
    this.actif.set(cur);
  }
  aller(id: string) { this.hote.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  haut() { this.defileur?.scrollTo({ top: 0, behavior: 'smooth' }); }
  exporter(f: 'pdf' | 'docx') { const d = this.d()!; this.fichiers.telecharger(`/projets/${this.p.code()}/documents/${d.code}/export?format=${f}`, `${d.code}.${f}`).catch((e) => this.s.erreur(e)); }
  copier() { navigator.clipboard?.writeText(location.href).then(() => { this.copie.set(true); setTimeout(() => this.copie.set(false), 1600); }).catch(() => undefined); }
  initiales = (n: string) => n.split(/\s+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase() || '?';
  couleur(n: string) { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 45% 45%)`; }
}
