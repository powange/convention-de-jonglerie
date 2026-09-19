import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, beforeEach } from 'vitest'
import { ref } from 'vue'

import { useVolunteerTimeSlots } from '../../../../../layers/volunteers/app/composables/useVolunteerTimeSlots'

/**
 * Le composable s'auto-appelle au montage, et aucun `v-if` ne peut l'en empêcher : le `setup`
 * s'exécute pour tout visiteur. La page publique de bénévolat lui passait l'identifiant d'édition
 * sans condition, si bien qu'un visiteur connecté n'ayant jamais candidaté déclenchait un
 * `GET /api/editions/<id>/volunteer-time-slots` auquel l'API répond 403. Invisible à l'écran — le
 * rejet est absorbé pour ne pas figer l'hydratation —, mais consigné dans les logs de production.
 *
 * Le contrat vérifié ici est celui qui rend la garde possible : un identifiant absent ne demande
 * RIEN, et la requête part d'elle-même dès qu'il apparaît.
 */

let appels = 0

registerEndpoint('/api/editions/21/volunteer-time-slots', {
  method: 'GET',
  handler: () => {
    appels += 1
    return []
  },
})

/** Laisser passer le `watch` (flush « pre ») puis le `$fetch` qu'il déclenche. */
const laisserPasser = async () => {
  for (let tour = 0; tour < 5; tour += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('useVolunteerTimeSlots : ce que déclenche le montage', () => {
  beforeEach(() => {
    appels = 0
  })

  it('ne demande rien quand aucune édition ne lui est donnée', async () => {
    // C'est ce cas qui permet à la page de garder l'appel derrière un droit : elle rend
    // `undefined` tant que la personne n'a pas de quoi consommer le planning.
    useVolunteerTimeSlots(() => undefined)
    await laisserPasser()

    expect(appels).toBe(0)
  })

  it('demande les créneaux une fois quand une édition lui est donnée', async () => {
    useVolunteerTimeSlots(() => 21)
    await laisserPasser()

    expect(appels).toBe(1)
  })

  it('attend que le droit soit établi, puis demande de lui-même', async () => {
    // La candidature n'est connue qu'après un chargement : rien ne doit partir au premier rendu,
    // et la requête doit partir seule ensuite — sans que la page ait à la relancer.
    const edition = ref<number | undefined>(undefined)
    useVolunteerTimeSlots(edition)
    await laisserPasser()
    expect(appels).toBe(0)

    edition.value = 21
    await laisserPasser()

    expect(appels).toBe(1)
  })

  it('expose les créneaux reçus', async () => {
    const { timeSlots } = useVolunteerTimeSlots(() => 21)
    await laisserPasser()

    expect(timeSlots.value).toEqual([])
  })
})
