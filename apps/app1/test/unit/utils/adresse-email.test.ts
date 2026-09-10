import { describe, expect, it } from 'vitest'

import { adresseEmailNormalisee, estAdresseEmail } from '../../../shared/utils/adresse-email'

/**
 * L'interface vérifiait l'adresse avec une expression maison, le serveur avec `zod`. Les deux ne
 * disaient pas la même chose : la recherche d'un responsable d'emprunt émettait un appel jugé
 * valable ici et refusé là-bas, laissant une 400 au journal de production pour un résultat que
 * l'utilisateur voyait simplement vide.
 *
 * Les cas ci-dessous sont ceux relevés à cette occasion : ils passaient l'ancienne expression.
 */
const ACCEPTEES_A_TORT = [
  'a@b..com',
  'jean@exemple.fr.',
  'jean..dupont@exemple.fr',
  'jean@-exemple.fr',
  'jean@exemple..fr',
  // Extension d'une seule lettre : aucun domaine de premier niveau n'en a.
  'a@b.c',
]

describe('estAdresseEmail', () => {
  it('accepte une adresse ordinaire', () => {
    expect(estAdresseEmail('jean@exemple.fr')).toBe(true)
    expect(estAdresseEmail('jean+billetterie@exemple.co.uk')).toBe(true)
  })

  it('ne se laisse pas prendre par la casse', () => {
    expect(estAdresseEmail('JEAN@Exemple.FR')).toBe(true)
  })

  it.each(ACCEPTEES_A_TORT)('refuse « %s », que l’ancienne règle acceptait', (adresse) => {
    expect(estAdresseEmail(adresse)).toBe(false)
  })

  it('refuse ce qui n’est manifestement pas une adresse', () => {
    expect(estAdresseEmail('jean')).toBe(false)
    expect(estAdresseEmail('jean@')).toBe(false)
    expect(estAdresseEmail('@exemple.fr')).toBe(false)
    expect(estAdresseEmail('jean dupont@exemple.fr')).toBe(false)
  })

  it('ignore les espaces qui entourent la saisie', () => {
    // Une adresse collée depuis un message en emporte souvent un : le serveur l'élaguait après
    // l'avoir validée, donc trop tard.
    expect(estAdresseEmail('  jean@exemple.fr  ')).toBe(true)
  })

  it('tolère une valeur absente', () => {
    expect(estAdresseEmail('')).toBe(false)
    expect(estAdresseEmail('   ')).toBe(false)
    expect(estAdresseEmail(null)).toBe(false)
    expect(estAdresseEmail(undefined)).toBe(false)
  })
})

describe('adresseEmailNormalisee', () => {
  it('rend l’adresse élaguée', () => {
    // Ce qu'on vérifie et ce qu'on envoie doivent être la même chaîne, sans quoi l'écart revient
    // par la fenêtre.
    expect(adresseEmailNormalisee('  jean@exemple.fr ')).toBe('jean@exemple.fr')
  })

  it('conserve la casse saisie', () => {
    // Le serveur met en minuscules lui-même ; ce n'est pas à l'interface de décider.
    expect(adresseEmailNormalisee('Jean@Exemple.fr')).toBe('Jean@Exemple.fr')
  })

  it('rend null pour ce qui n’est pas une adresse', () => {
    expect(adresseEmailNormalisee('jean@exemple..fr')).toBeNull()
    expect(adresseEmailNormalisee(null)).toBeNull()
  })
})
