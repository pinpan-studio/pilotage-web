import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../api/genere/api';
import { projetsPortefeuille } from '../../api/genere/functions';
import { ProjetResumeDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';

@Component({
  selector: 'app-portefeuille',
  imports: [RouterLink, ...PIPES],
  template: `
  <div class="titre-projet"><div><h1>Portefeuille</h1><p class="sous">{{ projets()?.length ?? 0 }} projet(s) suivi(s)</p></div></div>
  @if (erreur()) { <p class="erreur-texte">{{ erreur() }}</p> }
  @if (!projets()) { <p class="chargement">Chargement…</p> }
  @else if (!projets()!.length) { <p class="vide">Aucun projet accessible.</p> }
  <div class="cartes-projets">
    @for (p of projets(); track p.id) {
      <a class="carte projet" [routerLink]="['/projets', p.code]">
        <div class="haut"><div><h2>{{ p.nom }}</h2><small>{{ p.client }} · {{ p.code }}</small></div><span class="badge" [class]="'badge b-' + p.statut">{{ p.statut | libelle }}</span></div>
        <div class="ligne-barre grande"><span>Avancement</span><div class="barre"><span [style.width.%]="p.avancement * 100"></span></div><b>{{ p.avancement | pct }}</b></div>
        <dl class="chiffres">
          <div><dt>Couverture TDR</dt><dd>{{ p.couverture | pct }}</dd></div>
          <div><dt>Recette OK</dt><dd>{{ p.taux_recette | pct }}</dd></div>
          <div><dt>Livrables</dt><dd>{{ p.avancement_documents | pct }}</dd></div>
          <div><dt>Retours ouverts</dt><dd>{{ p.nb_retours_ouverts }}</dd></div>
          <div><dt>Actions en retard</dt><dd [class.ko]="p.nb_actions_en_retard">{{ p.nb_actions_en_retard }}</dd></div>
          <div><dt>Livraison</dt><dd>{{ p.date_livraison_prevue | dateFr }}</dd></div>
        </dl>
        @if (p.prochain_jalon) { <p class="note">Prochain jalon : {{ p.prochain_jalon.nom }} — {{ p.prochain_jalon.date_prevue | dateFr }}</p> }
        @if (p.nb_alertes.haute) { <p class="alerte-mini">{{ p.nb_alertes.haute }} alerte(s) haute(s)</p> }
      </a>
    }
  </div>`,
})
export class Portefeuille {
  private readonly api = inject(Api);
  readonly projets = signal<ProjetResumeDto[] | null>(null);
  readonly erreur = signal('');
  constructor() { this.api.invoke(projetsPortefeuille).then((p) => this.projets.set(p)).catch(() => this.erreur.set('Impossible de charger le portefeuille.')); }
}
