import { describe, expect, it } from 'vitest'

import {
  DELAI_MODIFICATION_MESSAGE_MINUTES,
  messageEncoreModifiable,
} from '../../../shared/utils/message-modifiable'

/**
 * Le délai pendant lequel l'auteur d'un message peut encore le modifier. L'écran et le serveur
 * appliquent cette même règle.
 */
describe('messageEncoreModifiable', () => {
  const envoi = new Date('2026-09-29T10:00:00Z')
  const apres = (minutes: number) => new Date(envoi.getTime() + minutes * 60 * 1000)

  it('le délai est de 15 minutes', () => {
    expect(DELAI_MODIFICATION_MESSAGE_MINUTES).toBe(15)
  })

  it('autorise juste après l’envoi et juste avant l’échéance', () => {
    expect(messageEncoreModifiable(envoi, envoi)).toBe(true)
    expect(messageEncoreModifiable(envoi, apres(14.9))).toBe(true)
  })

  it('refuse à l’échéance et au-delà', () => {
    expect(messageEncoreModifiable(envoi, apres(15))).toBe(false)
    expect(messageEncoreModifiable(envoi, apres(60 * 24))).toBe(false)
  })

  it('accepte une date sérialisée, telle que l’API la renvoie', () => {
    expect(messageEncoreModifiable(envoi.toISOString(), apres(5))).toBe(true)
  })
})
