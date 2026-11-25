import { describe, it, expect } from 'vitest'

import {
  cheminDuFormulaire,
  normaliserTypeFormulaire,
} from '../../../server/utils/editions/ticketing/helloasso'
import { buildHelloAssoUrl, normaliserTypeHelloAsso, parseHelloAssoUrl } from '~/utils/helloasso'

/**
 * Les types de formulaire envoyés à HelloAsso.
 *
 * L'API v5 n'accepte dans `/forms/{formType}/…` que les valeurs de son énumération `FormType` :
 * `CrowdFunding`, `Membership`, `Event`, `Donation`, `PaymentForm`, `Checkout`, `Shop`
 * (https://dev.helloasso.com/reference). L'interface proposait « Billetterie » (`Ticketing`) et
 * « Formulaire » (`Form`), et le décodage d'URL produisait les mêmes : HelloAsso répondait par une
 * erreur, que le test de connexion traduisait en « vérifiez les identifiants » — et l'import des
 * tarifs échouait de la même façon.
 */
const TYPES_API = [
  'CrowdFunding',
  'Membership',
  'Event',
  'Donation',
  'PaymentForm',
  'Checkout',
  'Shop',
]

describe('décodage d’une URL HelloAsso', () => {
  it.each([
    ['evenements', 'Event'],
    ['billetteries', 'Event'],
    ['adhesions', 'Membership'],
    ['formulaires', 'PaymentForm'],
    ['collectes', 'CrowdFunding'],
    ['boutiques', 'Shop'],
    ['dons', 'Donation'],
  ])('/%s/ donne le type %s', (segment, type) => {
    const parts = parseHelloAssoUrl(
      `https://www.helloasso.com/associations/mon-asso/${segment}/mon-form`
    )
    expect(parts).toEqual({ organizationSlug: 'mon-asso', formType: type, formSlug: 'mon-form' })
  })

  it('⚠️ ne produit JAMAIS un type que l’API refuse', () => {
    for (const segment of [
      'evenements',
      'billetteries',
      'adhesions',
      'formulaires',
      'collectes',
      'crowdfundings',
      'boutiques',
      'dons',
    ]) {
      const parts = parseHelloAssoUrl(`https://www.helloasso.com/associations/a/${segment}/f`)
      expect(TYPES_API, segment).toContain(parts?.formType)
    }
  })

  it('refuse un type d’URL inconnu au lieu de le replier en silence sur « Event »', () => {
    expect(parseHelloAssoUrl('https://www.helloasso.com/associations/a/inconnu/f')).toBeNull()
  })

  it('une ancienne configuration se reconstruit en URL que le décodage ramène à un type valide', () => {
    for (const [ancien, attendu] of [
      ['Ticketing', 'Event'],
      ['Form', 'PaymentForm'],
    ]) {
      const url = buildHelloAssoUrl({ organizationSlug: 'a', formType: ancien, formSlug: 'f' })
      expect(parseHelloAssoUrl(url)?.formType).toBe(attendu)
    }
  })

  it('l’aller-retour URL → type → URL est stable pour chaque type valide', () => {
    for (const type of ['Event', 'Membership', 'PaymentForm', 'CrowdFunding', 'Shop', 'Donation']) {
      const url = buildHelloAssoUrl({ organizationSlug: 'a', formType: type, formSlug: 'f' })
      expect(parseHelloAssoUrl(url)?.formType, type).toBe(type)
    }
  })

  it('normalise un type hérité pour l’affichage, et laisse les autres', () => {
    expect(normaliserTypeHelloAsso('Ticketing')).toBe('Event')
    expect(normaliserTypeHelloAsso('Form')).toBe('PaymentForm')
    expect(normaliserTypeHelloAsso('Membership')).toBe('Membership')
  })
})

describe('chemin d’API d’un formulaire (serveur)', () => {
  it('⚠️ traduit les types hérités enregistrés en base, pour qu’ils marchent sans ressaisie', () => {
    expect(normaliserTypeFormulaire('Ticketing')).toBe('Event')
    expect(normaliserTypeFormulaire('Form')).toBe('PaymentForm')
    expect(normaliserTypeFormulaire('Event')).toBe('Event')
  })

  it('construit le chemin avec le type normalisé et des slugs sans espaces', () => {
    expect(
      cheminDuFormulaire({
        organizationSlug: 'le-circographe ',
        formType: 'Ticketing',
        formSlug: ' les-24h',
      })
    ).toBe('/v5/organizations/le-circographe/forms/Event/les-24h')
  })
})
