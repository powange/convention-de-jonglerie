import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import MarkerModal from '../../../../app/components/edition/zones/MarkerModal.vue'

/**
 * Le rattachement d'un point de repère à une zone se posait mais ne se retirait plus.
 *
 * Le choix « aucune zone » portait la valeur `null`, que Nuxt UI lit comme « rien de
 * sélectionné » plutôt que comme une option : il figurait dans la liste sans jamais pouvoir
 * être retenu. Rien ne le signalait — la modale demande une session, et sa logique vit dans un
 * composant, hors de portée du lint comme du typecheck.
 *
 * Ce test monte la modale et regarde ce qu'elle émet, seul moyen de vérifier l'aller-retour
 * sans navigateur authentifié.
 */

const zones = [
  {
    id: 81,
    name: 'Gym',
    description: null,
    color: '#3b82f6',
    coordinates: [],
    zoneTypes: [],
    order: 0,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 82,
    name: 'Camping',
    description: null,
    color: '#10b981',
    coordinates: [],
    zoneTypes: [],
    order: 1,
    createdAt: '',
    updatedAt: '',
  },
] as never

const marker = (zoneId: number | null) =>
  ({
    id: 47,
    name: 'Acro Hall',
    description: null,
    latitude: 46.4,
    longitude: 15.8,
    markerTypes: ['OTHER'],
    color: '#3b82f6',
    order: 0,
    zoneId,
    createdAt: '',
    updatedAt: '',
  }) as never

async function saveWith(zoneId: number | null, select?: number) {
  const wrapper = await mountSuspended(MarkerModal, {
    props: { open: true, marker: marker(zoneId), zones },
  })
  if (select !== undefined) {
    // On agit sur le modèle plutôt que sur le menu déroulant : c'est la valeur retenue qui
    // compte, et elle ne doit jamais être `null` sous peine de redevenir insélectionnable.
    ;(wrapper.vm as unknown as { form: { zoneId: number } }).form.zoneId = select
  }
  ;(wrapper.vm as unknown as { handleSave: () => void }).handleSave()
  return wrapper.emitted('save')?.[0]?.[0] as { zoneId: number | null }
}

describe('MarkerModal — rattachement à une zone', () => {
  /**
   * Le cœur du défaut, et la seule assertion qui l'attrape : une option dont la valeur est
   * nullish n'est pas sélectionnable dans Nuxt UI, qui la lit comme « rien de sélectionné ».
   *
   * Vérifier le simple aller-retour du modèle ne suffit pas : la conversion était correcte, mais
   * l'option restait hors d'atteinte.
   */
  it('ne propose aucune option de valeur nulle', async () => {
    const wrapper = await mountSuspended(MarkerModal, {
      props: { open: true, marker: marker(81), zones },
    })
    const options = (
      wrapper.vm as unknown as { zoneOptions: Array<{ label: string; value: unknown }> }
    ).zoneOptions

    expect(options.length).toBe(3)
    for (const option of options) {
      expect(option.value, `« ${option.label} » n'est pas sélectionnable`).not.toBeNull()
      expect(option.value, `« ${option.label} » n'est pas sélectionnable`).not.toBeUndefined()
    }
  })

  it('conserve un rattachement existant', async () => {
    expect((await saveWith(81)).zoneId).toBe(81)
  })

  // Le cas signalé : sans valeur choisissable pour « aucune zone », le rattachement restait.
  it('retire le rattachement quand « aucune zone » est retenu', async () => {
    const { NO_ZONE } = await import('../../../../app/utils/map-zone-attachment')
    expect((await saveWith(81, NO_ZONE)).zoneId).toBeNull()
  })

  it('permet de changer de zone', async () => {
    expect((await saveWith(81, 82)).zoneId).toBe(82)
  })

  it('rend null pour un marqueur autonome', async () => {
    expect((await saveWith(null)).zoneId).toBeNull()
  })
})
