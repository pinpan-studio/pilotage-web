import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Api } from '../../api/genere/api';
import { projetsPortefeuille } from '../../api/genere/functions';
import { ProjetResumeDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { Statut } from '../noyau/statut';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-portefeuille',
  imports: [RouterLink, MatIconModule, Statut, EmptyStateComponent, SkeletonComponent, ...PIPES],
  styles: [`
    .projets { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: var(--space-4); }
    a.card { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-5); color: inherit; text-decoration: none; transition: box-shadow .15s, transform .15s;
      &:hover { box-shadow: var(--elevation-2); transform: translateY(-1px); } }
    .haut { display: flex; align-items: flex-start; gap: var(--space-3); h2 { margin: 0; font: 600 var(--fs-h4) / 1.35 var(--font-heading); } small { color: var(--text-muted); } .grow { flex: 1; min-width: 0; } }
    dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); margin: 0; dt { font-size: var(--fs-caption); color: var(--text-muted); } dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; } }
    .pied { display: flex; align-items: center; gap: var(--space-2); font-size: var(--fs-caption); color: var(--text-muted); mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .alerte { color: var(--error-color); font-weight: 600; }
  `],
  template: `
  <div class="page">
    <div class="page-head"><div class="titles"><span class="eyebrow">Espace de travail</span><h1>Portefeuille</h1><p>{{ projets()?.length ?? 0 }} projet(s) suivi(s), indicateurs calculés en temps réel.</p></div></div>
    @if (erreur()) { <p class="err-text">{{ erreur() }}</p> }
    @if (!projets()) { <app-skeleton variant="card" [count]="3" /> }
    @else if (!projets()!.length) { <app-empty-state icon="folder_off" title="Aucun projet" subtitle="Vous n'avez accès à aucun projet pour le moment." /> }
    @else {
      <div class="projets">
        @for (p of projets(); track p.id) {
          <a class="card" [routerLink]="['/projets', p.code]">
            <div class="haut"><span class="ic-tile tone-primary"><mat-icon>folder</mat-icon></span>
              <div class="grow"><h2>{{ p.nom }}</h2><small>{{ p.client }} · {{ p.code }}</small></div><app-statut [code]="p.statut" /></div>
            <div class="bar-row"><span>Avancement</span><div class="bar"><i [style.width.%]="p.avancement * 100"></i></div><b>{{ p.avancement | pct }}</b></div>
            <dl>
              <div><dt>Couverture TDR</dt><dd>{{ p.couverture | pct }}</dd></div>
              <div><dt>Recette OK</dt><dd>{{ p.taux_recette | pct }}</dd></div>
              <div><dt>Livrables</dt><dd>{{ p.avancement_documents | pct }}</dd></div>
              <div><dt>Retours ouverts</dt><dd>{{ p.nb_retours_ouverts }}</dd></div>
              <div><dt>Actions en retard</dt><dd [class.alerte]="p.nb_actions_en_retard">{{ p.nb_actions_en_retard }}</dd></div>
              <div><dt>Livraison</dt><dd>{{ p.date_livraison_prevue | dateFr }}</dd></div>
            </dl>
            <div class="pied">
              @if (p.prochain_jalon) { <mat-icon>flag</mat-icon>{{ p.prochain_jalon.nom }} — {{ p.prochain_jalon.date_prevue | dateFr }} }
              <span class="spacer"></span>
              @if (p.nb_alertes.haute) { <span class="alerte">{{ p.nb_alertes.haute }} alerte(s) haute(s)</span> }
            </div>
          </a>
        }
      </div>
    }
  </div>`,
})
export class Portefeuille {
  private readonly api = inject(Api);
  readonly projets = signal<ProjetResumeDto[] | null>(null);
  readonly erreur = signal('');
  constructor() { this.api.invoke(projetsPortefeuille).then((p) => this.projets.set(p)).catch(() => { this.projets.set([]); this.erreur.set('Impossible de charger le portefeuille.'); }); }
}
