import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getBccRecipients } from '../../../server/utils/email-bcc'

const BLOCKED = ['example.com', 'example.fr']

describe('getBccRecipients', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renvoie une liste vide quand aucune copie n’est configurée', () => {
    expect(getBccRecipients('')).toEqual([])
    expect(getBccRecipients('   ')).toEqual([])
  })

  it('accepte une adresse unique', () => {
    expect(getBccRecipients('archive@mondomaine.fr')).toEqual(['archive@mondomaine.fr'])
  })

  it('accepte plusieurs adresses séparées par des virgules, espaces compris', () => {
    expect(getBccRecipients('a@mondomaine.fr, b@mondomaine.fr ,c@mondomaine.fr')).toEqual([
      'a@mondomaine.fr',
      'b@mondomaine.fr',
      'c@mondomaine.fr',
    ])
  })

  // Le serveur SMTP rejetterait ces adresses au RCPT TO sans faire échouer l'envoi :
  // l'archivage échouerait alors en silence. On les écarte tôt, avec un log.
  it('écarte les adresses mal formées sans perdre les valides', () => {
    expect(getBccRecipients('archive@mondomaine.fr,pas-une-adresse')).toEqual([
      'archive@mondomaine.fr',
    ])
    expect(getBccRecipients('archive@,valide@mondomaine.fr')).toEqual(['valide@mondomaine.fr'])
  })

  it('renvoie une liste vide si toutes les adresses sont invalides', () => {
    expect(getBccRecipients('archive@,pas-une-adresse')).toEqual([])
  })

  it('signale les adresses écartées dans les logs', () => {
    getBccRecipients('valide@mondomaine.fr,cassee@')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('cassee@'))
  })

  // Même garde-fou que pour le destinataire réel : pas de RCPT TO vers un domaine de test
  it('écarte les domaines bloqués', () => {
    expect(getBccRecipients('archive@example.com', BLOCKED)).toEqual([])
    expect(getBccRecipients('archive@EXAMPLE.COM', BLOCKED)).toEqual([])
    expect(getBccRecipients('archive@example.com,vrai@mondomaine.fr', BLOCKED)).toEqual([
      'vrai@mondomaine.fr',
    ])
  })

  it('ne bloque aucun domaine quand la liste est vide', () => {
    expect(getBccRecipients('archive@example.com')).toEqual(['archive@example.com'])
  })

  // Un doublon consommerait un destinataire de plus à chaque envoi
  it('dédoublonne, sans tenir compte de la casse', () => {
    expect(getBccRecipients('a@mondomaine.fr,a@mondomaine.fr')).toEqual(['a@mondomaine.fr'])
    expect(getBccRecipients('a@mondomaine.fr, A@Mondomaine.FR')).toEqual(['a@mondomaine.fr'])
  })

  it('préserve l’ordre de configuration', () => {
    expect(getBccRecipients('z@mondomaine.fr,a@mondomaine.fr')).toEqual([
      'z@mondomaine.fr',
      'a@mondomaine.fr',
    ])
  })
})
