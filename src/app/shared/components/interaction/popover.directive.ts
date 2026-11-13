import { Directive, ElementRef, OnDestroy, TemplateRef, ViewContainerRef, inject, input, output } from '@angular/core';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

const POSITIONS: Record<string, ConnectedPosition[]> = {
  bottom: [{ originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 }, { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 }],
  top: [{ originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 }, { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 }],
  right: [{ originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: 8 }, { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -8 }],
  left: [{ originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -8 }, { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: 8 }],
  'bottom-start': [{ originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 }, { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 }],
};

/**
 * Popover riche (carte au survol ou au clic) : n'importe quel contenu via un template, délai d'ouverture /
 * fermeture, reste ouvert quand la souris passe sur la carte, repositionnement automatique, Échap / clic extérieur.
 *
 * ```html
 * <a [appPopover]="carteClient" [popoverContext]="client" popoverTrigger="hover">{{ client.nom }}</a>
 * <ng-template #carteClient let-c>…</ng-template>
 * ```
 */
@Directive({
  selector: '[appPopover]',
  standalone: true,
  exportAs: 'appPopover',
  host: {
    '(mouseenter)': 'hoverIn()', '(mouseleave)': 'hoverOut()', '(focusin)': 'hoverIn()', '(focusout)': 'hoverOut()',
    '(click)': 'onClick($event)', '[attr.aria-haspopup]': '"dialog"', '[attr.aria-expanded]': '!!ref?.hasAttached()',
  },
})
export class PopoverDirective implements OnDestroy {
  private overlay = inject(Overlay);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private vcr = inject(ViewContainerRef);

  template = input.required<TemplateRef<unknown>>({ alias: 'appPopover' });
  context = input<unknown>(null, { alias: 'popoverContext' });
  trigger = input<'hover' | 'click'>('hover', { alias: 'popoverTrigger' });
  position = input<keyof typeof POSITIONS>('bottom', { alias: 'popoverPosition' });
  openDelay = input(250, { alias: 'popoverOpenDelay' });
  closeDelay = input(150, { alias: 'popoverCloseDelay' });
  opened = output<boolean>({ alias: 'popoverOpened' });

  ref?: OverlayRef;
  private timer?: ReturnType<typeof setTimeout>;

  hoverIn(): void { if (this.trigger() === 'hover') this.schedule(() => this.open(), this.openDelay()); }
  hoverOut(): void { if (this.trigger() === 'hover') this.schedule(() => this.close(), this.closeDelay()); }
  onClick(e: MouseEvent): void {
    if (this.trigger() !== 'click') return;
    e.stopPropagation();
    this.ref?.hasAttached() ? this.close() : this.open();
  }
  private schedule(fn: () => void, ms: number): void { clearTimeout(this.timer); this.timer = setTimeout(fn, ms); }

  open(): void {
    if (this.ref?.hasAttached()) return;
    if (!this.ref) {
      this.ref = this.overlay.create({
        positionStrategy: this.overlay.position().flexibleConnectedTo(this.el).withPositions(POSITIONS[this.position()]).withPush(true).withViewportMargin(8),
        scrollStrategy: this.overlay.scrollStrategies.reposition(),
        panelClass: 'kit-popover-pane',
      });
      this.ref.keydownEvents().subscribe((e) => e.key === 'Escape' && this.close());
      this.ref.outsidePointerEvents().subscribe((e) => { if (!this.el.nativeElement.contains(e.target as Node)) this.close(); });
      const pane = this.ref.overlayElement;
      pane.addEventListener('mouseenter', () => this.trigger() === 'hover' && clearTimeout(this.timer));
      pane.addEventListener('mouseleave', () => this.hoverOut());
    }
    this.ref.attach(new TemplatePortal(this.template(), this.vcr, { $implicit: this.context(), close: () => this.close() }));
    this.opened.emit(true);
  }
  close(): void {
    clearTimeout(this.timer);
    if (this.ref?.hasAttached()) { this.ref.detach(); this.opened.emit(false); }
  }
  ngOnDestroy(): void { clearTimeout(this.timer); this.ref?.dispose(); }
}
