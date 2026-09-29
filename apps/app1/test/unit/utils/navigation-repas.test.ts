import { describe, expect, it } from 'vitest'

import {
  journeeVoisine,
  journeesDesRepas,
  repasDuJour,
  repasEnChangeantDeJour,
  repasParDefaut,
  typeSelonLHeure,
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

describe('typeSelonLHeure', () => {
  it('sert le petit-déjeuner le matin, le déjeuner à midi, le dîner ensuite', () => {
    expect(typeSelonLHeure(7)).toBe('BREAKFAST')
    expect(typeSelonLHeure(12)).toBe('LUNCH')
    expect(typeSelonLHeure(20)).toBe('DINNER')
  })

  it('bascule sur les bornes de SERVICE et non sur l’heure du repas', () => {
    // À 14 h 30 la file du déjeuner existe encore ; à 15 h 30 on prépare le soir.
    expect(typeSelonLHeure(14)).toBe('LUNCH')
    expect(typeSelonLHeure(15)).toBe('DINNER')
    // Et 10 h appartient encore au petit-déjeuner.
    expect(typeSelonLHeure(10)).toBe('BREAKFAST')
    expect(typeSelonLHeure(11)).toBe('LUNCH')
  })

  it('tient les extrêmes de la journée', () => {
    expect(typeSelonLHeure(0)).toBe('BREAKFAST')
    expect(typeSelonLHeure(23)).toBe('DINNER')
  })
})

/**
 * Le repas présenté d'emblée au comptoir.
 *
 * ⚠️ CE QUE CES TESTS VERROUILLENT, et pourquoi l'ancien code échouait : un repas est stocké à
 * MINUIT UTC du jour où il est servi — son heure de service n'existe nulle part. L'écran comparait
 * pourtant des instants : une fenêtre de ±3 h autour de « maintenant », puis un repli sur « le
 * premier repas à venir ». La fenêtre ne rencontrait jamais un déjeuner ni un dîner, et un dîner
 * « minuit UTC » est déjà passé dès 2 h du matin sur place — donc à midi plus aucun repas du jour
 * n'était « à venir » et le comptoir ouvrait sur LE LENDEMAIN.
 *
 * D'où des cas qui portent sur la JOURNÉE et le TYPE, jamais sur un instant : c'est la seule
 * information que la donnée porte réellement. La fonction reçoit le jour et l'heure, elle ne lit
 * aucune horloge — ces tests ne dépendent donc ni de la date d'exécution ni du fuseau de la machine,
 * ce qui est précisément ce qui manquait pour attraper le défaut.
 */
describe('repasParDefaut', () => {
  it('un jour d’édition à midi : le déjeuner DU JOUR', () => {
    // Le cas qui échouait : on obtenait le premier repas du lendemain.
    expect(repasParDefaut(repas, '2026-09-25', 12)?.id).toBe(3)
  })

  it('le même jour à 22 h : le dîner du jour, pas celui du lendemain', () => {
    expect(repasParDefaut(repas, '2026-09-25', 22)?.id).toBe(4)
  })

  it('le même jour au petit matin : le petit-déjeuner du jour', () => {
    expect(repasParDefaut(repas, '2026-09-25', 8)?.id).toBe(2)
  })

  it('retombe sur un repas existant quand le type de l’heure manque ce jour-là', () => {
    // Jeudi de montage : rien que le dîner. À midi, « déjeuner » n'existe pas — mais laisser
    // l'écran vide serait pire que de proposer le seul repas du jour.
    expect(repasParDefaut(repas, '2026-09-24', 12)?.id).toBe(1)
  })

  it('la veille de l’édition : le premier repas du premier jour', () => {
    expect(repasParDefaut(repas, '2026-09-23', 18)?.id).toBe(1)
  })

  it('après l’édition : le DERNIER repas servi', () => {
    // Et non le premier de la dernière journée : ce qu'on rouvre après coup est ce qui vient de
    // se passer. Le 26 s'arrête au déjeuner (id 6), il n'y a pas de dîner ce jour-là.
    expect(repasParDefaut(repas, '2026-10-01', 12)?.id).toBe(6)
  })

  it('entre deux journées de repas : la suivante, pas la précédente', () => {
    // Une édition dont le catalogue a un trou — un jour sans repas au milieu.
    const avecTrou = [
      { id: 1, date: '2026-09-24T19:00:00', mealType: 'DINNER' },
      { id: 5, date: '2026-09-26T08:00:00', mealType: 'BREAKFAST' },
    ]
    expect(repasParDefaut(avecTrou, '2026-09-25', 12)?.id).toBe(5)
  })

  /**
   * La VRAIE forme des données, et non une forme commode.
   *
   * ⚠️ Les cas ci-dessus décrivent les dates en heure locale (`'2026-09-25T12:00:00'`), ce qui est
   * lisible mais n'est PAS ce que l'API renvoie : elle rend des instants à minuit UTC. Or c'est
   * exactement cette forme qui produisait le défaut. Un jeu de données commode aurait donc laissé
   * passer une correction qui ne corrige rien — d'où ce cas, écrit avec les instants réels.
   */
  it('choisit le déjeuner du jour sur des repas stockés à MINUIT UTC', () => {
    const commeEnBase = [
      { id: 11, date: '2026-09-25T00:00:00.000Z', mealType: 'BREAKFAST' },
      { id: 12, date: '2026-09-25T00:00:00.000Z', mealType: 'LUNCH' },
      { id: 13, date: '2026-09-25T00:00:00.000Z', mealType: 'DINNER' },
      { id: 14, date: '2026-09-26T00:00:00.000Z', mealType: 'BREAKFAST' },
    ]

    // Midi le 25 : le déjeuner du 25. L'ancien code rendait ici le premier repas du 26, parce qu'un
    // repas « minuit UTC » du 25 est déjà passé et n'est donc plus « à venir ».
    expect(repasParDefaut(commeEnBase, '2026-09-25', 12)?.id).toBe(12)
    // Et à 22 h, le dîner du même jour — jamais celui du lendemain.
    expect(repasParDefaut(commeEnBase, '2026-09-25', 22)?.id).toBe(13)
  })

  it('rend null sans aucun repas, sans rien inventer', () => {
    // Depuis que les repas désactivés ne sont plus renvoyés, la liste PEUT être vide : l'écran
    // affiche alors son encart, et cette fonction ne doit pas désigner un repas au hasard.
    expect(repasParDefaut([], '2026-09-25', 12)).toBeNull()
  })
})
