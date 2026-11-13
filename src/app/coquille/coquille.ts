import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { filter } from 'rxjs';
import { ThemeService } from '../core/services/theme.service';
import { ThemePickerComponent } from '../shared/components/theme-picker/theme-picker.component';
import { AuthService } from '../noyau/auth.service';

interface EntreeMenu { libelle: string; icone: string; lien: string; exact?: boolean }

/**
 * Coquille de l'application, reprise de l'app-shell du UI-Kit : rail d'icônes, barre d'outils
 * (titre de page, thème, compte) et panneau droit du compte.
 */
@Component({
  selector: 'app-coquille',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatSidenavModule, MatToolbarModule, MatIconModule, MatButtonModule, MatTooltipModule, NgScrollbarModule, ThemePickerComponent],
  styleUrl: './coquille.scss',
  template: `
  <mat-sidenav-container class="shell-container" autosize>
    <mat-sidenav #rail class="shell-sidenav" [mode]="mobile() ? 'over' : 'side'" [opened]="!mobile()">
      <div class="sidenav-inner">
        <div class="sidenav-header"><a routerLink="/" class="brand-mark" matTooltip="Pilotage" matTooltipPosition="right"><mat-icon>insights</mat-icon></a></div>
        <ng-scrollbar class="nav-scrollbar" visibility="hover">
          <nav class="nav-rail">
            @for (m of menu; track m.lien) {
              <a class="nav-rail-item" [routerLink]="m.lien" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!m.exact }"
                 [matTooltip]="m.libelle" matTooltipPosition="right" (click)="mobile() && rail.close()">
                <mat-icon>{{ m.icone }}</mat-icon><span class="lbl">{{ m.libelle }}</span>
              </a>
            }
          </nav>
        </ng-scrollbar>
        <button type="button" class="user-avatar-btn" [matTooltip]="auth.utilisateur()?.nom" matTooltipPosition="right" (click)="compte.open()">
          @if (auth.utilisateur()?.photo_url) { <img class="avatar" [src]="auth.utilisateur()!.photo_url" alt="" referrerpolicy="no-referrer" style="object-fit: cover" /> } @else { <div class="avatar">{{ initiales() }}</div> }
        </button>
      </div>
    </mat-sidenav>

    <mat-sidenav-content>
      <mat-toolbar class="shell-toolbar">
        <button mat-icon-button (click)="rail.toggle()" aria-label="Menu"><mat-icon>{{ rail.opened ? 'menu_open' : 'menu' }}</mat-icon></button>
        <span class="page-title">{{ titre() }}</span>
        <span class="spacer"></span>
        <button mat-icon-button (click)="theme.toggle()" [matTooltip]="theme.mode() === 'light' ? 'Mode sombre' : 'Mode clair'">
          <mat-icon>{{ theme.mode() === 'light' ? 'dark_mode' : 'light_mode' }}</mat-icon>
        </button>
        <app-theme-picker />
        <button mat-icon-button class="avatar-btn" (click)="compte.open()" matTooltip="Mon compte">@if (auth.utilisateur()?.photo_url) { <img class="avatar" [src]="auth.utilisateur()!.photo_url" alt="" referrerpolicy="no-referrer" style="object-fit: cover" /> } @else { <div class="avatar">{{ initiales() }}</div> }</button>
      </mat-toolbar>
      <ng-scrollbar class="content-area" visibility="hover">
        <router-outlet />
      </ng-scrollbar>
    </mat-sidenav-content>

    <mat-sidenav #compte class="right-drawer" position="end" mode="over">
      <div class="sidenav-inner">
        <div class="compte">
          <div class="tete">
            @if (auth.utilisateur()?.photo_url) { <img class="avatar lg" [src]="auth.utilisateur()!.photo_url" alt="" referrerpolicy="no-referrer" style="object-fit: cover" /> } @else { <div class="avatar lg">{{ initiales() }}</div> }
            <div class="id"><strong>{{ auth.utilisateur()?.nom }}</strong><small>{{ auth.utilisateur()?.email }}</small></div>
            <span class="spacer"></span>
            <button mat-icon-button (click)="compte.close()" aria-label="Fermer"><mat-icon>close</mat-icon></button>
          </div>
          <div class="lignes">
            <a routerLink="/parametres/compte" (click)="compte.close()"><mat-icon>person</mat-icon>Mon compte</a>
            <a routerLink="/parametres/securite" (click)="compte.close()"><mat-icon>shield</mat-icon>Sécurité et sessions</a>
            <button (click)="theme.toggle()"><mat-icon>contrast</mat-icon>{{ theme.mode() === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair' }}</button>
            <button (click)="compte.close(); auth.deconnexion()"><mat-icon>logout</mat-icon>Se déconnecter</button>
          </div>
          <div class="bas">Rôle : {{ auth.utilisateur()?.role }} · dates en heure d'Abidjan (UTC+0)</div>
        </div>
      </div>
    </mat-sidenav>
  </mat-sidenav-container>`,
})
export class Coquille {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  readonly mobile = signal(false);
  readonly titre = signal('Pilotage');
  readonly menu: EntreeMenu[] = [
    { libelle: 'Portefeuille', icone: 'dashboard', lien: '/', exact: true },
    { libelle: 'Paramètres', icone: 'settings', lien: '/parametres' },
  ];
  readonly initiales = computed(() => (this.auth.utilisateur()?.nom ?? '?').split(/\s+/).filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase());

  constructor() {
    inject(BreakpointObserver).observe([Breakpoints.Handset, Breakpoints.TabletPortrait]).subscribe((r) => this.mobile.set(r.matches));
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      let r = this.router.routerState.snapshot.root; let t = 'Pilotage';
      while (r) { if (r.data['titre']) t = r.data['titre']; r = r.firstChild!; }
      this.titre.set(t);
    });
  }
}
