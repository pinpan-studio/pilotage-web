import { Component, model } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export type ViewMode = 'card' | 'list';

@Component({
  selector: 'app-view-mode-toggle',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <div class="m3-filter-toggle view-mode-toggle">
      <button type="button" [class.active]="mode() === 'card'" (click)="mode.set('card')" matTooltip="Vue cartes">
        <mat-icon>grid_view</mat-icon>
        <span>Cartes</span>
      </button>
      <button type="button" [class.active]="mode() === 'list'" (click)="mode.set('list')" matTooltip="Vue liste">
        <mat-icon>view_list</mat-icon>
        <span>Liste</span>
      </button>
    </div>
  `,
})
export class ViewModeToggleComponent {
  mode = model.required<ViewMode>();
}
