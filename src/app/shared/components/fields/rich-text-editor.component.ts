import { Component, ElementRef, HostListener, afterNextRender, booleanAttribute, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

type Cmd = 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'insertUnorderedList' | 'insertOrderedList';

/**
 * Éditeur de texte riche léger (contenteditable, aucune dépendance) : gras, italique, souligné, barré,
 * titres, listes, citation, lien, nettoyage, annuler / rétablir, compteur de caractères.
 * Le collage est converti en texte brut pour éviter les styles parasites. Valeur : HTML.
 *
 * ```html
 * <app-rich-text-editor [(ngModel)]="notes" placeholder="Compte rendu d'intervention…" [maxLength]="2000" />
 * ```
 */
@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RichTextEditorComponent), multi: true }],
  template: `
    <div class="rte" [class.focused]="focused()" [class.disabled]="disabled()">
      <div class="rte-toolbar" (mousedown)="$event.preventDefault()">
        <select class="rte-block" [value]="block()" (change)="formatBlock($any($event.target).value)" aria-label="Style de paragraphe" [disabled]="disabled()">
          <option value="p">Paragraphe</option><option value="h2">Titre</option><option value="h3">Sous-titre</option><option value="blockquote">Citation</option>
        </select>
        <span class="sep"></span>
        @for (b of buttons; track b.cmd) {
          <button type="button" [class.on]="active()[b.cmd]" (click)="exec(b.cmd)" [matTooltip]="b.label" [disabled]="disabled()"><mat-icon>{{ b.icon }}</mat-icon></button>
          @if (b.cmd === 'strikeThrough') { <span class="sep"></span> }
        }
        <span class="sep"></span>
        <button type="button" [class.on]="linkOpen()" (click)="toggleLink()" matTooltip="Lien" [disabled]="disabled()"><mat-icon>link</mat-icon></button>
        <button type="button" (click)="exec('removeFormat'); formatBlock('p')" matTooltip="Effacer la mise en forme" [disabled]="disabled()"><mat-icon>format_clear</mat-icon></button>
        <span class="spacer"></span>
        <button type="button" (click)="exec('undo')" matTooltip="Annuler (Ctrl+Z)" [disabled]="disabled()"><mat-icon>undo</mat-icon></button>
        <button type="button" (click)="exec('redo')" matTooltip="Rétablir (Ctrl+Y)" [disabled]="disabled()"><mat-icon>redo</mat-icon></button>
      </div>
      @if (linkOpen()) {
        <div class="rte-link">
          <mat-icon>link</mat-icon>
          <input #link type="url" placeholder="https://…" (keydown.enter)="applyLink(link.value); $event.preventDefault()" (keydown.escape)="linkOpen.set(false)" />
          <button type="button" (mousedown)="$event.preventDefault()" (click)="applyLink(link.value)">Appliquer</button>
          <button type="button" class="ghost" (mousedown)="$event.preventDefault()" (click)="exec('unlink'); linkOpen.set(false)">Retirer</button>
        </div>
      }
      <div #editor class="rte-content" [attr.contenteditable]="!disabled()" [attr.data-placeholder]="placeholder()" [style.min-height]="minHeight()"
        role="textbox" aria-multiline="true" [class.empty]="empty()"
        (input)="onInput()" (focus)="focused.set(true)" (blur)="focused.set(false); touched()" (paste)="onPaste($event)" (keyup)="refresh()" (mouseup)="refresh()"></div>
      @if (maxLength()) {
        <div class="rte-foot" [class.over]="length() > maxLength()!">{{ length() }} / {{ maxLength() }}</div>
      }
    </div>
  `,
  styleUrls: ['./rich-text-editor.component.scss'],
})
export class RichTextEditorComponent implements ControlValueAccessor {
  placeholder = input('Saisissez votre texte…');
  minHeight = input('140px');
  maxLength = input<number | null>(null);
  plainPaste = input(true, { transform: booleanAttribute });

  private editor = viewChild<ElementRef<HTMLElement>>('editor');
  private linkInput = viewChild<ElementRef<HTMLInputElement>>('link');
  private savedRange: Range | null = null;

  readonly buttons: { cmd: Cmd; icon: string; label: string }[] = [
    { cmd: 'bold', icon: 'format_bold', label: 'Gras (Ctrl+B)' },
    { cmd: 'italic', icon: 'format_italic', label: 'Italique (Ctrl+I)' },
    { cmd: 'underline', icon: 'format_underlined', label: 'Souligné (Ctrl+U)' },
    { cmd: 'strikeThrough', icon: 'strikethrough_s', label: 'Barré' },
    { cmd: 'insertUnorderedList', icon: 'format_list_bulleted', label: 'Liste à puces' },
    { cmd: 'insertOrderedList', icon: 'format_list_numbered', label: 'Liste numérotée' },
  ];
  active = signal<Partial<Record<Cmd, boolean>>>({});
  block = signal('p');
  focused = signal(false);
  disabled = signal(false);
  empty = signal(true);
  length = signal(0);
  linkOpen = signal(false);

  private onChange: (v: string) => void = () => {};
  touched: () => void = () => {};

  exec(cmd: string, arg?: string): void {
    this.editor()?.nativeElement.focus();
    document.execCommand(cmd, false, arg);
    this.onInput();
  }
  formatBlock(tag: string): void { this.exec('formatBlock', tag); }

  toggleLink(): void {
    const sel = window.getSelection();
    this.savedRange = sel && sel.rangeCount && this.editor()?.nativeElement.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    this.linkOpen.set(!this.linkOpen());
    setTimeout(() => this.linkInput()?.nativeElement.focus());
  }
  applyLink(url: string): void {
    url = url.trim();
    if (url && !/^(https?:|mailto:|tel:|\/)/.test(url)) url = 'https://' + url;
    const sel = window.getSelection();
    if (this.savedRange && sel) { sel.removeAllRanges(); sel.addRange(this.savedRange); }
    if (url) {
      if (sel?.isCollapsed) this.exec('insertHTML', `<a href="${url.replace(/"/g, '&quot;')}">${url.replace(/</g, '&lt;')}</a>`);
      else this.exec('createLink', url);
    }
    this.linkOpen.set(false);
  }

  onPaste(e: ClipboardEvent): void {
    if (!this.plainPaste()) return;
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
  }

  onInput(): void {
    const el = this.editor()?.nativeElement;
    if (!el) return;
    const text = el.innerText.replace(/\n$/, '');
    this.empty.set(!text.trim() && !el.querySelector('img, li'));
    this.length.set(text.length);
    this.onChange(this.empty() ? '' : el.innerHTML);
    this.refresh();
  }

  @HostListener('document:selectionchange')
  refresh(): void {
    const el = this.editor()?.nativeElement;
    const sel = window.getSelection();
    if (!el || !sel?.anchorNode || !el.contains(sel.anchorNode)) return;
    const st: Partial<Record<Cmd, boolean>> = {};
    for (const b of this.buttons) st[b.cmd] = document.queryCommandState(b.cmd);
    this.active.set(st);
    const v = String(document.queryCommandValue('formatBlock') || 'p').toLowerCase();
    this.block.set(['h2', 'h3', 'blockquote'].includes(v) ? v : 'p');
  }

  private pending: string | null = null;
  constructor() { afterNextRender(() => this.writeValue(this.pending)); }

  writeValue(v: string | null): void {
    this.pending = v;
    const el = this.editor()?.nativeElement;
    if (!el) return;
    el.innerHTML = v ?? '';
    this.empty.set(!el.innerText.trim());
    this.length.set(el.innerText.trim().length);
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}
