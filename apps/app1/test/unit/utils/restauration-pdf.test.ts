import { describe, it, expect } from 'vitest'

import {
  colonnesDePopulation,
  colonnesDeRegime,
  nombrePourCle,
  couleurDuType,
  motLePlusLong,
  nomFichierRestauration,
  resumerRepas,
  lignesDeParticipants,
  type RepasDeRestauration,
  type ParticipantDeRepas,
} from '../../../../../layers/meals/app/utils/restauration-pdf'

/**
 * La fiche de restauration.
 *
 * Ce qui se teste ici n'est pas la mise en page mais ce qui SORT : un régime qu'on oublie de
 * compter devient une personne qui ne mange pas, et une gravité d'allergie qu'on perd en route
 * peut envoyer quelqu'un à l'hôpital. Une fiche imprimée ne se rattrape pas.
 */

function personne(p: Partial<ParticipantDeRepas> = {}): ParticipantDeRepas {
  return { type: 'volunteer', nom: 'Martin', prenom: 'Camille', ...p }
}

function repas(p: Partial<RepasDeRestauration> = {}): RepasDeRestauration {
  return {
    mealType: 'LUNCH',
    phases: ['EVENT'],
    totalParticipants: 0,
    volunteerCount: 0,
    artistCount: 0,
    ticketParticipantCount: 0,
    organizerCount: 0,
    participants: [],
    ...p,
  }
}

describe('resumerRepas', () => {
  it('rend les clés du type de repas et de ses phases', () => {
    const r = resumerRepas(repas({ mealType: 'BREAKFAST', phases: ['SETUP', 'EVENT'] }))
    expect(r.cleTypeRepas).toBe('gestion.meals.breakfast')
    expect(r.clesPhases).toEqual(['common.setup', 'common.event'])
  })

  it("rend la valeur brute quand le type n'est pas connu", () => {
    // Mieux vaut une fiche qui affiche « BRUNCH » qu'une fiche qui affiche une case vide.
    const r = resumerRepas(repas({ mealType: 'BRUNCH', phases: ['INCONNUE'] }))
    expect(r.cleTypeRepas).toBe('BRUNCH')
    expect(r.clesPhases).toEqual(['INCONNUE'])
  })

  it('annonce toujours les bénévoles et les artistes, même à zéro', () => {
    // Une fiche qui tait une population laisse croire qu'on a oublié de la compter.
    const r = resumerRepas(repas({ volunteerCount: 0, artistCount: 0 }))
    expect(r.populations).toEqual([
      { cle: 'gestion.meals.count_volunteers', nombre: 0 },
      { cle: 'gestion.meals.count_artists', nombre: 0 },
    ])
  })

  it("n'annonce les billets et les organisateurs que s'il y en a", () => {
    const sans = resumerRepas(repas({ ticketParticipantCount: 0, organizerCount: 0 }))
    expect(sans.populations).toHaveLength(2)

    const avec = resumerRepas(repas({ ticketParticipantCount: 3, organizerCount: 1 }))
    expect(avec.populations.map((p) => p.cle)).toEqual([
      'gestion.meals.count_volunteers',
      'gestion.meals.count_artists',
      'gestion.meals.count_participants',
      'gestion.meals.count_organizers',
    ])
  })

  it('compte « sans régime » et « régime absent » ensemble', () => {
    // NONE vient de l'énumération des comptes, l'absence vient de la billetterie, qui n'en a pas.
    // Les séparer ferait deux lignes pour une seule réalité, et le total ne tomberait plus juste.
    const r = resumerRepas(
      repas({
        participants: [
          personne({ dietaryPreference: 'NONE' }),
          personne({ dietaryPreference: null }),
          personne({}),
        ],
      })
    )
    expect(r.regimes).toEqual([{ cle: 'gestion.meals.diet_none', nombre: 3 }])
  })

  it('garde un ordre fixe et omet les régimes absents', () => {
    const r = resumerRepas(
      repas({
        participants: [
          personne({ dietaryPreference: 'VEGAN' }),
          personne({ dietaryPreference: 'VEGETARIAN' }),
          personne({ dietaryPreference: 'VEGAN' }),
        ],
      })
    )
    // L'ordre ne suit pas les données : il est fixe, pour qu'on parcoure la fiche sans la relire.
    expect(r.regimes).toEqual([
      { cle: 'gestion.meals.diet_vegetarian', nombre: 1 },
      { cle: 'gestion.meals.diet_vegan', nombre: 2 },
    ])
  })

  /*
   * Le compte suivait autrefois le seul type « artiste », faute d'un drapeau ailleurs. Bénévoles
   * et organisateurs le portent désormais aussi : c'est la SOURCE qui décide qui peut le déclarer,
   * et le résumé compte ce qu'on lui donne.
   */
  it('compte après spectacle quel que soit le type de la personne', () => {
    const r = resumerRepas(
      repas({
        participants: [
          personne({ type: 'artist', afterShow: true }),
          personne({ type: 'artist', afterShow: false }),
          personne({ type: 'volunteer', afterShow: true }),
          personne({ type: 'organizer', afterShow: true }),
        ],
      })
    )
    expect(r.apresSpectacle).toBe(3)
  })

  it('retient les allergies, leur gravité et le contact d’urgence', () => {
    const r = resumerRepas(
      repas({
        participants: [
          personne({
            prenom: 'Sam',
            nom: 'Bakker',
            allergies: ' arachide ',
            allergySeverity: 'CRITICAL',
            emergencyContactPhone: '0600000000',
          }),
          personne({ allergies: '   ' }),
          personne({ allergies: null }),
        ],
      })
    )
    expect(r.allergies).toEqual([
      {
        nom: 'Sam Bakker',
        allergies: 'arachide',
        cleGravite: 'gestion.meals.severity_critical',
        contactUrgence: '0600000000',
      },
    ])
  })

  it('connaît les quatre gravités, CRITICAL comprise', () => {
    // L'énumération AllergySeverity en porte quatre. En perdre une l'efface de la fiche — et
    // c'est précisément la plus grave qui décide si une erreur de service devient un accident.
    for (const [gravite, cle] of [
      ['LIGHT', 'gestion.meals.severity_light'],
      ['MODERATE', 'gestion.meals.severity_moderate'],
      ['SEVERE', 'gestion.meals.severity_severe'],
      ['CRITICAL', 'gestion.meals.severity_critical'],
    ] as const) {
      const r = resumerRepas(
        repas({ participants: [personne({ allergies: 'lait', allergySeverity: gravite })] })
      )
      expect(r.allergies[0]?.cleGravite).toBe(cle)
    }
  })

  it('accepte une allergie sans gravité renseignée', () => {
    const r = resumerRepas(repas({ participants: [personne({ allergies: 'gluten' })] }))
    expect(r.allergies[0]?.cleGravite).toBeNull()
  })
})

describe('lignesDeParticipants', () => {
  it('laisse la colonne régime vide pour « sans régime particulier »', () => {
    // Ce qui doit sauter aux yeux, c'est l'exception — pas la mention répétée sur chaque ligne.
    const lignes = lignesDeParticipants(
      repas({
        participants: [
          personne({ dietaryPreference: 'NONE' }),
          personne({ dietaryPreference: null }),
          personne({ dietaryPreference: 'VEGAN' }),
        ],
      })
    )
    expect(lignes.map((l) => l.cleRegime)).toEqual([null, null, 'gestion.meals.diet_vegan'])
  })

  it('rend la clé du type de personne pour les quatre populations', () => {
    const lignes = lignesDeParticipants(
      repas({
        participants: [
          personne({ type: 'volunteer' }),
          personne({ type: 'artist' }),
          personne({ type: 'participant' }),
          personne({ type: 'organizer' }),
        ],
      })
    )
    expect(lignes.map((l) => l.cleType)).toEqual([
      'gestion.meals.person_type.volunteer',
      'gestion.meals.person_type.artist',
      'gestion.meals.person_type.participant',
      'gestion.meals.person_type.organizer',
    ])
  })

  it('ne marque « après spectacle » que pour un artiste', () => {
    const lignes = lignesDeParticipants(
      repas({
        participants: [
          personne({ type: 'artist', afterShow: true }),
          personne({ type: 'volunteer', afterShow: true }),
          personne({ type: 'artist', afterShow: null }),
        ],
      })
    )
    expect(lignes.map((l) => l.apresSpectacle)).toEqual([true, false, false])
  })

  it('vide une allergie qui ne contient que des espaces', () => {
    const lignes = lignesDeParticipants(
      repas({ participants: [personne({ allergies: '  ' }), personne({ allergies: ' soja ' })] })
    )
    expect(lignes.map((l) => l.allergies)).toEqual([null, 'soja'])
  })

  it('garde l’ordre reçu', () => {
    // Le serveur a déjà trié ; réordonner ici ferait diverger la fiche de l'écran.
    const lignes = lignesDeParticipants(
      repas({
        participants: [personne({ nom: 'Zola' }), personne({ nom: 'Adam' })],
      })
    )
    expect(lignes.map((l) => l.nom)).toEqual(['Zola', 'Adam'])
  })
})

/**
 * Le nom des fichiers d'une journée de restauration.
 *
 * La feuille ne sort plus d'un bloc : le résumé part en cuisine, chaque liste à son point de
 * distribution. Quatre fichiers téléchargés d'affilée doivent se reconnaître SANS qu'on les
 * ouvre, sinon le découpage complique au lieu d'aider.
 */
describe('nomFichierRestauration', () => {
  it('distingue les documents d’une MÊME journée', () => {
    // Le point qui justifie la fonction : sans la partie dans le nom, le second téléchargement
    // écraserait le premier, ou s'empilerait en « (1) », « (2) ».
    const resume = nomFichierRestauration('Jongle en Zik', '2026-10-02', 'Résumé des repas')
    const dejeuner = nomFichierRestauration('Jongle en Zik', '2026-10-02', 'Déjeuner Convention')

    expect(resume).toBe('restauration-jongle-en-zik-2026-10-02-resume-des-repas.pdf')
    expect(dejeuner).toBe('restauration-jongle-en-zik-2026-10-02-dejeuner-convention.pdf')
    expect(resume).not.toBe(dejeuner)
  })

  it('retire les ACCENTS au lieu de les remplacer par un tiret', () => {
    // L'ancien nom se contentait d'un remplacement des caractères non alphanumériques :
    // « Été à Brévent » y devenait « -t--br-vent », un tiret là où il y avait une lettre.
    expect(nomFichierRestauration('Été à Brévent', '2026-10-02', 'Dîner')).toBe(
      'restauration-ete-a-brevent-2026-10-02-diner.pdf'
    )
  })

  it('ne laisse pas de tirets en trop', () => {
    expect(nomFichierRestauration('  Jongle !! ', '2026-10-02', '  Petit-déjeuner  ')).toBe(
      'restauration-jongle-2026-10-02-petit-dejeuner.pdf'
    )
  })

  it('se passe du nom de l’édition', () => {
    expect(nomFichierRestauration(null, '2026-10-02', 'Dîner')).toBe(
      'restauration-2026-10-02-diner.pdf'
    )
  })

  it('retombe sur un nom générique plutôt que sur une extension nue', () => {
    // Un fichier appelé « .pdf » est invisible sous Linux et illisible ailleurs.
    expect(nomFichierRestauration(null, '', '')).toBe('restauration.pdf')
  })
})

/**
 * Le mot qui décide de la largeur d'une colonne.
 *
 * Un PDF coupe une cellule trop étroite AU MILIEU d'un mot : « leschapeauxpointus.associa » puis
 * « tion@gmail.com » sur la ligne suivante. Sur une feuille qu'on emporte au service, il n'y a
 * pas d'écran pour aller vérifier ce qui a été coupé.
 *
 * Mesuré sur la base de développement : la plus longue adresse fait 42 caractères, soit 59 mm à
 * 8 points — la colonne en faisait 45.
 */
describe('motLePlusLong', () => {
  it('trouve le mot le plus long, pas la valeur la plus longue', () => {
    // La distinction est tout le sujet : « Jean-Baptiste de la Tour » est plus LONG que
    // « Wüllenweber », mais il se coupe aux espaces. C'est le second qui impose la largeur.
    expect(motLePlusLong(['Jean Baptiste de la Tour', 'Wüllenweber'])).toBe('Wüllenweber')
  })

  it('traite une adresse comme UN seul mot', () => {
    // Elle n'a aucune espace : c'est ce qui en fait la première colonne à déborder.
    const adresse = 'leschapeauxpointus.association@gmail.com'
    expect(motLePlusLong(['Alice', adresse])).toBe(adresse)
  })

  it('regarde aussi l’EN-TÊTE, pas seulement les valeurs', () => {
    // Un en-tête plus long que sa colonne se coupe exactement pareil.
    expect(motLePlusLong(['Sévérité', '-', '-'])).toBe('Sévérité')
  })

  it('ignore les valeurs absentes', () => {
    expect(motLePlusLong([null, undefined, 'Oui'])).toBe('Oui')
    expect(motLePlusLong([])).toBe('')
    expect(motLePlusLong([null])).toBe('')
  })

  it('n’est pas dupé par les espaces multiples ni les retours à la ligne', () => {
    expect(motLePlusLong(['  arachides   fruits\nà coque  '])).toBe('arachides')
  })

  it('compte en CARACTÈRES, la mesure en millimètres venant ensuite', () => {
    // La fonction ne connaît pas la police : c'est l'appelant qui mesure le mot rendu. Un « iii »
    // et un « WWW » ont ici la même longueur, et c'est `getTextWidth` qui les départage.
    expect(motLePlusLong(['iii', 'WW'])).toBe('iii')
  })
})

/**
 * Le code couleur des types de personnes, sur la feuille imprimée.
 *
 * Il reprend celui de l'écran — vert pour les bénévoles, jaune pour les artistes, violet pour
 * les organisateurs, bleu pour la billetterie. Un code qui changerait de sens d'une page à
 * l'autre serait pire que pas de couleur du tout.
 */
describe('couleurDuType', () => {
  it('donne une couleur aux QUATRE types', () => {
    for (const type of ['volunteer', 'artist', 'organizer', 'participant']) {
      expect(couleurDuType(type)).not.toBeNull()
    }
  })

  it('donne à chacun une couleur DIFFÉRENTE', () => {
    // Deux types de la même teinte ne se distinguent plus, et la colorisation ne sert à rien.
    const fonds = ['volunteer', 'artist', 'organizer', 'participant'].map((type) =>
      couleurDuType(type)!.fond.join(',')
    )
    expect(new Set(fonds).size).toBe(4)
  })

  it('ne rend RIEN pour un type inconnu', () => {
    // Plutôt qu'une couleur de repli : une cellule grise au milieu de quatre couleurs se lit
    // comme une cinquième catégorie, et l'on cherche laquelle.
    expect(couleurDuType('chaperon')).toBeNull()
    expect(couleurDuType('')).toBeNull()
    expect(couleurDuType(null)).toBeNull()
    expect(couleurDuType(undefined)).toBeNull()
  })

  it('garde un fond CLAIR et un texte SOMBRE', () => {
    // Le contraste est ce qui rend la cellule lisible une fois imprimée — et, sur une
    // photocopie en niveaux de gris, ce qui empêche le texte de se fondre dans son fond.
    for (const type of ['volunteer', 'artist', 'organizer', 'participant']) {
      const { fond, texte } = couleurDuType(type)!
      const clarte = (rvb: number[]) => (rvb[0]! + rvb[1]! + rvb[2]!) / 3
      expect(clarte(fond)).toBeGreaterThan(200)
      expect(clarte(texte)).toBeLessThan(150)
    }
  })

  it('rend des composantes RVB valides, telles que jsPDF les attend', () => {
    for (const type of ['volunteer', 'artist', 'organizer', 'participant']) {
      const couleur = couleurDuType(type)!
      for (const composantes of [couleur.fond, couleur.texte]) {
        expect(composantes).toHaveLength(3)
        for (const composante of composantes) {
          expect(Number.isInteger(composante)).toBe(true)
          expect(composante).toBeGreaterThanOrEqual(0)
          expect(composante).toBeLessThanOrEqual(255)
        }
      }
    }
  })
})

/**
 * Les colonnes du tableau des volumes.
 *
 * Elles ne sont pas fixes : billetterie et organisateurs n'apparaissent que si quelqu'un est
 * concerné. Une colonne déduite d'un seul repas décalerait les chiffres de tous les autres.
 */
describe('colonnesDePopulation', () => {
  const resume = (populations: Array<{ cle: string; nombre: number }>) =>
    ({ populations, regimes: [] }) as never

  it("prend l'union des populations de la journée, dans l'ordre rencontré", () => {
    expect(
      colonnesDePopulation([
        resume([
          { cle: 'benevoles', nombre: 4 },
          { cle: 'artistes', nombre: 2 },
        ]),
        resume([
          { cle: 'benevoles', nombre: 6 },
          { cle: 'billetterie', nombre: 30 },
        ]),
      ])
    ).toEqual(['benevoles', 'artistes', 'billetterie'])
  })

  it('ne répète jamais une colonne', () => {
    const colonnes = colonnesDePopulation([
      resume([{ cle: 'benevoles', nombre: 1 }]),
      resume([{ cle: 'benevoles', nombre: 2 }]),
    ])
    expect(colonnes).toEqual(['benevoles'])
  })

  it('rend une liste vide sans repas', () => {
    expect(colonnesDePopulation([])).toEqual([])
  })
})

describe('colonnesDeRegime', () => {
  it("prend l'union des régimes déclarés", () => {
    const resume = (regimes: Array<{ cle: string; nombre: number }>) =>
      ({ populations: [], regimes }) as never
    expect(
      colonnesDeRegime([
        resume([{ cle: 'vegetarien', nombre: 3 }]),
        resume([
          { cle: 'vegan', nombre: 1 },
          { cle: 'vegetarien', nombre: 2 },
        ]),
      ])
    ).toEqual(['vegetarien', 'vegan'])
  })

  /* Sans régime déclaré, le tableau entier disparaît : un tableau vide se lit comme un oubli. */
  it('rend une liste vide quand personne ne déclare de régime', () => {
    expect(colonnesDeRegime([{ populations: [], regimes: [] } as never])).toEqual([])
  })
})

describe('nombrePourCle', () => {
  const comptes = [
    { cle: 'benevoles', nombre: 4 },
    { cle: 'artistes', nombre: 0 },
  ]

  it('rend le nombre quand la clé est présente, zéro compris', () => {
    expect(nombrePourCle(comptes, 'benevoles')).toBe(4)
    expect(nombrePourCle(comptes, 'artistes')).toBe(0)
  })

  /*
   * `null` et non `0` : la cuisine ne lit pas la même chose. « 0 » dit qu'on a compté et qu'il n'y
   * a personne ; une case vide dit que la question ne se pose pas pour ce service.
   */
  it('rend null pour une clé absente, jamais zéro', () => {
    expect(nombrePourCle(comptes, 'billetterie')).toBeNull()
    expect(nombrePourCle([], 'benevoles')).toBeNull()
  })
})

/**
 * Le contact d'urgence, nom compris.
 *
 * Ses deux colonnes étaient déjà LUES en base puis jetées avant l'envoi : la colonne
 * « Téléphone d'urgence » du PDF était vide depuis toujours, sans que rien ne le signale.
 */
describe("contact d'urgence", () => {
  const avecContact = (nom: string | null, telephone: string | null) =>
    resumerRepas({
      mealType: 'LUNCH',
      phases: ['EVENT'],
      totalParticipants: 1,
      volunteerCount: 1,
      artistCount: 0,
      ticketParticipantCount: 0,
      organizerCount: 0,
      participants: [
        {
          type: 'volunteer',
          prenom: 'Sam',
          nom: 'Bakker',
          allergies: 'arachide',
          emergencyContactName: nom,
          emergencyContactPhone: telephone,
        },
      ],
    }).allergies[0]!.contactUrgence

  /* Le numéro à la ligne : sur une seule, la colonne se repliait n'importe où et coupait le
     numéro en deux. */
  it('écrit le nom, puis le numéro à la ligne', () => {
    expect(avecContact('Marie Dupont', '0612345678')).toBe('Marie Dupont\n0612345678')
  })

  /* Un numéro sans nom reste composable ; un nom sans numéro n'aide personne. */
  it('garde le numéro seul, et rend null pour un nom sans numéro', () => {
    expect(avecContact(null, '0612345678')).toBe('0612345678')
    expect(avecContact('Marie Dupont', null)).toBeNull()
    expect(avecContact(null, null)).toBeNull()
  })

  it('ignore les espaces qui ne portent rien', () => {
    expect(avecContact('  ', '  ')).toBeNull()
    expect(avecContact('  Marie  ', ' 0612345678 ')).toBe('Marie\n0612345678')
  })
})

/**
 * Les personnes du repas d'après spectacle.
 *
 * Le compte figurait déjà ; il manquait les noms et les numéros. Compte et liste sortent du MÊME
 * filtre : deux filtres qui divergeraient donneraient un nombre ne correspondant pas aux noms
 * écrits juste en dessous.
 */
describe('personnesApresSpectacle', () => {
  const repasAvec = (participants: any[]) =>
    resumerRepas({
      mealType: 'DINNER',
      phases: ['EVENT'],
      totalParticipants: participants.length,
      volunteerCount: 0,
      artistCount: participants.length,
      ticketParticipantCount: 0,
      organizerCount: 0,
      participants,
    })

  it('rend les noms, types et téléphones, et le compte qui va avec', () => {
    const r = repasAvec([
      { type: 'artist', prenom: 'Ada', nom: 'Lovelace', afterShow: true, phone: '0611' },
      { type: 'artist', prenom: 'Bo', nom: 'Diddley', afterShow: false },
      { type: 'artist', prenom: 'Cy', nom: 'Twombly', afterShow: true, phone: null },
    ])
    expect(r.apresSpectacle).toBe(2)
    expect(r.personnesApresSpectacle).toEqual([
      { nom: 'Ada Lovelace', telephone: '0611', cleType: 'gestion.meals.person_type.artist' },
      { nom: 'Cy Twombly', telephone: null, cleType: 'gestion.meals.person_type.artist' },
    ])
  })

  /*
   * Bénévoles et organisateurs déclarent désormais eux aussi un repas d'après spectacle. Chaque
   * ligne dit lequel : on n'attend pas un artiste en coulisses comme on croise un bénévole de
   * plateau au comptoir.
   */
  it('retient aussi les bénévoles et les organisateurs, en les nommant', () => {
    const r = repasAvec([
      { type: 'volunteer', prenom: 'Dee', nom: 'Dee', afterShow: true, phone: '0622' },
      { type: 'organizer', prenom: 'Eve', nom: 'Ensler', afterShow: true },
    ])
    expect(r.apresSpectacle).toBe(2)
    expect(r.personnesApresSpectacle.map((p) => p.cleType)).toEqual([
      'gestion.meals.person_type.volunteer',
      'gestion.meals.person_type.organizer',
    ])
  })
})
