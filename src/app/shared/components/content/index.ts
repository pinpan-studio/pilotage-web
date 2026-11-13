export * from './content.models';
export * from './article-body.component';
export * from './comment-composer.component';
export * from './comment-thread.component';

import { ArticleBodyComponent as A } from './article-body.component';
import { CommentComposerComponent as C } from './comment-composer.component';
import { CommentThreadComponent as T } from './comment-thread.component';
/** Composants de contenu éditorial, à importer d'un bloc dans un composant standalone. */
export const CONTENT_COMPONENTS = [A, C, T] as const;
