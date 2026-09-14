import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import AutoAssignmentPanel from '../../../../../../layers/volunteers/app/components/edition/volunteer/AutoAssignmentPanel.vue'

/**
 * Le panneau compte une dizaine de curseurs, et il fallait bien les conserver quelque part : les
 * reperdre à chaque passage décourageait d'ajuster.
 *
 * Ils vivaient dans le `localStorage`, ce que ces tests vérifiaient jusqu'ici. Ils vivent
 * désormais sur l'édition : un organisateur retrouve les réglages de son collègue, et changer de
 * poste ne remet plus silencieusement le mode de conservation — celui qui décide de ce qui sera
 * détruit — à sa valeur par défaut.
 *
 * C'est donc ce que l'écran LIT qui est testé ici. Ce qu'il écrit ne le concerne plus : c'est le
 * serveur qui mémorise les contraintes au moment où il s'en sert.
 */
let reglagesRendus: Record<string, unknown> | null = null

registerEndpoint('/api/editions/1/volunteers/settings', () => ({
  autoAssignConstraints: reglagesRendus,
}))
registerEndpoint('/api/editions/2/volunteers/settings', () => ({
  autoAssignConstraints: null,
}))
registerEndpoint('/api/editions/1/volunteers/auto-assign/last-run', () => ({ lastRun: null }))
registerEndpoint('/api/editions/2/volunteers/auto-assign/last-run', () => ({ lastRun: null }))

/**
 * Les réglages arrivent par une requête lancée au montage : `mountSuspended` attend le `setup`,
 * pas ce qui se déclenche après, et `flushPromises` ne vide que les microtâches — un aller-retour
 * HTTP, même local, n'en est pas une. Sans cette attente, on observerait toujours les valeurs par
 * défaut, c'est-à-dire exactement ce que chaque test croirait vérifier.
 */
const monter = async (editionId = 1) => {
  const panneau = await mountSuspended(AutoAssignmentPanel, {
    props: { editionId, volunteers: [], timeSlots: [], teams: [] },
    global: {
      // `UTooltip` exige un `TooltipProvider`, que `UApp` fournit dans l'application mais qu'un
      // montage isolé n'a pas. Le remplacer par son contenu suffit : ce n'est pas l'infobulle que
      // ces tests observent.
      stubs: { UTooltip: { template: '<div><slot /></div>' } },
    },
  })

  // La sentinelle est le mode de conservation : il n'a pas de valeur par défaut en commun avec
  // ce que rendent les points d'entrée simulés, donc son arrivée prouve que la réponse a été lue.
  await vi.waitFor(() => {
    expect((panneau.vm as any).reglagesCharges).toBe(true)
  })
  await flushPromises()
  return panneau
}

/** Les valeurs des champs numériques, une fois le repliable ouvert. */
const valeursAffichees = async (panneau: Awaited<ReturnType<typeof monter>>) => {
  await panneau.find('button').trigger('click')
  await panneau.vm.$nextTick()
  return panneau.findAll('input').map((champ) => (champ.element as HTMLInputElement).value)
}

describe('AutoAssignmentPanel — réglages portés par l’édition', () => {
  beforeEach(() => {
    reglagesRendus = null
  })

  it('part des valeurs par défaut quand l’édition n’a jamais été réglée', async () => {
    const panneau = await monter()

    // La contrainte qui protège le travail des organisateurs est celle qui compte le plus.
    expect((panneau.vm as any).constraints.existingAssignmentsMode).toBe('keep-manual')
    expect(await valeursAffichees(panneau)).toContain('8')
  })

  it('affiche les réglages de l’édition plutôt que les valeurs par défaut', async () => {
    reglagesRendus = { maxHoursPerVolunteer: 3 }

    const panneau = await monter()
    const valeurs = await valeursAffichees(panneau)

    // 3 vient des réglages de l'édition ; 8 serait la valeur par défaut.
    expect(valeurs).toContain('3')
    expect(valeurs).not.toContain('8')
  })

  // Sans cette complétion, un réglage enregistré avant l'ajout d'une option laisserait cette
  // option indéfinie — et l'algorithme la lirait comme désactivée, sans que rien ne le dise.
  it('complète un réglage enregistré avant l’ajout d’une option', async () => {
    reglagesRendus = { maxHoursPerVolunteer: 3 }

    const panneau = await monter()

    expect((panneau.vm as any).constraints.maxHoursPerVolunteer).toBe(3)
    expect((panneau.vm as any).constraints.preserverAccesSpectacles).toBe(true)
    expect((panneau.vm as any).constraints.existingAssignmentsMode).toBe('keep-manual')
  })

  // Les contraintes d'un festival de trois jours ne sont pas celles d'une rencontre d'un week-end.
  it('garde les réglages de chaque édition séparés', async () => {
    reglagesRendus = { maxHoursPerVolunteer: 3 }

    const autreEdition = await monter(2)

    expect((autreEdition.vm as any).constraints.maxHoursPerVolunteer).toBe(8)
  })
})
