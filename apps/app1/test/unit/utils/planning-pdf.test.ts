import { describe, expect, it } from 'vitest'

import {
  COULEUR_PAR_DEFAUT,
  composantesRvb,
  couleurDEquipe,
  horairesReels,
  lignesDePlanning,
  nomFichierPlanning,
  resumerPlanning,
  type CreneauDePlanning,
} from '../../../../../layers/volunteers/app/utils/planning-pdf'

/**
 * Le planning qu'un bénévole emporte sur papier.
 *
 * Ce qui se teste ici n'est pas la mise en page mais ce qui SORT. Deux erreurs coûtent vraiment :
 * un créneau qui n'apparaît pas — quelqu'un ne se présente pas à son poste — et un horaire qui
 * ignore le retard, qui envoie quelqu'un une heure trop tôt devant une porte fermée.
 */

const FORMAT = {
  debut: (d: Date) => d.toISOString(),
  fin: (d: Date) => d.toISOString().slice(11, 16),
}

function creneau(champs: Partial<CreneauDePlanning> = {}): CreneauDePlanning {
  return {
    id: 1,
    title: 'Accueil',
    startDateTime: '2026-06-10T08:00:00Z',
    endDateTime: '2026-06-10T12:00:00Z',
    ...champs,
  }
}

describe('horairesReels', () => {
  it('décale les DEUX bornes du retard, pas une seule', () => {
    // Ne décaler que le début allongerait le créneau : quatre heures deviendraient cinq, et le
    // total d'heures imprimé cesserait de correspondre à ce qu'on demande au bénévole.
    const h = horairesReels(creneau({ delayMinutes: 30 }))!
    expect(h.debut.toISOString()).toBe('2026-06-10T08:30:00.000Z')
    expect(h.fin.toISOString()).toBe('2026-06-10T12:30:00.000Z')
    expect(h.fin.getTime() - h.debut.getTime()).toBe(4 * 3600 * 1000)
  })

  it('accepte un retard négatif — un créneau peut être avancé', () => {
    const h = horairesReels(creneau({ delayMinutes: -15 }))!
    expect(h.debut.toISOString()).toBe('2026-06-10T07:45:00.000Z')
  })

  it('traite un retard absent, nul ou illisible comme une absence de retard', () => {
    for (const retard of [undefined, null, 0, Number.NaN]) {
      const h = horairesReels(creneau({ delayMinutes: retard as number }))!
      expect(h.debut.toISOString()).toBe('2026-06-10T08:00:00.000Z')
    }
  })

  it('refuse un créneau dont les dates sont illisibles', () => {
    expect(horairesReels(creneau({ startDateTime: 'jeudi prochain' }))).toBeNull()
    expect(horairesReels(creneau({ endDateTime: '' }))).toBeNull()
  })
})

describe('lignesDePlanning', () => {
  it('garde l’ordre reçu', () => {
    // On suit sa journée de haut en bas. Retrier ici ferait diverger la feuille de l'écran.
    const lignes = lignesDePlanning(
      [creneau({ title: 'Bar' }), creneau({ title: 'Accueil' })],
      FORMAT
    )
    expect(lignes.map((l) => l.titre)).toEqual(['Bar', 'Accueil'])
  })

  it('écarte un créneau sans horaire lisible plutôt que de l’imprimer vide', () => {
    // Une ligne sans horaire annonce un poste sans dire quand : pire qu'une ligne absente.
    const lignes = lignesDePlanning(
      [creneau(), creneau({ startDateTime: 'n’importe quoi' })],
      FORMAT
    )
    expect(lignes).toHaveLength(1)
  })

  it('imprime l’horaire RETARDÉ, pas l’horaire prévu', () => {
    const [ligne] = lignesDePlanning([creneau({ delayMinutes: 45 })], FORMAT)
    expect(ligne!.debut).toBe('2026-06-10T08:45:00.000Z')
    expect(ligne!.retardMinutes).toBe(45)
  })

  it('réduit les champs libres et tolère leur absence', () => {
    const [ligne] = lignesDePlanning(
      [creneau({ title: '  Accueil  ', description: null, team: null })],
      FORMAT
    )
    expect(ligne!.titre).toBe('Accueil')
    expect(ligne!.description).toBe('')
    expect(ligne!.equipe).toBe('')
  })

  it('porte la couleur de l’équipe en composantes', () => {
    const [ligne] = lignesDePlanning(
      [creneau({ team: { id: 7, name: 'Bar', color: '#ff0000' } })],
      FORMAT
    )
    expect(ligne!.equipe).toBe('Bar')
    expect(ligne!.couleurEquipe).toEqual([255, 0, 0])
  })
})

describe('resumerPlanning', () => {
  it('compte les créneaux, les heures, les équipes et les retards', () => {
    const resume = resumerPlanning([
      creneau({ team: { id: 1, name: 'Bar' } }),
      creneau({ team: { id: 1, name: 'Bar' }, delayMinutes: 20 }),
      creneau({ team: { id: 2, name: 'Accueil' } }),
      creneau({ team: null }),
    ])
    expect(resume.creneaux).toBe(4)
    expect(resume.dureeTotaleMs).toBe(4 * 4 * 3600 * 1000)
    // Deux équipes distinctes : le créneau sans équipe n'en invente pas une troisième.
    expect(resume.equipes).toBe(2)
    expect(resume.retards).toBe(1)
  })

  it('ignore un créneau illisible dans la durée mais le compte comme créneau', () => {
    // Il figure dans la liste que l'écran affiche ; le taire dans le décompte ferait douter du
    // total. En revanche il n'ajoute aucune heure, faute de savoir laquelle.
    const resume = resumerPlanning([creneau({ startDateTime: 'illisible' })])
    expect(resume.creneaux).toBe(1)
    expect(resume.dureeTotaleMs).toBe(0)
  })

  it('rend un résumé vide sans planter sur une liste vide', () => {
    expect(resumerPlanning([])).toEqual({
      creneaux: 0,
      dureeTotaleMs: 0,
      equipes: 0,
      retards: 0,
    })
  })
})

describe('couleurDEquipe et composantesRvb', () => {
  it('accepte une couleur hexadécimale et refuse le reste', () => {
    expect(couleurDEquipe('#1a2b3c')).toBe('#1a2b3c')
    expect(couleurDEquipe('rouge')).toBe(COULEUR_PAR_DEFAUT)
    expect(couleurDEquipe(null)).toBe(COULEUR_PAR_DEFAUT)
    expect(couleurDEquipe('')).toBe(COULEUR_PAR_DEFAUT)
  })

  it('développe la forme courte', () => {
    expect(composantesRvb('#f00')).toEqual([255, 0, 0])
    expect(composantesRvb('#abc')).toEqual([170, 187, 204])
  })

  it('ignore la composante d’opacité', () => {
    // Sur du papier, elle n'a pas de sens — et la passer telle quelle donnerait une quatrième
    // valeur que la bibliothèque de rendu n'attend pas.
    expect(composantesRvb('#ff000080')).toEqual([255, 0, 0])
  })

  it('retombe sur la couleur par défaut plutôt que sur du noir', () => {
    // Du noir se confondrait avec le reste du texte, et l'on croirait la colonne sans couleur
    // alors qu'elle en a perdu une.
    expect(composantesRvb('pas une couleur')).toEqual(composantesRvb(COULEUR_PAR_DEFAUT))
    expect(composantesRvb(undefined)).toEqual([59, 130, 246])
  })
})

describe('nomFichierPlanning', () => {
  it('compose le nom de l’édition et celui du bénévole', () => {
    expect(nomFichierPlanning('Camille Martin', 'Convention 2026')).toBe(
      'planning-convention-2026-camille-martin.pdf'
    )
  })

  it('retire les accents et la ponctuation', () => {
    expect(nomFichierPlanning('Zoé Écureuil', "Fête de l'été")).toBe(
      'planning-fete-de-l-ete-zoe-ecureuil.pdf'
    )
  })

  it('se passe de ce qu’il n’a pas', () => {
    expect(nomFichierPlanning(null, 'Convention 2026')).toBe('planning-convention-2026.pdf')
    expect(nomFichierPlanning(undefined, undefined)).toBe('planning.pdf')
    // Un nom qui ne laisse que de la ponctuation ne doit pas produire `planning--.pdf`.
    expect(nomFichierPlanning('!!!', '???')).toBe('planning.pdf')
  })
})
