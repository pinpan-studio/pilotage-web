import { Injectable, signal } from '@angular/core';

declare global { interface Window { google?: any } }

/**
 * Google Identity Services (bouton « Se connecter avec Google »).
 * Le jeton d'identité obtenu est envoyé à l'API, qui le vérifie (signature, audience, expiration).
 */
@Injectable({ providedIn: 'root' })
export class GoogleService {
  readonly clientId = signal<string | null>(null);
  private chargement: Promise<void> | null = null;

  private charger(): Promise<void> {
    this.chargement ??= new Promise((ok, ko) => {
      if (window.google?.accounts?.id) return ok();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
      s.onload = () => ok(); s.onerror = () => { this.chargement = null; ko(new Error('Google injoignable')); };
      document.head.appendChild(s);
    });
    return this.chargement;
  }

  /** Affiche le bouton Google dans `hote` ; `surJeton` reçoit le jeton d'identité. */
  async afficherBouton(hote: HTMLElement, surJeton: (credential: string) => void, sombre = false) {
    const id = this.clientId();
    if (!id) throw new Error('Connexion Google non configurée');
    await this.charger();
    window.google.accounts.id.initialize({ client_id: id, callback: (r: { credential: string }) => surJeton(r.credential), ux_mode: 'popup', auto_select: false, itp_support: true });
    window.google.accounts.id.renderButton(hote, { type: 'standard', theme: sombre ? 'filled_black' : 'outline', size: 'large', text: 'continue_with', shape: 'pill', logo_alignment: 'left', locale: 'fr', width: Math.min(hote.clientWidth || 360, 400) });
  }

  /** À la déconnexion : n'enchaîne pas automatiquement sur le même compte Google. */
  oublier() { try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* ignore */ } }
}
