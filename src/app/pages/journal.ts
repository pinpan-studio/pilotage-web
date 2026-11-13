import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../api/genere/api';
import { projetsJournal, projetsSessions } from '../../api/genere/functions';
import { PageEvenementsDto, SessionDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ProjetCourant } from './projet';

@Component({
  selector: 'app-journal',
  imports: [FormsModule, ...PIPES],
  template: `
  <div class="grille">
    <section class="carte large"><h2>Sessions</h2>
      @for (s of sessions(); track s.id) {
        <details class="session"><summary><b>{{ s.debut | dateFr }}</b> · {{ s.depot ?? '—' }} · {{ s.auteur }} @if (s.utilisateur_id) { <span class="badge petit b-agent">Agent</span> } @if (!s.fin) { <span class="badge petit b-en_cours">en cours</span> }
          @for (f of s.fonctionnalites; track f) { <span class="ref">{{ f }}</span> }</summary>
          @if (s.notes.length) { <h3>Notes</h3><ul>@for (n of s.notes; track n.ts) { <li><small>{{ n.ts | dateFr: true }}</small> — {{ n.texte }}</li> }</ul> }
          <div class="prose" [innerHTML]="s.resume | md"></div>
        </details>
      } @empty { <p class="vide">Aucune session.</p> }
    </section>
    <section class="carte large"><h2>Événements <small>({{ page()?.total ?? 0 }})</small></h2>
      <div class="filtres">
        <select class="filtre" [(ngModel)]="depot" (change)="charger(1)"><option value="">Tous les dépôts</option>@for (d of p.detail()?.depots ?? []; track d.id) { <option [value]="d.nom">{{ d.nom }}</option> }</select>
        <select class="filtre" [(ngModel)]="evt" (change)="charger(1)"><option value="">Tous les types</option>@for (t of types; track t) { <option [value]="t">{{ t }}</option> }</select>
        <input class="filtre" placeholder="Auteur" [(ngModel)]="auteur" (change)="charger(1)">
      </div>
      <div class="defile"><table class="tableau compact">
        <thead><tr><th>Date</th><th>Type</th><th>Dépôt</th><th>Auteur</th><th>Détail</th><th>Fonct.</th></tr></thead>
        <tbody>@for (e of page()?.elements ?? []; track e.id) {
          <tr><td><small>{{ e.ts | dateFr: true }}</small></td><td><span [class]="'evt e-' + e.evt">{{ e.evt }}</span></td><td>{{ e.depot }}</td><td>{{ e.auteur }}</td>
            <td class="code">{{ e.hash ? e.hash + ' ' : '' }}{{ e.fichier || e.commande || e.message }}</td><td>@for (f of e.fonctionnalites; track f) { <span class="ref">{{ f }}</span> }</td></tr>
        } @empty { <tr><td colspan="6" class="vide">Aucun événement.</td></tr> }</tbody>
      </table></div>
      @if (page(); as pg) { <p class="filtres"><button class="bouton secondaire" [disabled]="pg.page <= 1" (click)="charger(pg.page - 1)">‹ Précédent</button>
        <span class="mute">Page {{ pg.page }} / {{ pages() }}</span><button class="bouton secondaire" [disabled]="pg.page >= pages()" (click)="charger(pg.page + 1)">Suivant ›</button></p> }
    </section>
  </div>`,
})
export class Journal {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  readonly types = ['modification', 'creation', 'commande', 'commit', 'doc', 'agent'];
  readonly sessions = signal<SessionDto[]>([]);
  readonly page = signal<PageEvenementsDto | null>(null);
  depot = ''; evt = ''; auteur = '';
  pages() { const p = this.page(); return p ? Math.max(1, Math.ceil(p.total / p.par_page)) : 1; }
  constructor() { effect(() => { const c = this.p.code(); if (c) { this.api.invoke(projetsSessions, { code: c }).then((s) => this.sessions.set(s)); this.charger(1); } }); }
  charger(page: number) {
    this.api.invoke(projetsJournal, { code: this.p.code(), page, par_page: 50, depot: this.depot || undefined, evt: this.evt || undefined, auteur: this.auteur || undefined }).then((x) => this.page.set(x));
  }
}
