import { defineStore } from 'pinia'

import type { Droits } from '#shared/modules-evenement'

/**
 * Le store « éditions » attendu par l'interface du layer bénévoles (contrat d'hôte côté interface,
 * cf. docs/flowvent-benevoles.md). App1 a le sien, branché sur ses éditions et conventions ; celui
 * de Flowvent sert ses événements sous la même forme, via `GET /api/events/:id/edition`.
 *
 * Membres lus par les layers : `fetchEditionById`, `getEditionById`, `loading`,
 * `canManageVolunteers`, `canEditEdition`, `isTeamLeader`, et un `canManage*` par module.
 */
export interface EditionFlowvent {
  id: number
  /** L'identifiant des adresses (`/events/<publicId>/…`). */
  publicId: string
  name: string
  description: string | null
  location: string | null
  startDate: string | null
  endDate: string | null
  timezone: string
  status: string
  creatorId: number
  convention: { name: string; authorId: number; organizers: unknown[] }
  peutGererBenevoles: boolean
  volunteersMode: 'INTERNAL' | 'EXTERNAL'
  volunteersPagePublic: boolean
  volunteersOpen: boolean
  volunteersOrganizersInTeams: boolean
  volunteersSetupStartDate: string | null
  volunteersTeardownEndDate: string | null
  volunteersSwapsEnabled: boolean
  volunteersHasFloatingTeam: boolean
  mealsEnabled: boolean
  /** Devise des montants (billetterie) : absente dans Flowvent, l'euro par défaut s'applique. */
  currency?: string | null
  /** Droits par domaine de la personne connectée, calculés par le serveur ; `null` : visiteur. */
  droits: Droits | null
  [cle: string]: unknown
}

export const useEditionStore = defineStore('editions', {
  state: () => ({
    editions: [] as EditionFlowvent[],
    loading: false,
    error: null as string | null,
    _enCours: {} as Record<number, Promise<EditionFlowvent> | undefined>,
    _responsables: {} as Record<number, Promise<boolean> | undefined>,
  }),

  getters: {
    getEditionById: (state) => (id: number) => state.editions.find((e) => e.id === id),
  },

  actions: {
    async fetchEditionById(id: number, opts?: { force?: boolean }) {
      const existante = this.editions.find((e) => e.id === id)
      if (existante && !opts?.force) return existante
      if (this._enCours[id]) return this._enCours[id]!

      this.loading = true
      this.error = null
      // Au rendu serveur, `$fetch` part sans le cookie de session : le serveur voyait un anonyme
      // et répondait 404 à l'organisateur sur la page de ses propres bénévoles, tant qu'elle
      // n'était pas publique. `useRequestFetch` transmet les en-têtes de la requête d'origine.
      const recuperer = import.meta.server ? useRequestFetch() : $fetch
      // Par l'identifiant PUBLIC quand le middleware l'a résolu : par numéro, l'API ne répond qu'à
      // qui est impliqué, si bien qu'un visiteur d'une page publique n'y trouverait rien.
      const ref =
        useState<Record<number, string>>('identifiants-publics', () => ({})).value[id] ?? id
      const promesse = recuperer<EditionFlowvent>(`/api/events/${ref}/edition`)
        .then((edition) => {
          const i = this.editions.findIndex((e) => e.id === id)
          if (i !== -1) this.editions[i] = edition
          else this.editions.push(edition)
          return edition
        })
        .catch((e: { message?: string }) => {
          this.error = e.message ?? "Impossible de charger l'événement"
          throw e
        })
        .finally(() => {
          this.loading = false
          this._enCours[id] = undefined
        })
      this._enCours[id] = promesse
      return promesse
    },

    /** Remplace l'édition en cache après une modification locale (la carte s'en sert). */
    setEdition(edition: EditionFlowvent) {
      const i = this.editions.findIndex((e) => e.id === edition.id)
      if (i !== -1) this.editions[i] = edition
      else this.editions.push(edition)
    },

    /** Droit calculé par le serveur (propriétaire, organisateur déclaré, administrateur). */
    canManageVolunteers(edition: EditionFlowvent | undefined | null, _userId?: number): boolean {
      return !!edition?.peutGererBenevoles
    },

    /** Droit « modifier l'événement ». */
    canEditEdition(edition: EditionFlowvent | undefined | null, _userId?: number): boolean {
      return !!edition?.droits?.modifier
    },

    // Les droits des autres modules, sous les noms qu'appellent les layers partagés.
    canManageStock(edition: EditionFlowvent | undefined | null, _userId?: number): boolean {
      return !!edition?.droits?.stock
    },
    canManageArtists(edition: EditionFlowvent | undefined | null, _userId?: number): boolean {
      return !!edition?.droits?.artistes
    },
    canManageMeals(edition: EditionFlowvent | undefined | null, _userId?: number): boolean {
      return !!edition?.droits?.repas
    },
    canManageTicketing(edition: EditionFlowvent | undefined | null, _userId?: number): boolean {
      return !!edition?.droits?.billetterie
    },
    canManageTreasury(edition: EditionFlowvent | undefined | null, _userId?: number): boolean {
      return !!edition?.droits?.tresorerie
    },

    async isTeamLeader(editionId: number): Promise<boolean> {
      if (this._responsables[editionId]) return this._responsables[editionId]!
      const recuperer = import.meta.server ? useRequestFetch() : $fetch
      const promesse = recuperer<{ data?: { isTeamLeader?: boolean } }>(
        `/api/editions/${editionId}/volunteers/is-team-leader`
      )
        .then((r) => !!r?.data?.isTeamLeader)
        .catch(() => false)
      this._responsables[editionId] = promesse
      return promesse
    },
  },
})
