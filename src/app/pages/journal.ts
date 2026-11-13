import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { Api } from '../../api/genere/api';
import { projetsJournal, projetsSessions } from '../../api/genere/functions';
import { PageEvenementsDto, SessionDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ProjetCourant } from './projet';

const ICONES: Record<string, string> = { modification: 'edit', creation: 'note_add', commande: 'terminal', commit: 'commit', doc: 'description', agent: 'smart_toy' };

@Component({
  selector: 'app-journal',
  imports: [FormsModule, MatIconModule, MatButtonModule, MatExpansionModule, ...PIPES],
  template: `
  <div class="grid-2">
    <section class="card wide"><div class="card-head"><h2>Sessions de développement</h2><span class="sub">{{ sessions().length }}</span></div>
      <div class="card-body"><mat-accordion>
        @for (s of sessions(); track s.id) {
          <mat-expansion-panel>
            <mat-expansion-panel-header><mat-panel-title>{{ s.debut | dateFr }} · {{ s.depot ?? '—' }} · {{ s.auteur }}</mat-panel-title>
              <mat-panel-description>@if (s.utilisateur_id) { <span class="agent-badge"><mat-icon>smart_toy</mat-icon>Agent</span> } @if (!s.fin) { &nbsp;en cours } @for (f of s.fonctionnalites; track f) { <span class="ref">{{ f }}</span> }</mat-panel-description>
            </mat-expansion-panel-header>
            @if (s.notes.length) { <h3 style="margin-top:0">Notes</h3><ul>@for (n of s.notes; track n.ts) { <li><small class="muted">{{ n.ts | dateFr: true }}</small> — {{ n.texte }}</li> }</ul> }
            <div class="prose" [innerHTML]="s.resume | md"></div>
          </mat-expansion-panel>
        } @empty { <p class="muted">Aucune session.</p> }
      </mat-accordion></div></section>

    <section class="card wide"><div class="card-head"><h2>Événements</h2><span class="sub">{{ page()?.total ?? 0 }}</span></div>
      <div class="card-body">
        <div class="toolbar-row">
          <button type="button" class="chip-filter" [class.on]="!evt" (click)="evt = ''; charger(1)">Tous</button>
          @for (t of types; track t) { <button type="button" class="chip-filter" [class.on]="evt === t" (click)="evt = t; charger(1)"><mat-icon>{{ icone(t) }}</mat-icon>{{ t }}</button> }
          <span class="spacer"></span>
          <select class="select-chip" [(ngModel)]="depot" (change)="charger(1)" aria-label="Dépôt"><option value="">Tous les dépôts</option>@for (d of p.detail()?.depots ?? []; track d.id) { <option [value]="d.nom">{{ d.nom }}</option> }</select>
        </div>
        <div class="rows">@for (e of page()?.elements ?? []; track e.id) {
          <div class="row" style="padding-left: 0; padding-right: 0">
            <span class="ic-tile" [class]="'ic-tile ' + (e.evt === 'commit' ? 'tone-success' : e.evt === 'doc' || e.evt === 'agent' ? 'tone-purple' : 'tone-neutral')"><mat-icon>{{ icone(e.evt) }}</mat-icon></span>
            <div class="grow"><strong class="mono">{{ e.hash ? e.hash + ' — ' : '' }}{{ e.fichier || e.commande || e.message }}</strong>
              <small>{{ e.auteur }} · {{ e.depot ?? '—' }} @for (f of e.fonctionnalites; track f) { · {{ f }} }</small></div>
            <span class="num" style="font-size: 12px; font-weight: 500">{{ e.ts | dateFr: true }}</span></div>
        } @empty { <p class="muted">Aucun événement.</p> }</div>
        @if (page(); as pg) { <div class="toolbar-row" style="justify-content: flex-end; margin: 12px 0 0">
          <button mat-stroked-button [disabled]="pg.page <= 1" (click)="charger(pg.page - 1)"><mat-icon>chevron_left</mat-icon>Précédent</button>
          <span class="muted">Page {{ pg.page }} / {{ pages() }}</span>
          <button mat-stroked-button [disabled]="pg.page >= pages()" (click)="charger(pg.page + 1)">Suivant<mat-icon iconPositionEnd>chevron_right</mat-icon></button></div> }
      </div></section>
  </div>`,
})
export class Journal {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  readonly types = Object.keys(ICONES);
  readonly sessions = signal<SessionDto[]>([]);
  readonly page = signal<PageEvenementsDto | null>(null);
  depot = ''; evt = '';
  icone = (t: string) => ICONES[t] ?? 'circle';
  pages() { const p = this.page(); return p ? Math.max(1, Math.ceil(p.total / p.par_page)) : 1; }
  constructor() { effect(() => { const c = this.p.code(); if (c) { this.api.invoke(projetsSessions, { code: c }).then((s) => this.sessions.set(s)); this.charger(1); } }); }
  charger(page: number) {
    this.api.invoke(projetsJournal, { code: this.p.code(), page, par_page: 50, depot: this.depot || undefined, evt: this.evt || undefined }).then((x) => this.page.set(x));
  }
}
