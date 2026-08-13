/**
 * Fusion des trois sources du programme d'une édition en une seule frise.
 *
 * Le programme d'une édition ne vit pas dans une table unique : les workshops portent un nombre de
 * places, les spectacles des artistes et des besoins techniques, et les éléments libres le reste —
 * repas, scène ouverte, accueil. Les réunir au moment de l'affichage plutôt qu'en base évite de
 * dupliquer des données qui ont déjà leur maison, et laisse chaque module maître de ses règles.
 *
 * Le prix à payer est ici : trois formes d'entrée, trois notions de fin, trois règles de
 * visibilité. C'est précisément ce que ce fichier concentre, pour que les points d'API restent
 * minces et que ces règles soient vérifiables sans base de données.
 */

import { journeeDans } from './fuseau-edition'

/** D'où vient une entrée du programme. Sert à l'affichage (icône, couleur) et aux liens. */
export type SourceProgramme = 'workshop' | 'spectacle' | 'element'

export interface EntreeProgramme {
  /**
   * Clé stable côté client. Les identifiants numériques se chevauchent d'une source à l'autre —
   * le workshop 3 et le spectacle 3 coexistent — d'où le préfixe.
   */
  cle: string
  source: SourceProgramme
  sourceId: number
  titre: string
  description: string | null
  /** Début, en ISO 8601. */
  debut: string
  /** Fin, en ISO 8601, ou `null` quand la source ne la connaît pas. */
  fin: string | null
  lieu: string | null
  zoneId: number | null
  markerId: number | null
  /** Faux pour un brouillon, que seuls les organisateurs voient. */
  publie: boolean
}

/** Un workshop, tel que lu en base. */
export interface WorkshopSource {
  id: number
  title: string
  description?: string | null
  startDateTime: Date | string
  endDateTime: Date | string
  location?: { name?: string | null; zoneId?: number | null; markerId?: number | null } | null
}

/** Un spectacle, tel que lu en base. */
export interface SpectacleSource {
  id: number
  title: string
  description?: string | null
  startDateTime: Date | string
  /** Durée en minutes. Les spectacles n'ont pas d'heure de fin, mais une durée facultative. */
  duration?: number | null
  location?: string | null
  zoneId?: number | null
  markerId?: number | null
  zone?: { name: string } | null
  marker?: { name: string } | null
  isPublic: boolean
}

/** Un élément libre, tel que lu en base. */
export interface ElementSource {
  id: number
  title: string
  description?: string | null
  startDateTime: Date | string
  /** Facultative : tous les moments n'ont pas une fin annoncée. */
  endDateTime?: Date | string | null
  locationName?: string | null
  zoneId?: number | null
  markerId?: number | null
  zone?: { name: string } | null
  marker?: { name: string } | null
  isPublic: boolean
}

export interface SourcesProgramme {
  workshops?: readonly WorkshopSource[]
  spectacles?: readonly SpectacleSource[]
  elements?: readonly ElementSource[]
}

export interface OptionsFrise {
  /**
   * Inclure les entrées non publiées. Réservé aux organisateurs : c'est la vue de composition du
   * programme, où l'on doit voir ce qu'on prépare.
   */
  inclureBrouillons?: boolean
}

const enIso = (valeur: Date | string): string =>
  typeof valeur === 'string' ? new Date(valeur).toISOString() : valeur.toISOString()

/**
 * Fin d'un spectacle, déduite de sa durée.
 *
 * Les spectacles stockent une durée en minutes plutôt qu'une heure de fin : c'est ce que connaît
 * un programmateur au moment de la saisie. Sans durée, on rend `null` — mieux vaut une fin absente
 * qu'une fin inventée, qui ferait dire à la frise qu'un spectacle est terminé alors qu'on n'en
 * sait rien.
 */
/**
 * Nom du lieu à afficher.
 *
 * Le texte libre l'emporte quand il existe : c'est une précision volontaire de l'organisateur
 * (« côté buvette »). Sinon on nomme la zone ou le repère — sans quoi une entrée rattachée à la
 * carte n'afficherait aucun lieu du tout, et le lien vers la carte resterait invisible faute
 * d'étiquette à cliquer.
 */
const nomDuLieu = (
  texteLibre?: string | null,
  zone?: { name: string } | null,
  marker?: { name: string } | null
): string | null => texteLibre || zone?.name || marker?.name || null

const finDuSpectacle = (debut: Date | string, dureeMinutes?: number | null): string | null => {
  if (!dureeMinutes || dureeMinutes <= 0) return null
  const d = typeof debut === 'string' ? new Date(debut) : debut
  return new Date(d.getTime() + dureeMinutes * 60_000).toISOString()
}

/**
 * Réunit les sources en une frise triée.
 *
 * Sur la visibilité, une asymétrie assumée : les workshops n'ont **aucun état de publication** en
 * base, et ils sont déjà visibles du public dès leur création sur leur propre page. Leur en
 * inventer un ici les ferait disparaître d'un programme public sans que personne l'ait demandé, et
 * changerait le comportement d'un module existant par un effet de bord. Ils sont donc toujours
 * considérés comme publiés ; les spectacles et les éléments libres, eux, portent leur `isPublic`.
 *
 * Le tri se fait sur le début, puis sur le titre : deux entrées à la même heure doivent garder un
 * ordre stable d'un appel à l'autre, sans quoi la liste se réordonne toute seule au rafraîchissement.
 */
export function construireFriseProgramme(
  sources: SourcesProgramme,
  options: OptionsFrise = {}
): EntreeProgramme[] {
  const { inclureBrouillons = false } = options
  const entrees: EntreeProgramme[] = []

  for (const a of sources.workshops ?? []) {
    entrees.push({
      cle: `workshop-${a.id}`,
      source: 'workshop',
      sourceId: a.id,
      titre: a.title,
      description: a.description ?? null,
      debut: enIso(a.startDateTime),
      fin: enIso(a.endDateTime),
      lieu: a.location?.name ?? null,
      zoneId: a.location?.zoneId ?? null,
      markerId: a.location?.markerId ?? null,
      publie: true,
    })
  }

  for (const s of sources.spectacles ?? []) {
    if (!s.isPublic && !inclureBrouillons) continue
    entrees.push({
      cle: `spectacle-${s.id}`,
      source: 'spectacle',
      sourceId: s.id,
      titre: s.title,
      description: s.description ?? null,
      debut: enIso(s.startDateTime),
      fin: finDuSpectacle(s.startDateTime, s.duration),
      lieu: nomDuLieu(s.location, s.zone, s.marker),
      zoneId: s.zoneId ?? null,
      markerId: s.markerId ?? null,
      publie: s.isPublic,
    })
  }

  for (const e of sources.elements ?? []) {
    if (!e.isPublic && !inclureBrouillons) continue
    entrees.push({
      cle: `element-${e.id}`,
      source: 'element',
      sourceId: e.id,
      titre: e.title,
      description: e.description ?? null,
      debut: enIso(e.startDateTime),
      fin: e.endDateTime ? enIso(e.endDateTime) : null,
      lieu: nomDuLieu(e.locationName, e.zone, e.marker),
      zoneId: e.zoneId ?? null,
      markerId: e.markerId ?? null,
      publie: e.isPublic,
    })
  }

  return entrees.sort(
    (x, y) => x.debut.localeCompare(y.debut) || x.titre.localeCompare(y.titre, 'fr')
  )
}

/**
 * Regroupe la frise par journée, pour un affichage jour par jour.
 *
 * La clé est la date **sur place** au format `AAAA-MM-JJ`, et non la partie date de l'ISO : une
 * soirée qui commence à 23 h appartient à la journée où le public la vit, pas à celle que donnerait
 * un découpage en temps universel.
 *
 * « Sur place » et non « chez le lecteur » : sans le fuseau de l'édition, cette même soirée passait
 * au lendemain pour qui consultait le programme depuis un fuseau plus à l'est, et la frise
 * comptait une journée de trop.
 */
export function grouperParJournee(
  entrees: readonly EntreeProgramme[],
  fuseau?: string | null
): { date: string; entrees: EntreeProgramme[] }[] {
  const parJour = new Map<string, EntreeProgramme[]>()

  for (const entree of entrees) {
    const cle = journeeDans(entree.debut, fuseau)
    const liste = parJour.get(cle)
    if (liste) liste.push(entree)
    else parJour.set(cle, [entree])
  }

  return [...parJour.entries()]
    .map(([date, entrees]) => ({ date, entrees }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
