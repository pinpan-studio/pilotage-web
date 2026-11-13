import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <span class="m3-badge {{ color() }}">
      @if (icon()) { <mat-icon>{{ icon() }}</mat-icon> }
      {{ label() }}
    </span>
  `,
  styles: [`
    :host { display: inline-block; }
    mat-icon { font-size: 14px; width: 14px; height: 14px; }
  `]
})
export class StatusBadgeComponent {
  label = input.required<string>();
  color = input<string>('neutral');
  icon  = input<string>('');
}
