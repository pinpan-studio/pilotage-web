import { Component, Directive, ElementRef, OnDestroy, inject, input, output, signal } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { MatIconModule } from '@angular/material/icon';
import { KbdComponent } from './shortcut.service';

export interface ContextMenuItem {
  id?: string;
  label?: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Séparateur horizontal. */
  divider?: boolean;
  /** Titre de section (non cliquable). */
  header?: string;
  action?: () => void;
}

@Component({
  selector: 'app-context-menu-panel',
  standalone: true,
  imports: [MatIconModule, KbdComponent],
  template: `
    <div class="kit-ctx" role="menu" tabindex="-1" (keydown)="onKey($event)">
      @for (it of items(); track $index; let i = $index) {
        @if (it.divider) { <div class="ctx-sep" role="separator"></div> }
        @else if (it.header) { <div class="ctx-head">{{ it.header }}</div> }
        @else {
          <button type="button" role="menuitem" class="ctx-item" [class.danger]="it.danger" [class.active]="i === active()" [disabled]="it.disabled"
            [attr.data-i]="i" (mouseenter)="active.set(i)" (click)="pick(it)">
            <mat-icon>{{ it.icon || '' }}</mat-icon><span>{{ it.label }}</span>
            @if (it.shortcut) { <app-kbd [keys]="it.shortcut" /> }
          </button>
        }
      }
    </div>
  `,
})
export class ContextMenuPanelComponent {
  items = signal<ContextMenuItem[]>([]);
  active = signal(-1);
  select: (it: ContextMenuItem) => void = () => {};
  close: () => void = () => {};

  pick(it: ContextMenuItem): void { if (!it.disabled) this.select(it); }
  private focusable(): number[] { return this.items().map((it, i) => (!it.divider && !it.header && !it.disabled ? i : -1)).filter((i) => i >= 0); }
  move(d: number): void {
    const f = this.focusable();
    if (!f.length) return;
    const cur = f.indexOf(this.active());
    this.active.set(f[(cur + d + f.length) % f.length]);
  }
  onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') { e.preventDefault(); this.move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.move(-1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const it = this.items()[this.active()]; if (it) this.pick(it); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); this.close(); }
  }
}

/**
 * Menu contextuel au clic droit (ou appui long au doigt, touche Menu / Maj+F10) positionné au curseur,
 * navigation clavier, raccourcis affichés, séparateurs, titres de section, actions dangereuses.
 *
 * ```html
 * <tr [appContextMenu]="menuLigne" (contextMenuOpen)="ligne = row">…</tr>
 * ```
 */
@Directive({
  selector: '[appContextMenu]',
  standalone: true,
  host: { '(contextmenu)': 'onContext($event)', '(keydown)': 'onKeydown($event)', '(touchstart)': 'touchStart($event)', '(touchend)': 'touchEnd()', '(touchmove)': 'touchEnd()' },
})
export class ContextMenuDirective implements OnDestroy {
  private overlay = inject(Overlay);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  items = input.required<ContextMenuItem[]>({ alias: 'appContextMenu' });
  contextMenuOpen = output<MouseEvent | KeyboardEvent | TouchEvent>();
  itemSelected = output<ContextMenuItem>();

  private ref?: OverlayRef;
  private longPress?: ReturnType<typeof setTimeout>;

  /** Sans entrée (ex. mode lecture seule), le menu natif reste disponible. */
  onContext(e: MouseEvent): void { if (!this.items().length) return; e.preventDefault(); this.contextMenuOpen.emit(e); this.openAt(e.clientX, e.clientY); }
  onKeydown(e: KeyboardEvent): void {
    if (this.items().length && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) {
      e.preventDefault();
      const r = this.el.nativeElement.getBoundingClientRect();
      this.contextMenuOpen.emit(e);
      this.openAt(r.left + 16, r.top + r.height / 2, true);
    }
  }
  touchStart(e: TouchEvent): void {
    if (!this.items().length) return;
    const t = e.touches[0];
    this.longPress = setTimeout(() => { this.contextMenuOpen.emit(e); this.openAt(t.clientX, t.clientY); }, 550);
  }
  touchEnd(): void { clearTimeout(this.longPress); }

  openAt(x: number, y: number, focusFirst = false): void {
    this.close();
    this.ref = this.overlay.create({
      positionStrategy: this.overlay.position().flexibleConnectedTo({ x, y }).withPositions([
        { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'top' },
        { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top' },
        { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
        { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
      ]).withViewportMargin(8),
      scrollStrategy: this.overlay.scrollStrategies.close(),
    });
    const cmp = this.ref.attach(new ComponentPortal(ContextMenuPanelComponent)).instance;
    cmp.items.set(this.items());
    cmp.select = (it) => { this.close(); this.itemSelected.emit(it); it.action?.(); };
    cmp.close = () => { this.close(); this.el.nativeElement.focus?.(); };
    if (focusFirst) cmp.move(1);
    this.ref.outsidePointerEvents().subscribe(() => this.close());
    this.ref.keydownEvents().subscribe((e) => e.key === 'Escape' && this.close());
    setTimeout(() => (this.ref?.overlayElement.querySelector('.kit-ctx') as HTMLElement | null)?.focus());
  }
  close(): void { this.ref?.dispose(); this.ref = undefined; }
  ngOnDestroy(): void { this.close(); clearTimeout(this.longPress); }
}
