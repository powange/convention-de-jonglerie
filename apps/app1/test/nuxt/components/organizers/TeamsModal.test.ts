import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TeamsModal from '../../../../app/components/organizers/TeamsModal.vue'

/**
 * La modale affichait « Aucune équipe de bénévoles sur cette édition » sur une édition qui en
 * comptait plusieurs : elle lisait `réponse.teams` alors que l'endpoint rend un **tableau nu**.
 *
 * Rien ne pouvait le signaler ailleurs — la liste vide est un état légitime, et le typage ne
 * dit rien d'une réponse dont la forme n'est affirmée que par l'appelant. Ce test monte la
 * modale contre la vraie forme de la réponse, la seule chose qui distingue les deux.
 */

const EQUIPES = [
  { id: 'accueil', name: 'Accueil', color: '#3b82f6' },
  { id: 'bar', name: 'Bar', color: '#10b981' },
]

registerEndpoint('/api/editions/22/volunteer-teams', () => EQUIPES)
registerEndpoint('/api/editions/23/volunteer-teams', () => [])

// La forme que rend réellement `edition-organizers.get` : utilisateur et équipes aplatis.
const organisateur = {
  id: 7,
  user: { pseudo: 'orga', prenom: 'Jean', nom: 'Dupont' },
  teams: [{ id: 'bar', name: 'Bar' }],
}

// Le corps de la modale est téléporté dans `document.body` : sans démontage, les cases d'un
// test s'ajoutent à celles du suivant et tout compte devient faux.
let monte: { unmount: () => void } | null = null
afterEach(() => {
  monte?.unmount()
  monte = null
})

const monter = async (editionId: number) => {
  const wrapper = await mountSuspended(TeamsModal, {
    props: { modelValue: true, organizer: organisateur, editionId },
  })
  monte = wrapper
  return wrapper
}

/** Le chargement part d'un `watch` immédiat, hors de la promesse que `mountSuspended` attend. */
const attendreChargement = async (wrapper: Awaited<ReturnType<typeof monter>>) => {
  await vi.waitFor(() =>
    expect((wrapper.vm as unknown as { loading: boolean }).loading).toBe(false)
  )
  return (wrapper.vm as unknown as { equipes: Array<{ name: string }> }).equipes
}

describe('OrganizersTeamsModal', () => {
  it("charge les équipes de l'édition", async () => {
    const wrapper = await monter(22)
    expect((await attendreChargement(wrapper)).map((e) => e.name)).toEqual(['Accueil', 'Bar'])
  })

  it("coche d'avance les équipes déjà rattachées", async () => {
    // Rouvrir la modale après un enregistrement doit retrouver les équipes posées ; elles
    // arrivent par la ligne du tableau, pas par un appel dédié.
    const wrapper = await monter(22)
    const selection = (wrapper.vm as unknown as { selection: string[] }).selection
    expect(selection).toEqual(['bar'])
  })

  it("nomme l'organisateur dans son titre", async () => {
    // La ligne porte `user` à plat : le lire sous `organizer.user` rendait un titre sans nom.
    // On regarde le nom calculé et non le titre rendu — les traductions ne sont pas
    // interpolées dans cet environnement de test.
    const wrapper = await monter(22)
    expect((wrapper.vm as unknown as { nomAffiche: string }).nomAffiche).toBe('Jean Dupont')
  })

  it("n'affiche rien quand l'édition n'a aucune équipe", async () => {
    // L'état légitime, à distinguer du défaut : c'est parce que les deux se ressemblaient que
    // celui-ci a échappé à tout le monde jusqu'à l'écran.
    const wrapper = await monter(23)
    expect(await attendreChargement(wrapper)).toEqual([])
  })

  /**
   * Cocher une équipe les cochait toutes : la liste était faite main, un `UCheckbox` par équipe
   * avec le tableau de sélection en `v-model`. Or ce composant attend un booléen — un tableau
   * non vide est vrai, donc toutes les cases l'étaient. `UCheckboxGroup` est le composant prévu
   * pour ça, et c'est déjà celui qu'emploie la candidature bénévole.
   *
   * L'assertion porte sur ce que l'écran montre, seul endroit où les deux se distinguaient :
   * `selection` était juste dans les deux cas.
   */
  it('affiche la pastille de couleur de chaque équipe', async () => {
    const wrapper = await monter(22)
    await attendreChargement(wrapper)
    await nextTick()

    const pastilles = [...document.querySelectorAll('[style*="background-color"]')].map((e) =>
      e.getAttribute('style')
    )
    expect(pastilles).toEqual(['background-color: #3b82f6;', 'background-color: #10b981;'])
  })

  it("ne coche que l'équipe rattachée, et pas les autres", async () => {
    const wrapper = await monter(22)
    await attendreChargement(wrapper)
    await nextTick()

    // Le corps de la modale est téléporté hors de l'arbre du composant : c'est le document
    // qu'il faut interroger, pas le wrapper — qui n'y trouve aucune case.
    const cases = document.querySelectorAll('[role="checkbox"]')
    const cochees = [...cases].filter((c) => c.getAttribute('aria-checked') === 'true')

    expect(cases.length).toBe(2)
    expect(cochees.length).toBe(1)
  })
})
