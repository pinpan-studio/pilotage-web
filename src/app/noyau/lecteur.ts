import { Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface FeuilleLecteur { id: string; libelle: string; lien: any[]; ref?: string; couleur?: string; badge?: string | number }
export interface GroupeLecteur { libelle: string; icone: string; feuilles: FeuilleLecteur[] }
export interface TitreSommaire { id: string; texte: string; niveau: 2 | 3 }

/** Ajoute des ancres aux titres h2/h3 d'un HTML rendu et renvoie le sommaire. */
export function ancrer(html: string): { html: string; sommaire: TitreSommaire[] } {
  const sommaire: TitreSommaire[] = []; const vus = new Map<string, number>();
  const out = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, n, contenu) => {
    const texte = contenu.replace(/<[^>]+>/g, '').trim();
    let id = texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
    const k = vus.get(id) ?? 0; vus.set(id, k + 1); if (k) id += `-${k}`;
    sommaire.push({ id, texte, niveau: Number(n) as 2 | 3 });
    return `<h${n} id="${id}">${contenu}</h${n}>`;
  });
  return { html: out, sommaire };
}

/**
 * Gabarit de lecture repris de ui-kit examples/app/docs : arborescence filtrable et collante, page en carte
 * (fil d'Ariane, titre, métadonnées, contenu projeté), sommaire « Sur cette page », pages précédente / suivante.
 */
@Component({
  selector: 'app-lecteur',
  imports: [RouterLink, MatIconModule, MatButtonModule],
  styleUrl: './lecteur.scss',
  template: `
  <div class="docs">
    <aside class="tree" [class.open]="navOuverte()" [attr.aria-label]="titreArbre()">
      <label class="searchbox"><mat-icon>search</mat-icon><input type="search" placeholder="Filtrer" [value]="q()" (input)="q.set($any($event.target).value)" /></label>
      <nav>
        @for (g of arbre(); track g.libelle) {
          <div class="group">
            <button type="button" class="g-head" (click)="basculer(g.libelle)" [attr.aria-expanded]="!fermes().has(g.libelle)">
              <mat-icon>{{ g.icone }}</mat-icon><span>{{ g.libelle }}</span><mat-icon class="chev" [class.shut]="fermes().has(g.libelle) && !q()">expand_more</mat-icon>
            </button>
            @if (!fermes().has(g.libelle) || q()) {
              @for (f of g.feuilles; track f.id) {
                <a class="leaf" [routerLink]="f.lien" [class.on]="f.id === courant()" (click)="navOuverte.set(false)">
                  @if (f.ref) { <span class="ref-l">{{ f.ref }}</span> }{{ f.libelle }}
                  @if (f.couleur) { <i class="pt" [style.background]="f.couleur"></i> } @else if (f.badge) { <span class="badge">{{ f.badge }}</span> }
                </a>
              }
            }
          </div>
        } @empty { <p class="vide-arbre">Aucun élément.</p> }
      </nav>
    </aside>
    <div class="scrim" [class.open]="navOuverte()" (click)="navOuverte.set(false)"></div>

    <article class="card doc">
      <button mat-stroked-button class="nav-btn" (click)="navOuverte.set(true)" style="margin-bottom: 12px"><mat-icon>menu_book</mat-icon>{{ titreArbre() }}</button>
      <nav class="crumbs" aria-label="Fil d’Ariane">@for (c of fil(); track c; let last = $last) { <span [class.cur]="last">{{ c }}</span>@if (!last) { <mat-icon>chevron_right</mat-icon> } }</nav>
      <h2 class="doc-title">{{ titre() }}</h2>
      <div class="meta"><ng-content select="[meta]" /></div>
      <ng-content />
      @if (precedent() || suivant()) {
        <nav class="pager" aria-label="Pages voisines">
          @if (precedent(); as p) { <a [routerLink]="p.lien"><small>Précédent</small><strong><mat-icon>arrow_back</mat-icon>{{ p.libelle }}</strong></a> } @else { <span></span> }
          @if (suivant(); as s) { <a class="next" [routerLink]="s.lien"><small>Suivant</small><strong>{{ s.libelle }}<mat-icon>arrow_forward</mat-icon></strong></a> }
        </nav>
      }
    </article>

    <aside class="otp" aria-label="Sur cette page">
      @if (sommaire().length) {
        <span class="text-overline">Sur cette page</span>
        @for (t of sommaire(); track t.id) { <a href="#" [class.sub]="t.niveau === 3" (click)="aller(t, $event)">{{ t.texte }}</a> }
        <hr />
      }
      <ng-content select="[droite]" />
    </aside>
  </div>`,
})
export class Lecteur {
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly groupes = input<GroupeLecteur[]>([]);
  readonly courant = input<string>('');
  readonly titre = input('');
  readonly fil = input<string[]>([]);
  readonly sommaire = input<TitreSommaire[]>([]);
  readonly titreArbre = input('Sommaire');
  readonly q = signal('');
  readonly navOuverte = signal(false);
  readonly fermes = signal(new Set<string>());
  readonly arbre = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.groupes().map((g) => ({ ...g, feuilles: g.feuilles.filter((f) => !q || `${f.ref ?? ''} ${f.libelle}`.toLowerCase().includes(q)) })).filter((g) => g.feuilles.length);
  });
  private readonly plat = computed(() => this.groupes().flatMap((g) => g.feuilles));
  readonly precedent = computed(() => { const l = this.plat(); const i = l.findIndex((f) => f.id === this.courant()); return i > 0 ? l[i - 1] : null; });
  readonly suivant = computed(() => { const l = this.plat(); const i = l.findIndex((f) => f.id === this.courant()); return i >= 0 && i < l.length - 1 ? l[i + 1] : null; });
  basculer(l: string) { this.fermes.update((s) => { const n = new Set(s); n.has(l) ? n.delete(l) : n.add(l); return n; }); }
  /** Défile jusqu'au titre : par id, sinon par texte (le nettoyage HTML d'Angular retire les id du Markdown rendu). */
  aller(t: TitreSommaire, e: Event) {
    e.preventDefault();
    const racine = this.hote.nativeElement;
    const cible = racine.querySelector('#' + CSS.escape(t.id))
      ?? [...racine.querySelectorAll<HTMLElement>('.doc h2, .doc h3')].find((h) => h.textContent?.trim() === t.texte);
    cible?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
