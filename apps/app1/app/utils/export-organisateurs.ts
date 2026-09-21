import { formatUserFullName } from './pronouns'

import { versCsv } from '~~/shared/utils/csv'

/**
 * Les organisateurs d'une édition, en CSV.
 *
 * **Ce qu'on exporte est ce qu'on voit.** Les colonnes conditionnelles du tableau le sont ici
 * aussi, et pour les mêmes raisons : pas de statut d'entrée si la billetterie est éteinte, pas de
 * repas sans le droit de les gérer. Un export qui déborde l'écran livre des colonnes que son
 * lecteur n'était pas censé voir ; un export qui en manque se découvre au tableur.
 *
 * Construit dans le NAVIGATEUR et non sur le serveur, contrairement à l'export des candidatures
 * bénévoles. Deux raisons, et elles ne valent que pour cet écran : la liste n'est pas paginée —
 * le client les a toutes —, et les libellés des rôles sont des clés i18n. Les reconstituer côté
 * serveur aurait recopié neuf libellés en français, à côté de ceux qui existent déjà.
 *
 * Le format, lui, est partagé : `versCsv` porte l'encodage, l'échappement et la garde contre
 * l'injection de formule, pour cet export comme pour celui des bénévoles.
 */

/** Ce que le tableau affiche réellement, et donc ce que le fichier doit porter. */
export interface ColonnesOrganisateurs {
  /** Courriel et téléphone : réservés aux gestionnaires d'organisateurs, masqués sinon. */
  contact: boolean
  /** Statut d'entrée : seulement quand la billetterie est active. */
  statut: boolean
  /** Repas : seulement quand le module est actif ET qu'on peut le gérer. */
  repas: boolean
}

interface OrganisateurExportable {
  title?: string | null
  entryValidated?: boolean | null
  roles?: string[] | null
  meals?: { accepted?: number | null; total?: number | null } | null
  user?: {
    prenom?: string | null
    nom?: string | null
    pronouns?: string | null
    email?: string | null
    phone?: string | null
  } | null
}

/** Ce que la fonction attend d'`useI18n` : de quoi traduire une clé. */
type Traducteur = (cle: string, valeurs?: Record<string, unknown>) => string

export function entetesDesOrganisateurs(colonnes: ColonnesOrganisateurs, t: Traducteur): string[] {
  return [
    t('gestion.organizers.organizer'),
    t('gestion.organizers.title_column'),
    ...(colonnes.contact ? [t('common.email'), t('common.phone')] : []),
    ...(colonnes.statut ? [t('gestion.organizers.status')] : []),
    t('gestion.organizers.roles_column'),
    ...(colonnes.repas ? [t('common.meals_short')] : []),
  ]
}

export function ligneDUnOrganisateur(
  organisateur: OrganisateurExportable,
  colonnes: ColonnesOrganisateurs,
  t: Traducteur
): unknown[] {
  const roles = organisateur.roles ?? []

  return [
    // Le même nom qu'à l'écran, pronom compris : deux façons de nommer quelqu'un dans un même
    // produit se rattrapent mal une fois le fichier ouvert ailleurs.
    formatUserFullName(organisateur.user ?? null, t),
    organisateur.title ?? '',
    ...(colonnes.contact ? [organisateur.user?.email ?? '', organisateur.user?.phone ?? ''] : []),
    ...(colonnes.statut
      ? [
          t(
            organisateur.entryValidated
              ? 'gestion.organizers.entry_validated'
              : 'gestion.organizers.entry_not_validated'
          ),
        ]
      : []),
    // Le point-virgule sépare les rôles : la virgule est le séparateur du fichier, et même
    // échappée elle rend la cellule pénible à redécouper dans un tableur.
    roles.map((role) => t(`gestion.organizers.role.${role}`)).join(' ; '),
    ...(colonnes.repas
      ? [`${organisateur.meals?.accepted ?? 0} / ${organisateur.meals?.total ?? 0}`]
      : []),
  ]
}

export function organisateursEnCsv(
  organisateurs: readonly OrganisateurExportable[],
  colonnes: ColonnesOrganisateurs,
  t: Traducteur
): string {
  return versCsv(
    entetesDesOrganisateurs(colonnes, t),
    organisateurs.map((organisateur) => ligneDUnOrganisateur(organisateur, colonnes, t))
  )
}
