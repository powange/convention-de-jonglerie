import { describe, it, expect } from 'vitest'

import {
  GIF_MINIMAL,
  JPEG_MINIMAL,
  PDF_MINIMAL,
  PNG_MINIMAL,
  TEXTE_DEGUISE_EN_IMAGE,
  WEBP_MINIMAL,
  fichierDepose,
} from '../../../fixtures/fichiers-minimaux'

import {
  ALLOWED_RECEIPT_EXTENSIONS,
  ALLOWED_RECEIPT_MIME_TYPES,
  typeReelDuContenu,
  validateUploadedFile,
} from '../../../../server/utils/upload-validation'

/**
 * Le type RÉEL d'un fichier déposé — constat A2.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * La validation ne comparait que le type MIME **déclaré par le navigateur** et l'extension du nom —
 * deux valeurs que le client choisit. Un fichier arbitraire renommé `.png` était accepté, stocké,
 * puis servi avec `Content-Type: image/png` par la route `/uploads/**`. La CSP et le `nosniff` de
 * nuxt-security limitent l'exploitation, mais le stockage acceptait n'importe quoi de moins de
 * 10 Mo, et une image corrompue ne se découvrait qu'à l'affichage.
 *
 * ⚠️ Le commentaire de la fonction l'écrivait noir sur blanc depuis le début : « Pour une vraie
 * validation, contrôler aussi les magic bytes ». **Un constat documenté dans le code n'est pas un
 * constat traité.**
 *
 * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
 *
 * Les contenus sont de VRAIS débuts de fichiers, pas des chaînes inventées — et c'est ce qui a
 * changé dans deux fichiers de test existants, qui déposaient `'fake image data'` en se disant
 * JPEG. Ils passaient parce que rien ne regardait le contenu ; ils seraient restés verts quelle que
 * soit la correction.
 *
 * Le témoin est le fichier LÉGITIME de chaque format : sans eux, un validateur qui refuserait tout
 * satisferait les cas de refus — et plus personne ne pourrait déposer d'affiche.
 */
describe('le type réel d’un fichier déposé', () => {
  describe('la signature reconnue', () => {
    it.each([
      ['JPEG', JPEG_MINIMAL, 'image/jpeg'],
      ['PNG', PNG_MINIMAL, 'image/png'],
      ['GIF', GIF_MINIMAL, 'image/gif'],
      ['WebP', WEBP_MINIMAL, 'image/webp'],
      ['PDF', PDF_MINIMAL, 'application/pdf'],
    ])('reconnaît un %s', (_nom, contenu, attendu) => {
      expect(typeReelDuContenu(contenu)).toBe(attendu)
    })

    it('⚠️ NE RECONNAÎT PAS DU TEXTE DÉGUISÉ', () => {
      /*
       * LE CŒUR DU CONSTAT : `'fake image data'` annoncé `image/jpeg`. C'est le contenu exact que
       * deux fichiers de test employaient, et il était accepté.
       */
      expect(typeReelDuContenu(TEXTE_DEGUISE_EN_IMAGE)).toBeNull()
    })

    it('⚠️ N’ACCEPTE PAS UN RIFF QUI N’EST PAS UN WEBP', () => {
      /*
       * La signature WebP est en DEUX morceaux : `RIFF` aux octets 0-3, `WEBP` aux octets 8-11. Se
       * contenter des quatre premiers accepterait n'importe quel conteneur RIFF — un fichier audio
       * WAV les porte aussi, et serait alors servi comme une image.
       */
      const wav = `data:image/webp;base64,${Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
      ]).toString('base64')}`

      expect(typeReelDuContenu(wav)).toBeNull()
    })

    it('lit un contenu base64 nu, sans préfixe de data-URL', () => {
      // nuxt-file-storage rend une data-URL, mais rien ne garantit qu'un appelant futur fasse de
      // même : perdre la signature faute de préfixe refuserait des fichiers parfaitement valides.
      const nu = PNG_MINIMAL.slice(PNG_MINIMAL.indexOf(',') + 1)

      expect(typeReelDuContenu(nu)).toBe('image/png')
    })
  })

  describe('la validation complète', () => {
    it('⚠️ REFUSE DU TEXTE RENOMMÉ EN IMAGE', () => {
      const faux = fichierDepose(TEXTE_DEGUISE_EN_IMAGE, 'affiche.jpg', 'image/jpeg')

      expect(() => validateUploadedFile(faux)).toThrow(/ne correspond à aucun format/)
    })

    it('⚠️ REFUSE UN VRAI PNG QUI SE DÉCLARE JPEG', () => {
      /*
       * Le type déclaré décide de l'en-tête `Content-Type` avec lequel le fichier sera servi : un
       * PNG annoncé JPEG serait servi avec le mauvais, et une liste blanche d'images laisserait
       * passer un PDF annoncé `image/png`. Connaître le type réel ne suffit donc pas, il doit
       * CORRESPONDRE.
       */
      const menteur = fichierDepose(PNG_MINIMAL, 'affiche.jpg', 'image/jpeg')

      expect(() => validateUploadedFile(menteur)).toThrow(/est un image\/png, pas un image\/jpeg/)
    })

    it('⚠️ REFUSE UN PDF LÀ OÙ SEULES LES IMAGES SONT ADMISES', () => {
      // Un vrai PDF, honnêtement déclaré : c'est la liste blanche de l'appelant qui tranche.
      const pdf = fichierDepose(PDF_MINIMAL, 'facture.pdf', 'application/pdf')

      expect(() => validateUploadedFile(pdf)).toThrow(/Type de fichier non autorisé/)
    })

    it('accepte une vraie image', () => {
      /*
       * LE TÉMOIN. Sans lui, un validateur qui refuserait tout satisferait les trois cas ci-dessus,
       * et plus personne ne pourrait déposer d'affiche.
       */
      const vraie = fichierDepose(JPEG_MINIMAL, 'affiche.jpg', 'image/jpeg')

      expect(() => validateUploadedFile(vraie)).not.toThrow()
    })

    it('accepte un PDF comme justificatif', () => {
      /*
       * SECOND TÉMOIN, et il a failli manquer : la fiche d'audit ne parlait que d'images. Un
       * justificatif de trésorerie peut être un PDF — oublier sa signature aurait fait refuser
       * TOUTES les factures, et le défaut serait passé pour une correction.
       */
      const facture = fichierDepose(PDF_MINIMAL, 'facture.pdf', 'application/pdf')

      expect(() =>
        validateUploadedFile(facture, {
          allowedMimeTypes: ALLOWED_RECEIPT_MIME_TYPES,
          allowedExtensions: ALLOWED_RECEIPT_EXTENSIONS,
        })
      ).not.toThrow()
    })

    it('refuse encore sur le type déclaré, avant même de lire le contenu', () => {
      /*
       * Les trois contrôles d'origine restent : ils donnent des messages plus utiles à qui s'est
       * simplement trompé de fichier. Celui du contenu vient en dernier, et ne les remplace pas.
       */
      const executable = fichierDepose(JPEG_MINIMAL, 'virus.exe', 'application/x-msdownload')

      expect(() => validateUploadedFile(executable)).toThrow(/Type de fichier non autorisé/)
    })
  })
})
