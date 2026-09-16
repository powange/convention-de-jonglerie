import { describe, expect, it } from 'vitest'

import {
  journeeVoisine,
  journeesDesRepas,
  repasDuJour,
  repasEnChangeantDeJour,
  typesDuJour,
} from '../../../../../layers/meals/app/utils/navigation-repas'

/**
 * Naviguer entre les repas par jour puis par type.
 *
 * ⚠️ La grille n'est pas complète : le jour de montage ne porte souvent que le dîner. Ces tests
 * portent surtout là-dessus — proposer « jeudi + petit-déjeuner » désignerait un repas inexistant
 * et laisserait l'écran vide.
 */
const repas = [
  // Jeudi : jour de montage, dîner seulement.
  { id: 1, date: '2026-09-24T19:00:00', mealType: 'DINNER' },
  { id: 2, date: '2026-09-25T08:00:00', mealType: 'BREAKFAST' },
  { id: 3, date: '2026-09-25T12:00:00', mealType: 'LUNCH' },
  { id: 4, date: '2026-09-25T19:00:00', mealType: 'DINNER' },
  { id: 5, date: '2026-09-26T08:00:00', mealType: 'BREAKFAST' },
  { id: 6, date: '2026-09-26T12:00:00', mealType: 'LUNCH' },
]

describe('journeesDesRepas', () => {
  it('rend les journées distinctes, en ordre chronologique', () => {
    expect(journeesDesRepas(repas)).toEqual(['2026-09-24', '2026-09-25', '2026-09-26'])
  })

  it('survit à une date illisible plutôt que d’inventer une journée', () => {
    expect(journeesDesRepas([{ id: 9, date: 'jeudi', mealType: 'LUNCH' }])).toEqual([])
  })
})

describe('typesDuJour', () => {
  it('ne propose que les types réellement configurés', () => {
    // Le cœur du sujet : le jeudi de montage ne porte que le dîner.
    expect(typesDuJour(repas, '2026-09-24')).toEqual(['DINNER'])
  })

  it('rend les types dans l’ordre de la journée', () => {
    // Et non dans l'ordre des identifiants ou de la base : on lit une journée du matin au soir.
    expect(typesDuJour(repas, '2026-09-25')).toEqual(['BREAKFAST', 'LUNCH', 'DINNER'])
  })

  it('n’escamote pas un type inattendu', () => {
    // Une collation reste atteignable : mieux vaut un bouton de plus qu'un repas inaccessible.
    const avecCollation = [...repas, { id: 7, date: '2026-09-26T16:00:00', mealType: 'SNACK' }]

    expect(typesDuJour(avecCollation, '2026-09-26')).toEqual(['BREAKFAST', 'LUNCH', 'SNACK'])
  })
})

describe('journeeVoisine', () => {
  const journees = journeesDesRepas(repas)

  it('avance et recule d’une journée', () => {
    expect(journeeVoisine(journees, '2026-09-25', 1)).toBe('2026-09-26')
    expect(journeeVoisine(journees, '2026-09-25', -1)).toBe('2026-09-24')
  })

  it('ne boucle PAS aux extrémités', () => {
    // Passer du dimanche au jeudi d'un clic surprendrait. C'est aussi ce `null` qui permet de
    // griser la flèche plutôt que de la laisser mentir.
    expect(journeeVoisine(journees, '2026-09-26', 1)).toBeNull()
    expect(journeeVoisine(journees, '2026-09-24', -1)).toBeNull()
  })

  it('ne rend rien depuis une journée inconnue', () => {
    expect(journeeVoisine(journees, '2026-01-01', 1)).toBeNull()
  })
})

describe('repasEnChangeantDeJour', () => {
  it('garde le MÊME type quand la journée le propose', () => {
    // Passer du déjeuner de vendredi au déjeuner de samedi est le geste attendu.
    expect(repasEnChangeantDeJour(repas, '2026-09-26', 'LUNCH')?.id).toBe(6)
  })

  it('retombe sur le premier repas quand le type manque', () => {
    // Depuis le dîner de vendredi vers le jeudi… qui n'a que le dîner : ici ça tombe juste.
    // Mais depuis le petit-déjeuner de vendredi vers le jeudi, il faut un repli.
    expect(repasEnChangeantDeJour(repas, '2026-09-24', 'BREAKFAST')?.id).toBe(1)
  })

  it('ne laisse jamais l’écran vide sur une journée qui a des repas', () => {
    // Une flèche qui ne sélectionne rien donnerait l'impression d'un défaut.
    expect(repasEnChangeantDeJour(repas, '2026-09-26', null)).not.toBeNull()
  })

  it('rend null sur une journée sans repas', () => {
    expect(repasEnChangeantDeJour(repas, '2026-12-25', 'LUNCH')).toBeNull()
  })
})

describe('repasDuJour', () => {
  it('trouve le repas d’un jour et d’un type', () => {
    expect(repasDuJour(repas, '2026-09-25', 'DINNER')?.id).toBe(4)
  })

  it('rend null sur une combinaison qui n’existe pas', () => {
    expect(repasDuJour(repas, '2026-09-24', 'BREAKFAST')).toBeNull()
  })
})
