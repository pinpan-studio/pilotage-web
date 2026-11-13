export * from './planning.models';
export { PlanningToolbarComponent } from './planning-toolbar.component';
export { KanbanBoardComponent } from './kanban-board.component';
export type { KanbanMove } from './kanban-board.component';
export { GanttTimelineComponent } from './gantt-timeline.component';
export type { GanttZoom } from './gantt-timeline.component';
export { NoteGridComponent } from './note-grid.component';
export { GroupedBoardComponent } from './grouped-board.component';
export { MonthCalendarComponent } from './month-calendar.component';
export { AgendaViewComponent } from './agenda-view.component';
export type { AgendaView } from './agenda-view.component';

/** Toutes les vues de planification, à importer d'un bloc dans un composant standalone. */
import { PlanningToolbarComponent as T } from './planning-toolbar.component';
import { KanbanBoardComponent as K } from './kanban-board.component';
import { GanttTimelineComponent as G } from './gantt-timeline.component';
import { NoteGridComponent as N } from './note-grid.component';
import { GroupedBoardComponent as B } from './grouped-board.component';
import { MonthCalendarComponent as M } from './month-calendar.component';
import { AgendaViewComponent as A } from './agenda-view.component';
export const PLANNING_COMPONENTS = [T, K, G, N, B, M, A] as const;
