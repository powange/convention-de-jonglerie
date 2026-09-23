import { describe, expect, it } from 'vitest'

import { cleDeBoiteDeReception } from '../../../shared/utils/adresse-email'
import {
  chercherLesDoublons,
  cleIdentiteCivile,
  clePseudo,
  cleTelephone,
  fragmentsDeTelephone,
  TAILLE_DE_GRAPPE_SUSPECTE,
  type CompteAComparer,
} from '../../../shared/utils/doublons-utilisateurs'

const compte = (id: number, p: Partial<CompteAComparer> = {}): CompteAComparer => ({
  id,
  email: `u${id}@exemple.fr`,
  pseudo: `pseudo${id}`,
  ...p,
})

describe('cleDeBoiteDeReception', () => {
  it('confond les écritures qui mènent à la même boîte Google', () => {
    const attendu = 'jeandupont@gmail.com'
    expect(cleDeBoiteDeReception('Jean.Dupont@Gmail.com')).toBe(attendu)
    expect(cleDeBoiteDeReception('jeandupont@gmail.com')).toBe(attendu)
    expect(cleDeBoiteDeReception('jean.dupont+asso@googlemail.com')).toBe(attendu)
  })

  /*
   * Hors de chez Google, un point sépare deux personnes : les retirer accuserait à tort.
   */
  it('ne retire pas les points ailleurs que chez Google', () => {
    expect(cleDeBoiteDeReception('jean.dupont@exemple.fr')).toBe('jean.dupont@exemple.fr')
    expect(cleDeBoiteDeReception('jeandupont@exemple.fr')).toBe('jeandupont@exemple.fr')
  })

  it('coupe le sous-adressage partout', () => {
    expect(cleDeBoiteDeReception('jean+asso@exemple.fr')).toBe('jean@exemple.fr')
  })

  it("rend null sur ce qui n'est pas une adresse, ou sur un nom local vidé", () => {
    expect(cleDeBoiteDeReception('pas une adresse')).toBeNull()
    expect(cleDeBoiteDeReception('')).toBeNull()
    expect(cleDeBoiteDeReception('+alias@exemple.fr')).toBeNull()
  })
})

describe('cleIdentiteCivile', () => {
  it('ignore casse, accents et espaces superflus', () => {
    expect(cleIdentiteCivile(' Dupont ', 'JEAN')).toBe('jean dupont')
    expect(cleIdentiteCivile('Dupont', 'Jéan')).toBe('jean dupont')
  })

  /* Un nom seul rapprocherait tous les homonymes ; un prénom seul, la moitié du fichier. */
  it('exige les deux champs', () => {
    expect(cleIdentiteCivile('Dupont', null)).toBeNull()
    expect(cleIdentiteCivile(null, 'Jean')).toBeNull()
    expect(cleIdentiteCivile('Dupont', '  ')).toBeNull()
  })
})

describe('cleTelephone', () => {
  it('confond deux écritures du même numéro', () => {
    expect(cleTelephone('+33 6 12 34 56 78')).toBe(cleTelephone('0612345678'))
  })

  /*
   * Mesuré en base de développement : `00000000` est partagé par 7 comptes, `000000` par 3.
   * Ce sont des remplissages, et les grouper produirait une fausse grappe.
   */
  it('écarte les remplissages et les numéros trop courts', () => {
    expect(cleTelephone('00000000')).toBeNull()
    expect(cleTelephone('000000')).toBeNull()
    expect(cleTelephone('1111111111')).toBeNull()
    expect(cleTelephone('123456')).toBeNull()
    expect(cleTelephone(null)).toBeNull()
  })
})

describe('clePseudo', () => {
  /* Les quatre cas relevés en base : ce sont eux que la règle doit attraper. */
  it('rapproche les pseudos qui ne diffèrent que par un suffixe ou un séparateur', () => {
    expect(clePseudo('Adrien')).toBe(clePseudo('adrien.1'))
    expect(clePseudo('Lulu')).toBe(clePseudo('Lulu84'))
    expect(clePseudo('Jo Ris')).toBe(clePseudo('Joris'))
    expect(clePseudo('romain_noel_1787647383299')).toBe(clePseudo('romainnoel'))
  })

  it('ne rapproche pas deux pseudos réellement différents', () => {
    expect(clePseudo('Jongleur')).not.toBe(clePseudo('Jongleuse'))
  })

  it('refuse les clés trop courtes pour affirmer quoi que ce soit', () => {
    expect(clePseudo('Jo')).toBeNull()
    expect(clePseudo('42')).toBeNull()
    expect(clePseudo('')).toBeNull()
  })
})

describe('chercherLesDoublons', () => {
  it('ne rend rien quand aucun compte ne se ressemble', () => {
    expect(
      chercherLesDoublons([
        compte(1, { email: 'alice@exemple.fr', pseudo: 'Alice' }),
        compte(2, { email: 'bob@exemple.fr', pseudo: 'Bob' }),
      ])
    ).toEqual([])
  })

  it('rapproche par boîte de réception et nomme le motif', () => {
    const grappes = chercherLesDoublons([
      compte(1, { email: 'jean.dupont@gmail.com', pseudo: 'Jean' }),
      compte(2, { email: 'jeandupont+asso@gmail.com', pseudo: 'Dupont' }),
    ])
    expect(grappes).toHaveLength(1)
    expect(grappes[0]).toMatchObject({
      motif: 'boite',
      cle: 'jeandupont@gmail.com',
      comptes: [1, 2],
      suspecte: false,
    })
  })

  /*
   * Un même couple rapproché par deux motifs apparaît deux fois, à dessein : c'est un candidat
   * plus fort qu'un couple rapproché par un seul.
   */
  it('cumule les motifs pour un même couple', () => {
    const grappes = chercherLesDoublons([
      compte(1, { pseudo: 'RomainNoel', nom: 'Noel', prenom: 'Romain' }),
      compte(2, { pseudo: 'romain_noel_2', nom: 'noël', prenom: 'romain' }),
    ])
    expect(grappes.map((g) => g.motif)).toEqual(['identite', 'pseudo'])
  })

  it('signale les grappes trop nombreuses sans les cacher', () => {
    const comptes = Array.from({ length: TAILLE_DE_GRAPPE_SUSPECTE + 1 }, (_, i) =>
      compte(i + 1, { phone: '+33612345678' })
    )
    const grappe = chercherLesDoublons(comptes).find((g) => g.motif === 'telephone')
    expect(grappe?.comptes).toHaveLength(TAILLE_DE_GRAPPE_SUSPECTE + 1)
    expect(grappe?.suspecte).toBe(true)
  })

  it('laisse une grappe à la taille limite non suspecte', () => {
    const comptes = Array.from({ length: TAILLE_DE_GRAPPE_SUSPECTE }, (_, i) =>
      compte(i + 1, { phone: '+33612345678' })
    )
    expect(chercherLesDoublons(comptes).find((g) => g.motif === 'telephone')?.suspecte).toBe(false)
  })

  it('classe les motifs du plus sûr au plus bavard, puis les paires avant les grappes', () => {
    const grappes = chercherLesDoublons([
      compte(1, { email: 'a@gmail.com', pseudo: 'Commun', phone: '+33611111112' }),
      compte(2, { email: 'a+x@gmail.com', pseudo: 'Commun2', phone: '+33611111112' }),
      compte(3, { pseudo: 'Commun3', phone: '+33611111112' }),
    ])
    expect(grappes.map((g) => g.motif)).toEqual(['boite', 'telephone', 'pseudo'])
  })
})

describe('fragmentsDeTelephone', () => {
  /*
   * Les six saisies jouées contre la base, dont les deux qui échouaient : « 0616810413 » et
   * « 0616 8104 ». Dans les deux cas c'est le préfixe qui diffère du « +33616810413 » stocké.
   */
  it('propose une écriture qui se retrouve dans le format international stocké', () => {
    expect(fragmentsDeTelephone('0616810413')).toContain('616810413')
    expect(fragmentsDeTelephone('06 16 81 04 13')).toContain('616810413')
    expect(fragmentsDeTelephone('0616 8104')).toContain('6168104')
  })

  /* Un fragment déjà compatible reste tel quel : rien à retirer. */
  it('laisse intact un fragment qui ne porte pas de zéro national', () => {
    expect(fragmentsDeTelephone('8104')).toEqual(['8104'])
    expect(fragmentsDeTelephone('616810')).toEqual(['616810'])
    expect(fragmentsDeTelephone('+33616')).toEqual(['33616'])
  })

  /* En deçà de trois chiffres, la recherche ramènerait presque tout le fichier. */
  it('refuse une saisie trop courte pour désigner quoi que ce soit', () => {
    expect(fragmentsDeTelephone('42')).toEqual([])
    expect(fragmentsDeTelephone('')).toEqual([])
    expect(fragmentsDeTelephone(null)).toEqual([])
  })

  /* Un nom ne doit pas être pris pour un numéro. */
  it('ignore ce qui ne porte pas assez de chiffres', () => {
    expect(fragmentsDeTelephone('Camille Bakker')).toEqual([])
    expect(fragmentsDeTelephone('jongleur42')).toEqual([])
  })

  /*
   * Contrairement à `cleTelephone`, aucun filtrage des remplissages : chercher explicitement
   * « 0600000000 » doit trouver les comptes qui le portent, justement pour pouvoir les traiter.
   */
  it('ne filtre pas les numéros de remplissage, à la différence de cleTelephone', () => {
    expect(fragmentsDeTelephone('0600000000')).toContain('600000000')
    expect(cleTelephone('0000000000')).toBeNull()
    expect(fragmentsDeTelephone('0000000000')).toContain('000000000')
  })
})
