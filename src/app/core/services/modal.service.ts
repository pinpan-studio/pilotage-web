import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatBottomSheet, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import {
  AlertComponent, ConfirmBottomSheetComponent, ConfirmComponent, ParamDialog,
  PriorityMessageComponent, PromptComponent, PushMessageComponent,
} from '../../shared/components/dialogs/legacy-dialogs.component';
import { ThemeService } from './theme.service';

export type { ParamDialog };

/**
 * Service purement UI : ouvre les boîtes de dialogue génériques du projet d'origine.
 * Mêmes signatures que `core/services/modal.service.ts` pour alert / confirm / prompt /
 * bottomConfirm / showPriorityMessage / showPushMessage. Aucun appel réseau.
 */
@Injectable({ providedIn: 'root' })
export class ModalService {
  readonly dialog = inject(MatDialog);
  private bottomSheet = inject(MatBottomSheet);
  private theme = inject(ThemeService);

  alert(p: ParamDialog, themeClass?: string): MatDialogRef<AlertComponent> {
    return this.dialog.open(AlertComponent, { data: p, disableClose: true, backdropClass: 'startBackDrop', panelClass: ['cPersonnal', themeClass || this.theme.mode()] });
  }

  confirm(p: ParamDialog, themeClass?: string): MatDialogRef<ConfirmComponent, boolean> {
    return this.dialog.open(ConfirmComponent, { data: p, backdropClass: 'startBackDrop', panelClass: ['cPersonnal', themeClass || this.theme.mode()] });
  }

  prompt(p: ParamDialog): MatDialogRef<PromptComponent, string | undefined> {
    return this.dialog.open(PromptComponent, { data: p, width: '480px' });
  }

  bottomConfirm(p: ParamDialog): MatBottomSheetRef<ConfirmBottomSheetComponent, boolean> {
    return this.bottomSheet.open(ConfirmBottomSheetComponent, { data: p });
  }

  showPriorityMessage(p: ParamDialog & { themeClass?: string }, fn?: () => void): MatDialogRef<PriorityMessageComponent> {
    const ref = this.dialog.open(PriorityMessageComponent, {
      panelClass: ['cPersonnal', p.themeClass || this.theme.mode()], backdropClass: 'startBackDrop', width: '600px',
      disableClose: !!p.actionBtn, data: p,
    });
    ref.afterClosed().subscribe(() => fn?.());
    return ref;
  }

  showPushMessage(p: ParamDialog & { themeClass?: string }, fn?: () => void): MatDialogRef<PushMessageComponent> {
    const ref = this.dialog.open(PushMessageComponent, {
      backdropClass: 'startBackDrop', panelClass: ['cPersonnal', p.themeClass || this.theme.mode()], width: '400px',
      disableClose: !!p.actionBtn, data: p,
    });
    ref.afterClosed().subscribe(() => fn?.());
    return ref;
  }
}
