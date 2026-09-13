import { describe, expect, it } from 'vitest'

import {
  aDesDetailsTechniques,
  detailsTechniques,
  TYPE_CLE_I18N_MANQUANTE,
} from '../../../app/utils/details-techniques-log'

/**
 * `prismaDetails` était collecté, stocké, renvoyé par l'endpoint de détail — et affiché nulle
 * part : la sélection de la liste l'écartait derrière un TODO périmé, recopié deux fois.
 *
 * Ce qui rend son affichage moins trivial qu'il n'y paraît, c'est que la colonne porte DEUX
 * contenus sans rapport : le détail d'une erreur de base de données, et le décompte d'une clé de
 * traduction manquante. Ces tests tiennent surtout cette frontière, et le fait que rien ne se
 * perde en chemin.
 */
describe('detailsTechniques', () => {
  describe('une erreur de base de données', () => {
    it('nomme les champs Prisma au lieu de rendre du JSON à décoder', () => {
      const details = detailsTechniques('DatabaseUniqueConstraintError', {
        code: 'P2002',
        sqlState: '23000',
        sqlMessage: "Duplicate entry 'a@b.c' for key 'User_email_key'",
      })

      expect(details?.forme).toBe('prisma')
      expect(details?.lignes).toEqual([
        { cle: 'Code Prisma', valeur: 'P2002' },
        { cle: 'État SQL', valeur: '23000' },
        { cle: 'Message SQL', valeur: "Duplicate entry 'a@b.c' for key 'User_email_key'" },
      ])
    })

    it('range `meta` dans le reste plutôt que de lui inventer une étiquette', () => {
      // Sa forme dépend du code d'erreur Prisma : aucune étiquette fixe ne la décrirait
      // honnêtement, elle part donc dans le bloc JSON.
      const details = detailsTechniques('DatabaseError', {
        code: 'P2002',
        meta: { target: ['email'] },
      })

      expect(details?.lignes).toEqual([{ cle: 'Code Prisma', valeur: 'P2002' }])
      expect(details?.reste).toEqual({ meta: { target: ['email'] } })
    })

    it('n’affiche pas un bloc JSON vide sous des lignes déjà lisibles', () => {
      expect(detailsTechniques('DatabaseError', { code: 'P2025' })?.reste).toBeNull()
    })
  })

  describe('une clé de traduction manquante', () => {
    it('lit le même champ tout autrement', () => {
      // `i18n/missing-keys.post.ts` se sert de la colonne comme d'un sac à métadonnées. Rien à
      // voir avec Prisma, malgré le nom.
      const details = detailsTechniques(TYPE_CLE_I18N_MANQUANTE, {
        locales: ['fr', 'en'],
        occurrences: 12,
        lastPath: '/editions/22/benevoles',
      })

      expect(details?.forme).toBe('i18n')
      expect(details?.lignes).toEqual([
        { cle: 'Occurrences', valeur: '12' },
        { cle: 'Langues', valeur: 'fr, en' },
        { cle: 'Dernière page', valeur: '/editions/22/benevoles' },
      ])
    })

    it('se décide sur le type d’erreur, pas sur la forme de l’objet', () => {
      // Deviner d'après les clés présentes reviendrait à redécouvrir ce que la donnée dit déjà —
      // et se tromperait le jour où les deux formes partageront un nom de champ.
      const details = detailsTechniques('DatabaseError', { occurrences: 3 })

      expect(details?.forme).toBe('inconnue')
      expect(details?.lignes).toEqual([])
      expect(details?.reste).toEqual({ occurrences: 3 })
    })
  })

  describe('ce qui ne doit jamais disparaître', () => {
    it('rend intégralement une forme qu’il ne reconnaît pas', () => {
      // Un troisième usage de la colonne qu'on n'aurait pas vu venir doit s'afficher en entier,
      // quitte à être brut — jamais s'évanouir en silence.
      const details = detailsTechniques('UnknownError', { quelqueChose: 'inattendu' })

      expect(details?.forme).toBe('inconnue')
      expect(details?.reste).toEqual({ quelqueChose: 'inattendu' })
    })

    it('garde les valeurs qui comptent bien qu’elles soient « fausses »', () => {
      // `0` occurrence ou un état SQL vide ne sont pas des absences.
      const details = detailsTechniques(TYPE_CLE_I18N_MANQUANTE, { occurrences: 0 })

      expect(details?.lignes).toEqual([{ cle: 'Occurrences', valeur: '0' }])
    })
  })

  describe('quand il n’y a rien à montrer', () => {
    it('rend `null` plutôt qu’un bloc vide', () => {
      // C'est le cas de la plupart des logs : la colonne n'est alimentée que pour les erreurs de
      // base de données et les clés i18n.
      for (const rien of [null, undefined, {}, 'texte', 42, []])
        expect(detailsTechniques('UnknownError', rien)).toBeNull()
    })
  })
})

describe('aDesDetailsTechniques', () => {
  it('n’accepte qu’un objet garni', () => {
    expect(aDesDetailsTechniques({ code: 'P2002' })).toBe(true)

    for (const rien of [null, undefined, {}, [], ['P2002'], 'P2002', 0])
      expect(aDesDetailsTechniques(rien)).toBe(false)
  })
})
