#!/usr/bin/env node
/**
 * Garde-fou de typage sur les seuls fichiers modifiés.
 *
 * Le typage complet remonte des milliers d'erreurs préexistantes : faire échouer la CI dessus la
 * rendrait rouge en permanence, et c'est pourquoi le garde-fou d'origine se limitait aux noms non
 * définis. L'angle mort a coûté cher — un `TS2345` (objet passé là où un entier est attendu) a
 * atteint la production et renvoyé sept erreurs 500 à un utilisateur qui tentait de modifier son
 * atelier, alors que `nuxt typecheck` le signalait déjà.
 *
 * On gèle donc la dette au lieu de la solder : les erreurs des fichiers que la branche touche
 * bloquent, celles du reste du dépôt attendent leur tour.
 */

/** Le journal cite les chemins depuis `apps/app1` ; git les donne depuis la racine. */
export function normaliserChemin(chemin) {
  return chemin.startsWith('../../') ? chemin.slice('../../'.length) : `apps/app1/${chemin}`
}

/**
 * @param {string} journal - sortie brute de `nuxt typecheck`
 * @param {string[]} fichiersModifies - chemins depuis la racine du dépôt
 * @param {string[]} codes - codes TS qui bloquent (sans le préfixe « TS »)
 */
export function erreursBloquantes(journal, fichiersModifies, codes) {
  const modifies = new Set(fichiersModifies)
  const motif = /^(\S+?)\((\d+),(\d+)\): error TS(\d+):/
  const trouvees = []

  for (const ligne of journal.split('\n')) {
    const m = motif.exec(ligne.trim())
    if (!m || !codes.includes(m[4])) continue
    if (modifies.has(normaliserChemin(m[1]))) trouvees.push(ligne.trim())
  }

  // `nuxt typecheck` répète chaque erreur à l'identique : on ne veut pas la lire deux fois.
  return [...new Set(trouvees)]
}

// ── Ligne de commande ──────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const [journalPath, fichiersPath, codesArg] = process.argv.slice(2)
  if (!journalPath || !fichiersPath) {
    console.error('usage : typecheck-gate.mjs <journal> <fichiers-modifiés> [codes séparés par ,]')
    process.exit(2)
  }

  const { readFileSync } = await import('node:fs')
  const journal = readFileSync(journalPath, 'utf8')
  const fichiers = readFileSync(fichiersPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const codes = (codesArg || '2345')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)

  const bloquantes = erreursBloquantes(journal, fichiers, codes)
  if (bloquantes.length === 0) {
    console.log(
      `✅ Aucune erreur TS${codes.join('/TS')} sur les ${fichiers.length} fichier(s) modifié(s).`
    )
    process.exit(0)
  }

  console.error(`::error::${bloquantes.length} erreur(s) de typage sur des fichiers modifiés :`)
  for (const ligne of bloquantes) console.error(ligne)
  process.exit(1)
}
