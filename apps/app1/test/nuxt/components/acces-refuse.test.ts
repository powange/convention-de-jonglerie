import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ⚠️ LE STORE EST DOUBLÉ, ET CE N'EST PAS UN RACCOURCI. `mountSuspended` installe SA propre
 * instance de Pinia : un `setActivePinia(createPinia())` écrit dans le test n'atteint pas le
 * composant, qui lisait donc un utilisateur vide. Deux cas passaient alors au vert pour la
 * mauvaise raison — il n'y avait simplement aucun administrateur.
 */
/*
 * Un objet NU, et non `reactive()` : `vi.hoisted` s'exécute avant les imports, donc `reactive`
 * n'existe pas encore à ce moment-là. La réactivité n'est de toute façon pas nécessaire — chaque
 * cas règle l'état AVANT de monter, et le `computed` du composant le lit au premier rendu.
 */
const faux = vi.hoisted(() => ({
  isGlobalAdmin: false,
  adminMode: false,
  enableAdminMode: vi.fn(),
}))
vi.mock('~/stores/auth', () => ({ useAuthStore: () => faux }))

import AccesRefuse from '../../../app/components/ui/AccesRefuse.vue'

/**
 * Le refus d'accès, et le raccourci de l'administrateur.
 *
 * ⚠️ CE QUE CES CAS GARDENT. Ce bloc était recopié dans 47 écrans, sous quatre formes. Le
 * mutualiser n'a d'intérêt que si la règle du bouton tient en un seul endroit — et cette règle
 * porte sur des DROITS : la montrer à qui ne doit pas la voir, c'est annoncer une porte dérobée.
 */
describe('UiAccesRefuse', () => {
  beforeEach(() => {
    faux.isGlobalAdmin = false
    faux.adminMode = false
    faux.enableAdminMode.mockClear()
  })

  it("n'offre aucun raccourci à un visiteur ordinaire", async () => {
    const composant = await mountSuspended(AccesRefuse)

    expect(composant.find('button').exists()).toBe(false)
  })

  it("propose la bascule à un administrateur global qui n'a pas activé son mode", async () => {
    faux.isGlobalAdmin = true

    const composant = await mountSuspended(AccesRefuse)

    expect(composant.find('button').exists()).toBe(true)
    expect(composant.find('button').text()).toMatch(/mode administrateur|administrator mode/i)
  })

  it('ne la propose plus une fois le mode activé', async () => {
    /*
     * 🔬 Déjà en mode admin ET toujours refusé : le refus ne vient alors pas des droits. Proposer
     * la bascule ferait recharger la page pour rien, encore et encore.
     */
    faux.isGlobalAdmin = true
    faux.adminMode = true

    const composant = await mountSuspended(AccesRefuse)

    expect(composant.find('button').exists()).toBe(false)
  })

  it('active le mode admin puis recharge, au clic', async () => {
    faux.isGlobalAdmin = true
    const recharger = vi.spyOn(window.location, 'reload').mockImplementation(() => {})

    const composant = await mountSuspended(AccesRefuse)
    await composant.find('button').trigger('click')

    expect(faux.enableAdminMode).toHaveBeenCalledTimes(1)
    /*
     * ⚠️ Le rechargement n'est pas cosmétique : `enableAdminMode` pose un COOKIE que le serveur
     * lit. Sans redemander les données, l'écran afficherait le même refus et le bouton paraîtrait
     * sans effet.
     */
    expect(recharger).toHaveBeenCalledTimes(1)
    recharger.mockRestore()
  })

  it('annonce la bascule et se protège du double clic', async () => {
    /*
     * ⚠️ CE QUE CE CAS GARDE. Le rechargement prend une seconde pendant laquelle l'écran ne bouge
     * pas : sans témoin, le clic paraît sans effet et on clique à nouveau. Signalé à l'usage.
     * Deux rechargements déclenchés valent moins qu'un.
     */
    faux.isGlobalAdmin = true
    const recharger = vi.spyOn(window.location, 'reload').mockImplementation(() => {})

    const composant = await mountSuspended(AccesRefuse)
    const bouton = composant.find('button')
    await bouton.trigger('click')

    expect(composant.find('button').attributes('disabled')).toBeDefined()

    await composant.find('button').trigger('click')
    expect(faux.enableAdminMode).toHaveBeenCalledTimes(1)
    expect(recharger).toHaveBeenCalledTimes(1)
    recharger.mockRestore()
  })

  it('laisse remplacer la description, comme le font deux écrans de bénévolat', async () => {
    const composant = await mountSuspended(AccesRefuse, {
      props: { description: 'Formulation propre au bénévolat' },
    })

    expect(composant.text()).toContain('Formulation propre au bénévolat')
  })
})
