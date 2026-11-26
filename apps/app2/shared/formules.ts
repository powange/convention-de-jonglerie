/**
 * Les formules d'abonnement de Flowvent — la grille écrite UNE fois, lue par l'API (garde par
 * module, paiement) comme par les écrans (page tarifs, accueil de la gestion, profil).
 *
 * Décisions de l'utilisateur (rapport « Tarifs de Flowvent », 26/11/2026) :
 * - trois formules : Solo (1 module au choix), Duo (2 modules au choix), Intégral (tous, et ceux
 *   à venir) ; au mois ou à l'année ;
 * - six modules payants ; la CARTE DU SITE est toujours incluse (elle sert de support au stock et
 *   aux spectacles) ;
 * - ni essai gratuit ni formule gratuite permanente.
 *
 * ⚠️ Ce fichier se suffit à lui-même (aucun import de valeur) : un test d'app1 le transpile et
 * l'exécute tel quel (cf. apps/app1/test/unit/utils/flowvent-formules.test.ts).
 */

export type CleFormule = 'solo' | 'duo' | 'integral'
export type Periode = 'monthly' | 'annual'

export const CLES_FORMULES = ['solo', 'duo', 'integral'] as const
export const PERIODES = ['monthly', 'annual'] as const

/**
 * Les modules qu'une formule doit couvrir, dans les clés de `shared/modules-evenement.ts`. La
 * carte n'y est pas : elle est incluse partout.
 */
export const MODULES_PAYANTS = [
  'benevoles',
  'artistes',
  'repas',
  'billetterie',
  'tresorerie',
  'stock',
] as const
export type ModulePayant = (typeof MODULES_PAYANTS)[number]

export interface DefinitionFormule {
  cle: CleFormule
  libelle: string
  /** Nombre de modules à choisir ; `null` : tous, y compris les modules à venir. */
  nombreModules: number | null
  /** Prix TTC en centimes, par période facturée (un mois, ou un an). */
  prix: Record<Periode, number>
  accroche: string
}

export const FORMULES: readonly DefinitionFormule[] = [
  {
    cle: 'solo',
    libelle: 'Solo',
    nombreModules: 1,
    prix: { monthly: 900, annual: 8400 },
    accroche: 'Pour un besoin précis : vos bénévoles, votre appel à spectacles, votre matériel.',
  },
  {
    cle: 'duo',
    libelle: 'Duo',
    nombreModules: 2,
    prix: { monthly: 1500, annual: 14400 },
    accroche: 'Les paires qui vont ensemble : bénévoles et repas, billetterie et trésorerie.',
  },
  {
    cle: 'integral',
    libelle: 'Intégral',
    nombreModules: null,
    prix: { monthly: 2500, annual: 24000 },
    accroche: "Tout l'événement au même endroit, et chaque nouveau module dès sa sortie.",
  },
]

export function estModulePayant(cle: unknown): cle is ModulePayant {
  return typeof cle === 'string' && (MODULES_PAYANTS as readonly string[]).includes(cle)
}

export function formule(cle: unknown): DefinitionFormule | null {
  return FORMULES.find((f) => f.cle === cle) ?? null
}

/**
 * Les modules payants que couvre un abonnement. Intégral : tous. Solo et Duo : ceux choisis, sans
 * doublon ni clé inconnue. Une formule inconnue ne couvre rien.
 */
export function modulesCouverts(cleFormule: unknown, modules: unknown): ModulePayant[] {
  const f = formule(cleFormule)
  if (!f) return []
  if (f.nombreModules === null) return [...MODULES_PAYANTS]
  const choisis = Array.isArray(modules) ? modules.filter(estModulePayant) : []
  return [...new Set(choisis)].slice(0, f.nombreModules)
}

/**
 * Le choix de modules est-il valable pour cette formule ? Renvoie le message d'erreur, ou `null`.
 * Solo : exactement 1 module payant ; Duo : exactement 2, différents ; Intégral : rien à choisir.
 */
export function erreurChoixModules(cleFormule: unknown, modules: unknown): string | null {
  const f = formule(cleFormule)
  if (!f) return 'Formule inconnue'
  if (f.nombreModules === null) return null
  const liste = Array.isArray(modules) ? modules : []
  if (liste.some((m) => !estModulePayant(m))) return 'Module inconnu'
  if (new Set(liste).size !== liste.length) return 'Un module est choisi deux fois'
  if (liste.length !== f.nombreModules) {
    return f.nombreModules === 1
      ? 'La formule Solo comprend 1 module : choisissez-le'
      : `La formule ${f.libelle} comprend ${f.nombreModules} modules : choisissez-les`
  }
  return null
}

/** La plus petite formule qui couvre ce nombre de modules (3 et plus : Intégral). */
export function formulePourNombreDeModules(n: number): CleFormule | null {
  if (n <= 0) return null
  if (n === 1) return 'solo'
  if (n === 2) return 'duo'
  return 'integral'
}

/** Prix ramené au mois, en centimes (l'annuel divisé par 12), pour l'affichage. */
export function prixMensuel(cleFormule: CleFormule, periode: Periode): number {
  const f = formule(cleFormule)
  if (!f) return 0
  return periode === 'annual' ? Math.round(f.prix.annual / 12) : f.prix.monthly
}

/** « 7 € », « 12,50 € » — centimes en euros, à la française. */
export function euros(centimes: number): string {
  const valeur = centimes / 100
  return `${valeur.toLocaleString('fr-FR', {
    minimumFractionDigits: Number.isInteger(valeur) ? 0 : 2,
    maximumFractionDigits: 2,
  })}\u00a0€`
}

/** La fin d'une période facturée qui commence à `debut`. */
export function finDePeriode(debut: Date, periode: Periode): Date {
  const fin = new Date(debut)
  if (periode === 'annual') fin.setFullYear(fin.getFullYear() + 1)
  else fin.setMonth(fin.getMonth() + 1)
  return fin
}
