import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

/** Paramètres — disposition de la page de réglages du UI-Kit (sous-navigation + volets). */
@Component({
  selector: 'app-parametres',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  styleUrl: './parametres.scss',
  template: `
  <div class="pl-page">
    <div class="page-head"><div class="titles"><span class="eyebrow">Compte et équipe</span><h1>Paramètres</h1><p>Profil, sécurité, membres, rôles et espaces de travail.</p></div></div>
    <div class="layout">
      <nav class="sub" aria-label="Sections">
        @for (s of sections; track s.lien) { <a [routerLink]="s.lien" routerLinkActive="on"><mat-icon>{{ s.icone }}</mat-icon><span>{{ s.libelle }}</span></a> }
      </nav>
      <div class="panes"><router-outlet /></div>
    </div>
  </div>`,
})
export class Parametres {
  readonly sections = [
    { lien: 'compte', libelle: 'Mon compte', icone: 'person' },
    { lien: 'securite', libelle: 'Sécurité', icone: 'shield' },
    { lien: 'equipe', libelle: 'Équipe et rôles', icone: 'group' },
    { lien: 'equipes', libelle: 'Mes équipes', icone: 'workspaces' },
  ];
}
