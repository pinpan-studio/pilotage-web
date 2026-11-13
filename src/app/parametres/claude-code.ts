import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { Api } from '../../api/genere/api';
import { equipesMembres, jetonsCreer, jetonsLister, jetonsRevoquer } from '../../api/genere/functions';
import { JetonApiCreeDto, JetonApiDto, MembreEquipeDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { CONFIG } from '../noyau/config';
import { versIso } from '../noyau/dates';
import { EquipeService } from '../noyau/equipe.service';
import { NavigationService } from '../noyau/navigation.service';
import { AuthService } from '../noyau/auth.service';
import { Chargement } from '../noyau/chargement';
import { CopyFieldComponent } from '../shared/components/fields';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';

/** Brancher Claude Code sur le serveur MCP : jetons d'API (création, affichage unique, révocation, renouvellement) et commandes prêtes à copier. */
@Component({
  selector: 'app-param-claude',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatDatepickerModule, CopyFieldComponent, SearchableSelectComponent, Chargement, ...PIPES],
  styleUrl: './parametres.scss',
  host: { style: 'display: contents' },
  styles: [`.etapes { margin: 0; padding-left: 20px; font-size: var(--fs-body-sm); line-height: 1.6; li { margin-bottom: 14px; } }
    .cmds { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
    .projets { display: flex; flex-wrap: wrap; gap: 8px; }
    .jeton-neuf { padding: 16px; border-radius: var(--radius-md); background: var(--success-color-light); margin-bottom: 8px;
      strong { display: flex; align-items: center; gap: 8px; color: var(--success-color-text, var(--success-color)); } p { margin: 6px 0 12px; font-size: 13px; } }`],
  template: `
  <section class="card pane">
    <header><h2>Claude Code et serveur MCP</h2><p>L'agent IA lit l'état des projets et y écrit (notes de session, statuts, documents) via le serveur MCP « pilotage ».</p></header>
    <ol class="etapes">
      <li><strong>Créez un jeton d'API</strong> ci-dessous (un par développeur et par poste, limité à ses projets).</li>
      <li><strong>Sur le poste, définissez la variable</strong> <code>PILOTAGE_TOKEN</code> (jamais dans un fichier versionné) :
        <div class="cmds"><app-copy-field [value]="cmdExport()" label="Terminal (macOS / Linux, ~/.bashrc ou ~/.zshrc)" /><app-copy-field [value]="cmdExportWin()" label="PowerShell (Windows)" /></div></li>
      <li><strong>Ajoutez le serveur MCP à Claude Code</strong> :
        <div class="cmds"><app-copy-field [value]="cmdMcp()" label="Commande Claude Code" /></div>
        <small class="muted">Puis dans Claude Code : « donne-moi l'état du projet », « ajoute une note de session ».</small></li>
      <li><strong>Recommandé — installez le kit dans chaque dépôt de code</strong> (journal automatique hors ligne, documentaliste, commandes /document, /fin-session…) :
        <div class="cmds"><app-copy-field [value]="cmdKit()" label="Depuis le dépôt de code (nécessite une copie de pilotage-api)" /></div></li>
    </ol>
  </section>

  @if (eq.estAdmin()) {
    <section class="card pane">
      <header><h2>Nouveau jeton d'API</h2><p>Le jeton donne le rôle « agent » : jamais de validation, de signature ni de suppression, quels que soient les droits de son titulaire.</p></header>
      @if (neuf(); as n) {
        <div class="jeton-neuf"><strong><mat-icon>key</mat-icon>Jeton « {{ n.nom }} » créé</strong><p>{{ n.avertissement }}</p><app-copy-field [value]="n.jeton" label="Jeton d'API" /></div>
      }
      <form (ngSubmit)="creer()">
        <div class="set"><div class="s-lbl"><strong>Nom</strong><small>Ex. « Poste de Konan — backend »</small></div>
          <div class="s-ctl"><div class="form-field"><div class="field-box"><input name="nom" [(ngModel)]="f.nom" placeholder="Poste de …" /></div></div></div></div>
        <div class="set"><div class="s-lbl"><strong>Développeur</strong><small>Titulaire du jeton ; ses écritures porteront son nom avec le badge Agent.</small></div>
          <div class="s-ctl"><app-searchable-select name="u" [(ngModel)]="f.utilisateur_id" [options]="optionsMembres()" icon="person" placeholder="Choisir" /></div></div>
        <div class="set"><div class="s-lbl"><strong>Projets autorisés</strong><small>Le développeur doit aussi être membre du projet.</small></div>
          <div class="s-ctl projets">@for (p of nav.projets() ?? []; track p.id) {
            <button type="button" class="chip-filter" [class.on]="f.projets.includes(p.id)" (click)="basculer(p.id)"><mat-icon>{{ f.projets.includes(p.id) ? 'check' : 'folder' }}</mat-icon>{{ p.nom }}</button> }</div></div>
        <div class="set"><div class="s-lbl"><strong>Expiration</strong><small>Facultative</small></div>
          <div class="s-ctl"><div class="form-field"><div class="field-box"><input name="exp" [matDatepicker]="dpExp" [(ngModel)]="f.expire" placeholder="jj/mm/aaaa" /><mat-datepicker-toggle [for]="dpExp" /><mat-datepicker #dpExp /></div></div></div></div>
        <footer><button mat-flat-button color="primary" type="submit" [disabled]="f.nom.trim().length < 2 || !f.utilisateur_id || !f.projets.length || enCours()"><mat-icon>key</mat-icon>Créer le jeton</button></footer>
      </form>
    </section>

    <section class="card pane">
      <header><h2>Jetons de l'équipe</h2><p>Préfixe visible seulement : la valeur complète n'est jamais conservée en clair.</p></header>
      @if (!jetons()) { <app-chargement forme="parametres" [lignes]="3" /> }
      @for (j of jetons() ?? []; track j.id) {
        <div class="set inline">
          <span class="ic-tile" [class]="'ic-tile ' + (actif(j) ? 'tone-success' : 'tone-neutral')"><mat-icon>{{ actif(j) ? 'key' : 'key_off' }}</mat-icon></span>
          <div class="s-lbl"><strong>{{ j.nom }} <code style="font-size: 11px">{{ j.prefixe }}…</code></strong>
            <small>{{ nomMembre(j.utilisateur_id) }} · {{ nomsProjets(j.projets) }} · créé le {{ j.cree_le | dateFr }}
              · {{ j.revoque_le ? 'révoqué le ' + (j.revoque_le | dateFr) : j.utilise_le ? 'utilisé le ' + (j.utilise_le | dateFr: true) : 'jamais utilisé' }}{{ j.expire_le ? ' · expire le ' + (j.expire_le | dateFr) : '' }}</small></div>
          @if (actif(j)) {
            <button mat-stroked-button (click)="renouveler(j)" title="Révoque ce jeton et en crée un nouveau identique"><mat-icon>autorenew</mat-icon>Renouveler</button>
            <button mat-stroked-button color="warn" (click)="revoquer(j)"><mat-icon>block</mat-icon>Révoquer</button>
          }
        </div>
      } @empty { @if (jetons()) { <p class="muted" style="padding: 0 0 20px">Aucun jeton pour le moment.</p> } }
    </section>
  } @else {
    <section class="card pane"><header><h2>Jeton d'API</h2><p>Demandez à un administrateur de l'équipe de créer votre jeton (Paramètres → Claude Code), puis suivez les étapes ci-dessus.</p></header></section>
  }`,
})
export class ParamClaudeCode {
  private readonly api = inject(Api);
  private readonly snack = inject(MatSnackBar);
  private readonly auth = inject(AuthService);
  readonly eq = inject(EquipeService);
  readonly nav = inject(NavigationService);
  readonly jetons = signal<JetonApiDto[] | null>(null);
  readonly membres = signal<MembreEquipeDto[]>([]);
  readonly neuf = signal<JetonApiCreeDto | null>(null);
  readonly enCours = signal(false);
  f: { nom: string; utilisateur_id: string; projets: string[]; expire: Date | null } = { nom: '', utilisateur_id: '', projets: [], expire: null };

  private readonly url = CONFIG.apiUrl.replace(/\/$/, '');
  private readonly jetonAffiche = computed(() => this.neuf()?.jeton ?? 'plt_…');
  readonly cmdExport = computed(() => `export PILOTAGE_TOKEN=${this.jetonAffiche()}`);
  readonly cmdExportWin = computed(() => `setx PILOTAGE_TOKEN "${this.jetonAffiche()}"`);
  readonly cmdMcp = computed(() => `claude mcp add --transport http pilotage ${this.url}/mcp --header "Authorization: Bearer \${PILOTAGE_TOKEN}"`);
  readonly cmdKit = computed(() => `node ../pilotage-api/claude-kit/installer.mjs --repo . --api ${this.url} --projet ${this.nav.projetCourant() ?? this.nav.projets()?.[0]?.code ?? '<code-projet>'} --depot backend`);
  readonly optionsMembres = computed(() => this.membres().filter((m) => m.actif && m.role !== 'client_lecteur').map((m) => ({ value: m.id, label: m.nom, description: m.email, icon: 'person' })));

  constructor() {
    this.eq.charger(); this.nav.chargerProjets();
    this.f.utilisateur_id = this.auth.utilisateur()?.id ?? '';
    this.charger();
    this.api.invoke(equipesMembres).then((m) => this.membres.set(m)).catch(() => undefined);
  }
  charger() { this.api.invoke(jetonsLister).then((l) => this.jetons.set(l)).catch(() => this.jetons.set([])); }
  actif(j: JetonApiDto) { return !j.revoque_le && (!j.expire_le || new Date(j.expire_le) > new Date()); }
  basculer(id: string) { this.f.projets = this.f.projets.includes(id) ? this.f.projets.filter((x) => x !== id) : [...this.f.projets, id]; }
  nomMembre(id: string) { return this.membres().find((m) => m.id === id)?.nom ?? '—'; }
  nomsProjets(ids: string[]) { return ids.map((id) => this.nav.projets()?.find((p) => p.id === id)?.nom ?? '?').join(', '); }
  private erreur(e: any) { const m = e?.error?.message; this.snack.open(Array.isArray(m) ? m.join(' · ') : m ?? 'Opération impossible', 'Fermer', { duration: 5000 }); }

  async creer(body = { utilisateur_id: this.f.utilisateur_id, nom: this.f.nom.trim(), projets: this.f.projets, expire_le: versIso(this.f.expire) ?? undefined }) {
    this.enCours.set(true);
    try { this.neuf.set(await this.api.invoke(jetonsCreer, { body })); this.f.nom = ''; this.charger(); window.scrollTo({ top: 0 }); }
    catch (e) { this.erreur(e); } finally { this.enCours.set(false); }
  }
  async revoquer(j: JetonApiDto) {
    try { await this.api.invoke(jetonsRevoquer, { id: j.id }); this.snack.open(`Jeton « ${j.nom} » révoqué`, undefined, { duration: 2500 }); this.charger(); } catch (e) { this.erreur(e); }
  }
  async renouveler(j: JetonApiDto) {
    try {
      await this.api.invoke(jetonsRevoquer, { id: j.id });
      await this.creer({ utilisateur_id: j.utilisateur_id, nom: j.nom, projets: j.projets, expire_le: undefined });
      this.snack.open('Ancien jeton révoqué : remplacez PILOTAGE_TOKEN sur le poste.', undefined, { duration: 5000 });
    } catch (e) { this.erreur(e); }
  }
}
