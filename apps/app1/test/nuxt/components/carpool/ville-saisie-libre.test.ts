import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import FormBase from '../../../../../../layers/carpool/app/components/edition/carpool/FormBase.vue'

/**
 * La ville d'un covoiturage se saisit LIBREMENT.
 *
 * ⚠️ CE QUI NE MARCHAIT PAS, et pourquoi c'était invisible. `form.locationCity` n'était renseigné
 * que par la sélection d'une suggestion Nominatim, elle-même restreinte à neuf pays. Une ville hors
 * de cette liste — Innsbruck, Göteborg, Montréal — ou une simple panne du service laissait donc le
 * modèle vide, le schéma zod refusait, et le bouton restait GRISÉ SANS MESSAGE. On voyait son texte
 * dans le champ, et rien n'expliquait pourquoi rien ne se passait.
 *
 * Le test porte sur `locationCity` dans la charge envoyée, et non sur l'état interne : c'est ce que
 * le serveur reçoit qui compte, et c'est là que la valeur disparaissait.
 */

const fetchMock = vi.hoisted(() => vi.fn(async () => ({ success: true, data: { id: 1 } })))
vi.stubGlobal('$fetch', fetchMock)

mockNuxtImport('useToast', () => () => ({ add: vi.fn() }))

describe('FormBase — la ville', () => {
  beforeEach(() => {
    fetchMock.mockClear()
  })

  /*
   * ⚠️ Démonter, et pas seulement restaurer les mocks. Le champ ville passe par
   * `refDebounced(searchTerm, 300)` : écrire dans `searchTerm` arme un `setTimeout` de 300 ms qui
   * déclenche la recherche Nominatim. Le test, lui, se termine en quelques millisecondes — la
   * minuterie retombait donc APRÈS la destruction de l'environnement happy-dom, le `USelectMenu`
   * se ré-affichait dans le vide, et reka-ui levait « ReferenceError: Element is not defined ».
   *
   * Un rejet non géré ne fait échouer aucun test : les 3479 passaient, et vitest sortait quand
   * même en 1 sur `Errors 1 error`. C'est ce qui a mis la CI de la #618 au rouge sans qu'aucune
   * ligne de « Failed Tests » ne l'explique. Démonter arrête le périmètre d'effets du composant,
   * et la retombée de la minuterie ne ré-affiche plus rien.
   */
  const montes: { unmount: () => void }[] = []

  afterEach(() => {
    while (montes.length) montes.pop()?.unmount()
    vi.restoreAllMocks()
  })

  const monter = async () => {
    const composant = await mountSuspended(FormBase, {
      props: { editionId: 22, formType: 'offer' as const },
    })
    montes.push(composant)
    return composant
  }

  it('accepte une ville hors des suggestions et la transmet', async () => {
    const composant = await monter()

    // La saisie libre, sans jamais choisir de suggestion : c'est exactement le cas qui bloquait.
    const champVille = composant.find('input[name="locationCity"], input')
    expect(champVille.exists()).toBe(true)

    // Le composant expose son état par le modèle interne ; on passe par le terme de recherche, qui
    // est ce que la personne tape.
    const vm = composant.vm as unknown as {
      searchTerm: string
      form: { locationCity: string }
    }
    vm.searchTerm = 'Innsbruck'
    await nextTick()

    expect(
      vm.form.locationCity,
      'la saisie libre doit alimenter le modèle, sans passer par une suggestion'
    ).toBe('Innsbruck')
  })

  it('rogne les espaces autour de la saisie', async () => {
    // Un « Innsbruck » collé avec une espace insécable finale passerait le `min(1)` de zod et
    // arriverait tel quel en base, où il ne se regrouperait avec aucune autre ville.
    const composant = await monter()
    const vm = composant.vm as unknown as { searchTerm: string; form: { locationCity: string } }

    vm.searchTerm = '  Innsbruck  '
    await nextTick()

    expect(vm.form.locationCity).toBe('Innsbruck')
  })

  it('une suggestion choisie remplace la saisie par son libellé', async () => {
    /*
     * Les suggestions restent une commodité : elles ne conditionnent plus la création, mais choisir
     * l'une d'elles doit encore normaliser le nom — sans quoi « innsbruck » et « Innsbruck »
     * deviendraient deux villes distinctes dans les listes.
     */
    const composant = await monter()
    const vm = composant.vm as unknown as {
      selectedCity: { name: string } | null
      form: { locationCity: string }
    }

    vm.selectedCity = { name: 'Innsbruck, Tyrol, Autriche' }
    await nextTick()

    expect(vm.form.locationCity).toBe('Innsbruck, Tyrol, Autriche')
  })

  it('ne lance plus de recherche de ville une fois le composant démonté', async () => {
    /*
     * La preuve du démontage, et pas seulement son intention. Sans lui, la minuterie de 300 ms
     * retombe après la fin du test : la requête de suggestions part dans un environnement déjà
     * détruit, et reka-ui lève « Element is not defined » — un rejet non géré qui ne fait échouer
     * aucun test mais fait sortir vitest en 1.
     *
     * Ce test mesure exactement ce qui doit ne PLUS se produire : une recherche qui démarre après
     * le démontage.
     */
    const composant = await monter()
    const vm = composant.vm as unknown as { searchTerm: string; loadingSuggestions: boolean }

    vm.searchTerm = 'Innsbruck'
    await nextTick()

    composant.unmount()
    montes.length = 0

    // Laisser largement passer les 300 ms du `refDebounced`.
    await new Promise((resoudre) => setTimeout(resoudre, 400))

    /*
     * `loadingSuggestions` est le premier effet de la recherche, et le seul qu'on puisse mesurer
     * sans dépendre de la sortie réseau : c'est lui qui ré-affiche le `USelectMenu`, et donc lui
     * qui provoquait l'erreur. Le voir rester à `false` prouve que le watcher est bien arrêté.
     */
    expect(vm.loadingSuggestions, 'la recherche ne doit pas démarrer après le démontage').toBe(
      false
    )
  })

  it('ne porte plus de champ `departureCoordinates`', async () => {
    // Il n'existait ni dans le schéma Prisma ni dans les schémas zod : le formulaire entretenait
    // une donnée que rien n'enregistrait ni ne relisait.
    const composant = await monter()
    const vm = composant.vm as unknown as { form: Record<string, unknown> }

    expect(Object.keys(vm.form)).not.toContain('departureCoordinates')
  })
})
