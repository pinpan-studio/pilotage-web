import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProjetResumeDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { NavigationService } from '../noyau/navigation.service';
import { EquipeService } from '../noyau/equipe.service';
import { date } from '../noyau/format';
import { StatCounterComponent } from '../shared/components/data/stat-counter.component';
import { DataColumn, DataTableComponent } from '../shared/components/data/data-table.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../shared/components/skeleton/skeleton.component';

interface Ligne { id: string; code: string; nom: string; client: string; avancement: number; recette: number; livrables: number; retours: number; alertes: number; livraison: string; jalon: string }

/** Portefeuille — composition du tableau de bord du ui-kit appliquée à l'ensemble des projets. */
@Component({
  selector: 'app-portefeuille',
  imports: [RouterLink, MatIconModule, MatButtonModule, MatProgressBarModule, StatCounterComponent, DataTableComponent, EmptyStateComponent, SkeletonComponent, ...PIPES],
  template: `
  <div class="pl-page">
    <div class="page-head">
      <div class="titles"><span class="eyebrow">{{ aujourdhui }}</span><h1>Portefeuille</h1><p>{{ eq.courante()?.nom ?? 'Équipe' }} · {{ projets()?.length ?? 0 }} projet(s) suivi(s) · indicateurs recalculés à chaque visite.</p></div>
      <div class="actions"><button mat-stroked-button (click)="nav.chargerProjets(true)"><mat-icon>refresh</mat-icon>Actualiser</button>
        @if (eq.peutCreerProjet()) { <a mat-flat-button color="primary" routerLink="/projets-nouveau"><mat-icon>create_new_folder</mat-icon>Nouveau projet</a> }</div>
    </div>
    @if (!projets()) { <app-skeleton variant="card" [count]="4" /> }
    @else if (!projets()!.length) { <app-empty-state icon="folder_off" title="Aucun projet" [subtitle]="eq.peutCreerProjet() ? 'Créez le premier projet de l’équipe.' : 'Vous n’êtes membre d’aucun projet pour le moment.'" [actionLabel]="eq.peutCreerProjet() ? 'Nouveau projet' : ''" (actionClick)="router.navigateByUrl('/projets-nouveau')" /> }
    @else {
      <div class="kpis">
        <div class="card kpi"><span class="k-label"><mat-icon>folder</mat-icon>Projets en cours</span><span class="k-val"><app-stat-counter [value]="enCours()" /></span><span class="k-foot">sur {{ projets()!.length }} au total</span></div>
        <div class="card kpi"><span class="k-label"><mat-icon>trending_up</mat-icon>Avancement moyen</span><span class="k-val">{{ moyenne() | pct }}</span><span class="k-foot">pondéré par projet</span></div>
        <div class="card kpi"><span class="k-label"><mat-icon>error</mat-icon>Alertes hautes</span><span class="k-val">{{ hautes() }}</span><span class="k-foot">{{ projetsAlerte() }} projet(s) concerné(s)</span></div>
        <div class="card kpi"><span class="k-label"><mat-icon>forum</mat-icon>Retours clients ouverts</span><span class="k-val">{{ retours() }}</span><span class="k-foot">{{ retard() }} action(s) en retard</span></div>
      </div>
      <div class="grid-3">
        <section class="card span-2">
          <div class="card-head"><h2>Avancement des projets</h2></div>
          <div class="card-body goals">@for (p of projets(); track p.id) {
            <a class="goal" [routerLink]="['/projets', p.code]" style="color: inherit; text-decoration: none">
              <div class="g-top"><span><strong>{{ p.nom }}</strong> · {{ p.client }}</span><strong class="tabular">{{ p.avancement | pct }}</strong></div>
              <mat-progress-bar mode="determinate" [value]="p.avancement * 100" />
              <small>Recette {{ p.taux_recette | pct }} · livrables {{ p.avancement_documents | pct }} · livraison {{ p.date_livraison_prevue | dateFr }}@if (p.prochain_jalon) { · prochain jalon « {{ p.prochain_jalon.nom }} » le {{ p.prochain_jalon.date_prevue | dateFr }} }</small>
            </a> }</div>
        </section>
        <section class="card">
          <div class="card-head"><h2>À traiter</h2></div>
          <div class="rows" style="padding-bottom: 8px">
            @for (p of aTraiter(); track p.id) {
              <a class="row" [routerLink]="['/projets', p.code, 'synthese']"><span class="ic-tile tone-error"><mat-icon>priority_high</mat-icon></span>
                <div class="grow"><strong>{{ p.nom }}</strong><small>{{ p.nb_alertes.haute }} alerte(s) haute(s) · {{ p.nb_alertes.moyenne }} moyenne(s)</small></div><mat-icon class="muted">chevron_right</mat-icon></a>
            } @empty { <p class="muted" style="padding: 0 20px">Aucune alerte haute. 🎉</p> }
          </div>
        </section>
        <app-data-table class="wide" title="Tous les projets" [rows]="lignes()" [columns]="colonnes" rowKey="id" [pageSize]="10" maxHeight="none" clickable (rowClick)="ouvrir($event)" />
      </div>
    }
  </div>`,
})
export class Portefeuille {
  readonly nav = inject(NavigationService);
  readonly eq = inject(EquipeService);
  readonly router = inject(Router);
  readonly aujourdhui = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' }).format(new Date());
  readonly projets = this.nav.projets;
  private readonly l = computed(() => this.projets() ?? []);
  readonly enCours = computed(() => this.l().filter((p) => p.statut === 'en_cours').length);
  readonly moyenne = computed(() => (this.l().length ? this.l().reduce((a, p) => a + p.avancement, 0) / this.l().length : null));
  readonly hautes = computed(() => this.l().reduce((a, p) => a + p.nb_alertes.haute, 0));
  readonly projetsAlerte = computed(() => this.l().filter((p) => p.nb_alertes.haute).length);
  readonly retours = computed(() => this.l().reduce((a, p) => a + p.nb_retours_ouverts, 0));
  readonly retard = computed(() => this.l().reduce((a, p) => a + p.nb_actions_en_retard, 0));
  readonly aTraiter = computed(() => [...this.l()].filter((p) => p.nb_alertes.haute).sort((a, b) => b.nb_alertes.haute - a.nb_alertes.haute).slice(0, 6));
  readonly colonnes: DataColumn<Ligne>[] = [
    { key: 'nom', label: 'Projet', minWidth: 220, sortable: true, required: true },
    { key: 'client', label: 'Client', width: 170, sortable: true },
    { key: 'avancement', label: 'Avancement', type: 'progress', width: 160, sortable: true },
    { key: 'recette', label: 'Recette OK', type: 'progress', width: 150, sortable: true },
    { key: 'livrables', label: 'Livrables', type: 'progress', width: 150, sortable: true },
    { key: 'retours', label: 'Retours', type: 'number', align: 'right', width: 90, sortable: true },
    { key: 'alertes', label: 'Alertes hautes', type: 'badge', width: 130, sortable: true, tone: (r) => (r.alertes ? 'error' : 'success') },
    { key: 'livraison', label: 'Livraison', width: 120 },
    { key: 'jalon', label: 'Prochain jalon', minWidth: 180 },
  ];
  readonly lignes = computed<Ligne[]>(() => this.l().map((p: ProjetResumeDto) => ({
    id: p.id, code: p.code, nom: p.nom, client: p.client, avancement: Math.round(p.avancement * 100), recette: Math.round((p.taux_recette ?? 0) * 100),
    livrables: Math.round((p.avancement_documents ?? 0) * 100), retours: p.nb_retours_ouverts, alertes: p.nb_alertes.haute, livraison: date(p.date_livraison_prevue),
    jalon: p.prochain_jalon ? `${p.prochain_jalon.nom} (${date(p.prochain_jalon.date_prevue)})` : '—' })));
  constructor() { this.nav.chargerProjets(); this.eq.charger(); }
  ouvrir(l: Ligne) { this.router.navigate(['/projets', l.code]); }
}
