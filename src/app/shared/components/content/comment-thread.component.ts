import { Component, booleanAttribute, computed, input, linkedSignal, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { markdownToHtml } from '../../utils/markdown.util';
import { CommentComposerComponent } from './comment-composer.component';
import { CommentAuthor, CommentItem, countComments } from './content.models';

type SortMode = 'top' | 'new' | 'old';

/**
 * Fil de commentaires : saisie, tri, réponses imbriquées (2 niveaux), j'aime, réactions,
 * épinglage, modification et suppression de ses propres messages. État local (aucun backend) ;
 * chaque changement est aussi émis via `changed` pour l'hôte.
 *
 * <app-comment-thread [comments]="comments" [me]="me" [mentionables]="people" />
 */
@Component({
  selector: 'app-comment-thread',
  standalone: true,
  imports: [NgTemplateOutlet, MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule, CommentComposerComponent],
  templateUrl: './comment-thread.component.html',
  styleUrls: ['./comment-thread.component.scss'],
  host: { '[class.compact]': 'compact()' },
})
export class CommentThreadComponent {
  comments = input<CommentItem[]>([]);
  me = input<CommentAuthor | null>(null);
  mentionables = input<CommentAuthor[]>([]);
  title = input('Commentaires');
  /** Variante resserrée (fil d'actualité, panneau latéral) : pas d'en-tête, saisie en bas. */
  compact = input(false, { transform: booleanAttribute });
  /** Le lecteur peut épingler (modérateur). */
  moderator = input(false, { transform: booleanAttribute });
  /** Réponses affichées avant « Afficher N réponses ». */
  visibleReplies = input(2);

  readonly changed = output<CommentItem[]>();

  /** Copie locale modifiable, réinitialisée si l'hôte fournit une nouvelle liste. */
  readonly list = linkedSignal(() => structuredClone(this.comments()));
  readonly sort = signal<SortMode>('top');
  readonly replyTo = signal<string | null>(null);
  /** Commentaire auquel on répond (racine ou réponse : la réponse est rangée sous la racine). */
  replyTarget: CommentItem | null = null;
  readonly editing = signal<string | null>(null);
  readonly expanded = signal<Set<string>>(new Set());
  readonly flash = signal<string | null>(null);
  readonly emojis = ['👍', '❤️', '🎉', '😄', '🤔', '👀'];
  readonly sortLabels: Record<SortMode, string> = { top: 'Les plus pertinents', new: 'Plus récents', old: 'Plus anciens' };
  readonly sortModes = Object.keys(this.sortLabels) as SortMode[];

  readonly total = computed(() => countComments(this.list()));
  readonly sorted = computed(() => {
    const l = [...this.list()];
    const pinned = (c: CommentItem) => (c.pinned ? 1 : 0);
    const idx = new Map(this.list().map((c, i) => [c.id, i]));
    const order: Record<SortMode, (a: CommentItem, b: CommentItem) => number> = {
      top: (a, b) => pinned(b) - pinned(a) || b.likes + (b.replies?.length ?? 0) * 2 - (a.likes + (a.replies?.length ?? 0) * 2),
      new: (a, b) => pinned(b) - pinned(a) || idx.get(b.id)! - idx.get(a.id)!,
      old: (a, b) => pinned(b) - pinned(a) || idx.get(a.id)! - idx.get(b.id)!,
    };
    return l.sort(order[this.sort()]);
  });

  /** Markdown + mise en évidence des @mentions. */
  render(text: string): string {
    return markdownToHtml(text).replace(/(^|[\s>(])@([\p{L}][\p{L}-]*)/gu, '$1<span class="mention">@$2</span>');
  }

  initials(n: string): string { return n.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase(); }
  isMine(c: CommentItem): boolean { return !!this.me() && c.author.name === this.me()!.name; }

  add(text: string): void {
    const c = this.create(text);
    // Le nouveau commentaire s'affiche en tête quel que soit le tri.
    this.list.update((l) => [c, ...l]);
    if (this.sort() === 'old') this.sort.set('new');
    this.highlight(c.id);
    this.emit();
  }

  reply(parent: CommentItem, text: string): void {
    const c = this.create(text);
    this.list.update((l) => l.map((x) => (x.id === parent.id ? { ...x, replies: [...(x.replies ?? []), c] } : x)));
    this.expanded.update((s) => new Set(s).add(parent.id));
    this.replyTo.set(null);
    this.highlight(c.id);
    this.emit();
  }

  /** Préfixe de réponse : mentionne l'auteur quand on répond à une réponse. */
  replyPrefix(c: CommentItem | null, root: CommentItem): string {
    return !c || c.id === root.id || this.isMine(c) ? '' : `@${c.author.name.replace(/\s+/g, '-')} `;
  }

  edit(c: CommentItem, text: string): void {
    this.patch(c.id, (x) => ({ ...x, text, edited: true }));
    this.editing.set(null);
    this.emit();
  }

  remove(c: CommentItem): void {
    const drop = (l: CommentItem[]): CommentItem[] =>
      l.flatMap((x): CommentItem[] => (x.id === c.id ? (x.replies?.length ? [{ ...x, deleted: true, text: '' }] : []) : [{ ...x, replies: x.replies ? drop(x.replies) : x.replies }]));
    this.list.update(drop);
    this.emit();
  }

  like(c: CommentItem): void {
    this.patch(c.id, (x) => ({ ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) }));
  }

  react(c: CommentItem, emoji: string): void {
    this.patch(c.id, (x) => {
      const r = [...(x.reactions ?? [])];
      const i = r.findIndex((e) => e.emoji === emoji);
      if (i < 0) r.push({ emoji, count: 1, mine: true });
      else {
        const e = r[i];
        const next = { ...e, mine: !e.mine, count: e.count + (e.mine ? -1 : 1) };
        if (next.count) r[i] = next; else r.splice(i, 1);
      }
      return { ...x, reactions: r };
    });
  }

  pin(c: CommentItem): void {
    this.list.update((l) => l.map((x) => ({ ...x, pinned: x.id === c.id ? !x.pinned : false })));
    this.emit();
  }

  toggleReplies(id: string): void {
    this.expanded.update((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  shownReplies(c: CommentItem): CommentItem[] {
    const r = c.replies ?? [];
    return this.expanded().has(c.id) ? r : r.slice(0, this.visibleReplies());
  }

  copyLink(c: CommentItem): void {
    navigator.clipboard?.writeText(location.href.split('#')[0] + '#comment-' + c.id).catch(() => undefined);
  }

  private create(text: string): CommentItem {
    return { id: 'n' + Date.now().toString(36), author: this.me() ?? { name: 'Invité' }, text, at: 'À l’instant', likes: 0 };
  }

  private patch(id: string, fn: (c: CommentItem) => CommentItem): void {
    const walk = (l: CommentItem[]): CommentItem[] => l.map((x) => (x.id === id ? fn(x) : x.replies ? { ...x, replies: walk(x.replies) } : x));
    this.list.update(walk);
  }

  private highlight(id: string): void {
    this.flash.set(id);
    setTimeout(() => this.flash.set(null), 1600);
  }

  private emit(): void { this.changed.emit(this.list()); }
}
