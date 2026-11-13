import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type ResultStatus = 'success' | 'error' | 'info' | 'warning' | 'pending' | '403' | '404' | '500';

const PRESETS: Record<ResultStatus, { icon: string; tone: string; title: string; subtitle: string }> = {
  success: { icon: 'check', tone: 'success', title: 'Opération réussie', subtitle: 'Votre demande a bien été prise en compte.' },
  error: { icon: 'close', tone: 'error', title: 'L’opération a échoué', subtitle: 'Vérifiez les informations ci-dessous puis réessayez.' },
  info: { icon: 'info', tone: 'info', title: 'Information', subtitle: '' },
  warning: { icon: 'priority_high', tone: 'warning', title: 'Action requise', subtitle: '' },
  pending: { icon: 'hourglass_top', tone: 'info', title: 'Traitement en cours', subtitle: 'Cela peut prendre quelques instants.' },
  '403': { icon: 'lock', tone: 'warning', title: 'Accès refusé', subtitle: 'Vous n’avez pas les droits nécessaires pour consulter cette page.' },
  '404': { icon: 'travel_explore', tone: 'info', title: 'Page introuvable', subtitle: 'Le lien est peut-être erroné ou la page a été déplacée.' },
  '500': { icon: 'cloud_off', tone: 'error', title: 'Erreur du serveur', subtitle: 'Un incident technique est survenu. Nos équipes sont prévenues.' },
};

/**
 * Page / bloc de résultat après une action importante (paiement, validation, envoi) ou une erreur
 * (403, 404, 500) : pictogramme animé, titre, sous-titre, contenu libre (récapitulatif) via
 * `<ng-content>`, actions via `[actions]`.
 *
 * ```html
 * <app-result status="success" title="Paiement confirmé" subtitle="Reçu envoyé par email.">
 *   <div class="receipt">…</div>
 *   <div actions><button mat-flat-button>Retour au tableau de bord</button></div>
 * </app-result>
 * ```
 */
@Component({
  selector: 'app-result',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="rs" [class.compact]="compact()" [style.--tone]="'var(--' + preset().tone + '-color)'">
      @if (code()) { <span class="rs-code">{{ code() }}</span> }
      <div class="rs-ic" [class.pending]="status() === 'pending'" [class.pop]="status() === 'success'">
        <mat-icon>{{ icon() || preset().icon }}</mat-icon>
      </div>
      <h2>{{ title() || preset().title }}</h2>
      @if (subtitle() || preset().subtitle) { <p>{{ subtitle() || preset().subtitle }}</p> }
      <div class="rs-content"><ng-content /></div>
      <div class="rs-actions"><ng-content select="[actions]" /></div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .rs { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 40px 20px; position: relative;
      h2 { margin: 18px 0 6px; font: 600 22px/1.25 'Outfit', sans-serif; color: var(--text-primary); }
      p { margin: 0; max-width: 460px; font-size: 14px; line-height: 1.55; color: var(--text-secondary); }
      &.compact { padding: 20px 12px; h2 { font-size: 18px; margin-top: 12px; } .rs-ic { width: 60px; height: 60px; mat-icon { font-size: 30px; width: 30px; height: 30px; } } } }
    .rs-code { position: absolute; top: 0; left: 50%; transform: translateX(-50%); font: 800 120px/1 'Outfit', sans-serif; letter-spacing: -0.04em;
      color: color-mix(in srgb, var(--tone) 9%, transparent); pointer-events: none; user-select: none; }
    .rs-ic { position: relative; width: 84px; height: 84px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--tone) 14%, var(--card-bg)); color: var(--tone);
      box-shadow: 0 0 0 10px color-mix(in srgb, var(--tone) 6%, transparent);
      mat-icon { font-size: 42px; width: 42px; height: 42px; }
      &.pop { animation: rs-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
      &.pending mat-icon { animation: rs-flip 1.6s ease-in-out infinite; } }
    @keyframes rs-pop { from { transform: scale(0.4); opacity: 0; } }
    @keyframes rs-flip { 50% { transform: rotate(180deg); } }
    .rs-content:not(:empty) { margin-top: 20px; width: 100%; max-width: 440px; }
    .rs-actions:not(:empty) { margin-top: 22px; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  `],
})
export class ResultComponent {
  status = input<ResultStatus>('success');
  title = input('');
  subtitle = input('');
  icon = input('');
  compact = input(false);
  preset = computed(() => PRESETS[this.status()]);
  code = computed(() => (['403', '404', '500'].includes(this.status()) ? this.status() : ''));
}
