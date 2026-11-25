import { defineStore } from 'pinia'

/**
 * Le store « éditions » attendu par l'interface du layer bénévoles (contrat d'hôte côté interface,
 * cf. docs/flowvent-benevoles.md). App1 a le sien, branché sur ses éditions et conventions ; celui
 * de Flowvent sert ses événements sous la même forme, via `GET /api/events/:id/edition`.
 *
 * Le layer n'en utilise que six membres : `fetchEditionById`, `getEditionById`, `loading`,
 * `canManageVolunteers`, `canEditEdition`, `isTeamLeader`.
 */
export interface EditionFlowvent {
  id: number
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
  volunteersOrganizersInTeams: boolean
  volunteersSetupStartDate: string | null
  volunteersTeardownEndDate: string | null
  volunteersSwapsEnabled: boolean
  volunteersHasFloatingTeam: boolean
  mealsEnabled: boolean
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
      const promesse = recuperer<EditionFlowvent>(`/api/events/${id}/edition`)
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

    /** Droit calculé par le serveur (propriétaire, organisateur déclaré, administrateur). */
    canManageVolunteers(edition: EditionFlowvent | undefined | null, _userId?: number): boolean {
      return !!edition?.peutGererBenevoles
    },

    /** Mêmes personnes : Flowvent ne distingue pas encore « modifier » de « gérer ». */
    canEditEdition(edition: EditionFlowvent | undefined | null, _userId?: number): boolean {
      return !!edition?.peutGererBenevoles
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
