import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatPaddingDirective, MatPaddingSmallDirective } from '../../directives/ui-directives';

/** Dialogs génériques du `ModalService` d'origine (core/components/*), portés tels quels. */

export interface ParamDialog {
  title?: string;
  subTitle?: string;
  message?: string | string[];
  actionBtn?: { label: string; link: string };
}

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [MatButtonModule, MatPaddingDirective],
  templateUrl: './alert.component.html',
})
export class AlertComponent {
  readonly dialogRef = inject(MatDialogRef<AlertComponent>);
  readonly data = inject<ParamDialog>(MAT_DIALOG_DATA);
  close() { this.dialogRef.close(); }
}

@Component({
  selector: 'app-confirm',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './confirm.component.html',
  styleUrls: ['./confirm.component.css'],
})
export class ConfirmComponent {
  readonly dialogRef = inject(MatDialogRef<ConfirmComponent>);
  readonly data = inject<ParamDialog>(MAT_DIALOG_DATA);
  valid() { this.dialogRef.close(true); }
  cancel() { this.dialogRef.close(false); }
}

/** Saisie libre (commentaire, motif…) — remplace le `PromptComponent` piloté par form-layout. */
@Component({
  selector: 'app-prompt',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      @if (data.message) { <p class="prompt-message">{{ data.message }}</p> }
      <div class="field-box textarea-box">
        <textarea [(ngModel)]="value" rows="4" placeholder="Votre réponse…"></textarea>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Annuler</button>
      <button mat-flat-button color="primary" (click)="dialogRef.close(value)">
        <mat-icon>check</mat-icon> Valider
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] { font-family: 'Outfit', sans-serif; font-weight: 700; }
    .prompt-message { color: var(--text-secondary); font-size: 14px; margin: 0 0 12px; }
  `],
})
export class PromptComponent {
  readonly dialogRef = inject(MatDialogRef<PromptComponent>);
  readonly data = inject<ParamDialog>(MAT_DIALOG_DATA);
  value = '';
}

@Component({
  selector: 'app-confirm-bottom-sheet',
  standalone: true,
  imports: [MatListModule, MatIconModule],
  template: `
    <mat-nav-list style="display:flex; flex-direction:column;">
      <div style="display:flex; flex-direction:row; justify-content:center; align-items:center; flex:1;">
        <p class="mat-title no-wrap">{{ data.message }}</p>
      </div>
      <div style="display:flex; flex-direction:row; justify-content:center; align-items:center; flex:1;">
        <a mat-list-item (click)="close(true)">
          <mat-icon matListItemIcon>check_circle</mat-icon>
          <span matListItemTitle>Confirmer</span>
          <span matListItemLine>Cliquer ici pour confirmer</span>
        </a>
        <a mat-list-item (click)="close(false)">
          <mat-icon matListItemIcon>cancel</mat-icon>
          <span matListItemTitle>Annuler</span>
          <span matListItemLine>Cliquer ici pour annuler</span>
        </a>
      </div>
    </mat-nav-list>
  `,
  styles: [`.no-wrap { white-space: normal; }`],
})
export class ConfirmBottomSheetComponent {
  private ref = inject(MatBottomSheetRef<ConfirmBottomSheetComponent>);
  readonly data = inject<ParamDialog>(MAT_BOTTOM_SHEET_DATA);
  close(v: boolean) { this.ref.dismiss(v); }
}

@Component({
  selector: 'app-push-message',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatPaddingDirective, MatPaddingSmallDirective],
  templateUrl: './push-message.component.html',
  styleUrls: ['./push-message.component.scss'],
})
export class PushMessageComponent {
  readonly dialogRef = inject(MatDialogRef<PushMessageComponent>);
  private router = inject(Router);
  private data = inject<ParamDialog>(MAT_DIALOG_DATA);
  title = this.data?.title ?? '';
  message = (this.data?.message as string) ?? '';
  actionBtn = this.data?.actionBtn;
  goTo(link: string) { this.dialogRef.close(); this.router.navigate([link]); }
  close() { this.dialogRef.close(); }
}

@Component({
  selector: 'app-priority-message',
  standalone: true,
  imports: [MatButtonModule, MatPaddingDirective],
  templateUrl: './priority-message.component.html',
  styleUrls: ['./priority-message.component.scss'],
})
export class PriorityMessageComponent {
  readonly dialogRef = inject(MatDialogRef<PriorityMessageComponent>);
  private router = inject(Router);
  private data = inject<ParamDialog>(MAT_DIALOG_DATA);
  title = this.data?.title ?? '';
  subTitle = this.data?.subTitle ?? '';
  message: any = this.data?.message ?? '';
  isArray = Array.isArray(this.data?.message);
  actionBtn = this.data?.actionBtn;
  goTo(link: string) { this.dialogRef.close(); this.router.navigate([link]); }
}
