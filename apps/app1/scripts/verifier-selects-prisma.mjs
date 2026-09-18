/**
 * Confronte chaque `select`, `include` et `where` Prisma aux champs que le schéma déclare.
 *
 * Ce défaut a mordu deux fois en production : un `_count` sur une relation inexistante, puis un
 * `timezone` demandé sur le mauvais modèle. Dans les deux cas Prisma refuse la requête ENTIÈRE —
 * un 500, pas un champ manquant — et la page concernée ne montre plus rien.
 *
 * Rien ne peut l'attraper en amont : un `select` se rédige librement, ni le lint ni le typage
 * n'ont d'avis, et un test qui simule la base rend ce qu'on lui dit. Seule la confrontation au
 * schéma le voit.
 *
 * ⚠️ Ce qu'il NE voit pas, et qu'il ne faut donc pas croire couvert : les sélections construites
 * à partir d'une constante partagée (`inclusionCreneau`, `userBasicSelect`…), celles passées par
 * une variable, et les modèles absents du schéma. L'absence de constat ne prouve pas l'absence
 * de défaut — elle prouve seulement qu'aucun n'est écrit sur place.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

/**
 * La racine du dépôt, trouvée en remontant depuis le dossier courant.
 *
 * `import.meta.url` ne convient pas : sous Vitest il arrive préfixé `/@fs`, et le chemin ne
 * résout plus. Remonter jusqu'au repère `apps/app1/prisma/schema` marche depuis n'importe où —
 * en ligne de commande comme dans un test.
 */
function trouverRacine(depart = process.cwd()) {
  let d = depart
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(d, 'apps/app1/prisma/schema'))) return d
    const parent = dirname(d)
    if (parent === d) break
    d = parent
  }
  throw new Error('Racine du dépôt introuvable depuis ' + depart)
}

const RACINE = trouverRacine()

/** Les opérateurs d'un `where` : ils ne sont pas des champs du modèle. */
const OPERATEURS = new Set([
  'AND',
  'OR',
  'NOT',
  'in',
  'notIn',
  'lt',
  'lte',
  'gt',
  'gte',
  'contains',
  'startsWith',
  'endsWith',
  'equals',
  'not',
  'mode',
  'some',
  'every',
  'none',
  'is',
  'isNot',
  'search',
  'isSet',
  'has',
  'hasEvery',
  'hasSome',
])

/** Ce qui n'est pas un champ dans un `select` : agrégats et options de requête. */
const HORS_CHAMPS = new Set([
  '_count',
  '_sum',
  '_avg',
  '_min',
  '_max',
  'where',
  'orderBy',
  'take',
  'skip',
  'cursor',
  'distinct',
  'by',
  'having',
  'omit',
])

export function lireSchema(dossier = join(RACINE, 'apps/app1/prisma/schema')) {
  const texte = readdirSync(dossier)
    .filter((f) => f.endsWith('.prisma'))
    .map((f) => readFileSync(join(dossier, f), 'utf-8'))
    .join('\n')

  const modeles = new Map()
  for (const m of texte.matchAll(/^(?:model|type)\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const champs = new Map()
    for (const ligne of m[2].split('\n')) {
      const l = ligne.trim()
      if (!l || l.startsWith('//') || l.startsWith('@@') || l.startsWith('///')) continue
      const c = l.match(/^(\w+)\s+(\w+)/)
      if (c) champs.set(c[1], c[2])
    }
    // Les clés composées que Prisma dérive de `@@unique([a, b])` : `editionId_userId` est valide.
    for (const u of m[2].matchAll(/@@(?:unique|id)\(\s*\[([^\]]+)\]/g)) {
      const membres = u[1]
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
      if (membres.length > 1) champs.set(membres.join('_'), null)
    }
    modeles.set(m[1], champs)
  }
  return modeles
}

/** Le contenu de l'accolade ouverte en `i`, accolades imbriquées comprises. */
function bloc(texte, i) {
  let prof = 0
  for (let j = i; j < texte.length; j++) {
    if (texte[j] === '{') prof++
    else if (texte[j] === '}' && --prof === 0) return texte.slice(i + 1, j)
  }
  return null
}

/** Les clés du niveau courant, avec la position de leur valeur. */
function clesDeNiveau(contenu) {
  const out = []
  let prof = 0
  for (let i = 0; i < contenu.length; i++) {
    const c = contenu[i]
    if ('{[('.includes(c)) prof++
    else if ('}])'.includes(c)) prof--
    else if (prof === 0) {
      const m = contenu.slice(i).match(/^(\w+)\s*:/)
      if (m && (i === 0 || ',\n \t'.includes(contenu[i - 1]))) {
        out.push([m[1], i + m[0].length])
        i += m[0].length - 1
      }
    }
  }
  return out
}

/**
 * Les fichiers dont on sait qu'ils nomment un champ inexistant EXPRÈS.
 *
 * `throw-error` est l'endpoint d'administration qui provoque des erreurs à la demande, pour
 * vérifier que la remontée des logs fonctionne. Son `champ_inexistant` est marqué `as any` et
 * constitue le comportement attendu, pas un défaut.
 */
const EXCEPTIONS = ['apps/app1/server/api/admin/debug/throw-error.get.ts']

function fichiersTs(dossiers) {
  const out = []
  const parcourir = (d) => {
    let entrees
    try {
      entrees = readdirSync(d)
    } catch {
      return
    }
    for (const e of entrees) {
      const p = join(d, e)
      if (e === 'node_modules' || e === 'generated') continue
      const s = statSync(p)
      if (s.isDirectory()) parcourir(p)
      else if (e.endsWith('.ts') && !e.endsWith('.d.ts')) out.push(p)
    }
  }
  dossiers.forEach((d) => parcourir(join(RACINE, d)))
  return out
}

export function verifier({ dossiers = ['layers', 'apps/app1/server'] } = {}) {
  const modeles = lireSchema()
  const constats = []

  const ajouter = (fichier, texte, pos, modele, cle) =>
    constats.push({
      fichier: relative(RACINE, fichier),
      ligne: texte.slice(0, pos).split('\n').length,
      modele,
      cle,
    })

  const descendre = (modele, contenu, fichier, decalage, texte, dansWhere) => {
    const champs = modeles.get(modele)
    if (!champs) return
    for (const [cle, pos] of clesDeNiveau(contenu)) {
      if (dansWhere && OPERATEURS.has(cle)) {
        const reste = contenu.slice(pos)
        const i = reste.indexOf('{')
        if (i !== -1) {
          const sous = bloc(reste, i)
          if (sous) descendre(modele, sous, fichier, decalage + pos + i + 1, texte, true)
        }
        continue
      }
      if (!dansWhere && HORS_CHAMPS.has(cle)) continue

      if (!champs.has(cle)) {
        ajouter(fichier, texte, decalage + pos, modele, dansWhere ? `where.${cle}` : cle)
        continue
      }
      const cible = champs.get(cle)
      if (!cible || !modeles.has(cible)) continue

      const reste = contenu.slice(pos)
      const i = reste.indexOf('{')
      if (i === -1 || reste.slice(0, i).trim() !== '') continue
      const sous = bloc(reste, i)
      if (!sous) continue

      for (const [sc, sp] of clesDeNiveau(sous)) {
        const imbrique = dansWhere
          ? ['some', 'every', 'none', 'is', 'isNot'].includes(sc)
          : ['select', 'include'].includes(sc)
        if (!imbrique) continue
        const r2 = sous.slice(sp)
        const j = r2.indexOf('{')
        if (j === -1) continue
        const s2 = bloc(r2, j)
        if (s2) descendre(cible, s2, fichier, decalage + pos + i + 1 + sp + j + 1, texte, dansWhere)
      }
    }
  }

  for (const fichier of fichiersTs(dossiers)) {
    if (EXCEPTIONS.some((e) => relative(RACINE, fichier) === e)) continue
    const brut = readFileSync(fichier, 'utf-8')
    // Les commentaires sont en français : « heure du LIEU » se lirait comme une clé. On les
    // blanchit en conservant les longueurs, pour que les numéros de ligne restent justes.
    const texte = brut.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '))

    const appel =
      /prisma\.(\w+)\.(findMany|findFirst|findUnique|findUniqueOrThrow|findFirstOrThrow|create|update|upsert|aggregate)\s*\(/g
    for (const m of texte.matchAll(appel)) {
      const modele = m[1][0].toUpperCase() + m[1].slice(1)
      const i = texte.indexOf('{', m.index + m[0].length - 1)
      if (i === -1) continue
      const contenu = bloc(texte, i)
      if (!contenu) continue
      for (const [cle, pos] of clesDeNiveau(contenu)) {
        if (!['select', 'include', 'where'].includes(cle)) continue
        const reste = contenu.slice(pos)
        const j = reste.indexOf('{')
        if (j === -1 || reste.slice(0, j).trim() !== '') continue
        const sous = bloc(reste, j)
        if (sous) {
          descendre(modele, sous, fichier, i + 1 + pos + j + 1, texte, cle === 'where')
        }
      }
    }
  }
  return constats
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const constats = verifier()
  for (const c of constats) {
    console.error(`${c.fichier}:${c.ligne}  ${c.modele}.${c.cle}`)
  }
  console.log(
    constats.length === 0
      ? '✅ Aucun champ Prisma inconnu du schéma.'
      : `❌ ${constats.length} champ(s) absent(s) du schéma.`
  )
  process.exit(constats.length === 0 ? 0 : 1)
}
