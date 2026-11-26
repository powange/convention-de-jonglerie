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
 *   d'app2 peut faire tomber la suite UNITAIRE ; et `lint` vérifie app2 (ESLint et Prettier).
 *   ⚠️ Cette dernière affirmation a été FAUSSE jusqu'au 26/11/2026 : eslint.config.mjs excluait
 *   `apps/app2/**` et `format:check` ne lisait pas app2, si bien que `lint` tournait pour rien sur
 *   ces PR et qu'app2 n'avait aucun contrôle de code. Avant de justifier un job par ce qu'il
 *   couvre, vérifier ce qu'il couvre.
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
 *
 * En plus du périmètre, certains jobs dépendent des FICHIERS touchés (`JOBS_SELON_FICHIERS`) :
 * `image-app1` construit celle d'app1 quand la PR touche ses fichiers Docker ou ses dépendances ;
 * `image-flowvent` ne construit l'image de Flowvent que si la PR touche app2 ou un layer qu'elle
 * étend. Cette garde vivait dans `publier-image-flowvent.yml`, hors de `ci-verte` : une PR qui
 * cassait Flowvent pouvait être mergée. La liste de ces layers est lue dans `extends` de
 * `apps/app2/nuxt.config.ts` à chaque run, et non recopiée ici : une copie de plus aurait dérivé
 * comme les autres (cf. test/unit/outillage/flowvent-liste-des-layers.test.ts).
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Préfixe des fichiers qu'aucun job lourd d'app1 ne lit. */
const PREFIXE_APP2 = 'apps/app2/'

/**
 * Les jobs CONDITIONNÉS lancés d'office, par périmètre. `changements` et `setup` tournent toujours
 * et ne figurent pas ici ; `ci-verte` et `signaler-run-planifie` non plus, ils jugent les autres.
 */
export const JOBS_PAR_PERIMETRE = {
  complet: ['lint', 'typecheck', 'build', 'test-unit', 'test', 'base-de-test', 'playwright'],
  // `lint` vérifie app2 (ESLint + Prettier), `test-unit` les tests d'outillage qui la lisent.
  'app2-seul': ['lint', 'test-unit'],
  // `base-de-test` écrit le cache du dump SQL, `navigateurs` celui de Chromium. `setup`, qui écrit
  // node_modules et le client Prisma, tourne de toute façon.
  amorcage: ['base-de-test', 'navigateurs'],
}

/** Les jobs ajoutés selon les fichiers touchés (hors push sur main, où rien n'est vérifié). */
export const JOBS_SELON_FICHIERS = ['image-flowvent', 'image-app1', 'audit']

/** Tous les jobs qui portent une condition dans le YAML. */
export const JOBS_CONDITIONNES = [
  ...new Set([...Object.values(JOBS_PAR_PERIMETRE).flat(), ...JOBS_SELON_FICHIERS]),
].sort()

/**
 * Les layers qu'app2 étend, lus dans le TEXTE de sa configuration (la CI ne prépare pas app2 : un
 * import n'y marcherait pas).
 *
 * @param {string} sourceConfig - contenu de `apps/app2/nuxt.config.ts`
 * @returns {string[]}
 */
export function layersEtendusParApp2(sourceConfig) {
  const bloc = sourceConfig.match(/extends:\s*\[([^\]]*)\]/)?.[1] ?? ''
  return [...bloc.matchAll(/'\.\.\/\.\.\/layers\/([a-z0-9-]+)'/g)].map((m) => m[1])
}

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
 * La PR peut-elle casser l'image de Flowvent ? Oui si elle touche app2, un layer qu'app2 étend, ou
 * la définition du job lui-même. Si la liste des layers n'a pas pu être lue, TOUT changement de
 * `layers/` compte : dans le doute, on construit.
 *
 * @param {string[]} fichiers
 * @param {string[]} layersApp2
 */
export function touchePourFlowvent(fichiers, layersApp2) {
  return fichiers.some(
    (f) =>
      f.startsWith(PREFIXE_APP2) ||
      f === '.github/workflows/tests.yml' ||
      (layersApp2.length === 0
        ? f.startsWith('layers/')
        : layersApp2.some((l) => f.startsWith(`layers/${l}/`)))
  )
}

/**
 * Les fichiers qui décident de ce qui entre dans l'image d'app1 et que le job `build` ne voit pas :
 * il fait un `nuxt build` HORS de Docker, si bien qu'un Dockerfile cassé, un `.dockerignore` qui
 * écarte un fichier nécessaire ou une dépendance qui ne s'installe que dans l'image n'étaient
 * découverts qu'une fois sur `main`, quand la publication échouait — `:main` restant alors sur
 * l'image précédente sans que rien ne le dise.
 */
const FICHIERS_IMAGE_APP1 = [
  'apps/app1/Dockerfile',
  '.dockerignore',
  'apps/app1/package.json',
  'apps/app1/package-lock.json',
  'apps/app1/scripts/lier-layers-node-modules.mjs',
  '.github/workflows/tests.yml',
]

/**
 * `npm audit` n'apprend rien d'une PR qui ne change pas les dépendances : une vulnérabilité naît
 * dans la base de npm, pas dans nos commits. Il tourne donc sur une PR qui touche le manifeste ou
 * le verrou d'app1 — et chaque nuit, sur le run planifié, où un avis publié depuis se voit.
 *
 * @param {string[]} fichiers
 */
export function touchePourAudit(fichiers) {
  return fichiers.some((f) => f === 'apps/app1/package.json' || f === 'apps/app1/package-lock.json')
}

/** @param {string[]} fichiers */
export function touchePourImageApp1(fichiers) {
  return fichiers.some((f) => FICHIERS_IMAGE_APP1.includes(f) || f.startsWith('apps/app1/docker/'))
}

/**
 * Le périmètre et la liste complète des jobs conditionnés à lancer.
 *
 * @param {string} evenement
 * @param {string[]} fichiers
 * @param {string[]} layersApp2
 * @returns {{ perimetre: keyof typeof JOBS_PAR_PERIMETRE, raison: string, jobs: string[] }}
 */
export function calculerJobs(evenement, fichiers, layersApp2) {
  const { perimetre, raison } = calculerPerimetre(evenement, fichiers)
  const jobs = [...JOBS_PAR_PERIMETRE[perimetre]]
  if (perimetre === 'amorcage') return { perimetre, raison, jobs }

  const utiles = fichiers.map((f) => f.trim()).filter(Boolean)
  // Hors PR (planifié, manuel) ou sans liste lisible : tout ce qui dépend des fichiers tourne.
  const toutLancer = evenement !== 'pull_request' || utiles.length === 0
  if (toutLancer || touchePourFlowvent(utiles, layersApp2)) jobs.push('image-flowvent')
  if (toutLancer || touchePourImageApp1(utiles)) jobs.push('image-app1')
  if (toutLancer || touchePourAudit(utiles)) jobs.push('audit')
  return { perimetre, raison, jobs }
}

/**
 * La liste publiée pour les conditions du YAML, entourée d'espaces : chaque job y cherche
 * ` <son nom> `, si bien que `test` ne se reconnaît pas dans `test-unit`. Une chaîne et non du
 * JSON : si `changements` échoue, la sortie est vide, et `contains('', …)` vaut faux au lieu de
 * lever une erreur d'évaluation comme le ferait `fromJSON('')`.
 *
 * @param {string[]} jobs
 */
export function listePourConditions(jobs) {
  return ` ${jobs.join(' ')} `
}

/**
 * Le verdict de `ci-verte`, à partir de la liste que `changements` a publiée.
 *
 *  1. un job en échec ou annulé refuse, toujours ;
 *  2. une liste absente ou vide (job `changements` en échec) vaut « tout était requis » — la
 *     lecture prudente : tout saut devient alors un refus ;
 *  3. un job sauté n'est accepté que s'il porte une condition ET qu'il n'était pas dans la liste.
 *     Un job inconnu de ce fichier est donc REQUIS : un job ajouté plus tard n'est jamais exempté
 *     par oubli.
 *
 * @param {Record<string, { result: string }>} besoins - `toJSON(needs)`
 * @param {string | undefined} jobsPublies - sortie `jobs` du job `changements`
 * @returns {{ vert: boolean, problemes: string[] }}
 */
export function rendreVerdict(besoins, jobsPublies) {
  const publies = (jobsPublies ?? '').split(/\s+/).filter(Boolean)
  const lances = publies.length > 0 ? publies : JOBS_CONDITIONNES
  const problemes = []

  const noms = Object.keys(besoins)
  if (noms.length === 0) problemes.push('aucun job surveillé : le verdict ne porterait sur rien')

  for (const nom of noms) {
    const resultat = besoins[nom]?.result
    if (resultat === 'success') continue
    if (resultat === 'skipped' && JOBS_CONDITIONNES.includes(nom) && !lances.includes(nom)) continue
    problemes.push(
      resultat === 'skipped'
        ? `${nom} : sauté alors qu'il devait tourner`
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
    let layersApp2 = []
    try {
      const config = join(dirname(fileURLToPath(import.meta.url)), '../../app2/nuxt.config.ts')
      layersApp2 = layersEtendusParApp2(readFileSync(config, 'utf8'))
    } catch {
      console.log(
        '::warning::apps/app2/nuxt.config.ts illisible : tout changement de layers/ compte'
      )
    }
    const { perimetre, raison, jobs } = calculerJobs(evenement ?? '', fichiers, layersApp2)
    const liste = listePourConditions(jobs)
    console.log(`Périmètre : ${perimetre} (${raison})`)
    console.log(`Layers étendus par app2 : ${layersApp2.join(', ') || '(inconnus)'}`)
    console.log(`Jobs lancés en plus de setup :${liste}`)
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `perimetre=${perimetre}\njobs=${liste}\n`)
    }
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### Périmètre : \`${perimetre}\`\n\n${raison}\n\nJobs lancés en plus de \`setup\` :${liste}\n`
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
    const { vert, problemes } = rendreVerdict(besoins, process.env.JOBS)
    if (!vert) {
      for (const p of problemes) console.error(`::error::${p}`)
      process.exit(1)
    }
    console.log(`✅ Tous les jobs requis sont passés (lancés :${process.env.JOBS || ' tous'}).`)
    process.exit(0)
  }

  console.error('Usage : perimetre-ci.mjs --perimetre <evenement> < fichiers  |  --verdict')
  process.exit(2)
}
