/**
 * Les modules d'un événement Flowvent et les droits par domaine — la liste écrite UNE fois, lue
 * par l'API (droits, activation, organisateurs) comme par les écrans (accueil de la gestion,
 * organisateurs, barre latérale).
 *
 * Décisions de l'utilisateur : un droit par domaine (le propriétaire a tout), un interrupteur par
 * module (désactiver ne supprime rien). Mêmes colonnes qu'app1 (`EditionOrganizerPermission.can*`,
 * `Edition.*Enabled`), pour que les layers partagés s'y retrouvent.
 *
 * `disponible` : le module est-il porté dans Flowvent ? Un module pas encore porté a ses colonnes
 * en base, mais n'apparaît nulle part — ni son interrupteur, ni son droit dans la page des
 * organisateurs. Chaque lot de portage passe le sien à `true`.
 */

export type CleDroit =
  | 'modifier'
  | 'organisateurs'
  | 'benevoles'
  | 'stock'
  | 'artistes'
  | 'repas'
  | 'billetterie'
  | 'tresorerie'

export type CleModule =
  | 'benevoles'
  | 'carte'
  | 'stock'
  | 'artistes'
  | 'repas'
  | 'billetterie'
  | 'tresorerie'
  | 'faq'

export type ColonneDroit =
  | 'canEditEvent'
  | 'canManageOrganizers'
  | 'canManageVolunteers'
  | 'canManageStock'
  | 'canManageArtists'
  | 'canManageMeals'
  | 'canManageTicketing'
  | 'canManageTreasury'

export type ColonneModule =
  | 'volunteersEnabled'
  | 'siteMapEnabled'
  | 'stockEnabled'
  | 'artistsEnabled'
  | 'mealsEnabled'
  | 'ticketingEnabled'
  | 'treasuryEnabled'
  | 'faqEnabled'

export interface DefinitionModule {
  cle: CleModule
  colonne: ColonneModule
  libelle: string
  description: string
  icone: string
  /** Le droit qui ouvre sa gestion. La carte n'a pas le sien : c'est « modifier l'événement ». */
  droit: CleDroit
  disponible: boolean
}

export interface DefinitionDroit {
  cle: CleDroit
  colonne: ColonneDroit
  libelle: string
  description: string
  /** Le module dont ce droit ouvre la gestion ; absent pour les droits sur l'événement lui-même. */
  module?: CleModule
}

export const MODULES_EVENEMENT: readonly DefinitionModule[] = [
  {
    cle: 'benevoles',
    colonne: 'volunteersEnabled',
    libelle: 'Bénévoles',
    description:
      "Candidatures, équipes, planning, échanges, notifications, et la page publique où l'on candidate.",
    icone: 'i-heroicons-hand-raised',
    droit: 'benevoles',
    disponible: true,
  },
  {
    cle: 'carte',
    colonne: 'siteMapEnabled',
    libelle: 'Carte du site',
    description: 'Zones et repères du lieu, et leur import.',
    icone: 'i-heroicons-map',
    droit: 'modifier',
    disponible: true,
  },
  {
    cle: 'stock',
    colonne: 'stockEnabled',
    libelle: 'Stock et prêts',
    description: 'Inventaire du matériel, emplacements et prêts.',
    icone: 'i-heroicons-archive-box',
    droit: 'stock',
    disponible: true,
  },
  {
    cle: 'artistes',
    colonne: 'artistsEnabled',
    libelle: 'Artistes et spectacles',
    description: "Artistes invités, leurs spectacles, l'espace artiste.",
    icone: 'i-heroicons-star',
    droit: 'artistes',
    disponible: true,
  },
  {
    cle: 'repas',
    colonne: 'mealsEnabled',
    libelle: 'Repas',
    description: 'Repas des bénévoles et des artistes, et leur validation.',
    icone: 'i-heroicons-cake',
    droit: 'repas',
    disponible: true,
  },
  {
    cle: 'billetterie',
    colonne: 'ticketingEnabled',
    libelle: 'Billetterie',
    description: 'Tarifs, commandes HelloAsso et contrôle des entrées.',
    icone: 'i-heroicons-ticket',
    droit: 'billetterie',
    disponible: true,
  },
  {
    cle: 'tresorerie',
    colonne: 'treasuryEnabled',
    libelle: 'Trésorerie',
    description: 'Dépenses, recettes et justificatifs.',
    icone: 'i-heroicons-banknotes',
    droit: 'tresorerie',
    disponible: true,
  },
  {
    cle: 'faq',
    colonne: 'faqEnabled',
    libelle: 'FAQ',
    description: 'Questions fréquentes, publiques ou internes, et leur page publique.',
    icone: 'i-heroicons-question-mark-circle',
    // Un contenu public de l'événement : relève de « modifier l'événement », comme la carte.
    droit: 'modifier',
    disponible: true,
  },
]

export const DROITS_PAR_DOMAINE: readonly DefinitionDroit[] = [
  {
    cle: 'modifier',
    colonne: 'canEditEvent',
    libelle: "Modifier l'événement",
    description: 'Nom, lieu, dates, fuseau, modules, et la carte du site.',
  },
  {
    cle: 'organisateurs',
    colonne: 'canManageOrganizers',
    libelle: 'Gérer les organisateurs',
    description: 'Ajouter, retirer, régler les droits.',
  },
  {
    cle: 'benevoles',
    colonne: 'canManageVolunteers',
    libelle: 'Gérer les bénévoles',
    description: 'Candidatures, équipes, planning.',
    module: 'benevoles',
  },
  {
    cle: 'stock',
    colonne: 'canManageStock',
    libelle: 'Gérer le stock',
    description: 'Matériel, emplacements, prêts.',
    module: 'stock',
  },
  {
    cle: 'artistes',
    colonne: 'canManageArtists',
    libelle: 'Gérer les artistes',
    description: 'Artistes, spectacles, appels à spectacles.',
    module: 'artistes',
  },
  {
    cle: 'repas',
    colonne: 'canManageMeals',
    libelle: 'Gérer les repas',
    description: 'Repas et leur validation.',
    module: 'repas',
  },
  {
    cle: 'billetterie',
    colonne: 'canManageTicketing',
    libelle: 'Gérer la billetterie',
    description: 'Tarifs, commandes, contrôle des entrées.',
    module: 'billetterie',
  },
  {
    cle: 'tresorerie',
    colonne: 'canManageTreasury',
    libelle: 'Gérer la trésorerie',
    description: 'Les montants de tous les modules : à donner avec soin.',
    module: 'tresorerie',
  },
]

/** Les modules portés dans Flowvent, dans l'ordre d'affichage. */
export const modulesDisponibles = () => MODULES_EVENEMENT.filter((m) => m.disponible)

/** Les droits à proposer : ceux de l'événement, et ceux des modules portés. */
export const droitsProposes = () =>
  DROITS_PAR_DOMAINE.filter(
    (d) => !d.module || MODULES_EVENEMENT.find((m) => m.cle === d.module)?.disponible
  )

export type Droits = Record<CleDroit, boolean>
export type Modules = Record<CleModule, boolean>
