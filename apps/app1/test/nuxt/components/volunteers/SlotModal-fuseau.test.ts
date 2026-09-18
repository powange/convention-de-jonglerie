import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'

import SlotModal from '../../../../../../layers/volunteers/app/components/edition/volunteer/planning/SlotModal.vue'

/**
 * Ce que l'organisateur saisit est une heure de LIEU.
 *
 * La modale convertissait la saisie avec le fuseau du NAVIGATEUR : « 14 h » tapé depuis Tokyo
 * n'enregistrait pas le même instant que « 14 h » tapé depuis Paris, pour un créneau censé être
 * le même. Pire, rouvrir une modale puis enregistrer sans rien changer suffisait à déplacer un
 * créneau existant, puisque l'aller et le retour n'utilisaient pas le même ancrage.
 *
 * Ces tests posent un fuseau de navigateur volontairement différent de celui de l'édition —
 * c'est la seule configuration où le défaut se voit. Ils tiennent l'INSTANT émis, seule chose
 * qui parte réellement vers la base.
 */
const EQUIPES = [{ id: 'accueil', name: 'Accueil', color: '#3b82f6' }]

let monte: { unmount: () => void } | null = null
afterEach(() => {
  monte?.unmount()
  monte = null
})

const monter = async (fuseau: string | null, creneau: Record<string, unknown>) => {
  const wrapper = await mountSuspended(SlotModal, {
    props: {
      modelValue: true,
      teams: EQUIPES,
      editionId: 22,
      fuseau,
      initialSlot: creneau,
    },
  })
  monte = wrapper
  return wrapper
}

/** Déclenche l'enregistrement sans passer par le DOM de la modale, téléporté hors du composant. */
const enregistrer = async (wrapper: Awaited<ReturnType<typeof monter>>) => {
  const form = wrapper.findComponent({ name: 'UForm' })
  await form.vm.$emit('submit')
  await new Promise((resoudre) => setTimeout(resoudre, 0))
  return wrapper.emitted('save')?.[0]?.[0] as { start: string; end: string } | undefined
}

describe('SlotModal — la saisie est ancrée au fuseau de l’édition', () => {
  it('enregistre 14 h de Paris, quel que soit le fuseau de qui saisit', async () => {
    const wrapper = await monter('Europe/Paris', {
      title: 'Accueil',
      teamId: 'accueil',
      startDateTime: '2026-09-25T14:00',
      endDateTime: '2026-09-25T16:00',
      maxVolunteers: 3,
    })

    const envoye = await enregistrer(wrapper)

    // Le 25 septembre, Paris est à UTC+2 : 14 h sur place, c'est 12 h UTC.
    expect(envoye?.start).toBe('2026-09-25T12:00:00.000Z')
    expect(envoye?.end).toBe('2026-09-25T14:00:00.000Z')
  })

  it("n'enregistre rien quand le fuseau annoncé est inconnu", async () => {
    // Retomber sur la machine écrirait un instant faux, et une donnée fausse en base survit bien
    // plus longtemps qu'un refus. C'est la seule fonction stricte du module de fuseau.
    const wrapper = await monter('Europe/Pariss', {
      title: 'Accueil',
      teamId: 'accueil',
      startDateTime: '2026-09-25T14:00',
      endDateTime: '2026-09-25T16:00',
      maxVolunteers: 3,
    })

    expect(await enregistrer(wrapper)).toBeUndefined()
  })
})
