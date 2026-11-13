import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
  icon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon [class]="'icon-' + (data.type || 'info')" style="vertical-align:middle;margin-right:8px;">
        {{ data.icon || (data.type === 'danger' ? 'warning' : data.type === 'warning' ? 'help_outline' : 'info_outline') }}
      </mat-icon>
      {{ data.title }}
    </h2>
    <mat-dialog-content>
      <p style="font-size:14px;color:#475569;line-height:1.6;">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">{{ data.cancelLabel || 'Annuler' }}</button>
      <button mat-raised-button [color]="data.type === 'danger' ? 'warn' : 'primary'" (click)="onConfirm()">
        {{ data.confirmLabel || 'Confirmer' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .icon-danger { color: #ef4444; }
    .icon-warning { color: #f59e0b; }
    .icon-info { color: #3b82f6; }
  `],
})
export class ConfirmDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
