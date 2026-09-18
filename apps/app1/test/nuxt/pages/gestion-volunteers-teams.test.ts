import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-router', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useRoute: () => ({ params: { id: '22' } }),
}))

/** Le réglage de l'édition, que chaque test positionne avant de monter la page. */
const optionOuverte = vi.hoisted(() => ({ valeur: false }))

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 1 } }),
}))

vi.mock('~/stores/editions', () => ({
  useEditionStore: () => ({
    // `creatorId` égal à l'utilisateur : la page n'est visible qu'à qui peut gérer les bénévoles,
    // et sans cela elle ne rend rien — le test ne prouverait alors plus rien du réglage.
    getEditionById: () => ({
      id: 22,
      name: 'Édition de test',
      creatorId: 1,
      volunteersOrganizersInTeams: optionOuverte.valeur,
    }),
    fetchEditionById: async () => undefined,
    canManageVolunteers: () => true,
  }),
}))

vi.mock('~/composables/useAccessControlPermissions', () => ({
  useAccessControlPermissions: () => ({ canAccessAccessControl: { value: false } }),
}))

import TeamsPage from '../../../../../layers/volunteers/app/pages/editions/[id]/gestion/volunteers/teams.vue'

/**
 * Le rattachement des organisateurs aux équipes n'existe que si l'édition l'a ouvert.
 *
 * Le point d'API d'écriture contrôle le réglage et refuse par un 403. La carte, elle, s'affichait
 * quoi qu'il arrive : on choisissait des équipes, on enregistrait, et l'échec n'arrivait qu'au
 * dernier clic — sur 47 éditions sur 49, celles où l'option est fermée.
 *
 * Les DEUX sens sont tenus. Une première version de ce test ne vérifiait que l'absence, et
 * passait alors même que la page entière ne rendait rien : une condition ne se vérifie pas à
 * moitié.
 */
let monte: { unmount: () => void } | null = null
afterEach(() => {
  monte?.unmount()
  monte = null
})

const carteVisible = async (reglage: boolean) => {
  optionOuverte.valeur = reglage
  const wrapper = await mountSuspended(TeamsPage, {
    global: {
      stubs: {
        EditionVolunteerPlanningTeamManagement: { template: '<div>équipes</div>' },
        VolunteersOrganizersInTeamsCard: {
          template: '<div data-test="carte-organisateurs">organisateurs</div>',
        },
      },
    },
  })
  monte = wrapper
  await wrapper.vm.$nextTick()
  return {
    carte: wrapper.find('[data-test="carte-organisateurs"]').exists(),
    // Le repère qui empêche un faux vert : si la page ne rend rien, l'absence de carte ne
    // signifie plus rien.
    page: wrapper.text().includes('équipes'),
  }
}

describe('page des équipes — la carte des organisateurs suit le réglage', () => {
  it('est absente quand l’option est fermée', async () => {
    const { carte, page } = await carteVisible(false)

    expect(page, 'la page elle-même ne rend rien : le test ne prouverait rien').toBe(true)
    expect(carte).toBe(false)
  })

  it('est présente quand l’option est ouverte', async () => {
    const { carte } = await carteVisible(true)

    expect(carte).toBe(true)
  })
})
