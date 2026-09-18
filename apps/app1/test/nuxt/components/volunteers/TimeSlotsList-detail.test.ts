import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'

import TimeSlotsList from '../../../../../../layers/volunteers/app/components/volunteers/TimeSlotsList.vue'

/**
 * La consigne d'un poste — « se présenter au point B », « prévoir des gants » — n'atteignait
 * jamais le bénévole dans sa liste de créneaux : le composant avait le balisage pour l'afficher,
 * mais aucun des points d'API ne renvoyait le champ.
 *
 * Elle ne s'affiche pas pour autant dans la liste, qui doit rester lisible d'un coup d'œil :
 * cliquer un créneau ouvre son détail. Ces tests tiennent les deux moitiés de cette règle.
 */
const CRENEAU = {
  id: 'creneau-1',
  title: 'Accueil du matin',
  description: 'Se présenter au point B, prévoir des gants',
  startDateTime: '2026-10-02T12:00:00.000Z',
  endDateTime: '2026-10-02T14:00:00.000Z',
  delayMinutes: null,
  team: { id: 'accueil', name: 'Accueil', color: '#3b82f6' },
}

let monte: { unmount: () => void } | null = null
afterEach(() => {
  monte?.unmount()
  monte = null
})

const monter = async () => {
  const wrapper = await mountSuspended(TimeSlotsList, {
    props: { timeSlots: [CRENEAU], fuseau: 'Europe/Paris', ouvrable: true },
  })
  monte = wrapper
  return wrapper
}

describe('TimeSlotsList — le détail d’un créneau', () => {
  it('n’affiche PAS la consigne dans la liste', async () => {
    // La liste doit rester lisible d'un coup d'œil : la consigne du poste est à un clic, pas
    // étalée sous chaque créneau.
    const wrapper = await monter()

    expect(wrapper.text()).toContain('Accueil du matin')
    expect(wrapper.text()).not.toContain('prévoir des gants')
  })

  it('signale le créneau cliqué, sans décider de ce qui s’ouvre', async () => {
    // C'est l'écran qui ouvre la modale, avec les créneaux COMPLETS du planning : héberger ici
    // une modale nourrie des seules données de la liste en fabriquerait une seconde, plus pauvre
    // que celle qu'on obtient en cliquant la frise.
    const wrapper = await monter()

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('ouvrir')?.[0]?.[0]).toMatchObject({ id: 'creneau-1' })
  })

  it('reste inerte là où personne n’écoute', async () => {
    // Une carte qui réagit au clic sans rien ouvrir est pire qu'une carte inerte.
    const wrapper = await mountSuspended(TimeSlotsList, {
      props: { timeSlots: [CRENEAU], fuseau: 'Europe/Paris' },
    })
    monte = wrapper

    expect(wrapper.find('button').exists()).toBe(false)
  })
})

/**
 * Un fond uniformément bleu faisait se ressembler toutes les équipes. La bordure gauche reprend
 * le traitement de la liste des créneaux d'un bénévole côté gestion : la couleur situe le
 * créneau avant même qu'on lise le nom de l'équipe.
 */
describe('TimeSlotsList — la couleur de l’équipe', () => {
  it('borde le créneau de la couleur de son équipe', async () => {
    const wrapper = await monter()

    expect(wrapper.find('button').attributes('style')).toContain('#3b82f6')
  })

  it('retombe sur un gris neutre quand le créneau n’a pas d’équipe', async () => {
    // Sans ce repli, un créneau sans équipe emprunterait la couleur du précédent.
    const wrapper = await mountSuspended(TimeSlotsList, {
      props: {
        timeSlots: [{ ...CRENEAU, team: undefined }],
        fuseau: 'Europe/Paris',
        ouvrable: true,
      },
    })
    monte = wrapper

    const style = wrapper.find('button').attributes('style') ?? ''
    expect(style).not.toContain('#3b82f6')
    expect(style.toLowerCase()).toContain('border-left-color')
  })
})
