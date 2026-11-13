import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../api/genere/api';

/** Téléchargements et dépôts binaires (l'intercepteur ajoute le jeton ; le stockage est privé). */
@Injectable({ providedIn: 'root' })
export class Fichiers {
  private readonly http = inject(HttpClient);
  private readonly api = inject(Api);

  async telecharger(chemin: string, nomParDefaut: string) {
    const r = await firstValueFrom(this.http.get(`${this.api.rootUrl}/api/v1${chemin}`, { responseType: 'blob', observe: 'response' }));
    const cd = r.headers.get('Content-Disposition') ?? '';
    const nom = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(cd)?.[1] ?? /filename="([^"]+)"/.exec(cd)?.[1] ?? nomParDefaut);
    const url = URL.createObjectURL(r.body!);
    const a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  deposer(code: string, fichier: File, categorie: 'scan_signe' | 'annexe' | 'tdr' | 'export', document?: string) {
    const f = new FormData(); f.append('fichier', fichier, fichier.name); f.append('categorie', categorie); if (document) f.append('document', document);
    return firstValueFrom(this.http.post<any>(`${this.api.rootUrl}/api/v1/projets/${encodeURIComponent(code)}/fichiers`, f));
  }
}
