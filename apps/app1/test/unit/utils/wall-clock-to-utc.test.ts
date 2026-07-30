import { describe, expect, it } from 'vitest'

import { wallClockToUtcIso } from '../../../app/utils/date'

/**
 * Le cas d'origine : sur `/editions/:id/gestion/ai-update`, une date déjà correcte était
 * proposée en remplacement d'elle-même, décalée de deux heures. L'ancien calcul retranchait un
 * décalage que `new Date()` avait déjà appliqué.
 */
describe('wallClockToUtcIso', () => {
  it('lit une heure murale dans le fuseau de l’édition', () => {
    // 01:00 à Paris en septembre (UTC+2) = 23:00 UTC la veille.
    expect(wallClockToUtcIso('2026-09-08T01:00', 'Europe/Paris')).toBe('2026-09-07T23:00:00.000Z')
  })

  // Le fuseau du navigateur ne doit jouer aucun rôle : c'est toute la raison d'être de cette
  // fonction. Une même heure murale lue dans deux fuseaux donne deux instants distincts.
  it('ne dépend que du fuseau demandé', () => {
    expect(wallClockToUtcIso('2026-09-08T01:00', 'UTC')).toBe('2026-09-08T01:00:00.000Z')
    expect(wallClockToUtcIso('2026-09-08T01:00', 'America/New_York')).toBe(
      '2026-09-08T05:00:00.000Z'
    )
  })

  // Le décalage doit être celui en vigueur à cette date-là, pas celui d'aujourd'hui.
  it('applique l’heure d’été de la date concernée', () => {
    // Paris : UTC+1 en janvier, UTC+2 en juillet.
    expect(wallClockToUtcIso('2026-01-15T12:00', 'Europe/Paris')).toBe('2026-01-15T11:00:00.000Z')
    expect(wallClockToUtcIso('2026-07-15T12:00', 'Europe/Paris')).toBe('2026-07-15T10:00:00.000Z')
  })

  // Une date déjà absolue ne doit pas être relue dans un fuseau : elle s'en trouverait décalée.
  it('laisse une date déjà absolue telle quelle', () => {
    expect(wallClockToUtcIso('2026-09-07T23:00:00.000Z', 'Europe/Paris')).toBe(
      '2026-09-07T23:00:00.000Z'
    )
    expect(wallClockToUtcIso('2026-09-08T01:00:00+02:00', 'America/New_York')).toBe(
      '2026-09-07T23:00:00.000Z'
    )
  })

  it('accepte une date sans heure', () => {
    expect(wallClockToUtcIso('2026-09-08', 'Europe/Paris')).toBe('2026-09-07T22:00:00.000Z')
  })

  // Rendre `null` plutôt qu'une date de repli : une valeur inventée se propagerait en base.
  it('rend null sur une entrée illisible', () => {
    expect(wallClockToUtcIso('pas une date', 'Europe/Paris')).toBeNull()
    expect(wallClockToUtcIso('', 'Europe/Paris')).toBeNull()
    expect(wallClockToUtcIso('2026-09-08T01:00', 'Pas/UnFuseau')).toBeNull()
  })
})
