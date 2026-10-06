import { describe, expect, it } from 'vitest'

import { cleDeBoiteDeReception } from '../../../shared/utils/adresse-email'
import {
  cleDuTitre,
  meriteUnGesteGroupe,
  regrouperParPersonne,
  titresAValider,
  type CompteConnu,
  type TitreRapprochable,
} from '../../../shared/utils/regroupement-controle-acces'

/**
 * Rapprocher les titres d'une même personne au contrôle d'accès.
 *
 * ⚠️ POURQUOI CES TESTS SONT LES PLUS IMPORTANTS DU LOT. Une erreur ici ne produit pas un écran
 * laid : elle fait **valider l'entrée de quelqu'un qui n'est pas là**. Chaque cas ci-dessous est
 * une façon de confondre deux personnes, ou d'en perdre une.
 *
 * 📍 Les chiffres cités viennent d'un relevé du 06/10/2026 sur la base de développement, et ce
 * sont eux qui ont dicté la clé — pas une intuition.
 */

const billet = (over: Partial<TitreRapprochable> = {}): TitreRapprochable => ({
  nature: 'ticket',
  id: 1,
  email: 'jean@example.com',
  prenom: 'Jean',
  nom: 'Dupont',
  ...over,
})

/** La table que le point d'API fournira : les comptes, rangés par boîte de réception. */
const comptes = (liste: CompteConnu[], email = 'jean@example.com') =>
  new Map([[cleDeBoiteDeReception(email)!, liste]])

const benevole = (over: Partial<TitreRapprochable> = {}): TitreRapprochable => ({
  nature: 'volunteer',
  id: 10,
  userId: 7,
  email: 'jean@example.com',
  prenom: 'Jean',
  nom: 'Dupont',
  ...over,
})

describe('la clé d’un titre', () => {
  it('est le COMPTE quand le titre en a un', () => {
    // Certain : deux titres du même compte sont la même personne, sans discussion.
    expect(cleDuTitre(benevole())).toEqual({ cle: 'compte:7', motif: 'compte' })
  })

  it('est le courriel ET LE NOM pour un billet', () => {
    const identite = cleDuTitre(billet())
    expect(identite?.motif).toBe('courriel-et-nom')
    expect(identite?.cle).toContain('jean@example.com')
    expect(identite?.cle).toContain('jean dupont')
  })

  it('ne rend RIEN sans courriel, ni sans nom', () => {
    /*
     * ⚠️ Ces titres resteront SEULS, et c'est le choix prudent. Un nom seul est trop faible —
     * « trop d'homonymes », dit déjà `doublons-utilisateurs` — et un courriel seul, c'est 27 %
     * d'erreurs mesurées.
     */
    expect(cleDuTitre(billet({ email: null }))).toBeNull()
    expect(cleDuTitre(billet({ prenom: null, nom: null }))).toBeNull()
    expect(cleDuTitre(billet({ email: 'pas une adresse' }))).toBeNull()
  })

  it('ignore la casse, les espaces et les alias de boîte', () => {
    // `cleDeBoiteDeReception` traite déjà les alias `+` et les points Google : on en hérite, et
    // c'est l'exigence du NOM qui rend cette largeur sans danger.
    const a = cleDuTitre(billet({ email: 'Jean.Dupont+asso@gmail.com', prenom: ' JEAN ' }))
    const b = cleDuTitre(billet({ email: 'jeandupont@googlemail.com', prenom: 'jean' }))
    expect(a?.cle).toBe(b?.cle)
  })
})

describe('regrouper des titres en personnes', () => {
  it('réunit les titres d’un même compte', () => {
    const personnes = regrouperParPersonne([
      benevole({ id: 10 }),
      { nature: 'artist', id: 20, userId: 7, prenom: 'Jean', nom: 'Dupont' },
    ])

    expect(personnes).toHaveLength(1)
    expect(personnes[0]!.motif).toBe('compte')
    expect(personnes[0]!.titres.map((t) => t.nature)).toEqual(['volunteer', 'artist'])
  })

  it('RÉUNIT un billet et une candidature de bénévole', () => {
    /*
     * ⚠️ LE CAS QUE L'UTILISATEUR DÉCRIT, et celui qui justifie tout le lot : une commande en
     * ligne et un titre de bénévole, qu'il fallait chercher deux fois. Sans les comptes connus,
     * ces deux titres resteraient deux personnes — le billet n'a pas de compte en base.
     */
    const personnes = regrouperParPersonne(
      [billet({ id: 1 }), benevole({ id: 10 })],
      comptes([{ userId: 7, prenom: 'Jean', nom: 'Dupont' }])
    )

    expect(personnes).toHaveLength(1)
    expect(personnes[0]!.titres.map((t) => t.nature).sort()).toEqual(['ticket', 'volunteer'])
    // Le motif dit sur quoi repose la jonction : ici le courriel et le nom, pas une relation en
    // base. L'écran doit pouvoir l'annoncer.
    expect(personnes[0]!.motif).toBe('courriel-et-nom')
  })

  it('NE RÉSOUT PAS un billet vers un compte au nom DIFFÉRENT', () => {
    /*
     * ⚠️ LA GARDE QUI ÉVITE LE PIRE. Un billet acheté par un parent pour son enfant porte le nom
     * de l'enfant et le courriel du parent. Résoudre sur le seul courriel l'aurait rattaché au
     * compte du parent — et valider le parent aurait validé l'enfant absent.
     */
    const personnes = regrouperParPersonne(
      [billet({ id: 1, prenom: 'Lucie', nom: 'Dupont' }), benevole({ id: 10 })],
      comptes([{ userId: 7, prenom: 'Jean', nom: 'Dupont' }])
    )

    expect(personnes).toHaveLength(2)
  })

  it('n’affirme RIEN quand deux comptes se disputent le même nom et la même boîte', () => {
    // Invraisemblable, mais un rapprochement ambigu au contrôle d'accès se paie en entrées
    // validées à tort : on préfère laisser le billet seul.
    const personnes = regrouperParPersonne(
      [billet({ id: 1 })],
      comptes([
        { userId: 7, prenom: 'Jean', nom: 'Dupont' },
        { userId: 8, prenom: 'Jean', nom: 'Dupont' },
      ])
    )

    expect(personnes).toHaveLength(1)
    expect(personnes[0]!.cle).toContain('courriel:')
  })

  it('NE CONFOND PAS deux noms sous un même courriel', () => {
    /*
     * ⚠️ LE CAS QUI A DICTÉ LA CLÉ. 163 courriels sur 609 portent des billets à plusieurs noms, et
     * l'un d'eux en porte 63 — une association achetant pour son groupe. Grouper par courriel
     * seul aurait validé l'entrée de 62 absents d'un seul clic.
     */
    const personnes = regrouperParPersonne([
      billet({ id: 1, prenom: 'Jean', nom: 'Dupont' }),
      billet({ id: 2, prenom: 'Marie', nom: 'Durand' }),
      billet({ id: 3, prenom: 'Paul', nom: 'Martin' }),
    ])

    expect(personnes).toHaveLength(3)
  })

  it('réunit en revanche les billets d’un MÊME nom', () => {
    // Deux billets de la même personne — un pass et un repas, par exemple.
    const personnes = regrouperParPersonne([billet({ id: 1 }), billet({ id: 2 })])

    expect(personnes).toHaveLength(1)
    expect(personnes[0]!.titres.map((t) => t.id)).toEqual([1, 2])
  })

  it('ne PERD aucun titre qu’on ne peut pas rapprocher', () => {
    /*
     * Un titre sans clé reste seul mais reste LÀ : il doit rester validable. Les faire disparaître
     * serait le pire défaut possible — un billet qui n'existe plus à l'écran ne se valide jamais.
     */
    const personnes = regrouperParPersonne([
      billet({ id: 1, email: null }),
      billet({ id: 2, email: null }),
      benevole({ id: 10 }),
    ])

    expect(personnes).toHaveLength(3)
    // Comparateur explicite : `.sort()` nu trie en CHAÎNES, et rendait [1, 10, 2].
    const ids = personnes.flatMap((p) => p.titres).map((t) => t.id)
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2, 10])
  })

  it('compte ce qui reste à valider, et met ces personnes en tête', () => {
    const personnes = regrouperParPersonne([
      // Déjà entièrement validée.
      benevole({ id: 10, userId: 1, entryValidated: true }),
      // Deux titres à valider.
      benevole({ id: 11, userId: 2 }),
      { nature: 'artist', id: 21, userId: 2, prenom: 'A', nom: 'B' },
    ])

    expect(personnes[0]!.aValider).toBe(2)
    expect(personnes[1]!.aValider).toBe(0)
  })

  it('annonce le motif le PLUS FAIBLE d’un groupe', () => {
    /*
     * ⚠️ UN GROUPE VAUT SON MAILLON LE PLUS FAIBLE. J'avais d'abord écrit l'inverse, et ce test
     * l'a dit : réunir un bénévole certain et un billet rapproché par courriel donne un groupe
     * INCERTAIN, puisque c'est l'appartenance du billet qui est en jeu. L'annoncer « compte »
     * aurait fait traiter le groupe comme sûr, sans rien demander.
     *
     * Ici les deux titres portent le MÊME compte : le groupe est donc bien certain.
     */
    const personnes = regrouperParPersonne([
      { nature: 'ticket', id: 1, userId: 5, email: 'x@y.fr', prenom: 'A', nom: 'B' },
      { nature: 'volunteer', id: 10, userId: 5, prenom: 'A', nom: 'B' },
    ])

    expect(personnes).toHaveLength(1)
    expect(personnes[0]!.motif).toBe('compte')
  })

  it('rend une liste vide sur une entrée vide', () => {
    expect(regrouperParPersonne([])).toEqual([])
  })
})

describe('proposer — ou non — un geste groupé', () => {
  const personne = (titres: number, aValider: number) => ({
    cle: 'compte:1',
    motif: 'compte' as const,
    libelle: 'Jean Dupont',
    titres: Array.from({ length: titres }, (_, i) => ({ nature: 'ticket' as const, id: i })),
    aValider,
  })

  it('⚠️ LE CAS SIGNALÉ : un seul titre RESTANT ne vaut pas un encart', () => {
    /*
     * Quelqu'un dont le billet est déjà validé et à qui il ne reste que sa place d'organisateur.
     * L'encart proposerait « Valider le titre restant » à côté du titre lui-même, dans la liste
     * juste en dessous — une seconde façon de faire la même chose, assortie d'un avertissement
     * sur le rapprochement par courriel qui n'a plus d'objet.
     */
    expect(meriteUnGesteGroupe(personne(2, 1))).toBe(false)
  })

  it('deux titres à valider : là, le geste fait gagner une recherche', () => {
    expect(meriteUnGesteGroupe(personne(2, 2))).toBe(true)
  })

  it('rien à valider : rien à proposer', () => {
    expect(meriteUnGesteGroupe(personne(3, 0))).toBe(false)
  })

  it('un seul titre, même à valider, reste l’affaire des listes', () => {
    expect(meriteUnGesteGroupe(personne(1, 1))).toBe(false)
  })
})

describe('les titres que le geste groupé doit montrer', () => {
  const personne = {
    cle: 'compte:1',
    motif: 'courriel-et-nom' as const,
    libelle: 'Emma Omer',
    aValider: 2,
    titres: [
      { nature: 'ticket' as const, id: 1456, entryValidated: true },
      { nature: 'artist' as const, id: 7 },
      { nature: 'organizer' as const, id: 9, entryValidated: false },
    ],
  }

  it('⚠️ LE CAS SIGNALÉ : le billet DÉJÀ validé ne doit pas s’afficher', () => {
    /*
     * Le bouton annonce « Valider les 2 titres restants ». Ouvrir une fiche où figure aussi le
     * billet validé la veille fait douter de ce qu'on s'apprête à valider, et oblige à relire
     * trois blocs pour en retrouver deux.
     */
    expect(titresAValider(personne).map((t) => t.nature)).toEqual(['artist', 'organizer'])
  })

  it('`entryValidated` absent se lit comme « à valider »', () => {
    // Les listes ne le portent pas toujours ; le supposer validé ferait DISPARAÎTRE un titre
    // qu'il faut remettre — l'erreur coûteuse, dans ce sens-là.
    expect(titresAValider({ ...personne, titres: [{ nature: 'artist', id: 7 }] })).toHaveLength(1)
  })

  it('tout validé : plus rien à montrer', () => {
    const tout = personne.titres.map((t) => ({ ...t, entryValidated: true }))
    expect(titresAValider({ ...personne, titres: tout })).toEqual([])
  })
})
