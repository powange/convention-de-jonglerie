import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import CarteRepliable from '../../../../../../layers/volunteers/app/components/edition/volunteer/CarteRepliable.vue'

/**
 * La carte repliable de la page publique de bénévolat, et son état d'ouverture par défaut.
 *
 * Sur la page, la carte « Bénévolat » s'ouvre d'emblée pour qui n'a pas encore candidaté : elle
 * porte le bouton de candidature et la présentation du bénévolat, c'est-à-dire tout ce qu'un nouveau
 * venu vient lire. Le défaut vaut donc `!myApplication`.
 *
 * Le piège, et l'objet principal de ces tests : `myApplication` n'est connue qu'APRÈS le montage —
 * elle dépend de la session, chargée en retard par le plugin client. Un composant qui lirait son
 * défaut une seule fois à l'initialisation ouvrirait donc la carte pour TOUT LE MONDE, puisqu'au
 * moment du calcul personne n'a encore de candidature. Le défaut est suivi, mais plus jamais une
 * fois que l'utilisateur y a touché.
 *
 * ⚠️ `useMediaQuery` rend `true` dans cet environnement — le `matchMedia` simulé répond « oui » à
 * `(min-width: 640px)`. Sans le mock ci-dessous, la carte ne serait donc JAMAIS repliable et quatre
 * de ces tests mesureraient l'écran de bureau en croyant décrire le mobile. Mesuré, pas supposé :
 * c'est l'inverse de ce que ce commentaire affirmait d'abord.
 */

// On force le petit écran : c'est le seul cas où le repli existe.
vi.mock('@vueuse/core', async (originale) => ({
  ...(await originale<typeof import('@vueuse/core')>()),
  useMediaQuery: () => ref(false),
}))

const monter = async (deplieParDefaut: boolean) =>
  mountSuspended(CarteRepliable, {
    props: {
      titre: 'Bénévolat',
      icone: 'i-heroicons-hand-raised',
      repliableSurMobile: true,
      deplieParDefaut,
    },
    slots: { default: () => 'Contenu de la carte' },
  })

/**
 * `v-show` masque par `display: none` : le contenu reste dans le DOM, caché.
 *
 * On vise le corps par `[data-slot="body"]`, et non par sa classe : l'EN-TÊTE de `UCard` porte lui
 * aussi `p-4`, si bien qu'un `find('div.p-4')` renvoyait l'en-tête — jamais masqué — et trois de ces
 * tests annonçaient « ouverte » quoi qu'il arrive.
 */
const corpsVisible = (composant: any) => {
  const corps = composant.find('[data-slot="body"] > div')
  if (!corps.exists()) return false
  return !(corps.attributes('style') ?? '').includes('display: none')
}

describe('CarteRepliable — ouverture par défaut', () => {
  it('s’ouvre quand le défaut est vrai', async () => {
    const composant = await monter(true)

    expect(corpsVisible(composant)).toBe(true)
  })

  it('reste fermée quand le défaut est faux', async () => {
    const composant = await monter(false)

    expect(corpsVisible(composant)).toBe(false)
  })

  it('suit un défaut qui devient vrai APRÈS le montage', async () => {
    /*
     * Le cas réel inverse : la page monte avec `!myApplication` encore indéterminé. Ce test couvre
     * le sens « s'ouvre plus tard », le suivant couvre « se referme plus tard » — c'est celui-là qui
     * était cassé avant le correctif.
     */
    const composant = await monter(false)
    expect(corpsVisible(composant)).toBe(false)

    await composant.setProps({ deplieParDefaut: true })
    await nextTick()

    expect(corpsVisible(composant)).toBe(true)
  })

  it('se referme quand la candidature arrive et démentit le défaut', async () => {
    /*
     * LE test qui compte. Au montage, `myApplication` est `null` — la session n'est pas encore
     * chargée — donc le défaut vaut « ouverte ». Quand la candidature arrive, il passe à « fermée »
     * et la carte doit suivre, sans quoi elle resterait ouverte pour tous les bénévoles déjà
     * inscrits : l'inverse de ce qui a été demandé.
     */
    const composant = await monter(true)
    expect(corpsVisible(composant)).toBe(true)

    await composant.setProps({ deplieParDefaut: false })
    await nextTick()

    expect(corpsVisible(composant)).toBe(false)
  })

  it('cesse de suivre le défaut dès que l’utilisateur a touché la carte', async () => {
    /*
     * La contrepartie indispensable du suivi : rien ne doit refermer sous les yeux de quelqu'un une
     * carte qu'il vient d'ouvrir. La donnée arrive en retard, parfois plusieurs secondes après le
     * premier rendu — largement de quoi qu'il ait déjà appuyé.
     */
    const composant = await monter(false)

    await composant.find('button').trigger('click')
    await nextTick()
    expect(corpsVisible(composant)).toBe(true)

    // La candidature arrive et voudrait refermer : le geste de l'utilisateur l'emporte.
    await composant.setProps({ deplieParDefaut: false })
    await nextTick()

    expect(corpsVisible(composant)).toBe(true)
  })

  it('reste entière quand elle n’est pas repliable, quel que soit le défaut', async () => {
    // `repliableSurMobile: false` : la carte n'a pas de commande de repli et son corps est toujours
    // montré, y compris sur petit écran.
    const composant = await mountSuspended(CarteRepliable, {
      props: {
        titre: 'Bénévolat',
        icone: 'i-heroicons-hand-raised',
        repliableSurMobile: false,
        deplieParDefaut: false,
      },
      slots: { default: () => 'Contenu de la carte' },
    })

    expect(corpsVisible(composant)).toBe(true)
    expect(composant.find('button').exists()).toBe(false)
  })
})
