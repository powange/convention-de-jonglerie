import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'

import { useNotificateur, messageDErreurServeur } from '../../../app/composables/useNotificateur'

/**
 * La forme commune des toasts : couleur et icône par type, écrites une seule fois.
 *
 * Ce que ces tests figent n'est pas une préférence esthétique : c'est la convention qui existait
 * DÉJÀ dans les faits — succès en vert avec `check-circle` (32 appels sur 98), erreur en rouge
 * avec `x-circle` (24) — et dont un tiers des appels s'écartait sans que personne ne le décide,
 * dont **32 sans aucune icône**.
 */
const toasts: { title?: string; description?: string; icon?: string; color?: string }[] = []
mockNuxtImport('useToast', () => () => ({
  add: (o: any) => {
    toasts.push({ title: o?.title, description: o?.description, icon: o?.icon, color: o?.color })
  },
}))

const monter = async () => {
  let expose: ReturnType<typeof useNotificateur> | undefined
  await mountSuspended(
    defineComponent({
      setup() {
        expose = useNotificateur()
        return () => h('div')
      },
    })
  )
  return expose!
}

beforeEach(() => {
  toasts.length = 0
})

describe('useNotificateur — une forme par type', () => {
  it('un succès est vert, avec la coche', async () => {
    const { succes } = await monter()

    succes('Créneau publié')

    expect(toasts.at(-1)).toEqual({
      title: 'Créneau publié',
      description: undefined,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  })

  it('une erreur est rouge, avec la croix', async () => {
    const { erreur } = await monter()

    erreur('Impossible de publier')

    expect(toasts.at(-1)?.color).toBe('error')
    expect(toasts.at(-1)?.icon).toBe('i-heroicons-x-circle')
  })

  it('un avertissement et une information ont chacun leur forme', async () => {
    const { avertir, info } = await monter()

    avertir('Aucun bénévole affecté')
    expect(toasts.at(-1)?.color).toBe('warning')
    expect(toasts.at(-1)?.icon).toBe('i-heroicons-exclamation-triangle')

    info('Le planning sera visible après publication')
    expect(toasts.at(-1)?.color).toBe('info')
    expect(toasts.at(-1)?.icon).toBe('i-heroicons-information-circle')
  })

  it('POSE TOUJOURS une icône, même quand l’appelant n’en demande aucune', async () => {
    /*
     * Le défaut le plus fréquent du relevé : 32 appels sur 98 n'avaient pas d'icône. Ce n'était
     * pas un choix — les autres en avaient une, et la même. Un toast sans icône est simplement
     * plus difficile à lire d'un coup d'œil, et rien ne le signalait.
     */
    const { succes, erreur, avertir, info } = await monter()

    succes('a')
    erreur('b')
    avertir('c')
    info('d')

    expect(toasts).toHaveLength(4)
    for (const t of toasts) expect(t.icon, `${t.title} sans icône`).toBeTruthy()
  })

  it('laisse remplacer l’icône quand elle porte un sens que le type ne dit pas', async () => {
    // Le seul cas du dépôt : l'étoile d'un responsable d'équipe.
    const { succes } = await monter()

    succes('Responsable ajouté', { icone: 'i-heroicons-star' })

    expect(toasts.at(-1)?.icon).toBe('i-heroicons-star')
    // La couleur, elle, reste celle du type : on remplace l'icône, pas la forme.
    expect(toasts.at(-1)?.color).toBe('success')
  })

  it('porte la description quand il y en a une', async () => {
    const { erreur } = await monter()

    erreur('Échec', { description: 'Le serveur a refusé la date' })

    expect(toasts.at(-1)?.description).toBe('Le serveur a refusé la date')
  })
})

describe('messageDErreurServeur', () => {
  it('extrait le message du serveur quand il y en a un', () => {
    expect(messageDErreurServeur({ data: { message: 'Édition introuvable' } })).toBe(
      'Édition introuvable'
    )
    expect(messageDErreurServeur({ statusMessage: 'Not Found' })).toBe('Not Found')
  })

  it('rend `undefined` plutôt qu’une chaîne vide quand il n’y en a pas', async () => {
    /*
     * ⚠️ `undefined` et non `''` : c'est ce qui permet à l'appelant d'écrire
     * `description: messageDErreurServeur(e)` sans produire une description vide — trois toasts
     * de /admin/error-logs en affichaient une, corrigé en septembre (#533).
     */
    expect(messageDErreurServeur({})).toBeUndefined()
    expect(messageDErreurServeur(null)).toBeUndefined()
    expect(messageDErreurServeur({ data: {} })).toBeUndefined()
    expect(messageDErreurServeur({ data: { message: '' } })).toBeUndefined()
  })
})
