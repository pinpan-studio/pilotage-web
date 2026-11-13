import { Pipe, PipeTransform } from '@angular/core';

/** Met en surbrillance `args` dans `value` (à utiliser avec [innerHTML]). */
@Pipe({ name: 'highlighter', standalone: true })
export class HighlighthPipe implements PipeTransform {
  transform(value: any, args: any, type?: string): unknown {
    if (!args || typeof value !== 'string') return value;
    const safe = String(args).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = type === 'full' ? new RegExp('\\b(' + safe + '\\b)', 'igm') : new RegExp(safe, 'igm');
    return value.replace(re, (m) => `<span class="highlighted-text">${m}</span>`);
  }
}
