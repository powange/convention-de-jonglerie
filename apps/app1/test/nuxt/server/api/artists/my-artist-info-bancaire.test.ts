import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../../../layers/artists/server/api/editions/[id]/my-artist-info.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 9, pseudo: 'zebulon' } } }

/**
 * L'artiste relit SES coordonnées et SES justificatifs depuis son espace.
 *
 * ⚠️ POURQUOI CE TEST EXISTE. Le champ qu'on ajoute à une colonne ne remonte pas tout seul : ce
 * point d'API emploie un `select` EXPLICITE, de quarante champs. Un champ oublié là ne provoque
 * aucune erreur — il arrive `undefined`, le gabarit affiche une chaîne vide, et l'écran dit
 * « rien » là où la base dit quelque chose. C'est exactement la forme de défaut qui s'est déjà
 * produite ici, et la raison pour laquelle l'IBAN enregistré ne s'affichait pas.
 *
 * 📍 La requête est ancrée sur `editionId_userId` : il n'existe aucun identifiant à falsifier pour
 * lire la fiche d'un autre. Le test le vérifie aussi, parce que c'est la garde de ce point d'API.
 */
const FICHE = {
  id: 77,
  qrCodeToken: 'jeton',
  arrivalDateTime: null,
  departureDateTime: null,
  payment: 10000,
  paymentPaid: false,
  reimbursementMax: 10000,
  reimbursementActual: null,
  reimbursementActualPaid: false,
  consumablesMax: null,
  consumablesActual: null,
  consumablesActualPaid: false,
  accommodationAutonomous: false,
  accommodationType: null,
  accommodationTypeOther: null,
  accommodationProposal: null,
  pickupRequired: false,
  pickupLocation: null,
  dropoffRequired: false,
  dropoffLocation: null,
  pickupResponsible: null,
  dropoffResponsible: null,
  invoiceRequested: false,
  invoiceProvided: false,
  feeRequested: false,
  feeProvided: false,
  iban: 'DE46120300001050945417',
  bic: 'GEBABEBB',
  reimbursementReceiptUrl: '/uploads/conventions/3/editions/22/artists/billet.pdf',
  consumablesReceiptUrl: null,
  user: { prenom: 'Zoé', nom: 'Bulon', email: 'z@exemple.test' },
  shows: [],
  mealSelections: [],
}

describe('GET /api/editions/[id]/my-artist-info — le volet bancaire', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.editionArtist.findUnique.mockResolvedValue(FICHE)
  })

  it('⚠️ demande bien iban, bic et les deux justificatifs à la base', async () => {
    await handler(evenement as any)

    const select = prismaMock.editionArtist.findUnique.mock.calls[0]?.[0]?.select ?? {}
    // Le `select` est explicite : ce qui n'y figure pas n'arrive jamais, en silence.
    expect(select.iban).toBe(true)
    expect(select.bic).toBe(true)
    expect(select.reimbursementReceiptUrl).toBe(true)
    expect(select.consumablesReceiptUrl).toBe(true)
  })

  it('⚠️ les rend dans sa réponse', async () => {
    // Les demander ne suffit pas : ce point d'API RECOMPOSE son objet champ par champ. Un champ
    // sélectionné mais non recopié arrive `undefined` côté écran, sans erreur.
    const { artist } = (await handler(evenement as any)) as any

    expect(artist.iban).toBe('DE46120300001050945417')
    expect(artist.bic).toBe('GEBABEBB')
    expect(artist.reimbursementReceiptUrl).toBe(
      '/uploads/conventions/3/editions/22/artists/billet.pdf'
    )
    expect(artist.consumablesReceiptUrl).toBeNull()
  })

  it('lit la fiche de la session, jamais un identifiant reçu', async () => {
    await handler(evenement as any)

    expect(prismaMock.editionArtist.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editionId_userId: { editionId: 22, userId: 9 } },
      })
    )
  })

  it('rend un artiste nul quand la personne n’en est pas un', async () => {
    prismaMock.editionArtist.findUnique.mockResolvedValue(null)

    const reponse = (await handler(evenement as any)) as any

    expect(reponse.artist).toBeNull()
  })
})
