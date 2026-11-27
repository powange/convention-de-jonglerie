// Ports du module « programme » (layers/program). Le layer lit les éléments libres et les
// représentations de spectacles lui-même (mêmes modèles dans les deux apps) ; ce qui diffère d'une
// app à l'autre passe par ici : les réglages de l'événement (une édition dans app1, un événement
// dans Flowvent) et les ateliers, que Flowvent n'a pas.

import type { WorkshopSource } from '#program/shared/utils/program-timeline'
import type { PrismaTransaction } from '#server/types/prisma-helpers'

/** Les réglages qui gouvernent le programme d'un événement. */
export interface ReglagesProgramme {
  programEnabled: boolean
  programPagePublic: boolean
  /** L'hôte a-t-il des ateliers, et sont-ils activés ? Toujours `false` dans Flowvent. */
  workshopsEnabled: boolean
  artistsEnabled: boolean
  siteMapEnabled: boolean
  mapPublic: boolean
  timezone: string | null
}

/** Un atelier, à la forme qu'attend `construireFriseProgramme`. */
export type AtelierDeFrise = WorkshopSource

/** Ce qu'il faut pour créer un atelier à partir d'un élément de programme. */
export interface ElementVersAtelier {
  editionId: number
  creatorId: number
  title: string
  description: string | null
  startDateTime: Date
  endDateTime: Date | null
  locationName: string | null
  zoneId: number | null
  markerId: number | null
}

export interface ProgramPorts {
  /** Les réglages du programme de l'événement, ou `null` s'il n'existe pas. */
  lireReglages(editionId: number): Promise<ReglagesProgramme | null>
  /** Rend la page publique du programme visible des visiteurs, ou la masque. */
  enregistrerPagePublique(editionId: number, pagePublique: boolean): Promise<void>
  /** Les ateliers de l'événement pour la frise ; `[]` si l'hôte n'en a pas. */
  lireAteliers(editionId: number): Promise<AtelierDeFrise[]>
  /**
   * Crée un atelier à partir d'un élément, dans la transaction de la conversion. Absent : l'hôte
   * n'a pas d'ateliers (Flowvent), et la conversion vers un atelier est refusée.
   */
  creerAtelier?(tx: PrismaTransaction, element: ElementVersAtelier): Promise<{ id: number }>
}
