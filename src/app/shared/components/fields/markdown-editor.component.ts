import { Component, ElementRef, computed, forwardRef, input, linkedSignal, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { markdownToHtml } from '../../utils/markdown.util';

type MdMode = 'write' | 'preview' | 'split';

/**
 * Éditeur Markdown : onglets Écrire / Aperçu / Côte à côte, barre d'insertion (gras, titre, liste,
 * tâche, lien, code, citation), raccourcis Ctrl+B / Ctrl+I / Ctrl+K, Tab pour indenter,
 * continuation automatique des listes à la touche Entrée. Valeur : texte Markdown.
 *
 * ```html
 * <app-markdown-editor [(ngModel)]="description" />
 * ```
 */
@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MarkdownEditorComponent), multi: true }],
  template: `
    <div class="md" [class.disabled]="disabled()">
      <div class="md-bar">
        <div class="md-tabs" role="tablist">
          <button type="button" role="tab" [class.on]="mode() === 'write'" (click)="mode.set('write')">Écrire</button>
          <button type="button" role="tab" [class.on]="mode() === 'preview'" (click)="mode.set('preview')">Aperçu</button>
          <button type="button" role="tab" class="hide-sm" [class.on]="mode() === 'split'" (click)="mode.set('split')">Côte à côte</button>
        </div>
        <span class="spacer"></span>
        @if (mode() !== 'preview') {
          @for (t of tools; track t.icon) {
            <button type="button" class="tool" (click)="apply(t.before, t.after, t.line)" [matTooltip]="t.label" [disabled]="disabled()"><mat-icon>{{ t.icon }}</mat-icon></button>
          }
        }
      </div>
      <div class="md-body" [class.split]="mode() === 'split'" [style.min-height]="minHeight()">
        @if (mode() !== 'preview') {
          <textarea #ta [value]="value()" [placeholder]="placeholder()" [disabled]="disabled()" spellcheck="true"
            (input)="set($any($event.target).value)" (keydown)="onKey($event)" (blur)="touched()"></textarea>
        }
        @if (mode() !== 'write') {
          <div class="md-preview kit-markdown" [innerHTML]="html()"></div>
          @if (!value().trim()) { <div class="md-empty">Rien à prévisualiser.</div> }
        }
      </div>
      <div class="md-foot"><mat-icon>code</mat-icon>Markdown pris en charge · {{ words() }} mot{{ words() > 1 ? 's' : '' }}</div>
    </div>
  `,
  styleUrls: ['./markdown-editor.component.scss'],
})
export class MarkdownEditorComponent implements ControlValueAccessor {
  placeholder = input('Rédigez en Markdown…');
  minHeight = input('220px');
  initialMode = input<MdMode>('write', { alias: 'mode' });

  private ta = viewChild<ElementRef<HTMLTextAreaElement>>('ta');
  mode = linkedSignal<MdMode>(() => this.initialMode());
  value = signal('');
  disabled = signal(false);
  html = computed(() => markdownToHtml(this.value()));
  words = computed(() => (this.value().match(/[\p{L}\p{N}’']+/gu) || []).length);

  readonly tools = [
    { icon: 'format_bold', label: 'Gras (Ctrl+B)', before: '**', after: '**', line: false },
    { icon: 'format_italic', label: 'Italique (Ctrl+I)', before: '*', after: '*', line: false },
    { icon: 'title', label: 'Titre', before: '## ', after: '', line: true },
    { icon: 'format_list_bulleted', label: 'Liste', before: '- ', after: '', line: true },
    { icon: 'checklist', label: 'Tâche', before: '- [ ] ', after: '', line: true },
    { icon: 'format_quote', label: 'Citation', before: '> ', after: '', line: true },
    { icon: 'data_object', label: 'Code', before: '`', after: '`', line: false },
    { icon: 'link', label: 'Lien (Ctrl+K)', before: '[', after: '](https://)', line: false },
  ];

  private onChange: (v: string) => void = () => {};
  touched: () => void = () => {};

  set(v: string): void { this.value.set(v); this.onChange(v); }

  /** Entoure la sélection (ou préfixe la ligne) puis restaure la sélection. */
  apply(before: string, after: string, line: boolean): void {
    const el = this.ta()?.nativeElement;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value: v } = el;
    let next: string, s: number, e: number;
    if (line) {
      const ls = v.lastIndexOf('\n', a - 1) + 1;
      next = v.slice(0, ls) + before + v.slice(ls);
      s = a + before.length; e = b + before.length;
    } else {
      const sel = v.slice(a, b) || 'texte';
      next = v.slice(0, a) + before + sel + after + v.slice(b);
      s = a + before.length; e = s + sel.length;
    }
    this.set(next);
    el.value = next;
    el.focus();
    el.setSelectionRange(s, e);
  }

  onKey(e: KeyboardEvent): void {
    const el = e.target as HTMLTextAreaElement;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); this.apply('**', '**', false); return; }
    if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); this.apply('*', '*', false); return; }
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); this.apply('[', '](https://)', false); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: a, value: v } = el;
      const next = v.slice(0, a) + '  ' + v.slice(el.selectionEnd);
      this.set(next); el.value = next; el.setSelectionRange(a + 2, a + 2);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const { selectionStart: a, value: v } = el;
      const ls = v.lastIndexOf('\n', a - 1) + 1;
      const cur = v.slice(ls, a);
      const m = cur.match(/^(\s*)([-*+]\s(?:\[[ xX]\]\s)?|(\d+)([.)])\s)/);
      if (!m) return;
      e.preventDefault();
      if (cur.trim() === m[2].trim()) { // élément vide : on sort de la liste
        const next = v.slice(0, ls) + v.slice(a);
        this.set(next); el.value = next; el.setSelectionRange(ls, ls);
        return;
      }
      const bullet = m[3] ? `${+m[3] + 1}${m[4]} ` : m[2].replace(/\[[xX]\]/, '[ ]');
      const ins = '\n' + m[1] + bullet;
      const next = v.slice(0, a) + ins + v.slice(el.selectionEnd);
      this.set(next); el.value = next; el.setSelectionRange(a + ins.length, a + ins.length);
    }
  }

  writeValue(v: string | null): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}
