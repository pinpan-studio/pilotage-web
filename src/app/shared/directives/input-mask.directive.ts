import { Directive, ElementRef, HostListener, Input, OnInit, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

/**
 * `appInputMask` : masque de saisie léger, sans dépendance.
 *
 * Jetons du motif : `0` chiffre · `A` lettre (mise en majuscule) · `*` lettre ou chiffre.
 * Tout autre caractère est un littéral inséré automatiquement (espace, /, -, +, parenthèses…).
 *
 * @example
 * <input appInputMask="00 00 00 00 00" [(ngModel)]="tel" placeholder="07 00 00 00 00">
 * <input appInputMask="0000 AA 00" formControlName="immatriculation">
 */
@Directive({ selector: 'input[appInputMask]', standalone: true })
export class InputMaskDirective implements OnInit {
  private el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private ngControl = inject(NgControl, { optional: true, self: true });

  @Input({ required: true }) appInputMask = '';

  ngOnInit(): void {
    const ph = this.el.nativeElement.getAttribute('placeholder');
    if (!ph) this.el.nativeElement.placeholder = this.appInputMask.replace(/0/g, '_').replace(/[A*]/g, '_');
  }

  @HostListener('input')
  onInput(): void {
    const input = this.el.nativeElement;
    const caret = input.selectionStart ?? input.value.length;
    const formatted = this.format(input.value);
    if (formatted === input.value) return;

    // Le curseur se replace après la partie déjà saisie, une fois masquée.
    input.value = formatted;
    const pos = Math.min(this.format(input.value.slice(0, caret)).length, formatted.length);
    input.setSelectionRange(pos, pos);

    // Le ValueAccessor a déjà propagé la valeur brute : on remplace par la valeur masquée.
    if (this.ngControl) {
      this.ngControl.control?.setValue(formatted, { emitModelToViewChange: false });
      this.ngControl.viewToModelUpdate(formatted);
    }
  }

  /** Applique le masque à une saisie quelconque. */
  format(value: string): string {
    const chars = value.split('');
    let out = '';
    for (let i = 0; i < this.appInputMask.length && chars.length; i++) {
      const token = this.appInputMask[i];
      if (!this.isToken(i)) {
        out += token;
        // Littéral déjà présent dans la saisie (ex. préfixe « CLI- ») : on le consomme.
        if (chars[0].toUpperCase() === token.toUpperCase()) chars.shift();
        continue;
      }
      // Ignore les caractères qui ne correspondent pas au jeton courant.
      while (chars.length && !this.accepts(token, chars[0])) chars.shift();
      if (!chars.length) break;
      const c = chars.shift()!;
      out += token === '0' ? c : c.toUpperCase();
    }
    return out;
  }

  private isToken(i: number): boolean { return ['0', 'A', '*'].includes(this.appInputMask[i]); }
  private accepts(token: string, c: string): boolean {
    if (token === '0') return /\d/.test(c);
    if (token === 'A') return /[A-Za-z]/.test(c);
    return /[A-Za-z0-9]/.test(c);
  }
}
