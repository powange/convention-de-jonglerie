import { describe, it, expect } from 'vitest'

import { useTimezones } from '../../../app/composables/useTimezones'

describe('useTimezones - getSelectMenuItems', () => {
  const { getSelectMenuItems } = useTimezones()

  it('retourne plusieurs groupes (labels) sans terme de recherche', () => {
    const items = getSelectMenuItems()
    const labels = items.filter((i) => (i as { type?: string }).type === 'label')
    expect(labels.length).toBeGreaterThan(1)
  })

  it('filtre par recherche et conserve « Europe/Paris » dans le groupe Europe', () => {
    const items = getSelectMenuItems('Paris')
    const options = items.filter((i) => !(i as { type?: string }).type)

    // Au moins une option, et Europe/Paris en fait partie
    expect(options.length).toBeGreaterThan(0)
    expect(options.some((o) => (o as { value?: string }).value === 'Europe/Paris')).toBe(true)

    // Le premier item est le label du groupe Europe (option pas désynchronisée)
    expect(items[0]).toMatchObject({ type: 'label', label: 'Europe' })
  })

  it('ne renvoie aucune catégorie vide : chaque label est suivi d’au moins une option', () => {
    const items = getSelectMenuItems('Paris')
    items.forEach((item, idx) => {
      if ((item as { type?: string }).type === 'label') {
        const next = items[idx + 1] as { type?: string } | undefined
        expect(next).toBeDefined()
        // l'item suivant un label doit être une option (sans `type`), pas un label/séparateur
        expect(next?.type).toBeUndefined()
      }
    })
  })

  it('recherche insensible à la casse', () => {
    const upper = getSelectMenuItems('PARIS')
    expect(upper.some((i) => (i as { value?: string }).value === 'Europe/Paris')).toBe(true)
  })

  it('renvoie une liste vide si aucun fuseau ne correspond', () => {
    const items = getSelectMenuItems('zzzzzzzz-aucune-ville')
    expect(items).toHaveLength(0)
  })
})
