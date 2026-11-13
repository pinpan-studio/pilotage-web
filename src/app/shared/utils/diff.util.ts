/** Diff ligne à ligne (LCS) avec repérage des mots modifiés dans les lignes appariées. */
export type DiffOp = 'equal' | 'add' | 'del';
export interface DiffPart { text: string; changed: boolean; }
export interface DiffLine { op: DiffOp; oldNo: number | null; newNo: number | null; text: string; parts?: DiffPart[]; }

function lcsOps<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean = (x, y) => x === y): DiffOp[] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { ops.push('equal'); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push('del'); i++; }
    else { ops.push('add'); j++; }
  }
  while (i++ < n) ops.push('del');
  while (j++ < m) ops.push('add');
  return ops;
}

/** Découpe deux lignes en mots et marque les fragments différents de chaque côté. */
export function wordDiff(a: string, b: string): { old: DiffPart[]; new: DiffPart[] } {
  const ta = a.split(/(\s+|[.,;:!?()«»"'])/).filter(Boolean), tb = b.split(/(\s+|[.,;:!?()«»"'])/).filter(Boolean);
  const ops = lcsOps(ta, tb);
  const o: DiffPart[] = [], n: DiffPart[] = [];
  let i = 0, j = 0;
  const push = (arr: DiffPart[], text: string, changed: boolean) => {
    const last = arr[arr.length - 1];
    if (last && last.changed === changed) last.text += text; else arr.push({ text, changed });
  };
  for (const op of ops) {
    if (op === 'equal') { push(o, ta[i++], false); push(n, tb[j++], false); }
    else if (op === 'del') push(o, ta[i++], true);
    else push(n, tb[j++], true);
  }
  return { old: o, new: n };
}

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.replace(/\r\n?/g, '\n').split('\n'), b = after.replace(/\r\n?/g, '\n').split('\n');
  const ops = lcsOps(a, b);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  for (const op of ops) {
    if (op === 'equal') out.push({ op, oldNo: ++i, newNo: ++j, text: a[i - 1] });
    else if (op === 'del') out.push({ op, oldNo: ++i, newNo: null, text: a[i - 1] });
    else out.push({ op, oldNo: null, newNo: ++j, text: b[j - 1] });
  }
  // Apparie les suppressions / ajouts consécutifs pour surligner les mots modifiés.
  for (let k = 0; k < out.length; k++) {
    if (out[k].op !== 'del') continue;
    let d = k; while (d < out.length && out[d].op === 'del') d++;
    let e = d; while (e < out.length && out[e].op === 'add') e++;
    for (let p = 0; p < Math.min(d - k, e - d); p++) {
      const w = wordDiff(out[k + p].text, out[d + p].text);
      out[k + p].parts = w.old;
      out[d + p].parts = w.new;
    }
    k = e - 1;
  }
  return out;
}
