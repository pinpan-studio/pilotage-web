import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Api } from '../../api/genere/api';
import { projetsFonctionnalite, projetsFonctionnalites } from '../../api/genere/functions';
import { FonctionnaliteDetailDto, FonctionnaliteDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { Statut, tonDeCouleur } from '../noyau/statut';
import { DataColumn, DataTableComponent } from '../shared/components/data/data-table.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { date } from '../noyau/format';
import { ProjetCourant } from './projet';

interface Ligne { id: string; ref: string; titre: string; lot: string; poids: number; statut: string; statut_code: string; depots: string; avancement: number; tests: number; activite: string; }

@Component({
  selector: 'app-fonctionnalites',
  imports: [FormsModule, MatIconModule, DataTableComponent, ...PIPES],
  template: `
  <div class="toolbar-row">
    @for (s of filtresStatut(); track s.code) {
      <button type="button" class="chip-filter" [class.on]="statut() === s.code" (click)="statut.set(statut() === s.code ? '' : s.code)">{{ s.libelle }}<span class="n">{{ s.nb }}</span></button>
    }
    <span class="spacer"></span>
    <select class="select-chip" [ngModel]="depot()" (ngModelChange)="depot.set($event)" aria-label="Dépôt"><option value="">Tous les dépôts</option>@for (d of p.detail()?.depots ?? []; track d.id) { <option [value]="d.nom">{{ d.nom }}</option> }</select>
  </div>
  <section class="card">
    <app-data-table [rows]="lignes()" [columns]="colonnes" rowKey="id" [pageSize]="25" maxHeight="none" clickable (rowClick)="ouvrir($event)" />
  </section>`,
})
export class Fonctionnalites {
  readonly p = inject(ProjetCourant);
  private readonly ref = inject(ReferentielsService);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly liste = signal<FonctionnaliteDto[]>([]);
  readonly statut = signal(''); readonly depot = signal('');
  readonly colonnes: DataColumn<Ligne>[] = [
    { key: 'ref', label: 'Réf.', type: 'mono', sortable: true, width: 90, required: true },
    { key: 'titre', label: 'Fonctionnalité', sortable: true, minWidth: 240, required: true },
    { key: 'lot', label: 'Lot', sortable: true, width: 100 },
    { key: 'poids', label: 'Poids', type: 'number', align: 'right', sortable: true, width: 80 },
    { key: 'statut', label: 'Statut', type: 'badge', sortable: true, width: 140, tone: (r) => tonDeCouleur(this.ref.couleur(r.statut_code)) },
    { key: 'depots', label: 'Dépôts', minWidth: 200 },
    { key: 'avancement', label: 'Avancement', type: 'progress', sortable: true, width: 160 },
    { key: 'tests', label: 'Tests', type: 'number', align: 'right', width: 80 },
    { key: 'activite', label: 'Dernière activité', width: 140, hidden: false },
  ];
  readonly filtresStatut = computed(() => {
    const n: Record<string, number> = {}; for (const f of this.liste()) n[f.statut_effectif] = (n[f.statut_effectif] ?? 0) + 1;
    return (this.ref.donnees()?.statuts_fonctionnalite ?? []).filter((s) => n[s.code]).map((s) => ({ ...s, nb: n[s.code] }));
  });
  readonly lignes = computed<Ligne[]>(() => this.liste()
    .filter((f) => (!this.statut() || f.statut_effectif === this.statut()) && (!this.depot() || f.depots.some((d) => d.depot === this.depot())))
    .map((f) => ({
      id: f.id, ref: f.ref, titre: f.titre, lot: f.jalon, poids: f.poids, statut: this.ref.libelle(f.statut_effectif), statut_code: f.statut_effectif,
      depots: f.depots.map((d) => `${d.depot} : ${this.ref.libelle(d.statut)}`).join(' · ') || '—',
      avancement: Math.round(f.avancement * 100), tests: f.cas_test.length, activite: date(f.derniere_activite),
    })));
  constructor() { effect(() => { const c = this.p.code(); if (c) this.api.invoke(projetsFonctionnalites, { code: c }).then((l) => this.liste.set(l)); }); }
  ouvrir(l: Ligne) { this.router.navigate(['/projets', this.p.code(), 'fonctionnalites', l.ref]); }
}

@Component({
  selector: 'app-fonctionnalite',
  imports: [RouterLink, MatIconModule, Statut, EmptyStateComponent, ...PIPES],
  template: `
  <a routerLink=".." class="crumbs" style="text-decoration: none"><mat-icon>arrow_back</mat-icon>Toutes les fonctionnalités</a>
  @if (f(); as f) {
    <div class="grid-aside">
      <div>
        <section class="card" style="margin-bottom: 16px"><div class="card-head"><h2>{{ f.ref }} — {{ f.titre }}</h2><app-statut [code]="f.statut_effectif" /></div>
          <div class="card-body">
            <div class="bar-row"><span>Avancement</span><div class="bar"><i [style.width.%]="f.avancement * 100"></i></div><b>{{ f.avancement | pct }}</b></div>
            @if (f.notes) { <p class="muted">{{ f.notes }}</p> }
          </div></section>
        <section class="card" style="margin-bottom: 16px"><div class="card-head"><h2>Cas de test</h2><span class="sub">{{ f.tests.length }}</span></div>
          <div class="rows" style="padding-bottom: 8px">@for (t of f.tests; track t.ref) {
            <div class="row"><span class="ref">{{ t.ref }}</span><div class="grow"><strong class="wrap">{{ t.titre }}</strong>@if (t.campagne) { <small>Campagne {{ t.campagne }}</small> }</div><app-statut [code]="t.resultat" /></div>
          } @empty { <app-empty-state icon="fact_check" title="Aucun cas de test" subtitle="Le cahier de recette ne couvre pas encore cette fonctionnalité." /> }</div></section>
        <section class="card"><div class="card-head"><h2>Activité liée</h2></div>
          <div class="rows" style="padding-bottom: 8px">@for (e of f.journal.slice(0, 20); track e.id) {
            <div class="row"><span class="ic-tile" [class]="'ic-tile ' + (e.evt === 'commit' ? 'tone-success' : 'tone-neutral')"><mat-icon>{{ e.evt === 'commit' ? 'commit' : e.evt === 'commande' ? 'terminal' : 'edit' }}</mat-icon></span>
              <div class="grow"><strong class="mono">{{ e.hash ? e.hash + ' — ' + e.message : (e.fichier || e.commande || e.message) }}</strong><small>{{ e.auteur }} · {{ e.depot }}</small></div><span class="num">{{ e.ts | dateFr: true }}</span></div>
          } @empty { <p class="muted" style="padding: 0 20px">Aucune activité.</p> }</div></section>
      </div>
      <aside class="card"><div class="card-head"><h2>Informations</h2></div><div class="card-body">
        <dl class="kv">
          <dt>Statut global</dt><dd><app-statut [code]="f.statut" /></dd>
          <dt>Lot</dt><dd>{{ f.jalon || '—' }}</dd><dt>Poids</dt><dd>{{ f.poids }}</dd><dt>Origine</dt><dd>{{ f.origine }}</dd>
          <dt>Exigences</dt><dd>@for (e of f.exigences; track e) { <span class="ref">{{ e }}</span> } @empty { — }</dd>
          <dt>Retours</dt><dd>@for (r of f.retours; track r) { <span class="ref">{{ r }}</span> } @empty { — }</dd>
          <dt>Dépôts</dt><dd>@for (d of f.depots; track d.depot) { <div>{{ d.depot }} <app-statut [code]="d.statut" /></div> } @empty { — }</dd>
          <dt>Dernière activité</dt><dd>{{ f.derniere_activite | dateFr: true }}</dd>
        </dl></div></aside>
    </div>
  } @else { <div class="loading">Chargement…</div> }`,
})
export class Fonctionnalite {
  private readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  readonly refF = input.required<string>({ alias: 'ref' });
  readonly f = signal<FonctionnaliteDetailDto | null>(null);
  constructor() { effect(() => { const c = this.p.code(), r = this.refF(); if (c && r) this.api.invoke(projetsFonctionnalite, { code: c, ref: r }).then((x) => this.f.set(x)); }); }
}
