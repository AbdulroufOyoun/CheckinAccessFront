import { Component, DOCUMENT, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info';

export interface ConfirmDialogMetaRow {
  labelKey: string;
  value: string;
}

export interface ConfirmDialogPreview {
  initials?: string;
  title: string;
  subtitle?: string;
  meta?: ConfirmDialogMetaRow[];
}

export interface ConfirmDialogData {
  variant?: ConfirmDialogVariant;
  titleKey: string;
  titleParams?: Record<string, string | number>;
  messageKey?: string;
  messageParams?: Record<string, string | number>;
  hintKey?: string;
  hintParams?: Record<string, string | number>;
  confirmKey?: string;
  cancelKey?: string;
  preview?: ConfirmDialogPreview;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, TranslateModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialog, boolean>);
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  isRTL = false;

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
  }

  get variant(): ConfirmDialogVariant {
    return this.data.variant || 'danger';
  }

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
