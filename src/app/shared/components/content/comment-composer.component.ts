import { Component, ElementRef, booleanAttribute, computed, input, output, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { markdownToHtml } from '../../utils/markdown.util';
import { CommentAuthor } from './content.models';

/**
 * Saisie d'un commentaire : zone de texte auto-extensible, barre de mise en forme Markdown,
 * mentions @, onglet d'aperçu, compteur de caractères, envoi par ⌘/Ctrl + Entrée.
 *
 * <app-comment-composer [author]="me" [mentionables]="people" (submitted)="add($event)" />
 */
@Component({
  selector: 'app-comment-composer',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
    <div class="composer" [class.open]="expanded()" [class.compact]="compact()">
      @if (author(); as a) { <span class="ava" [style.background]="a.color ?? 'var(--primary-color)'">{{ initials(a.name) }}</span> }
      <div class="box" [class.over]="over()">
        @if (expanded()) {
          <div class="bar">
            <div class="tabs" role="tablist">
              <button type="button" role="tab" [class.on]="!preview()" (click)="preview.set(false)">Écrire</button>
              <button type="button" role="tab" [class.on]="preview()" (click)="preview.set(true)" [disabled]="!text().trim()">Aperçu</button>
            </div>
            @if (!preview()) {
              <span class="tools">
                @for (t of tools; track t.icon) {
                  <button type="button" (mousedown)="$event.preventDefault()" (click)="format(t)" [matTooltip]="t.label" [attr.aria-label]="t.label"><mat-icon>{{ t.icon }}</mat-icon></button>
                }
              </span>
            }
          </div>
        }
        @if (preview()) {
          <div class="preview kit-markdown" [innerHTML]="html()"></div>
        } @else {
          <textarea #area [placeholder]="placeholder()" [value]="text()" [attr.maxlength]="maxLength() + 50" rows="1"
            (focus)="expanded.set(true)" (input)="onInput($event)" (keydown)="onKey($event)" (blur)="closeMentions()"
            [attr.aria-label]="placeholder()"></textarea>
        }
        @if (mentionList().length) {
          <ul class="mentions" role="listbox">
            @for (m of mentionList(); track m.name; let i = $index) {
              <li role="option" [class.on]="i === mentionIndex()" (mousedown)="$event.preventDefault(); pickMention(m)">
                <span class="ava xs" [style.background]="m.color ?? 'var(--primary-color)'">{{ initials(m.name) }}</span>{{ m.name }}@if (m.role) { <small>{{ m.role }}</small> }
              </li>
            }
          </ul>
        }
        @if (expanded()) {
          <div class="foot">
            <span class="hint"><mat-icon>info</mat-icon>**gras**, *italique*, &#64;mention · <kbd>{{ mod }}</kbd>+<kbd>Entrée</kbd> pour publier</span>
            <span class="count" [class.warn]="remaining() < 80" [class.over]="over()">{{ remaining() }}</span>
            @if (cancelable() || text()) { <button mat-button type="button" (click)="cancel()">Annuler</button> }
            <button mat-flat-button color="primary" type="button" (click)="submit()" [disabled]="!canSubmit()">
              @if (busy()) { <mat-spinner diameter="16" /> } @else { {{ submitLabel() }} }
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styleUrls: ['./comment-composer.component.scss'],
})
export class CommentComposerComponent {
  author = input<CommentAuthor | null>(null);
  placeholder = input('Ajouter un commentaire…');
  submitLabel = input('Publier');
  maxLength = input(1000);
  /** Personnes proposées après « @ ». */
  mentionables = input<CommentAuthor[]>([]);
  /** Bouton Annuler toujours visible (réponse, édition). */
  cancelable = input(false, { transform: booleanAttribute });
  /** Ouvert d'emblée (sinon : une ligne qui s'agrandit au focus). */
  startOpen = input(false, { transform: booleanAttribute });
  /** Texte initial (édition d'un commentaire). */
  initial = input('');
  compact = input(false, { transform: booleanAttribute });
  autofocus = input(false, { transform: booleanAttribute });

  readonly submitted = output<string>();
  readonly cancelled = output<void>();

  private area = viewChild<ElementRef<HTMLTextAreaElement>>('area');

  readonly text = signal('');
  readonly expanded = signal(false);
  readonly preview = signal(false);
  readonly busy = signal(false);
  private mentionQuery = signal<string | null>(null);
  readonly mentionIndex = signal(0);
  readonly mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

  readonly tools = [
    { icon: 'format_bold', label: 'Gras', before: '**', after: '**' },
    { icon: 'format_italic', label: 'Italique', before: '*', after: '*' },
    { icon: 'code', label: 'Code', before: '`', after: '`' },
    { icon: 'link', label: 'Lien', before: '[', after: '](https://)' },
    { icon: 'format_quote', label: 'Citation', before: '> ', after: '', line: true },
    { icon: 'format_list_bulleted', label: 'Liste', before: '- ', after: '', line: true },
  ];

  readonly remaining = computed(() => this.maxLength() - this.text().length);
  readonly over = computed(() => this.remaining() < 0);
  readonly canSubmit = computed(() => !!this.text().trim() && !this.over() && !this.busy());
  readonly html = computed(() => markdownToHtml(this.text()));
  readonly mentionList = computed(() => {
    const q = this.mentionQuery();
    if (q === null) return [];
    return this.mentionables().filter((m) => m.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
  });

  ngOnInit(): void {
    this.text.set(this.initial());
    if (this.startOpen() || this.initial()) this.expanded.set(true);
    if (this.autofocus()) setTimeout(() => this.focus());
  }

  focus(): void {
    const el = this.area()?.nativeElement;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    this.autosize(el);
  }

  onInput(e: Event): void {
    const el = e.target as HTMLTextAreaElement;
    this.text.set(el.value);
    this.autosize(el);
    const before = el.value.slice(0, el.selectionStart);
    const m = before.match(/(?:^|\s)@([\p{L}-]{0,20})$/u);
    this.mentionQuery.set(m ? m[1] : null);
    this.mentionIndex.set(0);
  }

  onKey(e: KeyboardEvent): void {
    const list = this.mentionList();
    if (list.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.mentionIndex.update((i) => (i + 1) % list.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.mentionIndex.update((i) => (i - 1 + list.length) % list.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this.pickMention(list[this.mentionIndex()]); return; }
      if (e.key === 'Escape') { this.closeMentions(); return; }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.submit(); }
    if (e.key === 'Escape' && !this.text()) this.cancel();
  }

  pickMention(m: CommentAuthor): void {
    const el = this.area()?.nativeElement;
    if (!el) return;
    const pos = el.selectionStart;
    const before = el.value.slice(0, pos).replace(/@([\p{L}-]{0,20})$/u, `@${m.name.replace(/\s+/g, '-')} `);
    this.setValue(el, before + el.value.slice(pos), before.length);
    this.closeMentions();
  }

  closeMentions(): void { this.mentionQuery.set(null); }

  /** Entoure la sélection (ou préfixe les lignes) avec la syntaxe Markdown de l'outil. */
  format(t: { before: string; after: string; line?: boolean }): void {
    const el = this.area()?.nativeElement;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value: v } = el;
    if (t.line) {
      const start = v.lastIndexOf('\n', s - 1) + 1;
      const block = v.slice(start, e).split('\n').map((l) => t.before + l).join('\n');
      this.setValue(el, v.slice(0, start) + block + v.slice(e), start + block.length);
    } else {
      const sel = v.slice(s, e) || (t.before === '[' ? 'texte' : '');
      this.setValue(el, v.slice(0, s) + t.before + sel + t.after + v.slice(e), s + t.before.length + sel.length);
      if (!v.slice(s, e)) el.setSelectionRange(s + t.before.length, s + t.before.length + sel.length);
    }
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    // Délai simulé d'envoi (démonstration statique).
    setTimeout(() => {
      this.submitted.emit(this.text().trim());
      this.busy.set(false);
      this.text.set('');
      this.preview.set(false);
      if (!this.startOpen()) this.expanded.set(false);
      const el = this.area()?.nativeElement;
      if (el) { el.value = ''; this.autosize(el); }
    }, 450);
  }

  cancel(): void {
    this.text.set('');
    this.preview.set(false);
    this.expanded.set(this.startOpen());
    this.closeMentions();
    this.cancelled.emit();
  }

  initials(n: string): string { return n.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase(); }

  private setValue(el: HTMLTextAreaElement, value: string, caret: number): void {
    el.value = value;
    this.text.set(value);
    el.focus();
    el.setSelectionRange(caret, caret);
    this.autosize(el);
  }

  private autosize(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 320) + 'px';
  }
}
