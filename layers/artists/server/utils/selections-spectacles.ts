/**
 * Sélections des spectacles (zones, marqueurs, représentations, composition), communes à app1 et
 * Flowvent. Chaque app les réexporte depuis son `#server/utils/prisma-select-helpers`, l'adresse
 * où le code les cherche ; le type `Prisma` est celui du client de l'app hôte.
 */
import type { Prisma } from '#server/types/prisma'

// ============================================================================
// SÉLECTIONS ZONES/MARQUEURS POUR LES SPECTACLES
// ============================================================================

/**
 * Sélection minimale d'une zone pour l'affichage dans un spectacle
 * Utilisée dans les endpoints shows (GET, POST, PUT)
 *
 * Occurrences: 3 fichiers (shows/index.get, shows/index.post, shows/[showId].put)
 */
export const showZoneSelect = {
  id: true,
  name: true,
  color: true,
  zoneTypes: true,
} satisfies Prisma.EditionZoneSelect

/**
 * Sélection minimale d'un marqueur pour l'affichage dans un spectacle
 * Utilisée dans les endpoints shows (GET, POST, PUT)
 *
 * Occurrences: 3 fichiers (shows/index.get, shows/index.post, shows/[showId].put)
 */
export const showMarkerSelect = {
  id: true,
  name: true,
  color: true,
  markerTypes: true,
} satisfies Prisma.EditionMarkerSelect

/**
 * Include pour spectacle avec zone et marqueur
 * Utilisé dans les endpoints shows pour inclure les relations zone/marker
 */
export const showZoneMarkerInclude = {
  zone: {
    select: showZoneSelect,
  },
  marker: {
    select: showMarkerSelect,
  },
} satisfies Prisma.ShowPerformanceInclude

/**
 * Include des représentations d'un spectacle, avec leur lieu.
 *
 * Elles sont rendues dans l'ordre chronologique : c'est celui dans lequel l'organisateur les
 * saisit, celui du programme, et le seul qui ait un sens pour qui lit une affiche.
 */
export const showPerformancesInclude = {
  performances: {
    include: showZoneMarkerInclude,
    orderBy: { startDateTime: 'asc' },
  },
} satisfies Prisma.ShowInclude

/**
 * Include des artistes d'un spectacle, avec leur utilisateur.
 * Sur un spectacle CABARET, cette liste couvre aussi les artistes rattachés à un numéro :
 * showId est renseigné dans tous les cas.
 */
export const showArtistsInclude = {
  include: {
    artist: {
      include: {
        user: {
          select: {
            id: true,
            email: true,
            prenom: true,
            nom: true,
            // Requis par UiUserName, qui affiche les pronoms à côté du nom
            pronouns: true,
          },
        },
      },
    },
  },
} satisfies Prisma.Show$artistsArgs

/**
 * Include des numéros d'un spectacle CABARET, dans l'ordre de passage, avec leurs artistes.
 */
export const showActsInclude = {
  orderBy: { position: 'asc' },
  include: {
    artists: showArtistsInclude,
  },
} satisfies Prisma.Show$actsArgs

/**
 * Include complet de la composition d'un spectacle : artistes et numéros.
 * Les endpoints de spectacles le réutilisent pour renvoyer une forme homogène.
 */
export const showCompositionInclude = {
  artists: showArtistsInclude,
  acts: showActsInclude,
} satisfies Prisma.ShowInclude
