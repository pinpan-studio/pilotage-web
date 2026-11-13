import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../api/genere/api';
import { equipesChanger, equipesCreer, equipesMesEquipes } from '../../api/genere/functions';
import { EquipeDto } from '../../api/genere/models';
import { AuthService } from './auth.service';
import { NavigationService } from './navigation.service';

/** Équipes (espaces de travail) de l'utilisateur et équipe courante. */
@Injectable({ providedIn: 'root' })
export class EquipeService {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly nav = inject(NavigationService);
  private readonly router = inject(Router);
  readonly equipes = signal<EquipeDto[]>([]);
  readonly courante = computed(() => this.equipes().find((e) => e.courante) ?? null);
  readonly estAdmin = computed(() => this.courante()?.role === 'admin');
  readonly peutCreerProjet = computed(() => ['admin', 'chef_projet'].includes(this.courante()?.role ?? ''));

  async charger() { this.equipes.set(await this.api.invoke(equipesMesEquipes).catch(() => [])); }

  async changer(organisation_id: string) {
    const s = await this.api.invoke(equipesChanger, { body: { organisation_id } });
    this.auth.appliquerSession(s);
    this.nav.projetCourant.set(null);
    await Promise.all([this.charger(), this.nav.chargerProjets(true)]);
    this.router.navigateByUrl('/');
  }

  async creer(nom: string) {
    const e = await this.api.invoke(equipesCreer, { body: { nom } });
    await this.charger();
    return e;
  }
}
