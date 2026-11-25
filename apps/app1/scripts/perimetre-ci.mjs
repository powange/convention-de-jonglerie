#!/usr/bin/env node
/**
 * Périmètre de la CI : ce qu'un run doit faire tourner, et le verdict de `ci-verte` qui en découle.
 *
 * Pourquoi ce fichier existe : la suite d'app1 tournait en entier sur TOUTES les PR, y compris
 * celles qui ne touchent que `apps/app2/` (Flowvent). Sur les douze PR qui ont précédé ce
 * changement, presque toutes étaient de ce type, et chacune a payé 18 jobs, 5 à 12 minutes, pour
 * un code d'app1 qu'elle ne modifiait pas.
 *
 * ⚠️ On ne SAUTE PAS TOUT, et c'est le point délicat. Quatre tests d'outillage d'app1 lisent des
 * fichiers d'app2 comme du texte (flowvent-libelles-benevoles, flowvent-modules-evenement,
 * flowvent-taches-planifiees, notification-create-titre) : une PR d'app2 peut donc faire tomber la
 * suite UNITAIRE d'app1. `setup`, `lint` (ESLint tourne depuis la racine, donc sur app2 aussi) et
 * `test-unit` restent dans tous les périmètres ; seuls les jobs lourds qui ne lisent qu'app1
 * (typage, build, vitest Nuxt et base, Playwright) sont sautés.
 *
 * ⚠️ Et pas de `paths-ignore` au niveau du workflow : `ci-verte` est le check REQUIS par la règle
 * de `main`. Un workflow qui ne démarre pas ne le rend jamais, et la PR reste bloquée sur un check
 * « en attente » pour toujours. Le workflow démarre donc toujours ; ce sont ses jobs qui se sautent,
 * et `ci-verte` sait lesquels avaient le droit de l'être.
 *
 * Le verdict est ici et non en YAML pour pouvoir être TESTÉ : c'est la seule porte qui décide si
 * une PR peut être mergée, et une condition GitHub Actions ne se vérifie qu'en poussant.
 */

/** Préfixe des fichiers qu'aucun job lourd d'app1 ne lit. */
const PREFIXE_APP2 = 'apps/app2/'

/**
 * Les jobs qu'une PR limitée à app2 a le droit de sauter. Tout autre job sauté fait échouer
 * `ci-verte` : un job ajouté plus tard est donc REQUIS par défaut, jamais exempté par oubli.
 */
export const SAUTABLES_SI_APP2_SEUL = ['typecheck', 'build', 'base-de-test', 'test', 'playwright']

/**
 * @param {string} evenement - `github.event_name`
 * @param {string[]} fichiers - chemins modifiés, relatifs à la racine du dépôt
 * @returns {{ perimetre: 'complet' | 'app2-seul', raison: string }}
 */
export function calculerPerimetre(evenement, fichiers) {
  if (evenement !== 'pull_request') {
    return { perimetre: 'complet', raison: `événement « ${evenement} » : suite complète` }
  }

  const utiles = fichiers.map((f) => f.trim()).filter(Boolean)
  // Un diff vide ou illisible ne prouve rien : dans le doute, tout tourne.
  if (utiles.length === 0) {
    return { perimetre: 'complet', raison: 'liste des fichiers modifiés vide ou illisible' }
  }

  const horsApp2 = utiles.filter((f) => !f.startsWith(PREFIXE_APP2))
  if (horsApp2.length > 0) {
    return {
      perimetre: 'complet',
      raison: `${horsApp2.length} fichier(s) hors de ${PREFIXE_APP2}, dont ${horsApp2[0]}`,
    }
  }

  return {
    perimetre: 'app2-seul',
    raison: `les ${utiles.length} fichier(s) modifiés sont tous sous ${PREFIXE_APP2}`,
  }
}

/**
 * Le verdict de `ci-verte`.
 *
 * Trois règles, dans cet ordre :
 *  1. un job en échec ou annulé refuse, quel que soit le périmètre ;
 *  2. un périmètre inconnu (job `changements` en échec, sortie vide) vaut `complet` — la lecture
 *     prudente : tout saut devient alors un refus ;
 *  3. un job sauté n'est accepté que si le périmètre l'autorise explicitement.
 *
 * @param {Record<string, { result: string }>} besoins - `toJSON(needs)`
 * @param {string | undefined} perimetre - sortie du job `changements`
 * @returns {{ vert: boolean, problemes: string[] }}
 */
export function rendreVerdict(besoins, perimetre) {
  const effectif = perimetre === 'app2-seul' ? 'app2-seul' : 'complet'
  const sautables = effectif === 'app2-seul' ? SAUTABLES_SI_APP2_SEUL : []
  const problemes = []

  const noms = Object.keys(besoins)
  if (noms.length === 0) problemes.push('aucun job surveillé : le verdict ne porterait sur rien')

  for (const nom of noms) {
    const resultat = besoins[nom]?.result
    if (resultat === 'success') continue
    if (resultat === 'skipped' && sautables.includes(nom)) continue
    problemes.push(
      resultat === 'skipped'
        ? `${nom} : sauté alors que le périmètre « ${effectif} » l'exige`
        : `${nom} : ${resultat ?? 'résultat absent'}`
    )
  }

  return { vert: problemes.length === 0, problemes }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { appendFileSync, readFileSync } = await import('node:fs')
  const [mode, evenement] = process.argv.slice(2)

  if (mode === '--perimetre') {
    const fichiers = readFileSync(0, 'utf8').split('\n')
    const { perimetre, raison } = calculerPerimetre(evenement ?? '', fichiers)
    console.log(`Périmètre : ${perimetre} (${raison})`)
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `perimetre=${perimetre}\n`)
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### Périmètre : \`${perimetre}\`\n\n${raison}\n`
      )
    }
    process.exit(0)
  }

  if (mode === '--verdict') {
    let besoins
    try {
      besoins = JSON.parse(process.env.RESULTATS ?? '')
    } catch {
      console.error('::error::RESULTATS absent ou illisible : impossible de rendre un verdict')
      process.exit(1)
    }
    const { vert, problemes } = rendreVerdict(besoins, process.env.PERIMETRE)
    if (!vert) {
      for (const p of problemes) console.error(`::error::${p}`)
      process.exit(1)
    }
    console.log(
      `✅ Tous les jobs requis par le périmètre « ${process.env.PERIMETRE || 'complet'} » sont passés.`
    )
    process.exit(0)
  }

  console.error('Usage : perimetre-ci.mjs --perimetre <evenement> < fichiers  |  --verdict')
  process.exit(2)
}
