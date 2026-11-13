import { Component, booleanAttribute, inject, input, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { markdownInline } from '../../utils/markdown.util';
import { ArticleBlock, slugify } from './content.models';

/**
 * Corps d'un article : rend une liste de blocs (chapô, paragraphes, intertitres, citations,
 * exergue, listes, code, figures, encadrés, tableaux) avec la typographie éditoriale du kit.
 *
 * <app-article-body [blocks]="article.blocks" size="lg" />
 */
@Component({
  selector: 'app-article-body',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  host: { '[class]': '"prose size-" + size()', '[class.serif]': 'serif()' },
  template: `
    @for (b of blocks(); track $index) {
      @switch (b.type) {
        @case ('lead') { <p class="lead" [innerHTML]="md(b.text)"></p> }
        @case ('p') { <p [class.dropcap]="b.dropcap" [innerHTML]="md(b.text)"></p> }
        @case ('h2') {
          <h2 [id]="b.id ?? slug(b.text)">{{ b.text }}@if (anchors()) { <a class="anchor" [href]="'#' + (b.id ?? slug(b.text))" aria-label="Lien vers cette section">#</a> }</h2>
        }
        @case ('h3') {
          <h3 [id]="b.id ?? slug(b.text)">{{ b.text }}@if (anchors()) { <a class="anchor" [href]="'#' + (b.id ?? slug(b.text))" aria-label="Lien vers cette section">#</a> }</h3>
        }
        @case ('quote') {
          <blockquote><p [innerHTML]="md(b.text)"></p>@if (b.cite) { <cite>— {{ b.cite }}</cite> }</blockquote>
        }
        @case ('pullquote') { <aside class="pullquote"><p>{{ b.text }}</p></aside> }
        @case ('list') {
          @if (b.ordered) { <ol>@for (it of b.items; track $index) { <li [innerHTML]="md(it)"></li> }</ol> }
          @else { <ul>@for (it of b.items; track $index) { <li [innerHTML]="md(it)"></li> }</ul> }
        }
        @case ('code') {
          <figure class="code">
            <figcaption>
              <span class="dots"><i></i><i></i><i></i></span>
              <span class="fname">{{ b.filename ?? b.lang ?? 'code' }}</span>
              @if (b.lang) { <span class="lang">{{ b.lang }}</span> }
              <button type="button" (click)="copy(b.code, $index)" [matTooltip]="copied() === $index ? 'Copié' : 'Copier'">
                <mat-icon>{{ copied() === $index ? 'check' : 'content_copy' }}</mat-icon>
              </button>
            </figcaption>
            <pre><code>{{ b.code }}</code></pre>
          </figure>
        }
        @case ('figure') {
          <figure class="figure" [class.wide]="b.wide">
            <div class="art" [style.--h]="b.hue ?? 190"><mat-icon>{{ b.icon }}</mat-icon></div>
            @if (b.caption) { <figcaption>{{ b.caption }}</figcaption> }
          </figure>
        }
        @case ('callout') {
          <div class="callout" [class]="'callout ' + b.tone" role="note">
            <mat-icon>{{ calloutIcon[b.tone] }}</mat-icon>
            <div>@if (b.title) { <strong>{{ b.title }}</strong> }<p [innerHTML]="md(b.text)"></p></div>
          </div>
        }
        @case ('table') {
          <div class="table-wrap">
            <table>
              @if (b.caption) { <caption>{{ b.caption }}</caption> }
              <thead><tr>@for (h of b.head; track $index) { <th>{{ h }}</th> }</tr></thead>
              <tbody>@for (r of b.rows; track $index) { <tr>@for (c of r; track $index) { <td [innerHTML]="md(c)"></td> }</tr> }</tbody>
            </table>
          </div>
        }
        @case ('divider') { <hr /> }
      }
    }
  `,
  styleUrls: ['./article-body.component.scss'],
})
export class ArticleBodyComponent {
  private clipboard = inject(Clipboard);

  blocks = input.required<ArticleBlock[]>();
  /** Corps de texte : 'md' (16 px, interfaces) ou 'lg' (18 px, lecture longue). */
  size = input<'md' | 'lg'>('lg');
  /** Ancres « # » au survol des intertitres. */
  anchors = input(true, { transform: booleanAttribute });
  /** Variante à empattements pour le texte courant (titres inchangés). */
  serif = input(false, { transform: booleanAttribute });

  readonly copied = signal<number | null>(null);
  readonly calloutIcon: Record<string, string> = { info: 'info', success: 'check_circle', warning: 'warning', error: 'error', neutral: 'lightbulb' };
  readonly md = markdownInline;
  readonly slug = slugify;

  copy(code: string, i: number): void {
    this.clipboard.copy(code);
    this.copied.set(i);
    setTimeout(() => this.copied.set(null), 1500);
  }
}
