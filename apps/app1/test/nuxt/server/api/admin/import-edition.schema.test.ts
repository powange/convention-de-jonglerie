import { describe, it, expect } from 'vitest'

import { importSchema } from '../../../../../server/api/admin/import-edition.post'

// Payload minimal valide (uniquement les champs requis).
const validBase = () => ({
  convention: { name: 'Convention Test', email: 'contact@test.org' },
  edition: {
    startDate: '2025-07-15',
    endDate: '2025-07-20',
    addressLine1: '1 rue du Cirque',
    city: 'Paris',
    country: 'France',
    postalCode: '75001',
  },
})

describe('importSchema (import admin d’édition)', () => {
  it('accepte un payload minimal valide', () => {
    expect(importSchema.safeParse(validBase()).success).toBe(true)
  })

  it('accepte une édition SANS nom : chaîne vide', () => {
    const payload = validBase()
    ;(payload.edition as Record<string, unknown>).name = ''
    const res = importSchema.safeParse(payload)
    expect(res.success).toBe(true)
  })

  it('accepte une édition sans nom : null', () => {
    const payload = validBase()
    ;(payload.edition as Record<string, unknown>).name = null
    expect(importSchema.safeParse(payload).success).toBe(true)
  })

  it('accepte une édition sans nom : champ omis', () => {
    expect(importSchema.safeParse(validBase()).success).toBe(true)
  })

  it('accepte un nom d’édition non vide', () => {
    const payload = validBase()
    ;(payload.edition as Record<string, unknown>).name = 'CIJ 2025'
    expect(importSchema.safeParse(payload).success).toBe(true)
  })

  it('refuse un nom de convention vide (c’est le fallback d’affichage)', () => {
    const payload = validBase()
    payload.convention.name = ''
    const res = importSchema.safeParse(payload)
    expect(res.success).toBe(false)
  })

  it('refuse une date de début manquante (champ requis)', () => {
    const payload = validBase()
    delete (payload.edition as Record<string, unknown>).startDate
    expect(importSchema.safeParse(payload).success).toBe(false)
  })
})
