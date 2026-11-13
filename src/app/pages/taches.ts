import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Api } from '../../api/genere/api';
import { ecritureCreerTache, ecritureModifierTache, projetsActions } from '../../api/genere/functions';
import { Action } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { tonDeCouleur } from '../noyau/statut';
import { date } from '../noyau/format';
import { DataColumn, DataTableComponent } from '../shared/components/data/data-table.component';
import { AgendaViewComponent, GanttTimelineComponent, GroupedBoardComponent, KanbanBoardComponent, KanbanMove, MonthCalendarComponent, NoteGridComponent, PlanningColumn, PlanningFilter, PlanningGroup, PlanningItem, PlanningTone } from '../shared/components/planning';
import { ProjetCourant } from './projet';
import { Chargement } from '../noyau/chargement';

type Vue = 'kanban' | 'liste' | 'responsables' | 'notes' | 'chronologie' | 'calendrier' | 'agenda';
interface Ligne { id: string; ref: string; action: string; statut: string; statut_code: string; responsable: string; echeance: string; retard: boolean; origine: string }

/** Suivi des tâches (plan d'actions) : kanban glisser-déposer, liste, chronologie par responsable, calendrier. */
@Component({
  selector: 'app-taches',
  imports: [FormsModule, MatIconModule, MatButtonModule, MatButtonToggleModule, DataTableComponent, KanbanBoardComponent, GanttTimelineComponent, MonthCalendarComponent, GroupedBoardComponent, NoteGridComponent, AgendaViewComponent, Chargement, ...PIPES],
  styles: [`.barre { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); }
    .vues { --mat-standard-button-toggle-height: 36px; --mat-standard-button-toggle-label-text-size: var(--fs-body-sm); }
    .vues mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 6px; vertical-align: -4px; }
    .card.plan { padding: var(--space-4); }
    .nouvelle { display: grid; grid-template-columns: minmax(0, 1fr) 200px 170px auto; gap: var(--space-3); align-items: end; padding: var(--space-4) var(--space-5); margin-bottom: var(--space-4);
      @media (max-width: 800px) { grid-template-columns: 1fr; } }
    .resume { display: flex; gap: var(--space-4); flex-wrap: wrap; font-size: var(--fs-body-sm); color: var(--text-secondary); b { color: var(--text-primary); } }`],
  template: `
  <div class="kpis">
    @for (k of compteurs(); track k.code) { <div class="card kpi"><span class="k-label"><mat-icon>{{ k.icone }}</mat-icon>{{ k.libelle }}</span><span class="k-val">{{ k.nb }}</span><span class="k-foot">{{ k.detail }}</span></div> }
  </div>
  <div class="barre">
    <mat-button-toggle-group class="vues" [value]="vue()" (change)="vue.set($event.value)" hideSingleSelectionIndicator aria-label="Vue">
      @for (v of vues; track v.id) { <mat-button-toggle [value]="v.id"><mat-icon>{{ v.icone }}</mat-icon>{{ v.libelle }}</mat-button-toggle> }
    </mat-button-toggle-group>
    <span class="spacer"></span>
    <button mat-flat-button color="primary" (click)="formulaire.set(!formulaire())"><mat-icon>{{ formulaire() ? 'close' : 'add_task' }}</mat-icon>{{ formulaire() ? 'Fermer' : 'Nouvelle tâche' }}</button>
  </div>
  @if (formulaire()) {
    <form class="card nouvelle" (ngSubmit)="creer()">
      <div class="form-field"><label class="field-label">Tâche</label><div class="field-box"><input name="t" [(ngModel)]="n.action" placeholder="Ex. Relancer le client pour les accès" required /></div></div>
      <div class="form-field"><label class="field-label">Responsable</label><div class="field-box"><input name="r" [(ngModel)]="n.responsable" placeholder="Nom" /></div></div>
      <div class="form-field"><label class="field-label">Échéance</label><div class="field-box"><input name="e" type="date" [(ngModel)]="n.echeance" /></div></div>
      <button mat-flat-button color="primary" type="submit" [disabled]="n.action.trim().length < 2 || enCours()">Créer</button>
    </form>
  }
  @if (!charge()) { <app-chargement forme="planning" /> } @else {
  <section class="card plan">
    @switch (vue()) {
      @case ('kanban') { <app-kanban-board [columns]="colonnes()" [items]="cartes()" [searchable]="true" [lateToggle]="true" [filters]="filtres()" emptyLabel="Déposez une tâche ici" (itemMoved)="deplacer($event)" /> }
      @case ('liste') { <app-data-table [rows]="lignes()" [columns]="colonnesListe" rowKey="id" [pageSize]="25" maxHeight="none" (cellEdit)="editer($event)" /> }
      @case ('chronologie') { <app-gantt-timeline [items]="cartes()" [groups]="responsables()" rowLabel="Responsable" zoom="week" [searchable]="true" [lateToggle]="true" /> }
      @case ('responsables') { <app-grouped-board [items]="cartes()" [groups]="responsables()" layout="list" [showProgress]="false" [searchable]="true" [lateToggle]="true" ungroupedLabel="Non attribuée" /> }
      @case ('notes') { <app-note-grid [items]="cartes()" [minWidth]="240" [searchable]="true" [lateToggle]="true" [filters]="filtres()" emptyLabel="Aucune tâche" /> }
      @case ('calendrier') { <app-month-calendar [items]="cartes()" [showDayPanel]="true" [searchable]="true" [lateToggle]="true" /> }
      @case ('agenda') { <app-agenda-view [items]="agenda()" view="week" [views]="['day', 'week', 'month']" [workWeek]="true" [startHour]="8" [endHour]="18" [searchable]="true" [lateToggle]="true" [filters]="filtres()" /> }
    }
  </section>
  }`,
})
export class Taches {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly ref = inject(ReferentielsService);
  private readonly snack = inject(MatSnackBar);
  readonly vue = signal<Vue>('kanban');
  readonly vues: { id: Vue; libelle: string; icone: string }[] = [
    { id: 'kanban', libelle: 'Kanban', icone: 'view_kanban' }, { id: 'liste', libelle: 'Liste', icone: 'list' },
    { id: 'responsables', libelle: 'Par responsable', icone: 'groups' }, { id: 'notes', libelle: 'Notes', icone: 'sticky_note_2' },
    { id: 'chronologie', libelle: 'Chronologie', icone: 'view_timeline' }, { id: 'calendrier', libelle: 'Calendrier', icone: 'calendar_month' },
    { id: 'agenda', libelle: 'Agenda', icone: 'event_note' },
  ];
  readonly charge = signal(false);
  /** Agenda : échéance à 9 h, durée d'une heure. */
  readonly agenda = computed<PlanningItem[]>(() => this.cartes().filter((c) => c.due).map((c) => { const j = String(c.due).slice(0, 10); return { ...c, start: `${j}T09:00:00`, end: `${j}T10:00:00` }; }));
  readonly taches = signal<Action[]>([]);
  readonly formulaire = signal(false);
  readonly enCours = signal(false);
  n = { action: '', responsable: '', echeance: '' };

  private aujourdhui() { return this.p.indicateurs()?.date_calcul ?? new Date().toISOString().slice(0, 10); }
  private enRetard(a: Action) { return !!a.echeance && ['a_faire', 'en_cours'].includes(a.statut) && a.echeance < this.aujourdhui(); }
  readonly compteurs = computed(() => {
    const l = this.taches();
    const n = (s: string) => l.filter((a) => a.statut === s).length;
    return [
      { code: 'a_faire', libelle: 'À faire', icone: 'radio_button_unchecked', nb: n('a_faire'), detail: `${l.filter((a) => a.statut === 'a_faire' && this.enRetard(a)).length} en retard` },
      { code: 'en_cours', libelle: 'En cours', icone: 'pending', nb: n('en_cours'), detail: `${l.filter((a) => a.statut === 'en_cours' && this.enRetard(a)).length} en retard` },
      { code: 'fait', libelle: 'Faites', icone: 'task_alt', nb: n('fait'), detail: l.length ? `${Math.round((n('fait') / l.length) * 100)} % du plan d'actions` : '—' },
      { code: 'retard', libelle: 'En retard', icone: 'alarm', nb: l.filter((a) => this.enRetard(a)).length, detail: 'échéance dépassée' },
    ];
  });
  readonly colonnes = computed<PlanningColumn[]>(() => (this.ref.donnees()?.statuts_action ?? []).map((s) => ({ key: s.code, label: s.libelle, color: `var(--${tonDeCouleur(s.couleur)}-color, var(--text-muted))` })));
  readonly cartes = computed<PlanningItem[]>(() => this.taches().map((a) => {
    const fini = ['fait', 'annule'].includes(a.statut);
    const ton = tonDeCouleur(this.ref.couleur(a.statut)) as PlanningTone;
    return { id: a.id, ref: a.ref, title: a.action, status: a.statut, group: a.responsable || 'Non attribuée', assignee: a.responsable || undefined,
      start: a.cree_le, end: a.echeance ?? undefined, due: a.echeance ?? undefined, done: fini, tone: ton, badge: { label: this.ref.libelle(a.statut), tone: ton },
      tags: a.origine_type === 'fichier_kit' || !a.origine_id ? [] : [a.origine_type === 'session' ? 'Session de dev' : a.origine_type], fields: { responsable: a.responsable || 'Non attribuée' }, data: a };
  }));
  readonly responsables = computed<PlanningGroup[]>(() => [...new Set(this.taches().map((a) => a.responsable || 'Non attribuée'))].sort().map((r) => ({ key: r, label: r, icon: 'person' })));
  readonly filtres = computed<PlanningFilter[]>(() => [{ key: 'responsable', label: 'Responsable', allLabel: 'Tous', options: this.responsables().map((r) => ({ value: r.key, label: r.label })) }]);
  readonly colonnesListe: DataColumn<Ligne>[] = [
    { key: 'ref', label: 'Réf.', type: 'mono', width: 90, sortable: true, required: true },
    { key: 'action', label: 'Tâche', minWidth: 280, sortable: true, required: true, editable: 'text' },
    { key: 'statut_code', label: 'Statut', width: 140, type: 'badge', sortable: true, editable: 'select', format: (r) => r.statut, tone: (r) => tonDeCouleur(this.ref.couleur(r.statut_code)),
      options: [] },
    { key: 'responsable', label: 'Responsable', width: 170, sortable: true, editable: 'text' },
    { key: 'echeance', label: 'Échéance', width: 130, type: 'badge', sortable: true, tone: (r) => (r.retard ? 'error' : 'neutral') },
    { key: 'origine', label: 'Origine', minWidth: 200 },
  ];
  readonly lignes = computed<Ligne[]>(() => this.taches().map((a) => ({ id: a.id, ref: a.ref, action: a.action, statut: this.ref.libelle(a.statut), statut_code: a.statut,
    responsable: a.responsable, echeance: a.echeance ? date(a.echeance) : '', retard: this.enRetard(a), origine: a.origine_id || '—' })));

  constructor() {
    effect(() => { const c = this.p.code(); if (c) this.charger(); });
    effect(() => { this.colonnesListe[2].options = (this.ref.donnees()?.statuts_action ?? []).map((s) => ({ value: s.code, label: s.libelle })); });
  }
  charger() { this.api.invoke(projetsActions, { code: this.p.code() }).then((l) => { this.taches.set(l); this.charge.set(true); }); }
  private erreur(e: any) { this.snack.open(e?.error?.message ?? 'Modification impossible', 'Fermer', { duration: 5000 }); this.charger(); }

  async creer() {
    this.enCours.set(true);
    try {
      const t = await this.api.invoke(ecritureCreerTache, { code: this.p.code(), body: { action: this.n.action.trim(), responsable: this.n.responsable.trim() || undefined, echeance: this.n.echeance || undefined } });
      this.taches.update((l) => [...l, t]); this.n = { action: '', responsable: '', echeance: '' };
      this.snack.open(`Tâche ${t.ref} créée`, undefined, { duration: 2500 });
    } catch (e) { this.erreur(e); } finally { this.enCours.set(false); }
  }
  async deplacer(m: KanbanMove) {
    if (m.from === m.to) return;
    const a = m.item.data as Action;
    this.taches.update((l) => l.map((x) => (x.id === a.id ? { ...x, statut: m.to as any } : x)));
    try { await this.api.invoke(ecritureModifierTache, { code: this.p.code(), ref: a.ref, body: { statut: m.to as Action['statut'] } }); } catch (e) { this.erreur(e); }
  }
  async editer(ev: { row: Ligne; key: string; value: unknown }) {
    const champ = ev.key === 'statut_code' ? 'statut' : ev.key;
    try {
      const t = await this.api.invoke(ecritureModifierTache, { code: this.p.code(), ref: ev.row.ref, body: { [champ]: String(ev.value ?? '') } as any });
      this.taches.update((l) => l.map((x) => (x.id === t.id ? t : x)));
    } catch (e) { this.erreur(e); }
  }
}
