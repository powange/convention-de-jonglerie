import { versCsv } from '~~/shared/utils/csv'

/**
 * Le fichier des candidatures de bénévoles.
 *
 * Il se construisait **côté serveur**, et l'on y avait écrit vingt-six en-têtes en français dans
 * le code — « Date candidature », « Régime alimentaire », « Personnes à éviter » — plus toutes
 * les valeurs : « En attente », « Végétarien », « Oui », « matin ». Sur un site traduit en treize
 * langues, un organisateur anglophone recevait un fichier entièrement français.
 *
 * Ce n'était pas de la paresse. Le traducteur serveur (`server-i18n`) ne lit que
 * `apps/app1/i18n/locales`, alors que les libellés des bénévoles vivent dans le layer — et
 * l'image de production ne contient même pas ces fichiers-là. Côté serveur, ces clés étaient
 * réellement hors d'atteinte.
 *
 * D'où le déménagement : le point d'API rend les lignes, le navigateur écrit le fichier. Il a
 * `t()` sous la main, donc les treize langues, et le vocabulaire devient exactement celui des
 * colonnes à l'écran — « Candidat » et non « Pseudo », « Commentaires » et non « Motivation ».
 * L'écriture du CSV, elle, reste l'util partagé `versCsv` : guillemets, marque d'ordre des
 * octets, garde contre l'injection de formule.
 */

/** Ce que cet util attend d'`useI18n` : de quoi traduire une clé. */
export type Traducteur = (cle: string, valeurs?: Record<string, unknown>) => string

/** Comment présenter les dates : la langue de l'utilisateur, l'heure du lieu. */
export interface FormatDesDates {
  locale: string
  /** Fuseau de l'édition. Absent, on prend celui de la machine. */
  fuseau?: string | null
}

/**
 * Une candidature, réduite à ce que le fichier lit.
 *
 * Tout est facultatif : la réponse du serveur varie avec les droits de qui la demande, et une
 * colonne absente doit rendre une cellule vide plutôt que faire tomber l'export.
 */
export interface CandidatureExportable {
  createdAt?: string | Date | null
  status?: string | null
  motivation?: string | null
  dietaryPreference?: string | null
  allergies?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  timePreferences?: unknown
  teamPreferences?: unknown
  hasPets?: boolean | null
  petsDetails?: string | null
  hasMinors?: boolean | null
  minorsDetails?: string | null
  hasVehicle?: boolean | null
  vehicleDetails?: string | null
  companionName?: string | null
  avoidList?: string | null
  skills?: string | null
  hasExperience?: boolean | null
  experienceDetails?: string | null
  setupAvailability?: boolean | null
  teardownAvailability?: boolean | null
  eventAvailability?: boolean | null
  arrivalDateTime?: string | null
  departureDateTime?: string | null
  user?: {
    pseudo?: string | null
    prenom?: string | null
    nom?: string | null
    email?: string | null
    phone?: string | null
  } | null
}

/**
 * Les colonnes du fichier, dans l'ordre, avec la clé de leur libellé.
 *
 * Une liste déclarée plutôt que vingt-six chaînes alignées à la main : l'en-tête et la valeur se
 * lisaient dans deux tableaux distincts, et rien n'empêchait qu'ils se décalent d'un cran. Ici,
 * ajouter une colonne au milieu est un seul geste.
 *
 * Les clés sont celles des colonnes de l'écran chaque fois qu'elles existent : le fichier doit
 * employer les mots que l'utilisateur vient de lire.
 */
export const COLONNES_CANDIDATURES = [
  { id: 'createdAt', cle: 'volunteers.export_application_date' },
  { id: 'status', cle: 'common.status' },
  { id: 'pseudo', cle: 'volunteers.table_user' },
  { id: 'prenom', cle: 'volunteers.table_first_name' },
  { id: 'nom', cle: 'volunteers.table_last_name' },
  { id: 'email', cle: 'common.email' },
  { id: 'phone', cle: 'common.phone' },
  { id: 'motivation', cle: 'volunteers.table_motivation' },
  { id: 'diet', cle: 'volunteers.table_diet' },
  { id: 'allergies', cle: 'volunteers.table_allergies' },
  { id: 'emergencyName', cle: 'pages.volunteers.emergency_contact_name' },
  { id: 'emergencyPhone', cle: 'pages.volunteers.emergency_contact_phone' },
  { id: 'timePreferences', cle: 'volunteers.table_time_preferences' },
  { id: 'teamPreferences', cle: 'volunteers.table_team_preferences' },
  { id: 'pets', cle: 'volunteers.table_pets' },
  { id: 'minors', cle: 'volunteers.table_minors' },
  { id: 'vehicle', cle: 'volunteers.table_vehicle' },
  { id: 'companion', cle: 'volunteers.table_companion' },
  { id: 'avoidList', cle: 'volunteers.table_avoid_list' },
  { id: 'skills', cle: 'volunteers.table_skills' },
  { id: 'experience', cle: 'pages.volunteers.experience' },
  { id: 'setup', cle: 'pages.volunteers.setup' },
  { id: 'teardown', cle: 'pages.volunteers.teardown' },
  { id: 'event', cle: 'pages.volunteers.event' },
  { id: 'arrival', cle: 'volunteers.export_arrival' },
  { id: 'departure', cle: 'volunteers.export_departure' },
] as const

/** L'identifiant d'une colonne, tel que `COLONNES_CANDIDATURES` le déclare. */
export type IdColonneCandidature = (typeof COLONNES_CANDIDATURES)[number]['id']

/**
 * Ce qu'on imprime, quand on imprime.
 *
 * Vingt-six colonnes ne tiennent pas sur une feuille : le paysage n'y suffit pas, et rétrécir la
 * police rendrait le tableau illisible — or une feuille illisible ne sert à rien, c'est
 * exactement ce pour quoi on l'imprimait.
 *
 * Le choix suit l'usage du papier : appeler quelqu'un, l'accueillir, et savoir ce qu'il a annoncé
 * pour les repas. Les motivations, les compétences et les préférences d'équipe sont du texte long
 * qu'on relit à l'écran, pas au guichet — le fichier tableur reste là pour tout le reste.
 */
export const COLONNES_A_IMPRIMER = [
  'status',
  'pseudo',
  'prenom',
  'nom',
  'phone',
  'diet',
  'allergies',
  'emergencyPhone',
  'arrival',
  'departure',
] as const satisfies readonly IdColonneCandidature[]

/** Les colonnes retenues, dans l'ordre déclaré. Sans choix, toutes. */
function colonnesRetenues(
  choisies?: readonly IdColonneCandidature[]
): readonly (typeof COLONNES_CANDIDATURES)[number][] {
  if (!choisies?.length) return COLONNES_CANDIDATURES
  const voulues = new Set<string>(choisies)
  return COLONNES_CANDIDATURES.filter((colonne) => voulues.has(colonne.id))
}

export function entetesDesCandidatures(
  t: Traducteur,
  colonnes?: readonly IdColonneCandidature[]
): string[] {
  return colonnesRetenues(colonnes).map((colonne) => t(colonne.cle))
}

/** Le statut, dans la langue de l'utilisateur. Un statut inconnu ressort tel quel. */
export function statutLisible(statut: string | null | undefined, t: Traducteur): string {
  const cles: Record<string, string> = {
    PENDING: 'volunteers.status_pending',
    ACCEPTED: 'volunteers.status_accepted',
    REJECTED: 'volunteers.status_rejected',
  }
  const cle = cles[statut ?? '']
  return cle ? t(cle) : (statut ?? '')
}

/** Le régime alimentaire. `NONE` est une VALEUR — « aucun régime » —, pas une absence. */
export function regimeLisible(regime: string | null | undefined, t: Traducteur): string {
  const cles: Record<string, string> = {
    VEGETARIAN: 'diet.vegetarian',
    VEGAN: 'diet.vegan',
    NONE: 'diet.none',
  }
  const cle = cles[regime ?? '']
  return cle ? t(cle) : (regime ?? '')
}

/**
 * « Oui (avec le détail) » ou « Non ».
 *
 * Le détail entre parenthèses plutôt que dans une colonne à part : c'est la forme qu'avait déjà
 * le fichier, et scinder « a un véhicule » de « lequel » sur vingt-six colonnes en ferait
 * vingt-neuf sans rien apprendre de plus.
 */
export function ouiAvecDetail(
  valeur: boolean | null | undefined,
  detail: string | null | undefined,
  t: Traducteur
): string {
  if (!valeur) return t('common.no')
  const precision = detail?.trim()
  return precision ? `${t('common.yes')} (${precision})` : t('common.yes')
}

/**
 * Une date d'arrivée ou de départ, telle que le bénévole l'a donnée.
 *
 * La valeur est stockée `2026-08-14_morning` : un jour et un MOMENT, pas une heure. Le bénévole
 * annonce « le 14 au matin », et le lui rendre en « 14/08/2026 00:00 » inventerait une précision
 * qu'il n'a pas donnée.
 *
 * Une valeur qui ne suit pas cette forme ressort telle quelle plutôt que vide : mieux vaut un
 * texte brut qu'une cellule muette, sur une information qui sert à organiser un accueil.
 */
export function momentLisible(
  valeur: string | null | undefined,
  t: Traducteur,
  format: FormatDesDates
): string {
  const brut = valeur?.trim()
  if (!brut) return ''
  if (!brut.includes('_')) return brut

  const [jour, moment] = brut.split('_')
  const date = new Date(jour ?? '')
  if (Number.isNaN(date.getTime())) return brut.split('_').join(' ')

  const jourLisible = date.toLocaleDateString(format.locale, {
    day: 'numeric',
    month: 'short',
    ...(format.fuseau ? { timeZone: format.fuseau } : {}),
  })

  const cles: Record<string, string> = {
    morning: 'edition.volunteers.time_granularity.morning',
    noon: 'edition.volunteers.time_granularity.noon',
    afternoon: 'edition.volunteers.time_granularity.afternoon',
    evening: 'edition.volunteers.time_granularity.evening',
  }
  const cle = cles[moment ?? '']
  return `${jourLisible} ${cle ? t(cle) : (moment ?? '')}`.trim()
}

/** Une liste de choix, mise bout à bout. Le point-virgule, parce que la virgule sépare déjà. */
export function listeLisible(valeur: unknown): string {
  if (Array.isArray(valeur)) return valeur.join(' ; ')
  return typeof valeur === 'string' ? valeur : ''
}

/** L'horodatage du dépôt de la candidature, à l'heure du lieu. */
export function dateLisible(
  valeur: string | Date | null | undefined,
  format: FormatDesDates
): string {
  if (!valeur) return ''
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(format.locale, {
    ...(format.fuseau ? { timeZone: format.fuseau } : {}),
  })
}

/**
 * Une candidature, valeur par valeur, indexée par identifiant de colonne.
 *
 * Un dictionnaire et non une liste alignée à la main : c'est lui qui garantit qu'un en-tête et sa
 * valeur ne peuvent pas se décaler, y compris quand on n'imprime qu'une partie des colonnes. Deux
 * listes parallèles se décalent en silence, et toutes les colonnes deviennent fausses d'un cran.
 */
function valeursDUneCandidature(
  candidature: CandidatureExportable,
  t: Traducteur,
  format: FormatDesDates
): Record<IdColonneCandidature, string> {
  const user = candidature.user ?? {}
  const ouiNon = (valeur: boolean | null | undefined) => (valeur ? t('common.yes') : t('common.no'))

  return {
    createdAt: dateLisible(candidature.createdAt, format),
    status: statutLisible(candidature.status, t),
    pseudo: user.pseudo ?? '',
    prenom: user.prenom ?? '',
    nom: user.nom ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    motivation: candidature.motivation ?? '',
    diet: regimeLisible(candidature.dietaryPreference, t),
    allergies: candidature.allergies ?? '',
    emergencyName: candidature.emergencyContactName ?? '',
    emergencyPhone: candidature.emergencyContactPhone ?? '',
    timePreferences: listeLisible(candidature.timePreferences),
    teamPreferences: listeLisible(candidature.teamPreferences),
    pets: ouiAvecDetail(candidature.hasPets, candidature.petsDetails, t),
    minors: ouiAvecDetail(candidature.hasMinors, candidature.minorsDetails, t),
    vehicle: ouiAvecDetail(candidature.hasVehicle, candidature.vehicleDetails, t),
    companion: candidature.companionName ?? '',
    avoidList: candidature.avoidList ?? '',
    skills: candidature.skills ?? '',
    experience: ouiAvecDetail(candidature.hasExperience, candidature.experienceDetails, t),
    setup: ouiNon(candidature.setupAvailability),
    teardown: ouiNon(candidature.teardownAvailability),
    event: ouiNon(candidature.eventAvailability),
    arrival: momentLisible(candidature.arrivalDateTime, t, format),
    departure: momentLisible(candidature.departureDateTime, t, format),
  }
}

/** Une candidature, dans l'ordre des colonnes retenues. */
export function ligneDUneCandidature(
  candidature: CandidatureExportable,
  t: Traducteur,
  format: FormatDesDates,
  colonnes?: readonly IdColonneCandidature[]
): string[] {
  const valeurs = valeursDUneCandidature(candidature, t, format)
  return colonnesRetenues(colonnes).map((colonne) => valeurs[colonne.id])
}

/** Le fichier entier, prêt à être téléchargé. */
export function candidaturesEnCsv(
  candidatures: CandidatureExportable[],
  t: Traducteur,
  format: FormatDesDates
): string {
  return versCsv(
    entetesDesCandidatures(t),
    candidatures.map((candidature) => ligneDUneCandidature(candidature, t, format))
  )
}
