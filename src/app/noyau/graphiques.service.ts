import { Injectable, effect, inject, signal } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ThemeService } from '../core/services/theme.service';
import { alpha, resolveColor } from './couleurs-graphiques';

export interface Palette { primary: string; muted: string; grid: string; card: string; text: string; success: string; info: string; warning: string; error: string; purple: string; neutral: string }

/** Couleurs concrètes du thème courant pour Chart.js (recalculées à chaque changement de thème). Repris du tableau de bord du ui-kit. */
@Injectable({ providedIn: 'root' })
export class GraphiquesService {
  private readonly theme = inject(ThemeService);
  readonly c = signal<Palette>({ primary: '#006a6a', muted: '#9ca3af', grid: '#e5e7eb', card: '#fff', text: '#1f2937', success: '#22c55e', info: '#3b82f6', warning: '#eab308', error: '#ef4444', purple: '#a855f7', neutral: '#9ca3af' });
  constructor() {
    effect(() => {
      this.theme.mode(); this.theme.label();
      setTimeout(() => this.c.set({ primary: resolveColor('--primary-color'), muted: resolveColor('--text-muted'), grid: resolveColor('--border-color'), card: resolveColor('--card-bg'),
        text: resolveColor('--text-primary'), success: resolveColor('--success-color'), info: resolveColor('--info-color'), warning: resolveColor('--warning-color'),
        error: resolveColor('--error-color'), purple: resolveColor('--purple-color'), neutral: resolveColor('--border-color') }));
    });
  }
  /** Couleur d'un ton du kit (success, info…). */
  ton(t: string) { return (this.c() as any)[t] ?? this.c().neutral; }
  alpha = alpha;

  optionsLignes(): ChartConfiguration<'line' | 'bar'>['options'] {
    const c = this.c();
    return {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: c.card, titleColor: c.text, bodyColor: c.text, borderColor: c.grid, borderWidth: 1, padding: 10, boxPadding: 4 } },
      scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: c.muted, maxRotation: 0, autoSkipPadding: 16 } },
        y: { beginAtZero: true, grid: { color: alpha(c.grid, 0.6) }, border: { display: false }, ticks: { color: c.muted, precision: 0 } } },
    } as any;
  }
  optionsSpark(): ChartConfiguration<'line'>['options'] {
    return { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { enabled: false } },
      elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } }, scales: { x: { display: false }, y: { display: false, beginAtZero: true } } };
  }
  optionsDonut(): ChartConfiguration<'doughnut'>['options'] {
    const c = this.c();
    return { responsive: true, maintainAspectRatio: false, cutout: '74%', plugins: { legend: { display: false }, tooltip: { backgroundColor: c.card, titleColor: c.text, bodyColor: c.text, borderColor: c.grid, borderWidth: 1 } } } as any;
  }
}
