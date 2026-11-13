import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { versIso } from '../noyau/dates';
import { Api } from '../../api/genere/api';
import { projetsAdminCreer } from '../../api/genere/functions';
import { EquipeService } from '../noyau/equipe.service';
import { NavigationService } from '../noyau/navigation.service';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Création d'un projet (administrateur ou chef de projet) — disposition des réglages du ui-kit. */
@Component({
  selector: 'app-nouveau-projet',
  imports: [FormsModule, RouterLink, MatButtonModule, MatIconModule, MatDatepickerModule],
  styleUrl: '../parametres/parametres.scss',
  styles: [`.depot { display: grid; grid-template-columns: 180px minmax(0, 1fr) 180px auto; gap: var(--space-2); margin-bottom: var(--space-2); @media (max-width: 700px) { grid-template-columns: 1fr; } }
    .form-pane { max-width: 860px; }`],
  template: `
  <div class="pl-page">
    <div class="page-head"><div class="titles"><span class="eyebrow">{{ eq.courante()?.nom }}</span><h1>Nouveau projet</h1>
      <p>Le catalogue des documents de gestion de projet est instancié « à produire » ; vous devenez chef de projet.</p></div></div>
    @if (eq.courante() && !eq.peutCreerProjet()) { <p class="err-text">Seul un administrateur ou un chef de projet peut créer un projet dans cette équipe.</p> }
    <form class="card pane form-pane" (ngSubmit)="creer()">
      <header><h2>Projet</h2><p>Les dates et le périmètre détaillé (TDR, exigences) peuvent être complétés ensuite, notamment par l'agent (/init-projet).</p></header>
      <div class="set"><div class="s-lbl"><strong>Nom</strong></div><div class="s-ctl"><div class="form-field"><div class="field-box"><input name="nom" [(ngModel)]="f.nom" (ngModelChange)="codeAuto && (f.code = slug($event))" required placeholder="Portail des déclarations" /></div></div></div></div>
      <div class="set"><div class="s-lbl"><strong>Code</strong><small>Minuscules, chiffres et tirets ; sert dans les URL et pour l'agent.</small></div>
        <div class="s-ctl"><div class="form-field"><div class="field-box"><input name="code" [(ngModel)]="f.code" (input)="codeAuto = false" required /></div></div></div></div>
      <div class="set"><div class="s-lbl"><strong>Client</strong></div><div class="s-ctl"><div class="form-field"><div class="field-box"><input name="client" [(ngModel)]="f.client" placeholder="Direction générale…" /></div></div></div></div>
      <div class="set"><div class="s-lbl"><strong>Description</strong></div><div class="s-ctl"><div class="form-field"><div class="field-box textarea-box"><textarea name="desc" rows="3" [(ngModel)]="f.description"></textarea></div></div></div></div>
      <div class="set"><div class="s-lbl"><strong>Période</strong><small>Début et livraison prévue</small></div>
        <div class="s-ctl"><div class="form-field"><div class="field-box"><mat-icon>date_range</mat-icon>
          <mat-date-range-input [rangePicker]="periode" aria-label="Période du projet">
            <input matStartDate name="d" [(ngModel)]="debut" placeholder="Début (jj/mm/aaaa)" />
            <input matEndDate name="l" [(ngModel)]="fin" placeholder="Livraison" />
          </mat-date-range-input>
          <button mat-icon-button type="button" (click)="periode.open()" aria-label="Choisir la période"><mat-icon>calendar_month</mat-icon></button>
          <mat-date-range-picker #periode />
        </div></div></div></div>
      <div class="set"><div class="s-lbl"><strong>Dépôts de code</strong><small>Un par dépôt (backend, web, mobile…) ; le kit Claude Code s'installe dans chacun.</small></div>
        <div class="s-ctl">
          @for (d of f.depots; track $index; let i = $index) {
            <div class="depot"><div class="form-field"><div class="field-box"><input [name]="'n' + i" [(ngModel)]="d.nom" placeholder="backend" /></div></div>
              <div class="form-field"><div class="field-box"><input [name]="'u' + i" [(ngModel)]="d.url" placeholder="https://github.com/…" /></div></div>
              <div class="form-field"><div class="field-box"><input [name]="'s' + i" [(ngModel)]="d.stack" placeholder="NestJS / PostgreSQL" /></div></div>
              <button mat-icon-button type="button" (click)="f.depots.splice(i, 1)" aria-label="Retirer"><mat-icon>close</mat-icon></button></div>
          }
          <button mat-stroked-button type="button" (click)="f.depots.push({ nom: '', url: '', stack: '' })"><mat-icon>add</mat-icon>Ajouter un dépôt</button>
        </div></div>
      @if (erreur()) { <p class="err-text" style="padding: 0 0 12px">{{ erreur() }}</p> }
      <footer><a mat-button routerLink="/">Annuler</a><button mat-flat-button color="primary" type="submit" [disabled]="enCours() || f.nom.trim().length < 2 || f.code.length < 2 || !eq.peutCreerProjet()"><mat-icon>create_new_folder</mat-icon>Créer le projet</button></footer>
    </form>
  </div>`,
})
export class NouveauProjet {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  private readonly nav = inject(NavigationService);
  readonly eq = inject(EquipeService);
  readonly enCours = signal(false); readonly erreur = signal('');
  readonly slug = slug;
  codeAuto = true;
  debut: Date | null = null; fin: Date | null = null;
  f = { nom: '', code: '', client: '', description: '', depots: [{ nom: 'backend', url: '', stack: '' }, { nom: 'web', url: '', stack: '' }] };
  constructor() { this.eq.charger(); }
  async creer() {
    this.enCours.set(true); this.erreur.set('');
    try {
      const r = await this.api.invoke(projetsAdminCreer, { body: { code: this.f.code, nom: this.f.nom.trim(), client: this.f.client.trim() || undefined, description: this.f.description || undefined,
        date_debut: versIso(this.debut) ?? undefined, date_livraison_prevue: versIso(this.fin) ?? undefined,
        depots: this.f.depots.filter((d) => d.nom.trim()).map((d) => ({ nom: d.nom.trim(), url: d.url.trim() || undefined, stack: d.stack.trim() || undefined })) } });
      await this.nav.chargerProjets(true);
      this.snack.open(`Projet ${r.code} créé · ${r.nb_documents} documents à produire`, undefined, { duration: 4000 });
      this.router.navigate(['/projets', r.code, 'equipe']);
    } catch (e: any) { const m = e?.error?.message; this.erreur.set(Array.isArray(m) ? m.join(' · ') : m ?? 'Création impossible.'); }
    finally { this.enCours.set(false); }
  }
}
