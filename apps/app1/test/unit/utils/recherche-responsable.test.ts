import { describe, expect, it } from 'vitest'

import {
  motsDeRecherche,
  MOTS_MAXIMUM,
  rechercheResponsable,
} from '../../../shared/utils/recherche-responsable'

/**
 * Deux recherches cohabitent dans le même champ, et elles n'ont pas la même portée : une adresse
 * complète trouve n'importe quel compte du site, des mots-clés ne cherchent que parmi les gens de
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
    expect(rechercheResponsable('jo')).toEqual({ type: 'personne', valeur: 'jo' })
    expect(rechercheResponsable('Jongleur42')).toEqual({ type: 'personne', valeur: 'Jongleur42' })
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
    expect(rechercheResponsable('  jean ')).toEqual({ type: 'personne', valeur: 'jean' })
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

/**
 * Le découpage d'une recherche en mots.
 *
 * ⚠️ C'EST CE DÉCOUPAGE QUI REND « Nom prénom » ET « prénom nom » ÉQUIVALENTS, et c'était la
 * demande. Chaque mot est ensuite confronté au pseudo, au prénom ET au nom par
 * `filtreRecherchePersonne`, et tous doivent trouver preneur.
 */
describe('motsDeRecherche', () => {
  it('🔬 découpe sur les espaces, dans l’ordre tapé', () => {
    expect(motsDeRecherche('Jean Dupont')).toEqual(['Jean', 'Dupont'])
    expect(motsDeRecherche('Dupont Jean')).toEqual(['Dupont', 'Jean'])
  })

  it('absorbe les espaces en trop, où qu’ils soient', () => {
    // Une saisie au clavier en contient : un espace final pendant la frappe, un double espace
    // entre deux noms. Sans ce nettoyage, un mot VIDE serait confronté aux champs — et `contains`
    // d'une chaîne vide retient tout le monde, ce qui annulerait le filtrage.
    expect(motsDeRecherche('  Jean   Dupont  ')).toEqual(['Jean', 'Dupont'])
    expect(motsDeRecherche('Jean\t\nDupont')).toEqual(['Jean', 'Dupont'])
  })

  it('rend un tableau vide pour une saisie sans mot', () => {
    expect(motsDeRecherche('')).toEqual([])
    expect(motsDeRecherche('   ')).toEqual([])
    expect(motsDeRecherche(null)).toEqual([])
    expect(motsDeRecherche(undefined)).toEqual([])
  })

  it('🔬 plafonne le nombre de mots', () => {
    /*
     * Chaque mot devient un groupe de trois conditions dans la requête : une saisie à rallonge
     * coûterait cher pour un résultat qui ne peut que se vider. Les mots en trop sont IGNORÉS
     * plutôt que refusés — la recherche reste utile, elle est seulement moins stricte que ce qui a
     * été tapé, ce qui vaut mieux qu'un champ qui cesse de répondre.
     */
    const beaucoup = Array.from({ length: MOTS_MAXIMUM + 3 }, (_, i) => `mot${i}`).join(' ')

    expect(motsDeRecherche(beaucoup)).toHaveLength(MOTS_MAXIMUM)
  })
})
