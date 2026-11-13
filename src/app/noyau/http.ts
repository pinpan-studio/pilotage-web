import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../api/genere/api';

/** Appels sans fonction générée commode (suppression générique, import d'archive). */
@Injectable({ providedIn: 'root' })
export class Http {
  private readonly http = inject(HttpClient);
  private readonly api = inject(Api);
  supprimer(code: string, type: string, cle: string) {
    return firstValueFrom(this.http.delete(`${this.api.rootUrl}/api/v1/projets/${encodeURIComponent(code)}/${type}/${encodeURIComponent(cle)}`));
  }
  importerKit(archive: File) {
    const f = new FormData(); f.append('archive', archive, archive.name);
    return firstValueFrom(this.http.post<any>(`${this.api.rootUrl}/api/v1/import/kit-v1`, f));
  }
}
