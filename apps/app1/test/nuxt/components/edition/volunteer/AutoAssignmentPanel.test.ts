import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach } from 'vitest'

import AutoAssignmentPanel from '../../../../../../layers/volunteers/app/components/edition/volunteer/AutoAssignmentPanel.vue'

/**
 * Le panneau compte une dizaine de curseurs : les perdre à chaque rechargement décourageait
 * d'ajuster. Ces tests portent sur ce qui est conservé, et sur ce qui reste propre à chaque
 * édition.
 */
const monter = (editionId = 1) =>
  mountSuspended(AutoAssignmentPanel, {
    props: { editionId, volunteers: [], timeSlots: [], teams: [] },
  })

const cle = (editionId: number) => `assignation-auto:${editionId}`

describe('AutoAssignmentPanel — mémoire des réglages', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('part des valeurs par défaut quand rien n’a été enregistré', async () => {
    const panneau = await monter()

    // La contrainte qui protège le travail des organisateurs est celle qui compte le plus.
    expect(JSON.parse(localStorage.getItem(cle(1)) ?? '{}').existingAssignmentsMode).toBe(
      'keep-manual'
    )
    expect(panneau.exists()).toBe(true)
  })

  it('affiche les réglages enregistrés plutôt que les valeurs par défaut', async () => {
    localStorage.setItem(cle(1), JSON.stringify({ maxHoursPerVolunteer: 3 }))

    const panneau = await monter()
    // Le contenu du panneau vit dans un repliable : il faut l'ouvrir pour voir les champs.
    await panneau.find('button').trigger('click')
    await panneau.vm.$nextTick()

    const valeurs = panneau
      .findAll('input')
      .map((champ) => (champ.element as HTMLInputElement).value)
    // 3 vient du réglage enregistré ; 8 serait la valeur par défaut.
    expect(valeurs).toContain('3')
    expect(valeurs).not.toContain('8')
  })

  // Sans cette complétion, un réglage enregistré avant l'ajout d'une option laisserait cette
  // option indéfinie — et l'algorithme la lirait comme désactivée, sans que rien ne le dise.
  it('complète un réglage enregistré avant l’ajout d’une option', async () => {
    localStorage.setItem(cle(1), JSON.stringify({ maxHoursPerVolunteer: 3 }))

    await monter()

    const enregistre = JSON.parse(localStorage.getItem(cle(1)) ?? '{}')
    expect(enregistre.maxHoursPerVolunteer).toBe(3)
    expect(enregistre.preserverAccesSpectacles).toBe(true)
    expect(enregistre.existingAssignmentsMode).toBe('keep-manual')
  })

  // Les contraintes d'un festival de trois jours ne sont pas celles d'une rencontre d'un week-end.
  it('garde les réglages de chaque édition séparés', async () => {
    localStorage.setItem(cle(1), JSON.stringify({ maxHoursPerVolunteer: 3 }))

    await monter(2)

    expect(JSON.parse(localStorage.getItem(cle(1)) ?? '{}').maxHoursPerVolunteer).toBe(3)
    expect(JSON.parse(localStorage.getItem(cle(2)) ?? '{}').maxHoursPerVolunteer).toBe(8)
  })
})
