import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import { useVolunteerSettings } from '../../../../../layers/volunteers/app/composables/useVolunteerSettings'

/**
 * `updateSettings` lisait `response.settings` alors que l'endpoint répond
 * `{ success, data: { settings } }` : il rendait donc toujours `undefined`.
 *
 * Sans conséquence visible sur la page de configuration — les interrupteurs sont en `v-model`
 * et s'affichent d'eux-mêmes —, mais tous ses appelants gardent ce retour derrière un `if` :
 * ni les toasts, ni le rafraîchissement de l'édition dans le store ne se déclenchaient. D'où
 * une colonne « Équipes » qui survivait à la fermeture de l'option qui la commande.
 */

const REGLAGES = { open: true, mode: 'INTERNAL', organizersInTeams: false }

registerEndpoint('/api/editions/22/volunteers/settings', {
  method: 'PATCH',
  handler: () => ({ success: true, data: { settings: REGLAGES } }),
})

// Le serveur répond ainsi quand le corps du PATCH ne changeait rien.
registerEndpoint('/api/editions/23/volunteers/settings', {
  method: 'PATCH',
  handler: () => ({ success: true, data: { unchanged: true } }),
})

describe('useVolunteerSettings.updateSettings', () => {
  it('rend les réglages enregistrés', async () => {
    const { updateSettings } = useVolunteerSettings(22)

    await expect(updateSettings({ organizersInTeams: false } as never)).resolves.toEqual(REGLAGES)
  })

  it("expose les réglages reçus, et pas seulement l'état local", async () => {
    const { updateSettings, settings } = useVolunteerSettings(22)
    await updateSettings({ organizersInTeams: false } as never)

    expect(settings.value).toEqual(REGLAGES)
  })

  it("ne rend rien quand le serveur dit n'avoir rien changé", async () => {
    const { updateSettings } = useVolunteerSettings(23)

    await expect(updateSettings({} as never)).resolves.toBeUndefined()
  })
})
