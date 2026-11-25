#!/usr/bin/env node
/**
 * Périmètre de la CI : ce qu'un run doit faire tourner, et le verdict de `ci-verte` qui en découle.
 *
 * C'est la SEULE source de cette décision. Le job `changements` de `tests.yml` publie la liste des
 * jobs à lancer (`jobs`) et chaque job conditionné se contente d'y chercher son nom ; `ci-verte`
 * rend son verdict avec les mêmes listes. Un test vérifie que le YAML et ce fichier concordent.
 *
 * Trois périmètres :
 *
 * - `complet` — une PR qui touche autre chose qu'app2, le run planifié, le déclenchement manuel.
 *
 * - `app2-seul` — une PR qui ne touche que `apps/app2/` (Flowvent). Elle payait les 18 jobs d'app1,
 *   5 à 12 minutes, sans modifier une ligne d'app1. ⚠️ On ne saute PAS TOUT : quatre tests
 *   d'outillage d'app1 lisent des fichiers d'app2 comme du texte (flowvent-libelles-benevoles,
 *   flowvent-modules-evenement, flowvent-taches-planifiees, notification-create-titre), donc une PR
 *   d'app2 peut faire tomber la suite UNITAIRE ; et ESLint tourne depuis la racine, sur app2 aussi.
 *
 * - `amorcage` — un push sur `main`. La règle de `main` exige `ci-verte` sur une branche À JOUR et
 *   les merges se font en squash : l'arbre qui arrive sur `main` est celui que la PR vient de
 *   tester. Rejouer la suite n'apprenait rien — sur 200 runs de `main`, les 7 échecs étaient tous
 *   des tests instables. Ce run garde un seul rôle, qu'aucun autre ne peut tenir : écrire les
 *   caches que TOUTES les PR lisent (un cache écrit dans une PR reste cantonné à cette PR). Les
 *   instabilités et les effets de date sont confiés au run planifié, en périmètre `complet`.
 *
 * ⚠️ Pas de `paths-ignore` au niveau du workflow : `ci-verte` est le check REQUIS par la règle de
 * `main`, et un workflow qui ne démarre pas ne le rend jamais — la PR resterait bloquée sur un check
 * « en attente ». Le workflow démarre donc toujours ; ce sont ses jobs qui se sautent.
 */

/** Préfixe des fichiers qu'aucun job lourd d'app1 ne lit. */
const PREFIXE_APP2 = 'apps/app2/'

/**
 * Les jobs CONDITIONNÉS à lancer, par périmètre. `changements` et `setup` tournent toujours et ne
 * figurent pas ici ; `ci-verte` et `signaler-run-planifie` non plus, ils jugent les autres.
 */
export const JOBS_PAR_PERIMETRE = {
  complet: [
    'lint',
    'typecheck',
    'build',
    'test-unit',
    'test',
    'base-de-test',
    'playwright',
    'audit',
  ],
  'app2-seul': ['lint', 'test-unit'],
  // `base-de-test` écrit le cache du dump SQL, `navigateurs` celui de Chromium. `setup`, qui écrit
  // node_modules et le client Prisma, tourne de toute façon.
  amorcage: ['base-de-test', 'navigateurs'],
}

/** Tous les jobs qui portent une condition de périmètre. */
export const JOBS_CONDITIONNES = [...new Set(Object.values(JOBS_PAR_PERIMETRE).flat())].sort()

/**
 * @param {string} evenement - `github.event_name`
 * @param {string[]} fichiers - chemins modifiés, relatifs à la racine du dépôt (PR seulement)
 * @returns {{ perimetre: keyof typeof JOBS_PAR_PERIMETRE, raison: string }}
 */
export function calculerPerimetre(evenement, fichiers) {
  if (evenement === 'push') {
    return {
      perimetre: 'amorcage',
      raison: 'push sur main : code déjà testé dans sa PR, seuls les caches partagés sont écrits',
    }
  }
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
 * La liste publiée pour les conditions du YAML, entourée d'espaces : chaque job y cherche
 * ` <son nom> `, si bien que `test` ne se reconnaît pas dans `test-unit`. Une chaîne et non du
 * JSON : si `changements` échoue, la sortie est vide, et `contains('', …)` vaut faux au lieu de
 * lever une erreur d'évaluation comme le ferait `fromJSON('')`.
 *
 * @param {keyof typeof JOBS_PAR_PERIMETRE} perimetre
 */
export function listePourConditions(perimetre) {
  return ` ${JOBS_PAR_PERIMETRE[perimetre].join(' ')} `
}

/**
 * Le verdict de `ci-verte`.
 *
 *  1. un job en échec ou annulé refuse, quel que soit le périmètre ;
 *  2. un périmètre inconnu (job `changements` en échec, sortie vide) vaut `complet` — la lecture
 *     prudente : tout saut devient alors un refus ;
 *  3. un job sauté n'est accepté que s'il porte une condition de périmètre ET que le périmètre ne
 *     le lance pas. Un job inconnu de ce fichier est donc REQUIS : un job ajouté plus tard n'est
 *     jamais exempté par oubli.
 *
 * @param {Record<string, { result: string }>} besoins - `toJSON(needs)`
 * @param {string | undefined} perimetre - sortie du job `changements`
 * @returns {{ vert: boolean, problemes: string[] }}
 */
export function rendreVerdict(besoins, perimetre) {
  const effectif = perimetre && perimetre in JOBS_PAR_PERIMETRE ? perimetre : 'complet'
  const lances = JOBS_PAR_PERIMETRE[effectif]
  const problemes = []

  const noms = Object.keys(besoins)
  if (noms.length === 0) problemes.push('aucun job surveillé : le verdict ne porterait sur rien')

  for (const nom of noms) {
    const resultat = besoins[nom]?.result
    if (resultat === 'success') continue
    if (resultat === 'skipped' && JOBS_CONDITIONNES.includes(nom) && !lances.includes(nom)) continue
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
    const jobs = listePourConditions(perimetre)
    console.log(`Périmètre : ${perimetre} (${raison})`)
    console.log(`Jobs lancés en plus de setup :${jobs}`)
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `perimetre=${perimetre}\njobs=${jobs}\n`)
    }
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### Périmètre : \`${perimetre}\`\n\n${raison}\n\nJobs lancés en plus de \`setup\` :${jobs}\n`
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
