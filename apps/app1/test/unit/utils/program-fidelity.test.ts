import { describe, expect, it } from 'vitest'

import { mesurerFidelite } from '../../../shared/utils/program-fidelity'

/**
 * Ce que cette mesure protège : le programme d'une journée doit être un relevé de la page, pas
 * une rédaction. Un modèle qui invente des horaires plausibles produit un texte indiscernable
 * d'un bon relevé tant qu'on ne le confronte pas à sa source.
 */
const page = `
Samedi 1 août
from 12:00 | Registrations
18:00 - 03:00 | Welcome party at the main tent
Dimanche 2 août
10:00 - 13:00 | Workshops with Anna Lisa
20:30 | Gala show
`

describe('mesurerFidelite', () => {
  it('reconnaît un relevé fidèle', () => {
    const extrait = 'from 12:00 | Registrations\n18:00 - 03:00 | Welcome party at the main tent'
    expect(mesurerFidelite(extrait, page)).toBe(1)
  })

  it('démasque un contenu inventé', () => {
    const extrait = '09:00 | Petit-déjeuner offert\n14:00 | Atelier de diabolo avancé'
    expect(mesurerFidelite(extrait, page)).toBe(0)
  })

  it('rend une proportion sur un mélange', () => {
    const extrait = 'from 12:00 | Registrations\n23:00 | Feu de camp sur la plage'
    expect(mesurerFidelite(extrait, page)).toBe(0.5)
  })

  // Minuscules et espaces sont les seules libertés accordées : un modèle qui recopie en
  // reformatant légèrement reste un copiste fidèle.
  it('tolère la casse et les espaces multiples', () => {
    expect(mesurerFidelite('FROM 12:00   |   Registrations', page)).toBe(1)
  })

  // Une heure isolée se retrouve partout : la compter gonflerait le score sans rien prouver.
  it('ignore les lignes trop courtes pour valoir preuve', () => {
    expect(mesurerFidelite('20:30\n-\nok', page)).toBe(1)
  })

  it('rend 1 sur un extrait vide : rien d’inventé dans rien', () => {
    expect(mesurerFidelite('', page)).toBe(1)
    expect(mesurerFidelite('   \n  ', page)).toBe(1)
  })

  it('rend 0 quand la source est vide', () => {
    expect(mesurerFidelite('18:00 - 03:00 | Welcome party', '')).toBe(0)
  })
})
