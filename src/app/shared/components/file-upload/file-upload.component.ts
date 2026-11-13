import { Component, EventEmitter, Input, OnDestroy, Output, forwardRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/** Fichier "local" sélectionné : aucune donnée n'est envoyée, l'aperçu utilise un blob URL. */
export interface LocalFile { _id: string; nom: string; taille: number; type: string; url: string; }

/**
 * Sélecteur de fichier (modes "champ" et "photo") — reprend `core/components/file-upload`.
 * L'upload réel est supprimé : le fichier choisi est lu localement et simplement affiché.
 */
@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, MatProgressSpinnerModule],
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FileUploadComponent), multi: true }],
})
export class FileUploadComponent implements ControlValueAccessor, OnDestroy {
  @Input() fichier: any;
  @Input() disabled = false;
  @Input() mode: string | undefined;
  @Input() accept: string | undefined;
  @Input() limitSize: number | undefined;
  @Input() placeholder: string | undefined | null = null;
  @Output() onUpload = new EventEmitter<LocalFile | null>();

  inProgress = false;
  private onChange: (v: any) => void = () => {};

  selectFile(): void {
    if (this.disabled) return;
    const input = document.createElement('input');
    input.type = 'file';
    if (this.accept) input.accept = this.accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      this.inProgress = true;
      // Petit délai purement visuel pour montrer l'état "en cours".
      setTimeout(() => {
        const local: LocalFile = { _id: 'local-' + Date.now(), nom: file.name, taille: file.size, type: file.type, url: URL.createObjectURL(file) };
        this.fichier = local;
        this.inProgress = false;
        this.onChange(local);
        this.onUpload.emit(local);
      }, 600);
    });
    input.click();
  }

  openFile(file: any): void {
    if (file?.url) window.open(file.url, '_blank');
  }

  deleteSelectedFile(_file?: any): void {
    this.revoke();
    this.fichier = null;
    this.onChange(null);
    this.onUpload.emit(null);
  }

  writeValue(v: any): void { this.fichier = v; }
  registerOnChange(fn: (v: any) => void): void { this.onChange = fn; }
  registerOnTouched(): void {}
  setDisabledState(d: boolean): void { this.disabled = d; }

  ngOnDestroy(): void { this.revoke(); }

  private revoke(): void {
    if (this.fichier?.url?.startsWith?.('blob:')) URL.revokeObjectURL(this.fichier.url);
  }
}
