/**
 * Modèles du contenu éditorial : articles structurés en blocs et commentaires en fil.
 * Le texte des blocs accepte le Markdown en ligne (**gras**, *italique*, `code`, [lien](url)).
 */
export type CalloutTone = 'info' | 'success' | 'warning' | 'error' | 'neutral';

export type ArticleBlock =
  | { type: 'lead'; text: string }
  | { type: 'p'; text: string; dropcap?: boolean }
  | { type: 'h2' | 'h3'; text: string; id?: string }
  | { type: 'quote'; text: string; cite?: string }
  | { type: 'pullquote'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'code'; code: string; lang?: string; filename?: string }
  | { type: 'figure'; icon: string; caption?: string; hue?: number; wide?: boolean }
  | { type: 'callout'; tone: CalloutTone; title?: string; text: string }
  | { type: 'table'; head: string[]; rows: string[][]; caption?: string }
  | { type: 'divider' };

export interface ArticleAuthor { name: string; role?: string; color?: string; bio?: string; }

export interface Article {
  slug: string;
  title: string;
  /** Chapô (sous-titre). */
  dek: string;
  category: string;
  tags: string[];
  author: ArticleAuthor;
  date: string;
  /** Minutes de lecture. */
  minutes: number;
  /** Teinte (0–360) de l'illustration générée. */
  hue: number;
  icon: string;
  featured?: boolean;
  blocks: ArticleBlock[];
}

export interface CommentAuthor { name: string; color?: string; role?: string; }

export interface CommentItem {
  id: string;
  author: CommentAuthor;
  /** Markdown simple. */
  text: string;
  /** ISO ou libellé relatif (« il y a 2 h »). */
  at: string;
  likes: number;
  liked?: boolean;
  pinned?: boolean;
  edited?: boolean;
  deleted?: boolean;
  /** Commentaire de l'auteur de l'article. */
  byAuthor?: boolean;
  reactions?: { emoji: string; count: number; mine?: boolean }[];
  replies?: CommentItem[];
}

/** Identifiant d'ancre stable à partir d'un titre. */
export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Sommaire (titres h2 / h3) d'une liste de blocs. */
export function articleToc(blocks: ArticleBlock[]): { id: string; text: string; level: 2 | 3 }[] {
  return blocks
    .filter((b): b is Extract<ArticleBlock, { type: 'h2' | 'h3' }> => b.type === 'h2' || b.type === 'h3')
    .map((b) => ({ id: b.id ?? slugify(b.text), text: b.text, level: b.type === 'h2' ? 2 : 3 }));
}

/** Nombre total de commentaires (réponses comprises, supprimés exclus). */
export function countComments(list: CommentItem[]): number {
  return list.reduce((n, c) => n + (c.deleted ? 0 : 1) + countComments(c.replies ?? []), 0);
}
