import { Pipe, PipeTransform, inject } from '@angular/core';
import { marked } from 'marked';
import { ReferentielsService } from './referentiels.service';
import { date, dateHeure, pct } from './format';

@Pipe({ name: 'pct' }) export class PctPipe implements PipeTransform { transform(v: number | null | undefined) { return pct(v); } }
@Pipe({ name: 'dateFr' }) export class DateFrPipe implements PipeTransform { transform(v: string | Date | null | undefined, heure = false) { return heure ? dateHeure(v) : date(v); } }
@Pipe({ name: 'libelle', pure: false }) export class LibellePipe implements PipeTransform {
  private readonly r = inject(ReferentielsService);
  transform(v: string | null | undefined) { return this.r.libelle(v); }
}
/** Markdown → HTML (assaini ensuite par Angular lors de la liaison [innerHTML]). */
@Pipe({ name: 'md' }) export class MdPipe implements PipeTransform { transform(v: string | null | undefined) { return marked.parse(v ?? '', { async: false }) as string; } }

export const PIPES = [PctPipe, DateFrPipe, LibellePipe, MdPipe] as const;
