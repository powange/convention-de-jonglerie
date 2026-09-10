import { describe, expect, it } from 'vitest'

import { rechercheResponsable } from '../../../shared/utils/recherche-responsable'

/**
 * Deux recherches cohabitent dans le même champ, et elles n'ont pas la même portée : une adresse
 * complète trouve n'importe quel compte du site, un pseudo ne cherche que parmi les gens de
 * l'édition. Se tromper de portée, c'est ouvrir l'annuaire des comptes à qui gère un stock.
 */
describe('rechercheResponsable', () => {
  it('reconnaît une adresse e-mail complète', () => {
    expect(rechercheResponsable('jean@exemple.fr')).toEqual({
      type: 'email',
      valeur: 'jean@exemple.fr',
    })
  })

  it('cherche par pseudo dès deux caractères', () => {
    expect(rechercheResponsable('jo')).toEqual({ type: 'pseudo', valeur: 'jo' })
    expect(rechercheResponsable('Jongleur42')).toEqual({ type: 'pseudo', valeur: 'Jongleur42' })
  })

  it('ne cherche rien sur un seul caractère', () => {
    // Une lettre ramènerait la moitié de l'édition, et une requête à chaque frappe avec.
    expect(rechercheResponsable('j')).toBeNull()
  })

  it('ne cherche rien sur une saisie vide', () => {
    expect(rechercheResponsable('')).toBeNull()
    expect(rechercheResponsable('   ')).toBeNull()
    expect(rechercheResponsable(null)).toBeNull()
    expect(rechercheResponsable(undefined)).toBeNull()
  })

  it('élague les espaces de bordure', () => {
    // Une adresse collée depuis un message en emporte souvent un.
    expect(rechercheResponsable('  jean@exemple.fr ')).toEqual({
      type: 'email',
      valeur: 'jean@exemple.fr',
    })
    expect(rechercheResponsable('  jean ')).toEqual({ type: 'pseudo', valeur: 'jean' })
  })

  it('attend qu’une adresse en cours de frappe soit complète', () => {
    // L'arobase trahit l'intention : `jean@` n'est le pseudo de personne, chercher dessus n'aurait
    // rendu que du vide — et aurait envoyé une requête à chaque lettre du domaine.
    expect(rechercheResponsable('jean@')).toBeNull()
    expect(rechercheResponsable('jean@exem')).toBeNull()
    expect(rechercheResponsable('jean@exemple.f')).toBeNull()
  })

  it('bascule en recherche d’adresse dès que celle-ci est valable', () => {
    expect(rechercheResponsable('jean@exemple.fr')?.type).toBe('email')
  })

  it('ne prend pas une adresse mal formée pour un pseudo', () => {
    // Ces formes passaient l'ancienne vérification côté interface : elles ne doivent pas non plus
    // se retrouver envoyées comme pseudo.
    expect(rechercheResponsable('jean@exemple..fr')).toBeNull()
    expect(rechercheResponsable('a@b.c')).toBeNull()
  })
})
