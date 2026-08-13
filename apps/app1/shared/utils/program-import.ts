/**
 * Rapprochement entre les éléments de programme proposés par l'IA et ceux déjà en base.
 *
 * L'extraction est rejouée : sur un même site, une seconde passe reproposerait tout. Recréer
 * aveuglément doublerait le programme ; ignorer ce qui existe empêcherait de corriger un horaire
 * qui a changé sur le site de l'organisateur. On compare donc, et on ne propose que ce qui
 * apporte quelque chose.
 *
 * Ce fichier ne touche ni au réseau ni à la base : il se teste sur des tableaux.
 */

import { journeeDans, versInstant } from './fuseau-edition'

/**
 * Un élément tel que le modèle vient de le lire, avant tout ancrage.
 *
 * `debut` et `fin` sont des date-heures **sans fuseau** — `AAAA-MM-JJTHH:MM:SS` — c'est-à-dire
 * l'heure telle qu'elle est écrite sur le site de l'organisateur. Elle le reste jusqu'à
 * `ancrerDansFuseau` : la composer côté serveur revenait à lui accoler le fuseau du serveur, UTC
 * en conteneur, et « 12:00 » devenait midi UTC — soit 14 h sur la frise d'une convention
 * européenne.
 */
export interface ElementLu {
  titre: string
  description?: string | null
  debut: string
  fin?: string | null
  lieu?: string | null
}

/**
 * Un élément ancré dans le fuseau de l'édition : `debut` et `fin` y désignent des instants ISO
 * 8601, comparables à ce que rend la base. Mêmes champs que `ElementLu`, mais l'un se compare et
 * s'enregistre quand l'autre ne le peut pas encore — les distinguer évite de les confondre.
 */
export type ElementPropose = ElementLu

/** Un élément déjà enregistré, tel que lu en base. */
export interface ElementExistant {
  id: number
  title: string
  description?: string | null
  startDateTime: string
  endDateTime?: string | null
  locationName?: string | null
}

/** Champ susceptible de changer lors d'une mise à jour. */
export type ChampElement = 'titre' | 'description' | 'debut' | 'fin' | 'lieu'

export interface Modification {
  champ: ChampElement
  avant: string | null
  apres: string | null
}

export type ActionImport =
  | { action: 'creer'; propose: ElementPropose }
  | {
      action: 'mettre_a_jour'
      propose: ElementPropose
      existantId: number
      modifications: Modification[]
    }
  | { action: 'inchange'; propose: ElementPropose; existantId: number }

/**
 * Normalise un titre pour la comparaison.
 *
 * Accents, casse et espaces multiples varient d'une passe à l'autre sans que le contenu change :
 * « Scène ouverte » et « scene  ouverte » désignent le même moment. Les comparer tels quels
 * créerait un doublon à chaque reformatage du site source.
 */
export const normaliserTitre = (titre: string): string =>
  titre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Ancre dans le fuseau de l'édition les heures lues sur le site.
 *
 * C'est le seul endroit où « 12:00 » devient un instant. Le fuseau retenu est celui de la
 * convention, et non celui du serveur ni celui du navigateur : une heure de programme est une
 * heure de lieu, et elle doit rester la même que le programme soit relu depuis Paris ou Melbourne.
 *
 * Une heure illisible écarte l'élément plutôt que de lui inventer un instant, et le nombre
 * d'écarts est rendu pour pouvoir le dire. Une heure qui n'existe pas — 2 h 30 la nuit du passage
 * à l'heure d'été — est en revanche reportée après le saut, et non écartée : le créneau existe
 * bel et bien sur le site, seule sa notation est ambiguë cette nuit-là.
 */
export function ancrerDansFuseau(
  lus: readonly ElementLu[],
  fuseau?: string | null
): { elements: ElementPropose[]; ignores: number } {
  const elements: ElementPropose[] = []
  let ignores = 0

  for (const lu of lus) {
    const debut = versInstant(lu.debut, fuseau)
    if (!debut) {
      ignores++
      continue
    }
    const fin = lu.fin ? versInstant(lu.fin, fuseau) : null
    elements.push({ ...lu, debut, fin: fin || null })
  }

  return { elements, ignores }
}

const memeInstant = (a?: string | null, b?: string | null): boolean => {
  if (!a && !b) return true
  if (!a || !b) return false
  return new Date(a).getTime() === new Date(b).getTime()
}

const texteEgal = (a?: string | null, b?: string | null): boolean =>
  (a ?? '').trim() === (b ?? '').trim()

/**
 * Établit le plan d'import.
 *
 * L'appariement se fait sur le **titre et la journée**, pas sur l'horaire : c'est justement
 * l'horaire qui change quand un organisateur décale un spectacle, et s'apparier dessus ferait
 * apparaître un doublon au lieu d'une correction. Deux moments homonymes le même jour — deux
 * « Scène ouverte » à midi et le soir — restent en revanche indiscernables : le second est traité
 * comme un nouvel élément, ce qui vaut mieux qu'écraser le premier.
 *
 * La journée se calcule dans le fuseau de l'édition, comme sur la frise : découpée ailleurs, une
 * scène ouverte de 23 h basculerait au lendemain et ne s'apparierait plus avec elle-même.
 */
export function planifierImportProgramme(
  proposes: readonly ElementPropose[],
  existants: readonly ElementExistant[],
  fuseau?: string | null
): ActionImport[] {
  const parCle = new Map<string, ElementExistant>()
  for (const e of existants) {
    const cle = `${normaliserTitre(e.title)}|${journeeDans(e.startDateTime, fuseau)}`
    // Le premier gagne : en cas d'homonymes le même jour, on s'accroche toujours au même.
    if (!parCle.has(cle)) parCle.set(cle, e)
  }

  const dejaApparies = new Set<number>()
  const plan: ActionImport[] = []

  for (const propose of proposes) {
    const cle = `${normaliserTitre(propose.titre)}|${journeeDans(propose.debut, fuseau)}`
    const existant = parCle.get(cle)

    if (!existant || dejaApparies.has(existant.id)) {
      plan.push({ action: 'creer', propose })
      continue
    }
    dejaApparies.add(existant.id)

    const modifications: Modification[] = []
    if (!texteEgal(propose.titre, existant.title)) {
      // Les titres ne diffèrent que par la casse ou les accents, puisqu'ils se sont appariés.
      modifications.push({ champ: 'titre', avant: existant.title, apres: propose.titre })
    }
    if (!texteEgal(propose.description, existant.description)) {
      modifications.push({
        champ: 'description',
        avant: existant.description ?? null,
        apres: propose.description ?? null,
      })
    }
    if (!memeInstant(propose.debut, existant.startDateTime)) {
      modifications.push({ champ: 'debut', avant: existant.startDateTime, apres: propose.debut })
    }
    if (!memeInstant(propose.fin, existant.endDateTime)) {
      modifications.push({
        champ: 'fin',
        avant: existant.endDateTime ?? null,
        apres: propose.fin ?? null,
      })
    }
    if (!texteEgal(propose.lieu, existant.locationName)) {
      modifications.push({
        champ: 'lieu',
        avant: existant.locationName ?? null,
        apres: propose.lieu ?? null,
      })
    }

    plan.push(
      modifications.length === 0
        ? { action: 'inchange', propose, existantId: existant.id }
        : { action: 'mettre_a_jour', propose, existantId: existant.id, modifications }
    )
  }

  return plan
}

/** Ce qu'il y a à faire, pour annoncer le volume avant d'appliquer. */
export function resumerPlan(plan: readonly ActionImport[]): {
  creations: number
  miseAJour: number
  inchanges: number
} {
  return {
    creations: plan.filter((p) => p.action === 'creer').length,
    miseAJour: plan.filter((p) => p.action === 'mettre_a_jour').length,
    inchanges: plan.filter((p) => p.action === 'inchange').length,
  }
}

/** Ce que le modèle rend pour une journée, avant toute vérification. */
export interface ElementBrut {
  titre?: unknown
  description?: unknown
  debut?: unknown
  fin?: unknown
  lieu?: unknown
}

const HEURE = /^(\d{1,2})\s*[:hH]\s*(\d{2})$/

/** Minutes depuis minuit, ou `null` si ce n'est pas une heure lisible. */
const enMinutes = (valeur: unknown): number | null => {
  const m = HEURE.exec(String(valeur ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

const texteOuNull = (valeur: unknown): string | null => {
  const s = String(valeur ?? '').trim()
  return s ? s : null
}

/**
 * Date-heure locale `AAAA-MM-JJTHH:MM:SS` à partir d'une journée et de minutes depuis minuit.
 *
 * Le calcul passe par UTC — donc par un fuseau fixe — uniquement pour reporter proprement au
 * lendemain les minutes qui débordent : le résultat est ensuite dépouillé de son `Z`, et ne
 * désigne aucun instant tant qu'un fuseau ne lui est pas donné.
 */
const composerDateHeure = (date: string, minutes: number): string => {
  const instant = new Date(`${date}T00:00:00Z`)
  instant.setUTCMinutes(minutes)
  return instant.toISOString().slice(0, 19)
}

/**
 * Compose les éléments d'une journée à partir de ce que rend le modèle.
 *
 * On ne lui demande que des **heures** — « 18:30 » — pour une journée qu'on lui a nommée, et la
 * date est recomposée ici. Lui faire calculer une date-heure complète revenait à lui confier un
 * calcul de calendrier, exactement le genre d'exercice où un modèle se trompe d'un jour sans que
 * rien ne le signale.
 *
 * Un élément sans titre ou sans heure de début lisible est écarté : mieux vaut un programme
 * incomplet qu'un créneau inventé. Le nombre d'écarts est rendu pour pouvoir le dire.
 *
 * Les date-heures rendues restent sans fuseau : celui de l'édition ne sera appliqué qu'à
 * `ancrerDansFuseau`, là où il est connu.
 */
export function construireElementsDeJournee(
  date: string,
  bruts: unknown
): { elements: ElementLu[]; ignores: number } {
  if (!Array.isArray(bruts)) return { elements: [], ignores: 0 }

  const elements: ElementLu[] = []
  let ignores = 0

  for (const brut of bruts as ElementBrut[]) {
    const titre = texteOuNull(brut?.titre)
    const debutMin = enMinutes(brut?.debut)
    if (!titre || debutMin === null) {
      ignores++
      continue
    }

    const finMin = enMinutes(brut?.fin)
    // Une fin antérieure au début désigne le lendemain : une scène ouverte qui commence à 23 h
    // et finit à 1 h est courante, et la refuser perdrait le créneau.
    const finReportee = finMin === null ? null : finMin + (finMin <= debutMin ? 24 * 60 : 0)

    elements.push({
      titre,
      description: texteOuNull(brut?.description),
      debut: composerDateHeure(date, debutMin),
      fin: finReportee === null ? null : composerDateHeure(date, finReportee),
      lieu: texteOuNull(brut?.lieu),
    })
  }

  return { elements, ignores }
}
