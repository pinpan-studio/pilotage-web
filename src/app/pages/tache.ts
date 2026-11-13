import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Api } from '../../api/genere/api';
import { ecritureModifierTache, projetsActions } from '../../api/genere/functions';
import { Action } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { Statut, tonDeCouleur } from '../noyau/statut';
import { Chargement } from '../noyau/chargement';
import { GraphiquesService } from '../noyau/graphiques.service';
import { GroupeLecteur, Lecteur } from '../noyau/lecteur';
import { ProjetCourant } from './projet';

/** Détail d'une tâche — gabarit de documentation du ui-kit (examples/app/docs), avec édition. */
@Component({
  selector: 'app-tache',
  imports: [FormsModule, MatButtonModule, MatIconModule, Statut, Lecteur, Chargement, ...PIPES],
  styles: [`.champs { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin: var(--space-2) 0 var(--space-4); @media (max-width: 700px) { grid-template-columns: 1fr; } }
    .actions { display: flex; gap: var(--space-2); justify-content: flex-end; }
    .statuts { display: flex; flex-wrap: wrap; gap: var(--space-2); }`],
  template: `
  @if (t(); as t) {
    <app-lecteur [groupes]="arbre()" [courant]="t.ref" [titre]="t.ref + ' — ' + t.action" [fil]="['Tâches', ref.libelle(t.statut), t.ref]" [sommaire]="sommaire" titreArbre="Tâches">
      <ng-container meta><app-statut [code]="t.statut" />@if (t.echeance) { <span [style.color]="enRetard(t) ? 'var(--error-color)' : ''">Échéance {{ t.echeance | dateFr }}{{ enRetard(t) ? ' · en retard' : '' }}</span> }
        <span>{{ t.responsable || 'Non attribuée' }}</span><span>Créée le {{ t.cree_le | dateFr }}</span></ng-container>
      <div class="prose">
        <h2 id="statut">Statut</h2>
        <div class="statuts">@for (s of ref.donnees()?.statuts_action ?? []; track s.code) {
          <button type="button" class="chip-filter" [class.on]="t.statut === s.code" (click)="enregistrer({ statut: $any(s.code) })">{{ s.libelle }}</button> }</div>
        <h2 id="details">Détails</h2>
        <div class="form-field"><label class="field-label">Tâche</label><div class="field-box"><input [(ngModel)]="f.action" name="a" /></div></div>
        <div class="champs">
          <div class="form-field"><label class="field-label">Responsable</label><div class="field-box"><mat-icon>person</mat-icon><input [(ngModel)]="f.responsable" name="r" /></div></div>
          <div class="form-field"><label class="field-label">Échéance</label><div class="field-box"><input type="date" [(ngModel)]="f.echeance" name="e" /></div></div>
        </div>
        <div class="actions"><button mat-button (click)="reinit(t)">Annuler</button><button mat-flat-button color="primary" (click)="enregistrerFormulaire()" [disabled]="f.action.trim().length < 2">Enregistrer</button></div>
        <h2 id="origine">Origine</h2>
        <p>@switch (t.origine_type) {
          @case ('session') { Créée par l'agent IA pendant une session de développement. }
          @case ('interface') { Créée depuis l'interface. }
          @case ('fichier_kit') { Issue de <code>{{ t.origine_id }}</code> (import du kit v1). }
          @default { {{ t.origine_id || 'Non précisée.' }} }
        }</p>
      </div>
    </app-lecteur>
  } @else { <app-chargement forme="document" /> }`,
})
export class Tache {
  private readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  readonly ref = inject(ReferentielsService);
  private readonly g = inject(GraphiquesService);
  private readonly snack = inject(MatSnackBar);
  readonly refT = input.required<string>({ alias: 'ref' });
  readonly taches = signal<Action[]>([]);
  readonly t = computed(() => this.taches().find((x) => x.ref === this.refT()) ?? null);
  f = { action: '', responsable: '', echeance: '' };
  readonly sommaire = [{ id: 'statut', texte: 'Statut', niveau: 2 as const }, { id: 'details', texte: 'Détails', niveau: 2 as const }, { id: 'origine', texte: 'Origine', niveau: 2 as const }];
  readonly arbre = computed<GroupeLecteur[]>(() => (this.ref.donnees()?.statuts_action ?? []).map((s) => ({ libelle: s.libelle, icone: 'task_alt',
    feuilles: this.taches().filter((x) => x.statut === s.code).map((x) => ({ id: x.ref, ref: x.ref, libelle: x.action, lien: ['/projets', this.p.code(), 'taches', x.ref], couleur: this.g.ton(tonDeCouleur(s.couleur)) })) }))
    .filter((g) => g.feuilles.length));
  constructor() {
    effect(() => { const c = this.p.code(); if (c) this.api.invoke(projetsActions, { code: c }).then((l) => this.taches.set(l)); });
    effect(() => { const t = this.t(); if (t) this.reinit(t); });
  }
  enRetard(t: Action) { return !!t.echeance && ['a_faire', 'en_cours'].includes(t.statut) && t.echeance < (this.p.indicateurs()?.date_calcul ?? ''); }
  reinit(t: Action) { this.f = { action: t.action, responsable: t.responsable, echeance: t.echeance ?? '' }; }
  enregistrerFormulaire() { this.enregistrer({ action: this.f.action.trim(), responsable: this.f.responsable.trim(), echeance: this.f.echeance || null }); }
  async enregistrer(body: { statut?: Action['statut']; action?: string; responsable?: string; echeance?: string | null }) {
    const t = this.t(); if (!t) return;
    try {
      const n = await this.api.invoke(ecritureModifierTache, { code: this.p.code(), ref: t.ref, body });
      this.taches.update((l) => l.map((x) => (x.id === n.id ? n : x)));
      this.snack.open('Tâche enregistrée', undefined, { duration: 2000 });
    } catch (e: any) { this.snack.open(e?.error?.message ?? 'Enregistrement impossible', 'Fermer', { duration: 5000 }); }
  }
}
