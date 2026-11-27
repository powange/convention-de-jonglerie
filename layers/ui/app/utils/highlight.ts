// Utilitaires de recherche et de surlignage insensibles à la casse et aux accents.
//
// Stratégie :
// - On normalise (NFD + lowercase) à la fois la requête et le texte cible.
// - Comme la décomposition NFD peut allonger la chaîne (ex: "é" → "e" + combining),
//   on construit un mapping index_normalisé → index_original pour reporter les
//   positions des matches sur la chaîne d'origine sans casser les caractères composés.
//
// Sécurité : `highlightText` échappe le HTML avant d'insérer les `<mark>`.
// `highlightHtml` parse le HTML déjà sanitisé via DOMParser, parcourt uniquement
// les nœuds texte et insère des éléments `<mark>` réels — aucun risque d'injection.

const MARK_CLASS = 'bg-yellow-200 dark:bg-yellow-700/60 text-inherit rounded px-0.5'

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function parseSearchTerms(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

export function matchesAllTerms(text: string, terms: string[]): boolean {
  if (!terms.length) return true
  const normalized = stripAccents(text).toLowerCase()
  return terms.every((t) => normalized.includes(stripAccents(t).toLowerCase()))
}

// Compte le nombre total d'occurrences (tous termes confondus, sans chevauchement).
export function countMatches(text: string, terms: string[]): number {
  if (!terms.length || !text) return 0
  const normalized = stripAccents(text).toLowerCase()
  let total = 0
  for (const term of terms) {
    const termNorm = stripAccents(term).toLowerCase()
    if (!termNorm) continue
    let from = 0
    while (from <= normalized.length - termNorm.length) {
      const idx = normalized.indexOf(termNorm, from)
      if (idx === -1) break
      total++
      from = idx + termNorm.length
    }
  }
  return total
}

function findMatchRanges(text: string, terms: string[]): Array<[number, number]> {
  if (!terms.length || !text) return []

  // Mapping char-par-char : pour chaque caractère original, on calcule sa version
  // normalisée et on accumule les indices originaux correspondants.
  const normChars: string[] = []
  const mapping: number[] = []
  for (let i = 0; i < text.length; i++) {
    const stripped = stripAccents(text[i]!).toLowerCase()
    for (let k = 0; k < stripped.length; k++) {
      normChars.push(stripped[k]!)
      mapping.push(i)
    }
  }
  const normalized = normChars.join('')

  const ranges: Array<[number, number]> = []
  for (const term of terms) {
    const termNorm = stripAccents(term).toLowerCase()
    if (!termNorm) continue
    let from = 0
    while (from <= normalized.length - termNorm.length) {
      const idx = normalized.indexOf(termNorm, from)
      if (idx === -1) break
      const startOrig = mapping[idx]!
      const endOrig = (mapping[idx + termNorm.length - 1] ?? text.length - 1) + 1
      ranges.push([startOrig, endOrig])
      from = idx + termNorm.length
    }
  }

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged: Array<[number, number]> = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) {
      last[1] = Math.max(last[1], r[1])
    } else {
      merged.push([r[0], r[1]])
    }
  }
  return merged
}

// Surligne un texte brut. Le résultat est du HTML safe (texte échappé, seuls
// les `<mark>` insérés sont du HTML "réel"). Convient pour les labels de FAQ.
export function highlightText(text: string, terms: string[]): string {
  const ranges = findMatchRanges(text, terms)
  if (!ranges.length) return escapeHtml(text)
  let out = ''
  let pos = 0
  for (const [start, end] of ranges) {
    if (start > pos) out += escapeHtml(text.slice(pos, start))
    out += `<mark class="${MARK_CLASS}">${escapeHtml(text.slice(start, end))}</mark>`
    pos = end
  }
  if (pos < text.length) out += escapeHtml(text.slice(pos))
  return out
}

// Surligne dans du HTML déjà sanitisé. Parcourt uniquement les nœuds texte et
// insère des `<mark>` réels — aucun risque d'injection. Côté SSR, retourne le
// HTML inchangé (DOMParser indisponible) : le surlignage est ré-appliqué au mount.
export function highlightHtml(html: string, terms: string[]): string {
  if (!terms.length || !html) return html
  if (typeof document === 'undefined' || typeof DOMParser === 'undefined') {
    return html
  }
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return html
  walkAndHighlight(root, terms)
  return root.innerHTML
}

function walkAndHighlight(node: Node, terms: string[]) {
  if (node.nodeType === 1) {
    const el = node as HTMLElement
    const tag = el.tagName
    if (tag === 'MARK' || tag === 'SCRIPT' || tag === 'STYLE') return
    const children = Array.from(node.childNodes)
    for (const child of children) walkAndHighlight(child, terms)
    return
  }
  if (node.nodeType !== 3) return
  const text = node.textContent || ''
  const ranges = findMatchRanges(text, terms)
  if (!ranges.length) return
  const frag = document.createDocumentFragment()
  let pos = 0
  for (const [start, end] of ranges) {
    if (start > pos) frag.appendChild(document.createTextNode(text.slice(pos, start)))
    const mark = document.createElement('mark')
    mark.className = MARK_CLASS
    mark.textContent = text.slice(start, end)
    frag.appendChild(mark)
    pos = end
  }
  if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)))
  node.parentNode?.replaceChild(frag, node)
}
