import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

let mermaidPret: Promise<any> | null = null;
let compteur = 0;
const css = (v: string, defaut: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || defaut;
const sombre = () => document.documentElement.getAttribute('data-mode') === 'dark' || document.documentElement.classList.contains('dark') ||
  (!document.documentElement.getAttribute('data-mode') && matchMedia('(prefers-color-scheme: dark)').matches);

/** Charge Mermaid à la demande (gros module) avec un thème accordé à l'application. */
function chargerMermaid() {
  mermaidPret ??= import('mermaid').then((m) => m.default);
  return mermaidPret.then((mermaid) => {
    const s = sombre();
    mermaid.initialize({
      startOnLoad: false, securityLevel: 'strict', theme: 'base',
      fontFamily: css('--font-body', 'Inter, system-ui, sans-serif'),
      flowchart: { curve: 'basis', htmlLabels: true, padding: 14, nodeSpacing: 46, rankSpacing: 64, useMaxWidth: true },
      gantt: { useMaxWidth: true, barHeight: 22, fontSize: 12 },
      themeVariables: {
        fontSize: '14px', background: 'transparent',
        primaryColor: s ? '#1f3b38' : '#e3f6f4', primaryBorderColor: s ? '#4fb3a6' : '#2a9d8f', primaryTextColor: s ? '#e6f2f0' : '#134e48',
        lineColor: s ? '#8aa0a0' : '#7c8b8b', textColor: s ? '#e3e3e3' : '#2b3434',
        clusterBkg: s ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.025)', clusterBorder: s ? '#3c4747' : '#d5dede',
        edgeLabelBackground: s ? '#1b2222' : '#ffffff', tertiaryColor: s ? '#1b2222' : '#f6f8f8',
      },
    });
    return mermaid;
  });
}

/** Remplace les blocs ```mermaid (rendus par marked) par des schémas SVG ; suit les changements du contenu. */
@Directive({ selector: '[appSchemas]' })
export class SchemasDirective implements OnInit, OnDestroy {
  private readonly hote = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private obs?: MutationObserver;
  ngOnInit() {
    this.obs = new MutationObserver(() => this.rendre());
    this.obs.observe(this.hote, { childList: true, subtree: true });
    this.rendre();
  }
  ngOnDestroy() { this.obs?.disconnect(); }
  private async rendre() {
    const blocs = [...this.hote.querySelectorAll<HTMLElement>('pre > code.language-mermaid')].filter((c) => !c.dataset['rendu']);
    if (!blocs.length) return;
    blocs.forEach((c) => (c.dataset['rendu'] = '1'));
    const mermaid = await chargerMermaid();
    for (const c of blocs) {
      const pre = c.parentElement!; const source = c.textContent ?? '';
      const fig = document.createElement('figure'); fig.className = 'schema';
      try {
        const { svg } = await mermaid.render(`schema-${++compteur}`, source);
        fig.innerHTML = svg;
        const bouton = document.createElement('button'); bouton.type = 'button'; bouton.className = 'schema-source'; bouton.textContent = 'Voir la source';
        bouton.onclick = () => { const p = fig.querySelector('pre'); if (p) p.remove(); else { const x = document.createElement('pre'); x.textContent = source; fig.appendChild(x); } };
        fig.appendChild(bouton);
        pre.replaceWith(fig);
      } catch {
        fig.innerHTML = '<figcaption class="schema-erreur">Schéma invalide : voici sa source.</figcaption>'; fig.appendChild(pre.cloneNode(true)); pre.replaceWith(fig);
      }
    }
  }
}
