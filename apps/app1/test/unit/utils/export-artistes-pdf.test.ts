import { describe, expect, it } from 'vitest'

import {
  colonnesImprimables,
  journeeNueDuRepas,
  nomFichierArtistes,
  preparerTableauDArtistes,
  texteDesRepas,
  texteImprimable,
} from '../../../../../layers/artists/app/utils/export-artistes-pdf'

/**
 * Ce qui part dans le PDF des artistes.
 *
 * Un PDF ne se rattrape pas une fois envoyé : une colonne absente, un jour décalé ou un montant
 * amputé d'un chiffre ne se découvrent qu'à la lecture, par quelqu'un d'autre. D'où ces tests sur
 * la structure, là où la page ne garde que la mise en forme.
 */

describe('colonnesImprimables', () => {
  const entete = (id: string) => ({ name: 'Nom', email: 'Email', actions: 'Actions' })[id] ?? id

  it('suit l’ordre des colonnes affichées', () => {
    expect(colonnesImprimables(['email', 'name'], entete)).toEqual([
      { id: 'email', entete: 'Email' },
      { id: 'name', entete: 'Nom' },
    ])
  })

  it('écarte la colonne des actions', () => {
    // Elle ne porte que des boutons : imprimée, elle donnerait une colonne vide et large qui
    // pousse les autres hors de la page.
    expect(colonnesImprimables(['name', 'actions'], entete).map((c) => c.id)).toEqual(['name'])
  })

  it('n’imprime que ce qui est affiché', () => {
    // Masquer une colonne à l'écran doit la retirer du PDF : c'est tout l'intérêt du bouton.
    expect(colonnesImprimables(['name'], entete)).toHaveLength(1)
  })
})

describe('texteImprimable', () => {
  it('ramène les espaces insécables à des espaces ordinaires', () => {
    // Les polices standard de jsPDF ignorent U+202F : « 1 250,00 € » s'imprimait « 1/250,00 € »,
    // et seulement sur les montants à quatre chiffres.
    expect(texteImprimable('1\u202f250,00\u00a0€')).toBe('1 250,00 €')
  })

  it('aplatit les retours à la ligne par défaut', () => {
    // Une note d'organisateur sur trois lignes ferait exploser la hauteur de la ligne du tableau,
    // et ce n'est jamais délibéré.
    expect(texteImprimable('première ligne\n\nseconde')).toBe('première ligne seconde')
  })

  it('garde les retours quand ils sont voulus', () => {
    expect(texteImprimable('vendredi soir\nsamedi midi', { multiligne: true })).toBe(
      'vendredi soir\nsamedi midi'
    )
  })

  it('n’empile pas les lignes vides en multiligne', () => {
    // Deux retours consécutifs laisseraient un blanc au milieu de la cellule.
    expect(texteImprimable('vendredi soir\n\n\nsamedi midi', { multiligne: true })).toBe(
      'vendredi soir\nsamedi midi'
    )
  })

  it('rend une chaîne vide pour une absence', () => {
    expect(texteImprimable(null)).toBe('')
    expect(texteImprimable(undefined)).toBe('')
  })
})

describe('journeeNueDuRepas', () => {
  it('retient la journée sans la convertir', () => {
    // `VolunteerMeal.date` est une colonne `@db.Date`. Sérialisée elle ressemble à un instant, et
    // la convertir la ferait basculer d'un jour à l'ouest de Greenwich.
    expect(journeeNueDuRepas('2026-10-02T00:00:00.000Z')).toBe('2026-10-02')
    expect(journeeNueDuRepas(new Date('2026-10-02T00:00:00.000Z'))).toBe('2026-10-02')
  })

  it('rend une chaîne vide sur une absence ou une valeur illisible', () => {
    expect(journeeNueDuRepas(null)).toBe('')
    expect(journeeNueDuRepas('pas une date')).toBe('')
  })
})

describe('texteDesRepas', () => {
  const jour = (journee: string) =>
    ({ '2026-10-02': 'vendredi', '2026-10-03': 'samedi' })[journee] ?? ''
  const moment = (type: string) =>
    ({ BREAKFAST: 'matin', LUNCH: 'midi', DINNER: 'soir' })[type] ?? ''

  const repas = (date: string, mealType: string, accepted = true) => ({
    accepted,
    meal: { date, mealType },
  })

  it('nomme les repas plutôt que de les compter, un par ligne', () => {
    // À l'écran un compteur suffit, il ouvre le détail d'un clic. Sur papier, personne ne peut
    // cliquer — et c'est cette liste qu'on emporte en cuisine. L'un sous l'autre se lit d'un
    // coup d'œil, là où une énumération à virgules se déchiffre.
    const selections = [
      repas('2026-10-02T00:00:00.000Z', 'DINNER'),
      repas('2026-10-03T00:00:00.000Z', 'LUNCH'),
    ]

    expect(texteDesRepas(selections, jour, moment)).toBe('vendredi soir\nsamedi midi')
  })

  it('ne retient que les repas acceptés', () => {
    const selections = [
      repas('2026-10-02T00:00:00.000Z', 'DINNER'),
      repas('2026-10-03T00:00:00.000Z', 'LUNCH', false),
    ]

    expect(texteDesRepas(selections, jour, moment)).toBe('vendredi soir')
  })

  it('rend une chaîne vide quand rien n’est attribué', () => {
    expect(texteDesRepas([], jour, moment)).toBe('')
    expect(texteDesRepas(null, jour, moment)).toBe('')
    expect(texteDesRepas([repas('2026-10-02T00:00:00.000Z', 'DINNER', false)], jour, moment)).toBe(
      ''
    )
  })

  it('n’écrit pas de fragment bancal quand une donnée manque', () => {
    // Un repas sans date ne doit pas produire « soir » tout seul, ni une virgule orpheline.
    const selections = [
      { accepted: true, meal: { date: null, mealType: 'DINNER' } },
      repas('2026-10-03T00:00:00.000Z', 'LUNCH'),
    ]

    expect(texteDesRepas(selections, jour, moment)).toBe('soir\nsamedi midi')
  })
})

describe('preparerTableauDArtistes', () => {
  const colonnes = [
    { id: 'name', entete: 'Nom' },
    { id: 'meals', entete: 'Repas' },
  ]
  const artistes = [
    { nom: 'Alice', repas: 'vendredi soir' },
    { nom: 'Bob', repas: '' },
  ]
  const valeur = (a: (typeof artistes)[number], id: string) =>
    id === 'name' ? a.nom : id === 'meals' ? a.repas : ''

  it('rend les en-têtes et une ligne par artiste', () => {
    expect(preparerTableauDArtistes(artistes, colonnes, valeur)).toEqual({
      entetes: ['Nom', 'Repas'],
      lignes: [
        ['Alice', 'vendredi soir'],
        ['Bob', ''],
      ],
    })
  })

  it('nettoie chaque cellule', () => {
    const sales = [{ nom: 'Alice\nDupont', repas: '1\u202f250' }]
    const salir = (a: (typeof sales)[number], id: string) => (id === 'name' ? a.nom : a.repas)

    expect(preparerTableauDArtistes(sales, colonnes, salir).lignes).toEqual([
      ['Alice Dupont', '1 250'],
    ])
  })

  it('garde les retours de la colonne des repas, et d’elle seule', () => {
    // La même chaîne, dans deux colonnes : aplatie côté nom, conservée côté repas. C'est ce qui
    // distingue un retour voulu d'un retour subi.
    const memeTexte = [{ nom: 'vendredi soir\nsamedi midi', repas: 'vendredi soir\nsamedi midi' }]
    const lire = (a: (typeof memeTexte)[number], id: string) => (id === 'name' ? a.nom : a.repas)

    expect(preparerTableauDArtistes(memeTexte, colonnes, lire).lignes).toEqual([
      ['vendredi soir samedi midi', 'vendredi soir\nsamedi midi'],
    ])
  })

  it('rend un tableau sans lignes quand rien n’est filtré', () => {
    expect(preparerTableauDArtistes([], colonnes, valeur).lignes).toEqual([])
  })
})

describe('nomFichierArtistes', () => {
  it('date le fichier et aplatit le nom de l’édition', () => {
    // Daté, parce qu'on refait cet export à mesure que la distribution se complète, et que trois
    // fichiers homonymes ne se distinguent plus dans un dossier de téléchargements.
    expect(nomFichierArtistes('Jongle en Zik 2026', new Date(2026, 8, 21))).toBe(
      'artistes-jongle-en-zik-2026-2026-09-21.pdf'
    )
  })

  it('se passe du nom de l’édition quand il manque', () => {
    expect(nomFichierArtistes(null, new Date(2026, 8, 21))).toBe('artistes-2026-09-21.pdf')
  })

  it('retire les accents, que tous les systèmes de fichiers n’acceptent pas', () => {
    expect(nomFichierArtistes('Été à Brévent', new Date(2026, 0, 5))).toBe(
      'artistes-ete-a-brevent-2026-01-05.pdf'
    )
  })
})
