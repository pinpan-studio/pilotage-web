import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Api } from '../../api/genere/api';
import { catalogueAdminMajType, catalogueAdminModele, referentielsCatalogue, referentielsModele } from '../../api/genere/functions';
import { CatalogueDto, TypeDocument } from '../../api/genere/models';
import { EquipeService } from '../noyau/equipe.service';
import { Saisie } from '../noyau/saisie';
import { Chargement } from '../noyau/chargement';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';

/** Catalogue documentaire de l'équipe : types de documents (phase, producteur, livrable, signature) et modèles Markdown. */
@Component({
  selector: 'app-param-catalogue',
  imports: [FormsModule, MatButtonModule, MatIconModule, Chargement, SearchableSelectComponent],
  styleUrl: './parametres.scss',
  styles: [`.ligne { display: grid; grid-template-columns: 150px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 20px; border-top: 1px solid var(--mat-sys-outline-variant); }
    .ligne:hover { background: var(--mat-sys-surface-container-low); } .etiq { font-size: 11px; padding: 1px 6px; border-radius: 6px; background: var(--mat-sys-surface-container-high); margin-left: 4px; }
    .modele textarea { font: 12.5px/1.5 ui-monospace, monospace; min-height: 360px; } .ph { padding: 14px 20px 4px; font-weight: 700; }
    @media (max-width: 700px) { .ligne { grid-template-columns: 1fr; } }`],
  template: `
  @if (!eq.estAdmin()) { <section class="card pane"><header><h2>Catalogue documentaire</h2><p>Réservé aux administrateurs de l'équipe.</p></header></section> }
  @else if (cat(); as c) {
    @if (edition(); as e) {
      <section class="card pane">
        <header><h2>{{ e.code }}</h2><p>Les changements s'appliquent aux projets de l'équipe (statut, droits de l'agent, circuit de signature).</p></header>
        <div class="set"><div class="s-lbl"><strong>Titre</strong></div><div class="s-ctl"><div class="form-field"><div class="field-box"><input name="t" [(ngModel)]="e.titre" /></div></div></div></div>
        <div class="set"><div class="s-lbl"><strong>Phase</strong></div><div class="s-ctl"><app-searchable-select name="ph" [(ngModel)]="e.phase" [options]="oPhases()" /></div></div>
        <div class="set"><div class="s-lbl"><strong>Producteur</strong><small>« Humain » : l'agent ne peut pas écrire ce document.</small></div><div class="s-ctl"><app-searchable-select name="pr" [(ngModel)]="e.producteur" [options]="oProducteurs" /></div></div>
        <div class="set"><div class="s-lbl"><strong>Livrable contractuel</strong></div><div class="s-ctl"><label><input type="checkbox" name="l" [(ngModel)]="e.livrable" /> Remis au client</label></div></div>
        <div class="set"><div class="s-lbl"><strong>Signature</strong><small>Un scan signé est exigé pour le statut « Signé ».</small></div><div class="s-ctl"><label><input type="checkbox" name="s" [(ngModel)]="e.signature" /> Exige une signature</label></div></div>
        <div class="set"><div class="s-lbl"><strong>Description</strong></div><div class="s-ctl"><div class="form-field"><div class="field-box textarea-box"><textarea name="d" rows="3" [(ngModel)]="e.description"></textarea></div></div></div></div>
        @if (modele() !== null) {
          <div class="set modele"><div class="s-lbl"><strong>Modèle</strong><small><code>{{ codeModele() }}</code> — gabarit utilisé par l'agent (/document).</small></div>
            <div class="s-ctl"><div class="form-field"><div class="field-box textarea-box"><textarea name="m" [(ngModel)]="texteModele"></textarea></div></div></div></div>
        }
        <footer><button mat-button (click)="edition.set(null)">Annuler</button><button mat-flat-button color="primary" (click)="enregistrer()"><mat-icon>save</mat-icon>Enregistrer</button></footer>
      </section>
    }
    <section class="card pane" style="padding: 0">
      <header style="padding: 20px 20px 0"><h2>Catalogue documentaire</h2><p>{{ c.types.length }} types de documents, instanciés « à produire » à la création de chaque projet.</p></header>
      @for (ph of c.phases; track ph.code) {
        <div class="ph">{{ ph.titre }}</div>
        @for (t of parPhase(ph.code); track t.id) {
          <div class="ligne"><code>{{ t.code }}</code>
            <div>{{ t.titre }}<span class="etiq">{{ t.producteur }}</span>@if (t.livrable) { <span class="etiq">livrable</span> }@if (t.signature) { <span class="etiq">signature</span> }@if (t.modele_id) { <span class="etiq">modèle</span> }</div>
            <button mat-stroked-button (click)="editer(t)"><mat-icon>edit</mat-icon>Modifier</button></div>
        }
      }
    </section>
  } @else { <app-chargement forme="parametres" [lignes]="6" /> }`,
})
export class ParamCatalogue {
  readonly eq = inject(EquipeService);
  private readonly api = inject(Api);
  private readonly s = inject(Saisie);
  readonly cat = signal<CatalogueDto | null>(null);
  readonly edition = signal<(Pick<TypeDocument, 'code' | 'titre' | 'phase' | 'producteur' | 'livrable' | 'signature' | 'description' | 'modele_id'>) | null>(null);
  readonly modele = signal<string | null>(null);
  texteModele = '';
  readonly oProducteurs = [{ value: 'agent', label: 'Agent', description: 'Rédigé par l’agent, relu par un humain' }, { value: 'mixte', label: 'Mixte' }, { value: 'humain', label: 'Humain', description: 'Interdit à l’agent' }];
  readonly oPhases = computed(() => (this.cat()?.phases ?? []).map((p) => ({ value: p.code, label: p.titre })));
  readonly codeModele = computed(() => this.cat()?.modeles.find((m) => m.id === this.edition()?.modele_id)?.code ?? '');
  parPhase = (ph: string) => (this.cat()?.types ?? []).filter((t) => t.phase === ph);
  constructor() { this.eq.charger(); this.charger(); }
  charger() { this.api.invoke(referentielsCatalogue).then((c) => this.cat.set(c)); }
  async editer(t: TypeDocument) {
    this.edition.set({ code: t.code, titre: t.titre, phase: t.phase, producteur: t.producteur, livrable: t.livrable, signature: t.signature, description: t.description, modele_id: t.modele_id });
    this.modele.set(null);
    const code = this.cat()?.modeles.find((m) => m.id === t.modele_id)?.code;
    if (code) { const m = await this.api.invoke(referentielsModele, { code }); this.texteModele = m.contenu; this.modele.set(m.contenu); }
    window.scrollTo({ top: 0 });
  }
  async enregistrer() {
    const e = this.edition()!;
    const ok = await this.s.faire(async () => {
      await this.api.invoke(catalogueAdminMajType, { code: e.code, body: { titre: e.titre, phase: e.phase, producteur: e.producteur, livrable: e.livrable, signature: e.signature, description: e.description } });
      if (this.modele() !== null && this.texteModele !== this.modele()) await this.api.invoke(catalogueAdminModele, { code: this.codeModele(), body: { contenu: this.texteModele } });
    }, `${e.code} enregistré`);
    if (ok) { this.edition.set(null); this.charger(); }
  }
}
