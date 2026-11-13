import { Component, Input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface Progress { loading: boolean; label: string; error?: boolean; }

/** Voile plein écran avec spinner (ex. connexion en cours). */
@Component({
  selector: 'app-overlay-spiner, app-overlay-spinner',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  templateUrl: './overlay-spiner.component.html',
  styleUrls: ['./overlay-spiner.component.scss'],
})
export class OverlaySpinerComponent {
  @Input() progress: Progress = { loading: false, label: '' };
}
