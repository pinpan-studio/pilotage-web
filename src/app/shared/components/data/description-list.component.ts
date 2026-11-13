import { Component, booleanAttribute, inject, input } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface DescriptionItem {
  label: string;
  value: string | number | null | undefined;
  icon?: string;
  /** Affiche un bouton de copie. */
  copy?: boolean;
  /** Occupe toute la largeur de la grille. */
  span?: 'full' | number;
  /** Rendu particulier de la valeur. */
  type?: 'text' | 'mono' | 'link' | 'email' | 'phone' | 'badge' | 'multiline';
  href?: string;
  /** Couleur du badge (token : success, warning, error, info, primary). */
  tone?: string;
  hint?: string;
}

/**
 * Liste descriptive clé / valeur standardisée pour les fiches détail : grille 1 à 4 colonnes,
 * disposition verticale ou horizontale (libellé à gauche), bordée ou non, valeurs typées
 * (mono, lien, email, téléphone, badge), copie en un clic, valeur vide « — ».
 *
 * ```html
 * <app-description-list [items]="infos" [columns]="2" layout="horizontal" bordered />
 * ```
 */
@Component({
  selector: 'app-description-list',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    @if (title()) { <div class="dl-title">{{ title() }}</div> }
    <dl class="dl" [class]="'dl dl--' + layout()" [class.bordered]="bordered()" [class.striped]="striped()" [style.--cols]="columns()">
      @for (it of items(); track it.label) {
        <div class="dl-item" [style.grid-column]="it.span === 'full' ? '1 / -1' : it.span ? 'span ' + it.span : null">
          <dt>@if (it.icon) { <mat-icon>{{ it.icon }}</mat-icon> }{{ it.label }}</dt>
          <dd [class.empty]="isEmpty(it.value)">
            @if (isEmpty(it.value)) { — }
            @else {
              @switch (it.type) {
                @case ('mono') { <code>{{ it.value }}</code> }
                @case ('link') { <a [href]="it.href || it.value" target="_blank" rel="noopener">{{ it.value }}<mat-icon>open_in_new</mat-icon></a> }
                @case ('email') { <a [href]="'mailto:' + it.value">{{ it.value }}</a> }
                @case ('phone') { <a [href]="tel(it.value)">{{ it.value }}</a> }
                @case ('badge') { <span class="dl-badge" [style.--tone]="'var(--' + (it.tone || 'primary') + '-color)'">{{ it.value }}</span> }
                @case ('multiline') { <span class="ml">{{ it.value }}</span> }
                @default { {{ it.value }} }
              }
              @if (it.copy) { <button type="button" class="dl-copy" (click)="copy(it)" matTooltip="Copier"><mat-icon>content_copy</mat-icon></button> }
            }
            @if (it.hint) { <small>{{ it.hint }}</small> }
          </dd>
        </div>
      }
    </dl>
  `,
  styles: [`
    :host { display: block; }
    .dl-title { font: 600 14px 'Outfit', sans-serif; margin-bottom: 10px; color: var(--text-primary); }
    .dl { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 16px 24px; margin: 0;
      @media (max-width: 767.98px) { grid-template-columns: repeat(min(var(--cols), 2), minmax(0, 1fr)); }
      @media (max-width: 479.98px) { grid-template-columns: 1fr; } }
    .dl-item { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    dt { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em;
      mat-icon { font-size: 15px; width: 15px; height: 15px; } }
    dd { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; min-width: 0; font-size: 14px; font-weight: 500; color: var(--text-primary); word-break: break-word;
      &.empty { color: var(--text-muted); font-weight: 400; }
      small { flex-basis: 100%; font-size: 11.5px; font-weight: 400; color: var(--text-muted); }
      code { font: 13px 'Space Mono', ui-monospace, monospace; padding: 1px 6px; border-radius: 6px; background: var(--hover-bg); }
      a { color: var(--primary-color); text-decoration: none; display: inline-flex; align-items: center; gap: 3px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; } &:hover { text-decoration: underline; } }
      .ml { white-space: pre-line; font-weight: 400; line-height: 1.55; } }
    .dl-badge { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;
      color: var(--tone); background: color-mix(in srgb, var(--tone) 14%, transparent);
      &::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--tone); } }
    .dl-copy { width: 26px; height: 26px; border: none; border-radius: 50%; background: transparent; color: var(--text-muted); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; opacity: 0.6;
      mat-icon { font-size: 15px; width: 15px; height: 15px; } &:hover { opacity: 1; background: var(--hover-bg); color: var(--primary-color); } }

    .dl--horizontal { gap: 0 24px;
      .dl-item { flex-direction: row; align-items: baseline; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-color); }
      dt { flex: 0 0 40%; text-transform: none; letter-spacing: 0; font-size: 13px; font-weight: 500; }
      dd { flex: 1; } }
    .bordered { gap: 0; border: 1px solid var(--border-color); border-radius: var(--r-m, 12px); overflow: hidden;
      .dl-item { padding: 12px 16px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); margin: 0 -1px -1px 0; } }
    .striped .dl-item:nth-child(odd) { background: var(--table-header-bg, var(--hover-bg)); }
  `],
})
export class DescriptionListComponent {
  private clipboard = inject(Clipboard);
  private snack = inject(MatSnackBar);
  items = input<DescriptionItem[]>([]);
  title = input('');
  columns = input(3);
  layout = input<'vertical' | 'horizontal'>('vertical');
  bordered = input(false, { transform: booleanAttribute });
  striped = input(false, { transform: booleanAttribute });

  tel(v: unknown): string { return 'tel:' + String(v).replace(/\s/g, ''); }
  isEmpty(v: unknown): boolean { return v === null || v === undefined || v === ''; }
  copy(it: DescriptionItem): void {
    this.clipboard.copy(String(it.value));
    this.snack.open(`${it.label} copié`, undefined, { duration: 1500 });
  }
}
