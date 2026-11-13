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

/** Brancher les assistants IA (Claude Code, Claude Desktop, Cursor, VS Code, Codex, Gemini CLI, Windsurf) sur le serveur MCP : jetons d'API (création, affichage unique, révocation, renouvellement) et commandes prêtes à copier. */
@Component({
  selector: 'app-param-claude',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatDatepickerModule, CopyFieldComponent, SearchableSelectComponent, Chargement, ...PIPES],
  styleUrl: './parametres.scss',
  host: { style: 'display: contents' },
  styles: [`.etapes { margin: 0; padding-left: 20px; font-size: var(--fs-body-sm); line-height: 1.6; li { margin-bottom: 14px; } }
    .cmds { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
    .projets { display: flex; flex-wrap: wrap; gap: 8px; }
    .role-jeton { display: inline-block; padding: 1px 8px; margin-right: 4px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); }
    .bloc-code { position: relative; pre { margin: 0; padding: 14px 16px; border-radius: var(--radius-sm); background: var(--mat-sys-surface-container-high, var(--hover-bg));
      font: 12.5px/1.5 var(--font-mono, ui-monospace, monospace); overflow-x: auto; white-space: pre; } button { position: absolute; top: 8px; right: 8px; } }
    .jeton-neuf { padding: 16px; border-radius: var(--radius-md); background: var(--success-color-light); margin-bottom: 8px;
      strong { display: flex; align-items: center; gap: 8px; color: var(--success-color-text, var(--success-color)); } p { margin: 6px 0 12px; font-size: 13px; } }`],
  template: `
  <section class="card pane">
    <header><h2>Assistants IA et serveur MCP</h2><p>Le serveur MCP « pilotage » (Streamable HTTP, jeton en en-tête) fonctionne avec les assistants les plus utilisés : l'agent lit l'état des projets et y écrit (notes de session, statuts, documents).</p></header>
    <ol class="etapes">
      <li><strong>Créez un jeton d'API</strong> ci-dessous (un par développeur et par poste, limité à ses projets).</li>
      <li><strong>Sur le poste, définissez la variable</strong> <code>PILOTAGE_TOKEN</code> (jamais dans un fichier versionné) :
        <div class="cmds"><app-copy-field [value]="cmdExport()" label="Terminal (macOS / Linux, ~/.bashrc ou ~/.zshrc)" /><app-copy-field [value]="cmdExportWin()" label="PowerShell (Windows) — puis rouvrir le terminal" /></div></li>
      <li><strong>Branchez votre assistant</strong> :
        <div class="m3-filter-toggle" role="tablist" aria-label="Assistant" style="margin: 10px 0 12px">
          @for (c of clients; track c.id) { <button type="button" role="tab" [class.active]="client() === c.id" (click)="client.set(c.id)"><mat-icon>{{ c.icone }}</mat-icon>{{ c.nom }}</button> }
        </div>
        @if (clientCourant(); as c) {
          <p class="muted" style="margin: 0 0 8px">{{ c.aide }}</p>
          @if (c.fichier) { <p style="margin: 0 0 6px; font-size: 13px">Fichier : <code>{{ c.fichier }}</code></p> }
          @if (c.config) {
            <div class="bloc-code"><pre>{{ c.config }}</pre><button mat-stroked-button type="button" (click)="copier(c.config)"><mat-icon>content_copy</mat-icon>Copier</button></div>
          }
          @if (c.note) { <p class="muted" style="margin: 8px 0 0; font-size: 12.5px"><mat-icon style="font-size: 15px; width: 15px; height: 15px; vertical-align: -3px">info</mat-icon> {{ c.note }}</p> }
        }
        <small class="muted">Puis dans l'assistant : « donne-moi l'état du projet », « ajoute une note de session ».</small></li>
      <li><strong>Recommandé — installez le kit dans chaque dépôt de code</strong> : configure d'un coup Claude Code (journal automatique hors ligne, documentaliste, commandes), Cursor, VS Code, Gemini CLI, Windsurf et <code>AGENTS.md</code> (consignes lues par Codex, Copilot, Cursor, Gemini…) :
        <div class="cmds"><app-copy-field [value]="cmdKit()" label="Depuis le dépôt de code (nécessite une copie de pilotage-api)" /></div></li>
    </ol>
  </section>

  @if (eq.estAdmin()) {
    <section class="card pane">
      <header><h2>Nouveau jeton d'API</h2><p>Choisissez le rôle du jeton : « Agent » (restreint : jamais de validation, de signature ni de suppression) ou un rôle humain, plafonné par celui du titulaire. Les écritures restent marquées « Agent ».</p></header>
      @if (neuf(); as n) {
        <div class="jeton-neuf"><strong><mat-icon>key</mat-icon>Jeton « {{ n.nom }} » créé</strong><p>{{ n.avertissement }}</p><app-copy-field [value]="n.jeton" label="Jeton d'API" /></div>
      }
      <form (ngSubmit)="creer()">
        <div class="set"><div class="s-lbl"><strong>Nom</strong><small>Ex. « Poste de Konan — backend »</small></div>
          <div class="s-ctl"><div class="form-field"><div class="field-box"><input name="nom" [(ngModel)]="f.nom" placeholder="Poste de …" /></div></div></div></div>
        <div class="set"><div class="s-lbl"><strong>Développeur</strong><small>Titulaire du jeton ; ses écritures porteront son nom avec le badge Agent.</small></div>
          <div class="s-ctl"><app-searchable-select name="u" [(ngModel)]="f.utilisateur_id" [options]="optionsMembres()" icon="person" placeholder="Choisir" /></div></div>
        <div class="set"><div class="s-lbl"><strong>Rôle du jeton</strong><small>Ne peut pas dépasser le rôle du titulaire.</small></div>
          <div class="s-ctl"><app-searchable-select name="role" [(ngModel)]="f.role" [options]="optionsRoles()" icon="badge" placeholder="Rôle" /></div></div>
        <div class="set"><div class="s-lbl"><strong>Projets autorisés</strong><small>Aucun sélectionné = tous les projets accessibles au titulaire.</small></div>
          <div class="s-ctl projets">@for (p of nav.projets() ?? []; track p.id) {
            <button type="button" class="chip-filter" [class.on]="f.projets.includes(p.id)" (click)="basculer(p.id)"><mat-icon>{{ f.projets.includes(p.id) ? 'check' : 'folder' }}</mat-icon>{{ p.nom }}</button> }</div></div>
        <div class="set"><div class="s-lbl"><strong>Expiration</strong><small>Facultative</small></div>
          <div class="s-ctl"><div class="form-field"><div class="field-box"><input name="exp" [matDatepicker]="dpExp" [(ngModel)]="f.expire" placeholder="jj/mm/aaaa" /><mat-datepicker-toggle [for]="dpExp" /><mat-datepicker #dpExp /></div></div></div></div>
        <footer><button mat-flat-button color="primary" type="submit" [disabled]="f.nom.trim().length < 2 || !f.utilisateur_id || !roleValide() || enCours()"><mat-icon>key</mat-icon>Créer le jeton</button></footer>
      </form>
    </section>

    <section class="card pane">
      <header><h2>Jetons de l'équipe</h2><p>Préfixe visible seulement : la valeur complète n'est jamais conservée en clair.</p></header>
      @if (!jetons()) { <app-chargement forme="parametres" [lignes]="3" /> }
      @for (j of jetons() ?? []; track j.id) {
        <div class="set inline">
          <span class="ic-tile" [class]="'ic-tile ' + (actif(j) ? 'tone-success' : 'tone-neutral')"><mat-icon>{{ actif(j) ? 'key' : 'key_off' }}</mat-icon></span>
          <div class="s-lbl"><strong>{{ j.nom }} <code style="font-size: 11px">{{ j.prefixe }}…</code></strong>
            <small><span class="role-jeton">{{ libelleRole(j.role) }}</span> {{ nomMembre(j.utilisateur_id) }} · {{ j.projets.length ? nomsProjets(j.projets) : 'tous ses projets' }} · créé le {{ j.cree_le | dateFr }}
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
  f: { nom: string; utilisateur_id: string; role: JetonApiDto['role']; projets: string[]; expire: Date | null } = { nom: '', utilisateur_id: '', role: 'agent', projets: [], expire: null };
  private static readonly ROLES: { value: JetonApiDto['role']; label: string; description: string; rang: number }[] = [
    { value: 'agent', label: 'Agent', description: 'Restreint : ni validation, ni signature, ni suppression', rang: 1 },
    { value: 'admin', label: 'Administrateur', description: "Tous les droits de l'équipe", rang: 3 },
    { value: 'chef_projet', label: 'Chef de projet', description: 'Gère et valide ses projets', rang: 2 },
    { value: 'developpeur', label: 'Développeur', description: 'Travaille sur ses projets', rang: 1 },
    { value: 'client_lecteur', label: 'Lecteur', description: 'Lecture seule', rang: 0 },
  ];
  private rangTitulaire() { const r = this.membres().find((m) => m.id === this.f.utilisateur_id)?.role; return ({ client_lecteur: 0, developpeur: 1, chef_projet: 2, admin: 3 } as any)[r ?? ''] ?? -1; }
  optionsRoles() { const r = this.rangTitulaire(); return ParamClaudeCode.ROLES.filter((x) => x.rang <= r).map((x) => ({ value: x.value, label: x.label, description: x.description, icon: x.value === 'agent' ? 'smart_toy' : 'badge' })); }
  roleValide() { return this.optionsRoles().some((o) => o.value === this.f.role); }
  libelleRole(r: string) { return ParamClaudeCode.ROLES.find((x) => x.value === r)?.label ?? r; }

  private readonly url = CONFIG.apiUrl.replace(/\/$/, '');
  private readonly jetonAffiche = computed(() => this.neuf()?.jeton ?? 'plt_…');
  readonly cmdExport = computed(() => `export PILOTAGE_TOKEN=${this.jetonAffiche()}`);
  readonly cmdExportWin = computed(() => `setx PILOTAGE_TOKEN "${this.jetonAffiche()}"`);
  readonly client = signal('claude-code');
  readonly clients: { id: string; nom: string; icone: string }[] = [
    { id: 'claude-code', nom: 'Claude Code', icone: 'terminal' }, { id: 'claude-desktop', nom: 'Claude Desktop', icone: 'desktop_windows' },
    { id: 'cursor', nom: 'Cursor', icone: 'ads_click' }, { id: 'vscode', nom: 'VS Code · Copilot', icone: 'code' },
    { id: 'codex', nom: 'Codex (OpenAI)', icone: 'smart_toy' }, { id: 'gemini', nom: 'Gemini CLI', icone: 'auto_awesome' },
    { id: 'windsurf', nom: 'Windsurf', icone: 'air' }, { id: 'web', nom: 'ChatGPT · claude.ai', icone: 'public' },
  ];
  readonly clientCourant = computed(() => {
    const u = `${this.url}/mcp`; const j = this.jetonAffiche();
    const json = (o: unknown) => JSON.stringify(o, null, 2);
    switch (this.client()) {
      case 'claude-code': return { aide: 'Une commande suffit (le jeton est lu dans PILOTAGE_TOKEN au lancement).', fichier: '',
        config: `claude mcp add --transport http pilotage ${u} --header "Authorization: Bearer \${PILOTAGE_TOKEN}"`, note: 'Ajoutez « --scope user » pour l’activer dans tous vos dépôts.' };
      case 'claude-desktop': return { aide: 'Claude Desktop passe par la passerelle mcp-remote (Node.js requis) : Réglages → Développeur → Modifier la configuration.', fichier: 'claude_desktop_config.json',
        config: json({ mcpServers: { pilotage: { command: 'npx', args: ['-y', 'mcp-remote', u, '--header', 'Authorization:${PILOTAGE_AUTH}'], env: { PILOTAGE_AUTH: `Bearer ${j}` } } } }),
        note: 'Ce fichier est local à votre poste : le jeton y est écrit, ne le partagez pas. Redémarrez Claude Desktop ensuite.' };
      case 'cursor': return { aide: 'Paramètres de Cursor → MCP, ou directement le fichier ci-dessous (global) ; le kit écrit aussi .cursor/mcp.json dans chaque dépôt.', fichier: '~/.cursor/mcp.json',
        config: json({ mcpServers: { pilotage: { url: u, headers: { Authorization: 'Bearer ${env:PILOTAGE_TOKEN}' } } } }), note: '' };
      case 'vscode': return { aide: 'Mode agent de GitHub Copilot (VS Code 1.99+). VS Code demande le jeton au premier démarrage du serveur et le conserve de façon chiffrée.', fichier: '.vscode/mcp.json',
        config: json({ servers: { pilotage: { type: 'http', url: u, headers: { Authorization: 'Bearer ${input:pilotage-token}' } } }, inputs: [{ type: 'promptString', id: 'pilotage-token', description: "Jeton d'API Pilotage", password: true }] }), note: '' };
      case 'codex': return { aide: 'Codex CLI / extension Codex (OpenAI). Ajoutez la section au fichier de configuration ; le jeton est lu dans PILOTAGE_TOKEN.', fichier: '~/.codex/config.toml',
        config: `[mcp_servers.pilotage]\nurl = "${u}"\nbearer_token_env_var = "PILOTAGE_TOKEN"`, note: 'Les consignes du projet sont lues dans AGENTS.md (écrit par le kit). Vérifiez avec « codex mcp list ».' };
      case 'gemini': return { aide: 'Gemini CLI (Google) : une commande, ou le fichier de réglages (global ou .gemini/settings.json du dépôt, écrit par le kit).', fichier: '~/.gemini/settings.json',
        config: json({ mcpServers: { pilotage: { httpUrl: u, headers: { Authorization: 'Bearer $PILOTAGE_TOKEN' }, timeout: 30000 } } }),
        note: `Ou : gemini mcp add --transport http pilotage ${u} --header "Authorization: Bearer $PILOTAGE_TOKEN"` };
      case 'windsurf': return { aide: 'Windsurf (Codeium) : Cascade → MCP → « View raw config ».', fichier: '~/.codeium/windsurf/mcp_config.json',
        config: json({ mcpServers: { pilotage: { serverUrl: u, headers: { Authorization: 'Bearer ${env:PILOTAGE_TOKEN}' } } } }), note: '' };
      default: return { aide: "claude.ai et ChatGPT se connectent par OAuth : aucun jeton à copier. Ajoutez un connecteur avec l'URL ci-dessous, puis connectez-vous à Pilotage et choisissez le rôle accordé.", fichier: '',
        config: u, note: "claude.ai : Paramètres → Connecteurs → Ajouter un connecteur personnalisé. ChatGPT : Paramètres → Applications et connecteurs → mode développeur → Créer. L'accès (30 jours, renouvelé automatiquement) apparaît ensuite dans la liste des jetons ci-dessous, où il est révocable." };
    }
  });
  copier(texte: string) { navigator.clipboard?.writeText(texte).then(() => this.snack.open('Copié', undefined, { duration: 1500 })).catch(() => undefined); }
  readonly cmdKit = computed(() => `node ../pilotage-api/claude-kit/installer.mjs --repo . --api ${this.url} --projet ${this.nav.projetCourant() ?? this.nav.projets()?.[0]?.code ?? '<code-projet>'} --depot backend --clients tous`);
  readonly optionsMembres = computed(() => this.membres().filter((m) => m.actif).map((m) => ({ value: m.id, label: m.nom, description: m.email, icon: 'person' })));

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

  async creer(body = { utilisateur_id: this.f.utilisateur_id, nom: this.f.nom.trim(), role: this.f.role, projets: this.f.projets, expire_le: versIso(this.f.expire) ?? undefined }) {
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
      await this.creer({ utilisateur_id: j.utilisateur_id, nom: j.nom, role: j.role, projets: j.projets, expire_le: undefined });
      this.snack.open('Ancien jeton révoqué : remplacez PILOTAGE_TOKEN sur le poste.', undefined, { duration: 5000 });
    } catch (e) { this.erreur(e); }
  }
}
