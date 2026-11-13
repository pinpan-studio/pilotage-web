import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

/** `matPadding` : padding 10px (directive d'origine `core/directives/mat-padding`). */
@Directive({ selector: '[matPadding]', standalone: true })
export class MatPaddingDirective implements AfterViewInit {
  private el = inject(ElementRef);
  ngAfterViewInit() { this.el.nativeElement.style.padding = '10px 10px'; }
}

/** `matPaddingSmall` : padding 5px. */
@Directive({ selector: '[matPaddingSmall]', standalone: true })
export class MatPaddingSmallDirective implements AfterViewInit {
  private el = inject(ElementRef);
  ngAfterViewInit() { this.el.nativeElement.style.padding = '5px'; }
}

/** `matRounded` : coins arrondis "pilule" (50px). */
@Directive({ selector: '[matRounded]', standalone: true })
export class MatRoundedDirective implements AfterViewInit {
  private el = inject(ElementRef);
  ngAfterViewInit() { this.el.nativeElement.style.borderRadius = '50px'; }
}

/** `matSquare` : coins droits. */
@Directive({ selector: '[matSquare]', standalone: true })
export class MatSquareDirective implements AfterViewInit {
  private el = inject(ElementRef);
  ngAfterViewInit() { this.el.nativeElement.style.borderRadius = '0px'; }
}

/** `overflowY` : défilement vertical automatique. */
@Directive({ selector: '[overflowY]', standalone: true })
export class OverflowYDirective implements AfterViewInit {
  private el = inject(ElementRef);
  ngAfterViewInit() { this.el.nativeElement.style.overflowY = 'auto'; }
}

/** `appAutofocus` : focus à l'affichage. */
@Directive({ selector: '[appAutofocus]', standalone: true })
export class AutofocusDirective implements AfterViewInit {
  private el = inject(ElementRef);
  ngAfterViewInit() { setTimeout(() => this.el.nativeElement.focus?.(), 0); }
}

export const UI_DIRECTIVES = [
  MatPaddingDirective,
  MatPaddingSmallDirective,
  MatRoundedDirective,
  MatSquareDirective,
  OverflowYDirective,
  AutofocusDirective,
] as const;
