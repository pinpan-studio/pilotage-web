import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Api } from '../../api/genere/api';
import { oAuthConsentementApprouver, oAuthConsentementClient, oAuthConsentementRefuser } from '../../api/genere/functions';
import { ClientOAuthDto } from '../../api/genere/models';
import { AuthService } from '../noyau/auth.service';
import { EquipeService } from '../noyau/equipe.service';
import { NavigationService } from '../noyau/navigation.service';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';

const RANG: Record<string, number> = { client_lecteur: 0, developpeur: 1, chef_projet: 2, admin: 3 };
const ROLES = [
  { value: 'agent', label: 'Agent', description: 'Lit et documente ; jamais de validation, signature ni suppression', icon: 'smart_toy', rang: 1 },
  { value: 'client_lecteur', label: 'Lecture seule', description: 'Consulte les projets, ne modifie rien', icon: 'visibility', rang: 0 },
  { value: 'developpeur', label: 'Développeur', description: 'Met à jour fonctionnalités, tâches et documents', icon: 'code', rang: 1 },
  { value: 'chef_projet', label: 'Chef de projet', description: 'Pilote et valide ses projets', icon: 'manage_accounts', rang: 2 },
  { value: 'admin', label: 'Administrateur', description: "Tous les droits de l'équipe", icon: 'admin_panel_settings', rang: 3 },
];

/** Consentement OAuth : un assistant (claude.ai, ChatGPT…) demande l'accès au serveur MCP de Pilotage. */
@Component({
  selector: 'app-autoriser',
  imports: [FormsModule, MatButtonModule, MatIconModule, SearchableSelectComponent],
  styles: [`:host { display: grid; place-items: center; min-height: 100dvh; padding: 16px; box-sizing: border-box; background: var(--mat-sys-surface-container-low); }
    .boite { width: min(560px, 100%); background: var(--mat-sys-surface); border: 1px solid var(--mat-sys-outline-variant); border-radius: 20px; padding: 28px; box-sizing: border-box; }
    h1 { font-size: 22px; margin: 12px 0 4px; } .logo { display: flex; align-items: center; gap: 10px; color: var(--mat-sys-primary); font-weight: 700; }
    .qui { display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: 12px; background: var(--mat-sys-surface-container); margin: 16px 0; }
    label { display: block; font-size: 12px; font-weight: 600; margin: 14px 0 6px; color: var(--mat-sys-on-surface-variant); }
    ul { margin: 8px 0 0; padding-left: 18px; font-size: 13px; color: var(--mat-sys-on-surface-variant); }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 22px; flex-wrap: wrap; } .err { color: var(--mat-sys-error); }
    .projets { display: flex; flex-wrap: wrap; gap: 8px; }`],
  template: `
  <div class="boite">
    <div class="logo"><mat-icon>insights</mat-icon>Pilotage</div>
    @if (erreur()) { <h1>Demande invalide</h1><p class="err">{{ erreur() }}</p> }
    @else if (client(); as c) {
      <h1>« {{ c.nom }} » demande l'accès à Pilotage</h1>
      <p class="muted">L'assistant pourra utiliser le serveur MCP de Pilotage en votre nom, dans les limites choisies ci-dessous.</p>
      <div class="qui"><mat-icon>account_circle</mat-icon><div><strong>{{ auth.utilisateur()?.nom }}</strong><div class="mini">{{ auth.utilisateur()?.email }} · équipe {{ eq.courante()?.nom ?? '…' }}</div></div></div>
      <label>Rôle accordé à l'assistant</label>
      <app-searchable-select name="role" [(ngModel)]="role" [options]="roles()" icon="badge" />
      <label>Projets</label>
      <div class="projets">
        <button type="button" class="chip-filter" [class.on]="!projets().length" (click)="projets.set([])"><mat-icon>{{ !projets().length ? 'check' : 'select_all' }}</mat-icon>Tous mes projets</button>
        @for (p of nav.projets() ?? []; track p.id) { <button type="button" class="chip-filter" [class.on]="projets().includes(p.id)" (click)="basculer(p.id)"><mat-icon>{{ projets().includes(p.id) ? 'check' : 'folder' }}</mat-icon>{{ p.nom }}</button> }
      </div>
      <ul>
        <li>L'accès est valable 30 jours et se renouvelle automatiquement ; révocable à tout moment dans Paramètres → Assistants IA.</li>
        <li>Les écritures de l'assistant sont tracées avec votre nom et le badge « Agent ».</li>
        <li>Retour vers : <code>{{ hote() }}</code></li>
      </ul>
      <div class="actions">
        <button mat-button (click)="refuser()" [disabled]="enCours()">Refuser</button>
        <button mat-flat-button color="primary" (click)="approuver()" [disabled]="enCours() || !role"><mat-icon>check</mat-icon>Autoriser</button>
      </div>
    } @else { <p>Chargement…</p> }
  </div>`,
})
export class Autoriser {
  readonly auth = inject(AuthService);
  readonly eq = inject(EquipeService);
  readonly nav = inject(NavigationService);
  private readonly api = inject(Api);
  private readonly q = new URLSearchParams(location.search);
  readonly client = signal<ClientOAuthDto | null>(null);
  readonly erreur = signal('');
  readonly enCours = signal(false);
  readonly projets = signal<string[]>([]);
  role = 'agent';
  readonly roles = computed(() => {
    const r = RANG[this.auth.utilisateur()?.role ?? 'client_lecteur'] ?? 0;
    return ROLES.filter((x) => x.rang <= r && !(x.value === 'agent' && r === 0)).map(({ rang, ...o }) => o);
  });
  hote() { try { return new URL(this.q.get('redirect_uri') ?? '').host; } catch { return '?'; } }
  private corps() {
    return { client_id: this.q.get('client_id') ?? '', redirect_uri: this.q.get('redirect_uri') ?? '', code_challenge: this.q.get('code_challenge') ?? '', state: this.q.get('state') ?? undefined };
  }
  constructor() {
    this.eq.charger(); this.nav.chargerProjets();
    if (this.auth.utilisateur()?.role === 'client_lecteur') this.role = 'client_lecteur';
    const id = this.q.get('client_id');
    if (!id || !this.q.get('redirect_uri') || !this.q.get('code_challenge')) { this.erreur.set('Paramètres manquants (client_id, redirect_uri, code_challenge).'); return; }
    this.api.invoke(oAuthConsentementClient, { id }).then((c) => {
      if (!c.redirect_uris.includes(this.q.get('redirect_uri')!)) this.erreur.set("L'adresse de retour n'est pas enregistrée pour cet assistant."); else this.client.set(c);
    }).catch(() => this.erreur.set('Assistant inconnu : relancez la connexion depuis votre assistant.'));
  }
  basculer(id: string) { this.projets.set(this.projets().includes(id) ? this.projets().filter((x) => x !== id) : [...this.projets(), id]); }
  async approuver() {
    this.enCours.set(true);
    try { const r = await this.api.invoke(oAuthConsentementApprouver, { body: { ...this.corps(), role: this.role as any, projets: this.projets() } }); location.href = r.redirection; }
    catch (e: any) { this.erreur.set(e?.error?.message?.error_description ?? e?.error?.error_description ?? 'Autorisation impossible.'); this.enCours.set(false); }
  }
  async refuser() {
    this.enCours.set(true);
    try { const r = await this.api.invoke(oAuthConsentementRefuser, { body: this.corps() }); location.href = r.redirection; } catch { this.enCours.set(false); }
  }
}
