/** Échappement HTML. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Markdown en ligne seul (gras, italique, barré, code, liens), texte échappé : pour une ligne ou un paragraphe déjà découpé. */
export function markdownInline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/|#)[^)\s]*)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

/**
 * Convertisseur Markdown → HTML minimal et sûr (le texte est échappé avant transformation).
 * Gère : titres #–####, gras, italique, barré, code en ligne et blocs ```, listes à puces / numérotées,
 * cases à cocher - [ ] / - [x], citations, liens [texte](url), séparateurs ---, paragraphes.
 */
export function markdownToHtml(src: string): string {
  const inline = markdownInline;

  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flushPara(); closeList();
      const code: string[] = [];
      while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i]);
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushPara(); closeList(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flushPara(); closeList(); out.push('<hr>'); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); closeList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    if ((m = line.match(/^\s*[-*+]\s+(.*)$/)) || (m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      const kind = /^\s*\d/.test(line) ? 'ol' : 'ul';
      if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; }
      const task = m[1].match(/^\[( |x|X)\]\s+(.*)$/);
      out.push(task ? `<li class="task"><span class="box${task[1] !== ' ' ? ' on' : ''}"></span>${inline(task[2])}</li>` : `<li>${inline(m[1])}</li>`);
      continue;
    }
    if (!line.trim()) { flushPara(); closeList(); continue; }
    closeList();
    para.push(line);
  }
  flushPara(); closeList();
  return out.join('\n');
}
