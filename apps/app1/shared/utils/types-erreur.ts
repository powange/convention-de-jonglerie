/**
 * Les types d'erreur du journal d'API : ce qu'ils valent, à quelle famille ils appartiennent, et
 * comment on les filtre.
 *
 * Une seule description, lue des DEUX côtés — `server/utils/error-logger.ts` pour la classification
 * à l'écriture, `app/pages/admin/error-logs.vue` pour les options du filtre. Elles étaient tenues
 * séparément et avaient divergé : le serveur produisait dix-sept types, l'écran en proposait huit.
 *
 * La divergence ne se voyait sur aucun écran, et elle coûtait cher au diagnostic. Choisir « Base de
 * données » filtrait sur `DatabaseError`, qui est le REPLI GÉNÉRIQUE — un interblocage, un
 * dépassement de verrou ou une contrainte d'unicité étaient donc exclus par le filtre censé les
 * montrer. On cherchait un problème de base de données et le seul filtre qui en parlait cachait
 * précisément les cas intéressants.
 *
 * D'où les FAMILLES : « Base de données » désigne désormais les neuf types, et chaque type reste
 * sélectionnable séparément quand on sait ce qu'on cherche.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Les regroupements proposés au filtre, au-dessus des types précis. */
export type FamilleDErreur =
  | 'base-de-donnees'
  | 'validation'
  | 'acces'
  | 'reseau'
  | 'systeme'
  | 'autre'

export const LIBELLES_DE_FAMILLE: Record<FamilleDErreur, string> = {
  'base-de-donnees': 'Base de données',
  validation: 'Validation',
  acces: 'Accès',
  reseau: 'Réseau',
  systeme: 'Système',
  autre: 'Autre',
}

/**
 * Tout ce que la colonne `errorType` peut contenir.
 *
 * Les libellés nomment le symptôme plutôt que la classe d'erreur JavaScript : c'est « Interblocage »
 * qu'on cherche dans un menu, pas `DatabaseDeadlockError`. Les codes Prisma sont rappelés entre
 * parenthèses parce qu'ils sont ce qu'on recopie dans une recherche.
 */
export const TYPES_D_ERREUR = [
  // ---- Base de données ----
  {
    code: 'DatabaseUniqueConstraintError',
    libelle: "Contrainte d'unicité (P2002)",
    famille: 'base-de-donnees',
  },
  {
    code: 'DatabaseForeignKeyError',
    libelle: 'Clé étrangère (P2003)',
    famille: 'base-de-donnees',
  },
  {
    code: 'DatabaseRecordNotFoundError',
    libelle: 'Enregistrement introuvable (P2025)',
    famille: 'base-de-donnees',
  },
  { code: 'DatabaseDeadlockError', libelle: 'Interblocage', famille: 'base-de-donnees' },
  {
    code: 'DatabaseLockTimeoutError',
    libelle: "Dépassement d'attente de verrou",
    famille: 'base-de-donnees',
  },
  {
    code: 'DatabaseSortMemoryError',
    libelle: 'Mémoire de tri saturée',
    famille: 'base-de-donnees',
  },
  { code: 'DatabaseConnectionError', libelle: 'Connexion à la base', famille: 'base-de-donnees' },
  {
    code: 'DatabaseValidationError',
    libelle: 'Requête Prisma invalide',
    famille: 'base-de-donnees',
  },
  // Le repli : tout ce que la classification n'a pas su affiner. Placé EN DERNIER de sa famille,
  // parce qu'il est le moins informatif — et c'est lui que l'ancien filtre proposait tout seul.
  { code: 'DatabaseError', libelle: 'Base de données (non précisée)', famille: 'base-de-donnees' },

  // ---- Validation ----
  { code: 'ValidationError', libelle: 'Validation des données', famille: 'validation' },

  // ---- Accès ----
  { code: 'AuthenticationError', libelle: 'Authentification', famille: 'acces' },
  { code: 'AuthorizationError', libelle: 'Autorisation', famille: 'acces' },

  // ---- Réseau ----
  { code: 'NetworkError', libelle: 'Réseau', famille: 'reseau' },
  { code: 'TimeoutError', libelle: 'Délai dépassé', famille: 'reseau' },

  // ---- Système ----
  { code: 'HttpError', libelle: 'Erreur HTTP', famille: 'systeme' },
  { code: 'FileError', libelle: 'Fichier', famille: 'systeme' },

  // ---- Autre ----
  {
    // Écrit directement par `server/api/i18n/missing-keys.post.ts`, sans passer par
    // `getErrorType` : la table sert aussi de journal aux clés de traduction manquantes.
    code: 'I18nMissingKey',
    libelle: 'Clé de traduction manquante',
    famille: 'autre',
  },
  { code: 'UnknownError', libelle: 'Non classée', famille: 'autre' },
] as const satisfies ReadonlyArray<{ code: string; libelle: string; famille: FamilleDErreur }>

/**
 * Les codes admis, en type.
 *
 * C'est la moitié de la garantie : `getErrorType` déclare rendre ce type, donc TypeScript refuse
 * qu'il produise un code absent de cette liste. L'autre moitié — qu'aucune branche nouvelle
 * n'échappe au filtre — est tenue par les tests, qui relisent la fonction.
 */
export type CodeTypeDErreur = (typeof TYPES_D_ERREUR)[number]['code']

/** Le préfixe qui distingue, dans la valeur du filtre, une famille d'un type précis. */
export const PREFIXE_FAMILLE = 'famille:'

/** Les codes d'une famille, dans l'ordre de la liste. */
export function codesDeLaFamille(famille: FamilleDErreur): string[] {
  return TYPES_D_ERREUR.filter((type) => type.famille === famille).map((type) => type.code)
}

/** Le libellé d'un code, ou le code lui-même s'il est inconnu — jamais rien d'illisible. */
export function libelleDuType(code: string | null | undefined): string {
  if (!code) return 'Non classée'
  return TYPES_D_ERREUR.find((type) => type.code === code)?.libelle ?? code
}

/**
 * Les codes que doit retenir une valeur de filtre.
 *
 * `null` signifie « aucune restriction » : c'est le cas de `all`, mais AUSSI d'une valeur qu'on ne
 * reconnaît pas. Une valeur fabriquée à la main dans l'URL ne doit pas rendre une liste vide sans
 * rien expliquer — mieux vaut ignorer le filtre que faire croire à une absence d'erreurs.
 */
export function codesDuFiltreDeType(valeur: string | null | undefined): string[] | null {
  if (!valeur || valeur === 'all') return null

  if (valeur.startsWith(PREFIXE_FAMILLE)) {
    const famille = valeur.slice(PREFIXE_FAMILLE.length) as FamilleDErreur
    const codes = codesDeLaFamille(famille)
    return codes.length > 0 ? codes : null
  }

  return TYPES_D_ERREUR.some((type) => type.code === valeur) ? [valeur] : null
}

/** Un item de `USelect`, tel que le composant les attend. */
export interface OptionDeFiltre {
  label?: string
  value?: string
  type?: 'label' | 'separator'
}

/**
 * Les options du filtre : d'abord les familles, puis les types précis, séparés.
 *
 * Les familles d'abord parce que c'est ce qu'on veut neuf fois sur dix — « montre-moi les erreurs
 * de base de données » —, et les types précis ensuite pour qui sait déjà ce qu'il cherche.
 */
export function optionsDuFiltreDeType(): OptionDeFiltre[] {
  const familles = (Object.keys(LIBELLES_DE_FAMILLE) as FamilleDErreur[]).filter(
    (famille) => codesDeLaFamille(famille).length > 1
  )

  return [
    { label: 'Tous les types', value: 'all' },
    { type: 'separator' },
    { type: 'label', label: 'Familles' },
    ...familles.map((famille) => ({
      label: LIBELLES_DE_FAMILLE[famille],
      value: `${PREFIXE_FAMILLE}${famille}`,
    })),
    { type: 'separator' },
    { type: 'label', label: 'Types précis' },
    ...TYPES_D_ERREUR.map((type) => ({ label: type.libelle, value: type.code })),
  ]
}
