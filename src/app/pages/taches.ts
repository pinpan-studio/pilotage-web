import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Api } from '../../api/genere/api';
import { ecritureCreerTache, ecritureModifierTache, projetsActions, projetsDocuments } from '../../api/genere/functions';
import { Action, DocumentDto } from '../../api/genere/models';
import { Router } from '@angular/router';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { tonDeCouleur } from '../noyau/statut';
import { date } from '../noyau/format';
import { AgendaViewComponent, GanttTimelineComponent, KanbanBoardComponent, KanbanMove, PlanningColumn, PlanningFilter, PlanningGroup, PlanningItem, PlanningTone } from '../shared/components/planning';
import { ProjetCourant } from './projet';
import { Chargement } from '../noyau/chargement';

type Vue = 'kanban' | 'timeline' | 'agenda';

/** Tâches : kanban (glisser-déposer), planning en timeline (jalons, livrables, tâches par responsable) et agenda. */
@Component({
  selector: 'app-taches',
  imports: [FormsModule, MatIconModule, MatButtonModule, KanbanBoardComponent, GanttTimelineComponent, AgendaViewComponent, Chargement, ...PIPES],
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
    <div class="m3-filter-toggle" style="margin: 0" role="tablist" aria-label="Vue">
      @for (v of vues; track v.id) { <button type="button" role="tab" [class.active]="vue() === v.id" [attr.aria-selected]="vue() === v.id" (click)="vue.set(v.id)"><mat-icon>{{ v.icone }}</mat-icon>{{ v.libelle }}</button> }
    </div>
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
      @case ('kanban') { <app-kanban-board [columns]="colonnes()" [items]="cartes()" [searchable]="true" [lateToggle]="true" [filters]="filtres()" emptyLabel="Déposez une tâche ici" (itemMoved)="deplacer($event)" (itemClick)="ouvrir($event)" /> }
      @case ('timeline') { <app-gantt-timeline [items]="planning()" [groups]="groupesPlanning()" rowLabel="Jalons et responsables" zoom="week" [searchable]="true" [lateToggle]="true" (itemClick)="ouvrir($event)" /> }
      @case ('agenda') { <app-agenda-view [items]="agenda()" view="week" [views]="['day', 'week', 'month']" [workWeek]="true" [startHour]="8" [endHour]="18" [searchable]="true" [lateToggle]="true" [filters]="filtres()" (itemClick)="ouvrir($event)" /> }
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
    { id: 'kanban', libelle: 'Kanban', icone: 'view_kanban' },
    { id: 'timeline', libelle: 'Planning', icone: 'view_timeline' },
    { id: 'agenda', libelle: 'Agenda', icone: 'event_note' },
  ];
  readonly charge = signal(false);
  /** Agenda : échéance à 9 h, durée d'une heure. */
  readonly agenda = computed<PlanningItem[]>(() => this.cartes().filter((c) => c.due).map((c) => { const j = String(c.due).slice(0, 10); return { ...c, start: `${j}T09:00:00`, end: `${j}T10:00:00` }; }));
  readonly taches = signal<Action[]>([]);
  readonly docs = signal<DocumentDto[]>([]);
  private readonly router = inject(Router);
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
  /** Timeline : jalons, échéances des livrables, puis tâches par responsable. */
  readonly groupesPlanning = computed<PlanningGroup[]>(() => [
    { key: '__jalons', label: 'Jalons', icon: 'flag', subtitle: 'Planning contractuel' },
    { key: '__livrables', label: 'Livrables', icon: 'description', subtitle: 'Échéances documentaires' },
    ...this.responsables().map((r) => ({ ...r, subtitle: 'Tâches' })),
  ]);
  readonly planning = computed<PlanningItem[]>(() => {
    const m = this.p.indicateurs(); const d = this.p.detail(); if (!m || !d) return this.cartes();
    const items: PlanningItem[] = [];
    let debut = d.date_debut ?? m.jalons[0]?.date_prevue;
    for (const j of m.jalons) {
      if (!j.date_prevue) continue;
      const ton: PlanningTone = j.statut === 'atteint' ? 'success' : j.statut === 'en_retard' ? 'error' : 'primary';
      items.push({ id: `j-${j.ref}`, ref: j.ref, title: j.nom, group: '__jalons', start: debut ?? j.date_prevue, end: j.date_reelle || j.date_prevue, due: j.date_prevue,
        done: j.statut === 'atteint', tone: ton, badge: { label: this.ref.libelle(j.statut), tone: ton },
        description: [j.facturation && `Facturation : ${j.facturation}`, j.livrables.length && `Documents attendus : ${j.livrables.join(', ')}`].filter(Boolean).join(' · ') });
      debut = j.date_reelle || j.date_prevue;
    }
    for (const x of this.docs()) {
      if (!x.echeance_effective || x.statut === 'sans_objet') continue;
      const ton = tonDeCouleur(this.ref.couleur(x.statut)) as PlanningTone;
      items.push({ id: `d-${x.code}`, ref: x.code, title: x.titre, group: '__livrables', start: x.echeance_effective, due: x.echeance_effective,
        done: ['valide', 'signe'].includes(x.statut), tone: ton, badge: { label: this.ref.libelle(x.statut), tone: ton }, assignee: x.responsable || undefined, data: { document: x.code } });
    }
    return [...items, ...this.cartes()];
  });
  constructor() {
    effect(() => { const c = this.p.code(); if (c) this.charger(); });
  }
  charger() {
    this.api.invoke(projetsActions, { code: this.p.code() }).then((l) => { this.taches.set(l); this.charge.set(true); });
    this.api.invoke(projetsDocuments, { code: this.p.code() }).then((l) => this.docs.set(l)).catch(() => undefined);
  }
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
  ouvrir(i: PlanningItem) {
    const d = i.data as { document?: string; ref?: string } | undefined;
    if (d?.document) this.router.navigate(['/projets', this.p.code(), 'livrables', d.document]);
    else if (d?.ref && /^A-/.test(d.ref)) this.router.navigate(['/projets', this.p.code(), 'taches', d.ref]);
  }

}
