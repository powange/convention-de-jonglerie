import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import HomeSearch from '../../../app/components/HomeSearch.vue'

/**
 * La recherche de l'en-tête ne parle à la page que par l'URL : ce qu'elle écrit dans la query EST
 * son contrat, et c'est donc ce que ces tests regardent.
 *
 * Deux choses s'y jouent, et aucune n'est visible à l'œil sur une capture d'écran :
 *
 * 1. **`showPast=true`** — sans lui, la recherche ne trouve aucune édition terminée, c'est-à-dire
 *    qu'elle ne sert à rien. L'accueil masque les éditions passées par défaut.
 * 2. **l'absence de tout le reste** — pays, dates, services : la recherche les écarte, et un seul
 *    paramètre oublié dans la query les laisserait en vigueur sans que rien ne le signale.
 * 3. **`sort=recent`** — l'ordre par défaut de l'accueil met la plus PROCHE en tête, ce qui, une
 *    fois le passé ouvert, remonte l'édition la plus ancienne. On veut l'inverse.
 *
 * Le reste de la chaîne est déjà couvert ailleurs : la page transforme la query en filtres
 * (`pages/index.vue`), et le point d'API ouvre bien la fenêtre du passé sur `showPast=true`
 * (`test/nuxt/server/api/editions/index.get.test.ts`). La liaison dans un vrai navigateur, elle,
 * est vérifiée par `test/e2e/playwright/public/recherche-entete.spec.ts`.
 */

/** La route que chaque test positionne avant de monter le composant. */
const routeCourante = vi.hoisted(() => ({
  valeur: { path: '/', query: {} as Record<string, unknown> },
}))

mockNuxtImport('useRoute', () => () => routeCourante.valeur)

/**
 * ⚠️ `useRouter` n'est PAS mocké, et ce n'est pas un oubli : `@nuxt/test-utils` s'en sert lui-même
 * (`useRouter().afterEach(…)` dans son propre `setupNuxt`). Le remplacer fait échouer le fichier
 * entier avant le premier test — onze tests « skipped » et un `TypeError` en guise de verdict.
 *
 * On espionne donc `replace` sur le vrai routeur, une fois le composant monté. La méthode étant
 * résolue à l'appel, l'espion intercepte bien ce que le composant demande, et sa fausse
 * implémentation évite la navigation réelle (et les gardes globales qu'elle déclencherait).
 */
let monte: Awaited<ReturnType<typeof mountSuspended>> | null = null
let replace: ReturnType<typeof vi.fn>

const monter = async (
  route: { path?: string; query?: Record<string, unknown> } = {},
  props: Record<string, unknown> = {}
) => {
  // `reactive` : un test change de page en cours de route (`routeCourante.valeur.path = …`) pour
  // vérifier que la loupe se replie. Sur un objet ordinaire, le `computed` ne le verrait pas.
  routeCourante.valeur = reactive({ path: route.path ?? '/', query: route.query ?? {} })
  monte = await mountSuspended(HomeSearch, { props })
  replace = vi
    .spyOn(
      (monte.vm as unknown as { $router: { replace: () => Promise<void> } }).$router,
      'replace'
    )
    .mockResolvedValue(undefined) as unknown as ReturnType<typeof vi.fn>
  return monte
}

afterEach(() => {
  vi.restoreAllMocks()
  monte?.unmount()
  monte = null
})

/**
 * Le bouton de l'état courant.
 *
 * L'état ouvert comme l'état fermé n'en comptent qu'un — la loupe, puis la croix — et la longueur
 * est vérifiée plutôt que supposée : viser « le premier bouton » sans savoir combien il y en a est
 * la façon habituelle de cliquer sur autre chose que ce qu'on croit.
 */
const bouton = (wrapper: NonNullable<typeof monte>) => {
  const boutons = wrapper.findAll('button')
  expect(boutons).toHaveLength(1)
  return boutons[0]!
}

describe("Recherche d'édition dans l'en-tête", () => {
  it("ne s'affiche pas ailleurs que sur l'accueil", async () => {
    const wrapper = await monter({ path: '/editions/12' })

    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it("s'affiche sur l'accueil, replié sur sa loupe", async () => {
    const wrapper = await monter()

    expect(wrapper.findAll('button')).toHaveLength(1)
    // Rien n'est cherché avant d'avoir cliqué : la liste de l'accueil est intacte.
    expect(wrapper.find('input').exists()).toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })

  it('la loupe ouvre un champ de saisie', async () => {
    const wrapper = await monter()

    await bouton(wrapper).trigger('click')

    expect(wrapper.find('input').exists()).toBe(true)
    // Ouvrir n'est pas chercher : la liste ne doit pas bouger avant la première frappe.
    expect(replace).not.toHaveBeenCalled()
  })

  it("n'écrit que le nom et l'ouverture des éditions passées", async () => {
    const wrapper = await monter()
    await bouton(wrapper).trigger('click')

    await wrapper.find('input').setValue('Rennes')

    expect(replace).toHaveBeenLastCalledWith({
      query: { name: 'Rennes', showPast: 'true', sort: 'recent' },
    })
  })

  it('écarte les filtres déjà posés', async () => {
    const wrapper = await monter({
      query: {
        name: 'Paris',
        countries: '["France"]',
        startDate: '2026-01-01',
        hasGala: 'true',
        showFuture: 'false',
      },
    })
    await bouton(wrapper).trigger('click')

    await wrapper.find('input').setValue('Rennes')

    // Tout le reste a disparu de la query : c'est ce que « faire abstraction des autres filtres »
    // veut dire, et la page reprend ses valeurs par défaut pour tout ce qui n'y figure plus.
    expect(replace).toHaveBeenLastCalledWith({
      query: { name: 'Rennes', showPast: 'true', sort: 'recent' },
    })
  })

  it('conserve la vue en cours (grille, agenda, carte)', async () => {
    const wrapper = await monter({ query: { view: 'map' } })
    await bouton(wrapper).trigger('click')

    await wrapper.find('input').setValue('Rennes')

    expect(replace).toHaveBeenLastCalledWith({
      query: { view: 'map', name: 'Rennes', showPast: 'true', sort: 'recent' },
    })
  })

  it('reprend le nom déjà filtré à l’ouverture, sans rien changer', async () => {
    const wrapper = await monter({ query: { name: 'Rennes' } })

    await bouton(wrapper).trigger('click')

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('Rennes')
    expect(replace).not.toHaveBeenCalled()
  })

  it('un nom réduit à des espaces ne filtre rien', async () => {
    const wrapper = await monter()
    await bouton(wrapper).trigger('click')

    await wrapper.find('input').setValue('   ')

    expect(replace).toHaveBeenLastCalledWith({ query: {} })
  })

  it("refermer la loupe rend à l'accueil ses filtres par défaut", async () => {
    const wrapper = await monter({ query: { view: 'agenda' } })
    await bouton(wrapper).trigger('click')
    await wrapper.find('input').setValue('Rennes')
    replace.mockClear()

    await bouton(wrapper).trigger('click')

    expect(wrapper.find('input').exists()).toBe(false)
    expect(replace).toHaveBeenLastCalledWith({ query: { view: 'agenda' } })
  })

  it('ouvrir puis refermer sans rien taper laisse les filtres en place', async () => {
    const wrapper = await monter({ query: { countries: '["France"]' } })

    await bouton(wrapper).trigger('click')
    await bouton(wrapper).trigger('click')

    expect(wrapper.find('input').exists()).toBe(false)
    // Le point du garde-fou : ouvrir un champ ne doit pas coûter à l'utilisateur les filtres
    // qu'il avait posés.
    expect(replace).not.toHaveBeenCalled()
  })

  it("quitter l'accueil replie la loupe", async () => {
    const wrapper = await monter()
    await bouton(wrapper).trigger('click')
    await wrapper.find('input').setValue('Rennes')
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([true])

    routeCourante.valeur.path = '/editions/12'
    await nextTick()

    // Le point n'est pas cosmétique : `AppHeader` masque logo, langue et compte tant que le modèle
    // vaut vrai. Un composant qui disparaît sans se replier laisserait l'en-tête amputé sur toutes
    // les pages suivantes, sans rien à l'écran qui en donne la raison.
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('la touche Échap referme le champ', async () => {
    const wrapper = await monter()
    await bouton(wrapper).trigger('click')
    await wrapper.find('input').setValue('Rennes')
    replace.mockClear()

    await wrapper.find('input').trigger('keydown.escape')

    expect(wrapper.find('input').exists()).toBe(false)
    expect(replace).toHaveBeenLastCalledWith({ query: {} })
  })
})

/**
 * La variante du CENTRE, sur grand écran : le champ est là en permanence.
 *
 * Elle existe parce qu'une loupe seule ne dit pas ce qu'elle cherche. Ce qui change par rapport à
 * la loupe du mobile tient en trois points, et chacun se casserait sans bruit :
 *
 * 1. le champ s'affiche **sans qu'on ait cliqué** — c'est tout son propos ;
 * 2. il **reprend ce que l'URL porte déjà**, sans quoi il paraîtrait vide au-dessus de résultats
 *    filtrés, et l'on chercherait la cause du filtre ailleurs ;
 * 3. la croix **efface le filtre** au lieu de replier un champ qui ne se replie pas.
 *
 * Le contrat de la query, lui, est le même : il est déjà couvert plus haut, et ces tests ne le
 * redoublent pas — ils vérifient que cette variante l'emprunte bien.
 */
describe('Recherche du centre, sur grand écran', () => {
  const centre = { variante: 'centre' }

  it('affiche son champ sans qu’on ait cliqué', async () => {
    const wrapper = await monter({}, centre)

    expect(wrapper.find('input').exists()).toBe(true)
    // Aucune croix tant que rien n'est tapé : un champ vide n'a rien à effacer.
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('reprend le nom que l’URL porte déjà', async () => {
    // Le cas d'une adresse partagée ou d'un retour arrière du navigateur.
    const wrapper = await monter({ query: { name: 'balles perdues' } }, centre)

    expect(wrapper.find('input').element.value).toBe('balles perdues')
  })

  it('écrase les autres filtres, comme la loupe', async () => {
    const wrapper = await monter({ query: { countries: '["FR"]' } }, centre)

    await wrapper.find('input').setValue('rennes')
    await nextTick()

    expect(replace).toHaveBeenCalledWith({
      query: { name: 'rennes', showPast: 'true', sort: 'recent' },
    })
  })

  it('la croix efface le filtre plutôt que de replier le champ', async () => {
    const wrapper = await monter({ query: { name: 'rennes' } }, centre)

    // La croix n'apparaît que parce que le champ porte déjà un nom.
    const croix = wrapper.findAll('button')
    expect(croix).toHaveLength(1)
    await croix[0]!.trigger('click')
    await nextTick()

    // Le champ reste à l'écran : c'est la différence avec la loupe du mobile.
    expect(wrapper.find('input').exists()).toBe(true)
    expect(replace).toHaveBeenLastCalledWith({ query: {} })
  })

  it('ne s’affiche pas ailleurs que sur l’accueil', async () => {
    const wrapper = await monter({ path: '/editions/12' }, centre)

    expect(wrapper.find('input').exists()).toBe(false)
  })
})
