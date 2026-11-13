import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Api } from '../../api/genere/api';
import { projetsDocument, projetsDocuments } from '../../api/genere/functions';
import { DocumentDetailDto, DocumentDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { Statut, tonDeCouleur } from '../noyau/statut';
import { date } from '../noyau/format';
import { DataColumn, DataTableComponent } from '../shared/components/data/data-table.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { ProjetCourant } from './projet';

interface Ligne { id: string; code: string; titre: string; statut: string; statut_code: string; version: string; echeance: string; retard: boolean; responsable: string; producteur: string; }

@Component({
  selector: 'app-livrables',
  imports: [MatIconModule, DataTableComponent, ...PIPES],
  template: `
  @if (p.indicateurs(); as m) {
    <div class="kpis">@for (ph of m.documents_par_phase; track ph.code) {
      <div class="card kpi"><span class="k-label"><mat-icon>folder_open</mat-icon>{{ ph.titre }}</span><span class="k-val">{{ ph.avancement | pct }}</span><span class="k-foot">{{ ph.finalises }} / {{ ph.nb }} finalisé(s)</span></div> }
    </div>
  }
  <div class="toolbar-row">
    <button type="button" class="chip-filter" [class.on]="!phase()" (click)="phase.set('')">Toutes les phases<span class="n">{{ docs().length }}</span></button>
    @for (ph of phases(); track ph.code) { <button type="button" class="chip-filter" [class.on]="phase() === ph.code" (click)="phase.set(ph.code)">{{ ph.titre }}<span class="n">{{ ph.nb }}</span></button> }
  </div>
  <section class="card"><app-data-table [rows]="lignes()" [columns]="colonnes" rowKey="id" [pageSize]="50" maxHeight="none" clickable (rowClick)="ouvrir($event)" /></section>`,
})
export class Livrables {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly ref = inject(ReferentielsService);
  private readonly router = inject(Router);
  readonly docs = signal<DocumentDto[]>([]);
  readonly phase = signal('');
  readonly colonnes: DataColumn<Ligne>[] = [
    { key: 'code', label: 'Code', type: 'mono', sortable: true, width: 150, required: true },
    { key: 'titre', label: 'Document', sortable: true, minWidth: 260, required: true },
    { key: 'statut', label: 'Statut', type: 'badge', sortable: true, width: 130, tone: (r) => tonDeCouleur(this.ref.couleur(r.statut_code)) },
    { key: 'version', label: 'Version', width: 90 },
    { key: 'echeance', label: 'Échéance', width: 120, type: 'badge', tone: (r) => (r.retard ? 'error' : 'neutral') },
    { key: 'responsable', label: 'Responsable', width: 160 },
    { key: 'producteur', label: 'Producteur', width: 130 },
  ];
  readonly phases = computed(() => (this.ref.donnees()?.phases ?? []).map((ph) => ({ code: ph.code, titre: ph.libelle, nb: this.docs().filter((d) => d.phase === ph.code).length })).filter((x) => x.nb));
  readonly lignes = computed<Ligne[]>(() => {
    const auj = this.p.indicateurs()?.date_calcul ?? '';
    return this.docs().filter((d) => !this.phase() || d.phase === this.phase()).map((d) => ({
      id: d.id, code: d.code, titre: d.titre, statut: this.ref.libelle(d.statut), statut_code: d.statut, version: d.version || '—',
      echeance: d.echeance_effective ? date(d.echeance_effective) : '', retard: !!d.echeance_effective && !['valide', 'signe', 'sans_objet'].includes(d.statut) && d.echeance_effective < auj,
      responsable: d.responsable || '—', producteur: this.ref.libelle(d.producteur),
    }));
  });
  constructor() { effect(() => { const c = this.p.code(); if (c) this.api.invoke(projetsDocuments, { code: c }).then((l) => this.docs.set(l)); }); }
  ouvrir(l: Ligne) { this.router.navigate(['/projets', this.p.code(), 'livrables', l.code]); }
}

@Component({
  selector: 'app-document',
  imports: [RouterLink, MatIconModule, Statut, EmptyStateComponent, ...PIPES],
  template: `
  <a routerLink=".." class="crumbs" style="text-decoration: none"><mat-icon>arrow_back</mat-icon>Tous les livrables</a>
  @if (d(); as d) {
    <div class="grid-aside">
      <article class="card"><div class="card-body" style="padding: 28px 32px">
        @if (d.version_courante) { <div class="prose" [innerHTML]="d.version_courante.contenu | md"></div> }
        @else { <app-empty-state icon="draft" title="Aucun contenu" [subtitle]="d.lien_externe ? 'Ce document est conservé hors de Pilotage.' : 'Ce document n’a pas encore été rédigé.'" />
          @if (d.lien_externe) { <p style="text-align:center"><a [href]="d.lien_externe" target="_blank" rel="noopener">Ouvrir le document externe</a></p> } }
      </div></article>
      <aside>
        <section class="card" style="margin-bottom: 16px"><div class="card-head"><h2>{{ d.code }}</h2><app-statut [code]="d.statut" /></div><div class="card-body">
          <dl class="kv"><dt>Titre</dt><dd>{{ d.titre }}</dd><dt>Version</dt><dd>{{ d.version || '—' }}</dd><dt>Échéance</dt><dd>{{ d.echeance_effective | dateFr }}</dd>
            <dt>Producteur</dt><dd>{{ d.producteur | libelle }}</dd><dt>Validé le</dt><dd>{{ d.date_validation | dateFr }}</dd><dt>Scans signés</dt><dd>{{ d.nb_scans }}</dd></dl>
          @if (d.description) { <p class="muted" style="font-size: var(--fs-caption); margin: 12px 0 0">{{ d.description }}</p> }
        </div></section>
        <section class="card"><div class="card-head"><h2>Versions</h2><span class="sub">{{ d.versions.length }}</span></div>
          <div class="rows" style="padding-bottom: 8px">@for (v of d.versions; track v.id) {
            <a class="row" [routerLink]="[]" [queryParams]="{ version: v.numero }" [style.background]="v.id === d.version_courante?.id ? 'var(--hover-bg)' : ''">
              <span class="ic-tile tone-primary" style="font-weight:600; font-size: 12px">{{ v.numero }}</span>
              <div class="grow"><strong>{{ v.auteur || '—' }} @if (v.auteur_type === 'agent') { <span class="agent-badge"><mat-icon>smart_toy</mat-icon>Agent</span> }</strong><small>{{ v.resume_modif }}</small></div>
              <span class="num" style="font-size: 12px">{{ v.cree_le | dateFr }}@if (v.figee) { <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:-2px">lock</mat-icon> }</span></a>
          } @empty { <p class="muted" style="padding: 0 20px">Aucune version.</p> }</div></section>
      </aside>
    </div>
  } @else { <div class="loading">Chargement…</div> }`,
})
export class Document {
  private readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  readonly doc = input.required<string>();
  readonly version = input<string>();
  readonly d = signal<DocumentDetailDto | null>(null);
  constructor() { effect(() => { const c = this.p.code(), doc = this.doc(), v = this.version(); if (c && doc) this.api.invoke(projetsDocument, { code: c, doc, version: v }).then((x) => this.d.set(x)); }); }
}
