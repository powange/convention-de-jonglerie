import { describe, expect, it } from 'vitest'

import {
  designerLaPersonne,
  type Designation,
} from '../../../../server/utils/ticketing/designation-participant'

/**
 * La règle qui sépare « ce qu'on me présente » de « ce que je sais déjà ».
 *
 * Ce qu'elle ferme : un QR code réduit à `volunteer-42` entrait, parce que le jeton n'était
 * vérifié que s'il était là. Ce qu'elle doit continuer de permettre : que l'écran de gestion
 * rouvre une fiche qu'il affiche déjà, sans avoir à transporter le jeton.
 */

/** Raccourci de lecture : la désignation d'une personne, ou l'échec. */
const genreDe = (d: Designation) => d.genre

describe('designerLaPersonne', () => {
  describe('un QR code présenté au scan', () => {
    it('exige le jeton pour un bénévole', () => {
      const d = designerLaPersonne({ qrCode: 'volunteer-42-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6' })
      expect(d).toEqual({
        genre: 'volunteer',
        id: 42,
        preuve: { qrCodeToken: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6' },
      })
    })

    it('exige le jeton pour un artiste et pour un organisateur', () => {
      expect(designerLaPersonne({ qrCode: 'artist-7-jeton' })).toEqual({
        genre: 'artist',
        id: 7,
        preuve: { qrCodeToken: 'jeton' },
      })
      expect(designerLaPersonne({ qrCode: 'organizer-3-jeton' })).toEqual({
        genre: 'organizer',
        id: 3,
        preuve: { qrCodeToken: 'jeton' },
      })
    })

    // Le cœur du correctif : ces trois-là entraient.
    it.each([['volunteer-42'], ['artist-7'], ['organizer-3']])(
      'refuse « %s », qui ne porte aucun jeton',
      (qrCode) => {
        const d = designerLaPersonne({ qrCode })
        expect(genreDe(d)).toBe('refus')
      }
    )

    it('refuse aussi la forme avec un tiret final mais rien derrière', () => {
      expect(genreDe(designerLaPersonne({ qrCode: 'volunteer-42-' }))).toBe('refus')
    })

    it('dit à la personne au guichet quoi faire, plutôt que « introuvable »', () => {
      const d = designerLaPersonne({ qrCode: 'volunteer-42' })
      if (d.genre !== 'refus') throw new Error('un refus était attendu')
      // Une CLÉ, pas une phrase : c'est le client qui connaît la langue de qui tient le guichet.
      expect(d.cle).toBe('qr_format_obsolete')
    })

    it('refuse un identifiant qui n’est pas un nombre', () => {
      const d = designerLaPersonne({ qrCode: 'volunteer-abc-jeton' })
      if (d.genre !== 'refus') throw new Error('un refus était attendu')
      expect(d.cle).toBe('qr_invalide')
    })

    it('laisse passer au billet tout ce qui ne porte aucun des trois préfixes', () => {
      expect(designerLaPersonne({ qrCode: 'onsite-0168d7ddee737c74' })).toEqual({
        genre: 'ticket',
        qrCode: 'onsite-0168d7ddee737c74',
      })
      // Un code HelloAsso n'a aucune forme imposée : il ne doit surtout pas être découpé.
      expect(designerLaPersonne({ qrCode: 'XY-12-34' })).toEqual({
        genre: 'ticket',
        qrCode: 'XY-12-34',
      })
    })
  })

  describe('une relecture demandée par l’écran de gestion', () => {
    it('n’exige aucun jeton : la preuve est le droit de qui interroge', () => {
      expect(designerLaPersonne({ type: 'volunteer', id: 42 })).toEqual({
        genre: 'volunteer',
        id: 42,
        preuve: {},
      })
    })

    it('rend une preuve vide, et non un jeton nul — il n’y a rien à tester chez l’appelant', () => {
      const d = designerLaPersonne({ type: 'organizer', id: 3 })
      if (d.genre === 'refus' || d.genre === 'ticket')
        throw new Error('une personne était attendue')
      expect(Object.keys(d.preuve)).toHaveLength(0)
      // Étalé dans un `where`, cela n'ajoute aucune condition.
      expect({ id: 3, ...d.preuve }).toEqual({ id: 3 })
    })
  })
})
