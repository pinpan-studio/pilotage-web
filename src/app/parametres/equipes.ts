import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PIPES } from '../noyau/pipes';
import { EquipeService } from '../noyau/equipe.service';

/** Mes équipes : liste des espaces de travail, changement, création. */
@Component({
  selector: 'app-param-equipes',
  imports: [FormsModule, MatButtonModule, MatIconModule, ...PIPES],
  styleUrl: './parametres.scss',
  host: { style: 'display: contents' },
  template: `
  <section class="card pane">
    <header><h2>Mes équipes</h2><p>Vous pouvez appartenir à plusieurs équipes ; chacune est un espace isolé.</p></header>
    @for (e of eq.equipes(); track e.id) {
      <div class="set inline"><span class="ic-tile" [class]="'ic-tile ' + (e.courante ? 'tone-primary' : '')"><mat-icon>workspaces</mat-icon></span>
        <div class="s-lbl"><strong>{{ e.nom }}</strong><small>{{ e.role | libelle }} · {{ e.nb_membres }} membre(s) · {{ e.nb_projets }} projet(s)</small></div>
        @if (e.courante) { <span class="ref tone-success">Équipe courante</span> } @else { <button mat-stroked-button (click)="eq.changer(e.id)">Ouvrir</button> }</div>
    }
  </section>
  <section class="card pane">
    <header><h2>Créer une équipe</h2><p>Vous en serez administrateur ; le catalogue des 41 documents de gestion de projet y est installé.</p></header>
    <form class="set" (ngSubmit)="creer()">
      <div class="s-lbl"><strong>Nom de l'équipe</strong><small>Ex. le nom de votre société ou de votre service.</small></div>
      <div class="s-ctl" style="display: flex; gap: 12px"><div class="form-field" style="flex: 1"><div class="field-box"><input name="nom" [(ngModel)]="nom" placeholder="Studio digital" /></div></div>
        <button mat-flat-button color="primary" type="submit" [disabled]="nom.trim().length < 2 || enCours()"><mat-icon>add</mat-icon>Créer</button></div>
    </form>
  </section>`,
})
export class ParamEquipes {
  readonly eq = inject(EquipeService);
  private readonly snack = inject(MatSnackBar);
  readonly enCours = signal(false);
  nom = '';
  constructor() { this.eq.charger(); }
  async creer() {
    this.enCours.set(true);
    try { const e = await this.eq.creer(this.nom.trim()); this.nom = ''; this.snack.open(`Équipe « ${e.nom} » créée`, 'Ouvrir', { duration: 6000 }).onAction().subscribe(() => this.eq.changer(e.id)); }
    catch (e: any) { this.snack.open(e?.error?.message ?? 'Création impossible', 'Fermer', { duration: 5000 }); } finally { this.enCours.set(false); }
  }
}
