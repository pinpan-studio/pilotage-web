import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { Api } from '../../api/genere/api';
import { ecritureStatutFonctionnalite, projetsActions, projetsDocuments, projetsFonctionnalites } from '../../api/genere/functions';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Action, DocumentDto, FonctionnaliteDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { tonDeCouleur } from '../noyau/statut';
import { AgendaViewComponent, GanttTimelineComponent, GroupedBoardComponent, KanbanBoardComponent, KanbanMove, MonthCalendarComponent, NoteGridComponent, PlanningColumn, PlanningFilter, PlanningGroup, PlanningItem, PlanningTone } from '../shared/components/planning';
import { ProjetCourant } from './projet';
import { Chargement } from '../noyau/chargement';

type Vue = 'gantt' | 'kanban' | 'lots' | 'notes' | 'calendrier' | 'agenda';

/** Planning du projet : jalons, échéances documentaires et actions (Gantt, calendrier), fonctionnalités par statut (kanban). Composants planning du ui-kit. */
@Component({
  selector: 'app-planning',
  imports: [Chargement, MatIconModule, MatButtonToggleModule, GanttTimelineComponent, KanbanBoardComponent, MonthCalendarComponent, GroupedBoardComponent, NoteGridComponent, AgendaViewComponent, ...PIPES],
  styles: [`.vues { margin-bottom: var(--space-4); --mat-standard-button-toggle-height: 36px; --mat-standard-button-toggle-label-text-size: var(--fs-body-sm); }
    .vues mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 6px; vertical-align: -4px; }
    .card.plan { padding: var(--space-4); }`],
  template: `
  <div class="toolbar-row">
    <mat-button-toggle-group class="vues" [value]="vue()" (change)="vue.set($event.value)" hideSingleSelectionIndicator aria-label="Vue">
      @for (v of vues; track v.id) { <mat-button-toggle [value]="v.id"><mat-icon>{{ v.icone }}</mat-icon>{{ v.libelle }}</mat-button-toggle> }
    </mat-button-toggle-group>
  </div>
  @if (!charge()) { <app-chargement forme="planning" /> }
  @else {
  <section class="card plan">
    @switch (vue()) {
      @case ('gantt') { <app-gantt-timeline [items]="echeances()" [groups]="groupes" rowLabel="Type" zoom="week" [searchable]="true" [lateToggle]="true" [filters]="filtres" (itemClick)="ouvrir($event)" /> }
      @case ('kanban') { <app-kanban-board [columns]="colonnes()" [items]="cartes()" [searchable]="true" [filters]="filtresKanban()" emptyLabel="Déposez une fonctionnalité ici" (itemClick)="ouvrir($event)" (itemMoved)="deplacer($event)" /> }
      @case ('lots') { <app-grouped-board [items]="cartesParLot()" [groups]="lots()" layout="notes" [showProgress]="true" [searchable]="true" [filters]="filtresKanban()" ungroupedLabel="Sans lot" (itemClick)="ouvrir($event)" /> }
      @case ('notes') { <app-note-grid [items]="cartes()" [minWidth]="260" [descriptionLines]="3" [searchable]="true" [filters]="filtresKanban()" emptyLabel="Aucune fonctionnalité" (itemClick)="ouvrir($event)" /> }
      @case ('calendrier') { <app-month-calendar [items]="echeances()" [showDayPanel]="true" [searchable]="true" [lateToggle]="true" [filters]="filtres" (itemClick)="ouvrir($event)" /> }
      @case ('agenda') { <app-agenda-view [items]="agenda()" view="month" [views]="['day', 'week', 'month']" [workWeek]="true" [startHour]="8" [endHour]="18" [searchable]="true" [lateToggle]="true" [filters]="filtres" (itemClick)="ouvrir($event)" /> }
    }
  </section>
  }`,
})
export class Planning {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly ref = inject(ReferentielsService);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  readonly vue = signal<Vue>('gantt');
  readonly vues: { id: Vue; libelle: string; icone: string }[] = [
    { id: 'gantt', libelle: 'Chronologie', icone: 'view_timeline' }, { id: 'kanban', libelle: 'Kanban', icone: 'view_kanban' },
    { id: 'lots', libelle: 'Par lot', icone: 'view_agenda' }, { id: 'notes', libelle: 'Notes', icone: 'sticky_note_2' },
    { id: 'calendrier', libelle: 'Calendrier', icone: 'calendar_month' }, { id: 'agenda', libelle: 'Agenda', icone: 'event_note' },
  ];
  private readonly nbCharges = signal(0);
  readonly charge = computed(() => this.nbCharges() >= 3 && !!this.p.indicateurs());
  readonly docs = signal<DocumentDto[]>([]);
  readonly actions = signal<Action[]>([]);
  readonly foncs = signal<FonctionnaliteDto[]>([]);

  readonly groupes: PlanningGroup[] = [
    { key: 'jalons', label: 'Jalons', icon: 'flag', subtitle: 'Planning contractuel' },
    { key: 'documents', label: 'Livrables', icon: 'description', subtitle: 'Échéances documentaires' },
    { key: 'actions', label: 'Actions', icon: 'task_alt', subtitle: 'Plan d’actions' },
  ];
  readonly filtres: PlanningFilter[] = [{ key: 'type', label: 'Type', allLabel: 'Tous les types', options: this.groupes.map((g) => ({ value: g.key, label: g.label })), value: (i) => i.group }];

  readonly echeances = computed<PlanningItem[]>(() => {
    const m = this.p.indicateurs(); const d = this.p.detail(); if (!m || !d) return [];
    const items: PlanningItem[] = [];
    let debut = d.date_debut ?? m.jalons[0]?.date_prevue;
    for (const j of m.jalons) {
      if (!j.date_prevue) continue;
      items.push({ id: `j-${j.ref}`, ref: j.ref, title: j.nom, group: 'jalons', start: debut ?? j.date_prevue, end: j.date_reelle || j.date_prevue, due: j.date_prevue,
        done: j.statut === 'atteint', tone: j.statut === 'atteint' ? 'success' : j.statut === 'en_retard' ? 'error' : 'primary',
        badge: { label: this.ref.libelle(j.statut), tone: j.statut === 'atteint' ? 'success' : j.statut === 'en_retard' ? 'error' : 'info' },
        description: [j.facturation && `Facturation : ${j.facturation}`, j.livrables.length && `Documents attendus : ${j.livrables.join(', ')}`].filter(Boolean).join(' · '), data: { type: 'jalon' } });
      debut = j.date_reelle || j.date_prevue;
    }
    for (const x of this.docs()) {
      if (!x.echeance_effective || x.statut === 'sans_objet') continue;
      const fini = ['valide', 'signe'].includes(x.statut);
      items.push({ id: `d-${x.code}`, ref: x.code, title: x.titre, group: 'documents', start: x.echeance_effective, due: x.echeance_effective, done: fini,
        tone: tonDeCouleur(this.ref.couleur(x.statut)) as PlanningTone, badge: { label: this.ref.libelle(x.statut), tone: tonDeCouleur(this.ref.couleur(x.statut)) as PlanningTone },
        assignee: x.responsable || undefined, data: { type: 'document', code: x.code } });
    }
    for (const a of this.actions()) {
      if (!a.echeance) continue;
      const fini = ['fait', 'annule'].includes(a.statut);
      items.push({ id: `a-${a.ref}`, ref: a.ref, title: a.action, group: 'actions', start: a.echeance, due: a.echeance, done: fini,
        tone: fini ? 'success' : 'warning', badge: { label: this.ref.libelle(a.statut), tone: fini ? 'success' : 'warning' }, assignee: a.responsable || undefined, data: { type: 'action' } });
    }
    return items;
  });

  readonly colonnes = computed<PlanningColumn[]>(() => (this.ref.donnees()?.statuts_fonctionnalite ?? []).filter((s) => s.code !== 'abandonne')
    .map((s) => ({ key: s.code, label: s.libelle, color: `var(--${tonDeCouleur(s.couleur)}-color, var(--text-muted))` })));
  readonly cartes = computed<PlanningItem[]>(() => this.foncs().filter((f) => f.statut !== 'abandonne').map((f) => ({
    id: f.id, ref: f.ref, title: f.titre, status: f.statut_effectif, progress: Math.round(f.avancement * 100), done: f.statut_effectif === 'valide',
    tone: tonDeCouleur(this.ref.couleur(f.statut_effectif)) as PlanningTone, assignee: undefined,
    description: f.depots.map((d) => `${d.depot} : ${this.ref.libelle(d.statut)}`).join(' · '), badge: { label: this.ref.libelle(f.statut_effectif), tone: tonDeCouleur(this.ref.couleur(f.statut_effectif)) as PlanningTone },
    tags: [`Poids ${f.poids}`, ...f.exigences], fields: { lot: f.jalon, depot: f.depots.map((d) => d.depot) }, data: { type: 'fonctionnalite', ref: f.ref },
  })));
  /** Vue groupée : une colonne par lot, avec la progression du lot. */
  readonly lots = computed<PlanningGroup[]>(() => (this.p.indicateurs()?.par_lot ?? []).map((l) => ({ key: l.nom, label: l.nom, subtitle: `${l.nb} fonctionnalité(s) · ${Math.round(l.avancement * 100)} %`, icon: 'inventory_2' })));
  readonly cartesParLot = computed<PlanningItem[]>(() => this.cartes().map((c) => ({ ...c, group: (c.fields?.['lot'] as string) || undefined })));
  /** Agenda : les échéances (sans heure) sont placées à 9 h pour une durée d'une heure. */
  readonly agenda = computed<PlanningItem[]>(() => this.echeances().map((i) => {
    const j = String(i.due ?? i.start).slice(0, 10);
    return { ...i, start: `${j}T09:00:00`, end: `${j}T10:00:00` };
  }));
  readonly filtresKanban = computed<PlanningFilter[]>(() => {
    const lots = [...new Set(this.foncs().map((f) => f.jalon).filter(Boolean))];
    const depots = this.p.detail()?.depots ?? [];
    return [
      { key: 'lot', label: 'Lot', allLabel: 'Tous les lots', options: lots.map((l) => ({ value: l, label: l })) },
      { key: 'depot', label: 'Dépôt', allLabel: 'Tous les dépôts', options: depots.map((d) => ({ value: d.nom, label: d.nom })) },
    ];
  });

  constructor() {
    effect(() => {
      const c = this.p.code(); if (!c) return;
      this.nbCharges.set(0);
      this.api.invoke(projetsDocuments, { code: c }).then((l) => this.docs.set(l)).catch(() => undefined).finally(() => this.nbCharges.update((n) => n + 1));
      this.api.invoke(projetsActions, { code: c }).then((l) => this.actions.set(l)).catch(() => undefined).finally(() => this.nbCharges.update((n) => n + 1));
      this.api.invoke(projetsFonctionnalites, { code: c }).then((l) => this.foncs.set(l)).catch(() => undefined).finally(() => this.nbCharges.update((n) => n + 1));
    });
  }
  /** Kanban : changer le statut global d'une fonctionnalité (les règles — validation par le chef de projet… — sont appliquées par l'API). */
  async deplacer(m: KanbanMove) {
    if (m.from === m.to) return;
    const ref = (m.item.data as { ref: string }).ref;
    try {
      await this.api.invoke(ecritureStatutFonctionnalite, { code: this.p.code(), ref, body: { statut: m.to } });
      this.snack.open(`${ref} → ${this.ref.libelle(m.to)}`, undefined, { duration: 2500 });
      this.p.charger(this.p.code());
    } catch (e: any) { this.snack.open(e?.error?.message ?? 'Changement refusé', 'Fermer', { duration: 6000 }); }
    this.api.invoke(projetsFonctionnalites, { code: this.p.code() }).then((l) => this.foncs.set(l));
  }

  ouvrir(i: PlanningItem) {
    const d = i.data as { type: string; code?: string; ref?: string } | undefined;
    if (d?.type === 'document') this.router.navigate(['/projets', this.p.code(), 'livrables', d.code]);
    else if (d?.type === 'fonctionnalite') this.router.navigate(['/projets', this.p.code(), 'fonctionnalites', d.ref]);
  }
}
