import { Component, ElementRef, afterNextRender, computed, input, model, output, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlanningToolbarComponent } from './planning-toolbar.component';
import {
  EMPTY_FILTER_STATE, MONTHS, PlanningFilter, PlanningFilterState, PlanningGroup, PlanningItem,
  addDays, applyPlanningFilters, initials, isLate, itemColor, startOfDay, startOfWeek, toDate,
} from './planning.models';

export type GanttZoom = 'day' | 'week' | 'month';
const DAY_WIDTH: Record<GanttZoom, number> = { day: 44, week: 20, month: 7 };
const TRACK_H = 34;
const DAY_MS = 86_400_000;

interface Bar { item: PlanningItem; left: number; width: number; track: number; late: boolean; overdueLeft: number; overdueWidth: number; dueLeft: number | null; }
interface Row { key: string; label: string; subtitle?: string; color?: string; icon?: string; bars: Bar[]; tracks: number; late: number; done: number; }

/**
 * Diagramme de Gantt générique. Lignes = `groups` (ou `item.group` détectés), sinon une ligne par élément.
 * Barre de `start` à `end` (ou `due`), marqueur d'échéance, zone hachurée si l'échéance est dépassée.
 * Options : zoom, ligne « aujourd'hui », barre d'outils (recherche / filtres / retard).
 */
@Component({
  selector: 'app-gantt-timeline',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatTooltipModule, PlanningToolbarComponent],
  templateUrl: './gantt-timeline.component.html',
  styleUrls: ['./gantt-timeline.component.scss'],
})
export class GanttTimelineComponent {
  items = input<PlanningItem[]>([]);
  groups = input<PlanningGroup[] | null>(null);
  /** Libellé de la colonne de gauche. */
  rowLabel = input('Ressource');
  zoom = model<GanttZoom>('day');
  showZoom = input(true);
  showToday = input(true);
  searchable = input(false);
  filters = input<PlanningFilter[]>([]);
  lateToggle = input(false);
  filterState = model<PlanningFilterState>(EMPTY_FILTER_STATE);
  itemClick = output<PlanningItem>();

  private scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  readonly initials = initials;
  readonly color = itemColor;
  readonly zooms: { key: GanttZoom; label: string }[] = [{ key: 'day', label: 'Jour' }, { key: 'week', label: 'Semaine' }, { key: 'month', label: 'Mois' }];

  constructor() { afterNextRender(() => this.scrollToToday('instant')); }

  dayWidth = computed(() => DAY_WIDTH[this.zoom()]);
  visible = computed(() => applyPlanningFilters(this.items(), this.filters(), this.filterState()).filter((i) => toDate(i.start)));
  lateCount = computed(() => this.items().filter((i) => isLate(i)).length);

  /** Plage affichée : du lundi précédant le premier début jusqu'à ~1 semaine après la dernière fin. */
  range = computed(() => {
    const today = startOfDay(new Date());
    let min = today, max = addDays(today, 14);
    for (const i of this.items()) {
      const s = toDate(i.start); const e = toDate(i.end) ?? toDate(i.due) ?? s;
      if (s && s < min) min = s;
      if (e && e > max) max = e;
    }
    const start = startOfWeek(addDays(min, -3));
    const end = addDays(startOfDay(max), 8);
    const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
    return { start, days };
  });

  days = computed(() => {
    const { start, days } = this.range();
    const today = startOfDay(new Date()).getTime();
    return Array.from({ length: days }, (_, i) => {
      const d = addDays(start, i);
      return { date: d, weekend: d.getDay() === 0 || d.getDay() === 6, today: d.getTime() === today, monday: d.getDay() === 1 };
    });
  });

  months = computed(() => {
    const out: { label: string; left: number; width: number }[] = [];
    const dw = this.dayWidth();
    this.days().forEach((d, i) => {
      const label = `${MONTHS[d.date.getMonth()]} ${d.date.getFullYear()}`;
      const last = out[out.length - 1];
      if (last && last.label === label) last.width += dw;
      else out.push({ label, left: i * dw, width: dw });
    });
    return out;
  });

  todayLeft = computed(() => {
    const t = (startOfDay(new Date()).getTime() - this.range().start.getTime()) / DAY_MS;
    return (t + 0.5) * this.dayWidth();
  });

  private offset(d: Date): number { return Math.round((startOfDay(d).getTime() - this.range().start.getTime()) / DAY_MS); }

  rows = computed<Row[]>(() => {
    const dw = this.dayWidth();
    const todayIdx = this.offset(new Date());
    const declared = this.groups();
    const items = this.visible();
    const hasGroups = !!declared?.length || items.some((i) => i.group);
    const defs: PlanningGroup[] = declared?.length ? declared
      : hasGroups ? [...new Set(items.map((i) => i.group ?? '—'))].map((k) => ({ key: k, label: k }))
      : items.map((i) => ({ key: i.id, label: i.title, subtitle: i.ref }));

    return defs.map((g) => {
      const own = items.filter((i) => (hasGroups ? (i.group ?? '—') === g.key : i.id === g.key))
        .sort((a, b) => toDate(a.start)!.getTime() - toDate(b.start)!.getTime());
      const trackEnds: number[] = [];
      const bars = own.map((item) => {
        const s = this.offset(toDate(item.start)!);
        const e = Math.max(s, this.offset(toDate(item.end) ?? toDate(item.due) ?? toDate(item.start)!));
        let track = trackEnds.findIndex((end) => end < s);
        if (track < 0) { track = trackEnds.length; trackEnds.push(e); } else trackEnds[track] = e;
        const late = isLate(item);
        const due = toDate(item.due);
        const dueIdx = due ? this.offset(due) : null;
        const ovStart = Math.max(e + 1, (dueIdx ?? e) + 1);
        return {
          item, track, late,
          left: s * dw + 1, width: Math.max((e - s + 1) * dw - 2, 6),
          dueLeft: dueIdx != null ? (dueIdx + 1) * dw - 2 : null,
          overdueLeft: ovStart * dw, overdueWidth: late ? Math.max(0, (todayIdx + 1 - ovStart) * dw) : 0,
        };
      });
      return {
        key: g.key, label: g.label, subtitle: g.subtitle ?? (hasGroups ? `${own.length} élément(s)` : undefined), color: g.color, icon: g.icon,
        bars, tracks: Math.max(1, trackEnds.length), late: bars.filter((b) => b.late).length, done: own.filter((i) => i.done).length,
      };
    });
  });

  trackHeight = TRACK_H;
  scrollToToday(behavior: ScrollBehavior = 'smooth'): void {
    const el = this.scroller()?.nativeElement;
    if (el) el.scrollTo({ left: Math.max(0, this.todayLeft() - el.clientWidth / 3), behavior });
  }
}
