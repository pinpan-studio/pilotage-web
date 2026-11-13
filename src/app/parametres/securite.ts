import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../api/genere/api';
import { compteRevoquer, compteRevoquerAutres, compteSessions } from '../../api/genere/functions';
import { SessionConnexionDto } from '../../api/genere/models';
import { AuthService } from '../noyau/auth.service';
import { PIPES } from '../noyau/pipes';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';

/** Décrit grossièrement un navigateur à partir de son user-agent. */
export function decrireAppareil(ua: string) {
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  const mobile = /Mobile|Android|iPhone/.test(ua);
  return { libelle: os ? `${nav} sur ${os}` : nav, icone: mobile ? 'smartphone' : 'computer' };
}

@Component({
  selector: 'app-securite',
  imports: [MatButtonModule, MatIconModule, ...PIPES],
  styleUrl: './parametres.scss',
  host: { style: 'display: contents' },
  template: `
  <section class="card pane">
    <header><h2>Sessions actives</h2><p>Appareils connectés à votre compte. Révoquer une session déconnecte cet appareil (sous 15 minutes au plus).</p></header>
    @for (s of sessions(); track s.id) {
      <div class="set inline">
        <span class="ic-tile"><mat-icon>{{ appareil(s).icone }}</mat-icon></span>
        <div class="s-lbl"><strong>{{ appareil(s).libelle }} @if (s.courante) { <span class="ref tone-success">Cet appareil</span> }</strong>
          <small>{{ s.methode === 'google' ? 'Google' : 'Mot de passe' }} · ouverte le {{ s.ouverte_le | dateFr: true }} · activité {{ s.derniere_activite | dateFr: true }}{{ s.ip ? ' · ' + s.ip : '' }}</small></div>
        @if (s.courante) { <button mat-stroked-button (click)="auth.deconnexion()">Se déconnecter</button> }
        @else { <button mat-stroked-button color="warn" (click)="revoquer(s)">Révoquer</button> }
      </div>
    } @empty { <div class="loading">Chargement…</div> }
    @if (sessions().length > 1) { <footer><button mat-flat-button color="warn" (click)="revoquerAutres()"><mat-icon>logout</mat-icon>Déconnecter les autres appareils</button></footer> }
  </section>`,
})
export class Securite {
  private readonly api = inject(Api);
  readonly auth = inject(AuthService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  readonly sessions = signal<SessionConnexionDto[]>([]);
  appareil = (s: SessionConnexionDto) => decrireAppareil(s.appareil);
  constructor() { this.charger(); }
  charger() { this.api.invoke(compteSessions).then((s) => this.sessions.set(s)); }
  private confirmer(titre: string, message: string) {
    return firstValueFrom(this.dialog.open(ConfirmDialogComponent, { data: { title: titre, message, confirmLabel: 'Confirmer', cancelLabel: 'Annuler', type: 'danger' }, width: '420px' }).afterClosed());
  }
  async revoquer(s: SessionConnexionDto) {
    if (!(await this.confirmer('Révoquer la session', `Déconnecter « ${this.appareil(s).libelle} » ?`))) return;
    await this.api.invoke(compteRevoquer, { id: s.id }); this.snack.open('Session révoquée', undefined, { duration: 2500 }); this.charger();
  }
  async revoquerAutres() {
    if (!(await this.confirmer('Déconnecter les autres appareils', 'Toutes les autres sessions seront fermées.'))) return;
    const r = await this.api.invoke(compteRevoquerAutres); this.snack.open(`${r.revoquees} session(s) révoquée(s)`, undefined, { duration: 2500 }); this.charger();
  }
}
