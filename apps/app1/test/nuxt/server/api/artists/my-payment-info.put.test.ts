import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockDeplacerJustificatif = vi.hoisted(() => vi.fn())
const mockSupprimerJustificatif = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/treasury-receipt-files', () => ({
  deplacerJustificatif: mockDeplacerJustificatif,
  supprimerJustificatif: mockSupprimerJustificatif,
}))

import handler from '../../../../../../../layers/artists/server/api/editions/[id]/my-payment-info.put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/** Aucun identifiant d'artiste dans la requête : la fiche se résout par la session. */
const evenement = {
  context: { params: { id: '22' }, user: { id: 9, pseudo: 'zebulon' } },
}

const DOSSIER = '/uploads/conventions/3/editions/22/artists'

/** La fiche de CET artiste, telle que le point d'API la relit avant d'écrire. */
const ficheExistante = {
  id: 77,
  reimbursementReceiptUrl: `${DOSSIER}/le-mien.pdf`,
  consumablesReceiptUrl: null,
  edition: { id: 22, conventionId: 3 },
}

describe('PUT /api/editions/[id]/my-payment-info', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.editionArtist.findUnique.mockResolvedValue(ficheExistante)
    prismaMock.editionArtist.update.mockResolvedValue({
      iban: null,
      bic: null,
      reimbursementReceiptUrl: null,
      consumablesReceiptUrl: null,
    })
    // Par défaut, le déplacement rend l'URL définitive, comme en vrai.
    mockDeplacerJustificatif.mockImplementation(async (url: string | null) => url ?? null)
  })

  const envoyer = (body: unknown) => {
    global.readBody = vi.fn().mockResolvedValue(body)
    return handler(evenement as any)
  }

  /** Ce qui a réellement été écrit en base. */
  const ecrit = () => prismaMock.editionArtist.update.mock.calls[0]?.[0]?.data ?? {}

  it('⚠️ écrit sur la fiche de la SESSION, jamais sur un identifiant reçu', async () => {
    // La garde principale du point d'API : il n'existe aucune valeur à falsifier. Passer un
    // `artistId` dans le corps ne doit rien changer.
    await envoyer({ iban: 'BE68 5390 0754 7034', artistId: 1234, id: 1234 })

    expect(prismaMock.editionArtist.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editionId_userId: { editionId: 22, userId: 9 } },
      })
    )
    expect(prismaMock.editionArtist.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 77 } })
    )
  })

  it('normalise l’IBAN avant de l’écrire', async () => {
    await envoyer({ iban: 'be68 5390-0754.7034' })

    expect(ecrit().iban).toBe('BE68539007547034')
  })

  it('⚠️ n’efface PAS les coordonnées quand le corps n’en parle pas', async () => {
    // C'EST LE CONTRAT SUBTILE. Un champ absent n'est pas un champ vidé : sinon, enregistrer un
    // justificatif effacerait l'IBAN, et la personne devrait le reconfier sans jamais savoir
    // pourquoi il a disparu.
    await envoyer({ reimbursementReceiptUrl: `/uploads/temp/artists/22/frais.pdf` })

    expect('iban' in ecrit()).toBe(false)
    expect('bic' in ecrit()).toBe(false)
  })

  it('efface sur un null explicite', async () => {
    await envoyer({ iban: null })

    expect(ecrit().iban).toBeNull()
  })

  it('refuse un IBAN plus long que la colonne', async () => {
    // Le seul refus dur : la base ne pourrait pas l'écrire, et l'erreur Prisma serait illisible.
    //
    // 📍 On assère le MESSAGE et non le statut, comme le fait déjà le test du helper de
    // justificatifs : ce refus vient d'un util qui importe `createError` depuis h3 — il doit le
    // faire, étant couvert par le projet de tests unitaire, qui n'installe aucune globale. L'objet
    // rendu est donc un vrai `H3Error`, en `statusCode`, là où le `createError` du point d'API est
    // une globale bouchonnée qui rend l'objet tel quel.
    await expect(envoyer({ iban: 'FR' + '1'.repeat(40) })).rejects.toThrow(
      /L'IBAN ne peut pas dépasser 34/
    )
    expect(prismaMock.editionArtist.update).not.toHaveBeenCalled()
  })

  it('accepte un IBAN dont la clé de contrôle est fausse', async () => {
    // Délibéré : l'avertissement est dans l'interface, le serveur n'arbitre pas. Refuser ici
    // priverait de recours un compte hors zone IBAN ou une forme que notre code ignore.
    await envoyer({ iban: 'BE68539007547035' })

    expect(ecrit().iban).toBe('BE68539007547035')
  })

  it('accepte un dépôt temporaire frais et le fait déplacer', async () => {
    const temporaire = '/uploads/temp/artists/22/billet.pdf'
    await envoyer({ reimbursementReceiptUrl: temporaire })

    expect(mockDeplacerJustificatif).toHaveBeenCalledWith(
      temporaire,
      ficheExistante.edition,
      'artists'
    )
  })

  it('accepte de conserver le justificatif qui est DÉJÀ le sien', async () => {
    // Réenregistrer la fiche sans toucher au justificatif ne doit pas être refusé.
    await envoyer({ reimbursementReceiptUrl: ficheExistante.reimbursementReceiptUrl })

    expect(prismaMock.editionArtist.update).toHaveBeenCalled()
  })

  it('⚠️ refuse de s’attacher le justificatif d’un AUTRE artiste', async () => {
    // LA GARDE QUI N'EXISTE QUE DE CE CÔTÉ-CI. `deplacerJustificatif` laisse passer toute URL du
    // dossier `artists` de l'édition — ce qui suffit pour un organisateur, qui voit de toute façon
    // les justificatifs de tous. Un artiste, lui, pourrait ainsi pointer sa fiche sur le
    // justificatif d'un camarade, puis l'afficher.
    await expect(
      envoyer({ consumablesReceiptUrl: `${DOSSIER}/celui-du-voisin.pdf` })
    ).rejects.toMatchObject({ status: 400 })

    expect(prismaMock.editionArtist.update).not.toHaveBeenCalled()
  })

  it('⚠️ refuse plutôt que d’effacer quand le fichier temporaire a disparu', async () => {
    /*
     * LE DÉFAUT MUET ET DESTRUCTEUR. `deplacerJustificatif` rend `null` quand le fichier
     * temporaire n'est plus là — purge, redémarrage, double enregistrement. Recopier ce `null`
     * écraserait le justificatif EN PLACE : l'ancien part, le nouveau n'arrive pas, et le bandeau
     * annonce « enregistré ». La fiche doit rester intacte.
     */
    mockDeplacerJustificatif.mockResolvedValue(null)

    await expect(
      envoyer({ reimbursementReceiptUrl: '/uploads/temp/artists/22/disparu.pdf' })
    ).rejects.toMatchObject({ status: 409 })

    expect(prismaMock.editionArtist.update).not.toHaveBeenCalled()
  })

  it('accepte un null explicite, qui est le geste « retirer »', async () => {
    // Témoin du cas précédent : le refus ne doit pas mordre sur un retrait volontaire, où `null`
    // ne vient pas d'un échec mais de la demande.
    mockDeplacerJustificatif.mockResolvedValue(null)

    await envoyer({ reimbursementReceiptUrl: null })

    expect(ecrit().reimbursementReceiptUrl).toBeNull()
  })

  it('supprime le fichier qu’il remplace', async () => {
    // Sans cela, le fichier reste sur le disque indéfiniment — et lisible par qui a vu son URL.
    const neuf = `${DOSSIER}/le-nouveau.pdf`
    mockDeplacerJustificatif.mockResolvedValue(neuf)

    await envoyer({ reimbursementReceiptUrl: '/uploads/temp/artists/22/le-nouveau.pdf' })

    expect(mockSupprimerJustificatif).toHaveBeenCalledWith(
      ficheExistante.reimbursementReceiptUrl,
      ficheExistante.edition,
      'artists'
    )
  })

  it('ne supprime rien quand le justificatif ne change pas', async () => {
    await envoyer({ reimbursementReceiptUrl: ficheExistante.reimbursementReceiptUrl })

    expect(mockSupprimerJustificatif).not.toHaveBeenCalled()
  })

  it('refuse quand la personne n’est pas artiste de cette édition', async () => {
    prismaMock.editionArtist.findUnique.mockResolvedValue(null)

    await expect(envoyer({ iban: 'BE68539007547034' })).rejects.toMatchObject({ status: 404 })
  })
})
