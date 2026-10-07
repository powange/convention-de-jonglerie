import { z } from 'zod'

import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { coordonneesBancairesRecues } from '#server/utils/coordonnees-bancaires-recues'
import { remiseDeLaFacture } from '#server/utils/remise-de-la-facture'
import { deplacerJustificatif, supprimerJustificatif } from '#server/utils/treasury-receipt-files'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Ce que l'ARTISTE renseigne lui-même : ses coordonnées bancaires et ses justificatifs.
 *
 * ⚠️ IL N'Y A PAS D'IDENTIFIANT D'ARTISTE DANS CE SCHÉMA, et c'est la garde principale. La fiche
 * est résolue par `editionId_userId` d'après la session : il n'existe aucune valeur à falsifier
 * pour écrire sur la fiche de quelqu'un d'autre. C'est le motif de tous les points `my-*`.
 *
 * 📍 Un champ ABSENT n'est pas un champ vidé. L'espace artiste enregistre les quatre ensemble,
 * mais le contrat vaut aussi pour un appel partiel : seules les clés présentes sont écrites.
 */
const schema = z.object({
  iban: z.string().max(60).optional().nullable(),
  bic: z.string().max(60).optional().nullable(),
  reimbursementReceiptUrl: z.string().max(500).optional().nullable(),
  consumablesReceiptUrl: z.string().max(500).optional().nullable(),
  invoiceUrl: z.string().max(500).optional().nullable(),
})

/**
 * Les trois justificatifs que l'artiste dépose, et eux seuls.
 *
 * 📍 `invoiceUrl` en est un à part entière : c'est l'ARTISTE qui fournit sa facture — il la remet à
 * la convention, pas l'inverse. Les deux autres attestent une dépense qu'il a avancée.
 */
const JUSTIFICATIFS = ['reimbursementReceiptUrl', 'consumablesReceiptUrl', 'invoiceUrl'] as const

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const donnees = schema.parse(await readBody(event))

    const artiste = await prisma.editionArtist.findUnique({
      where: { editionId_userId: { editionId, userId: user.id } },
      select: {
        id: true,
        reimbursementReceiptUrl: true,
        consumablesReceiptUrl: true,
        invoiceUrl: true,
        edition: { select: { id: true, conventionId: true } },
      },
    })

    if (!artiste) {
      throw createError({ status: 404, message: "Vous n'êtes pas artiste pour cette édition" })
    }

    /*
     * Les justificatifs, déplacés du dossier temporaire vers celui de l'édition.
     *
     * ⚠️ UNE GARDE DE PLUS QUE DU CÔTÉ ORGANISATEUR, et elle est nécessaire. `deplacerJustificatif`
     * laisse passer une URL non temporaire pourvu qu'elle désigne le dossier `artists` de CETTE
     * édition — ce qui suffit pour un organisateur, qui voit de toute façon les justificatifs de
     * tous les artistes. Pour un artiste, non : il pourrait enregistrer sur sa propre fiche l'URL
     * du justificatif d'un camarade, puis l'afficher. Un artiste ne peut donc attacher qu'un dépôt
     * TEMPORAIRE frais, ou conserver — ou effacer — ce qui est déjà le sien.
     */
    const justificatifs: Record<string, string | null> = {}
    const aSupprimer: string[] = []
    for (const champ of JUSTIFICATIFS) {
      if (!(champ in donnees)) continue
      const recue = donnees[champ]

      if (recue && !recue.includes('/temp/') && recue !== artiste[champ]) {
        throw createError({ status: 400, message: 'Justificatif invalide' })
      }

      const deplacee = await deplacerJustificatif(recue, artiste.edition, 'artists')

      /*
       * ⚠️ UN DÉPLACEMENT RATÉ NE DOIT PAS EFFACER CE QUI ÉTAIT LÀ. `deplacerJustificatif` rend
       * `null` quand le fichier temporaire a disparu — purge, redémarrage, double enregistrement —
       * et ce compromis se défend pour une ligne comptable qu'on CRÉE : mieux vaut l'entrée sans sa
       * pièce qu'un refus d'enregistrer. Ici l'écriture ÉCRASE une valeur existante, et le défaut
       * devient muet et destructeur : l'ancien justificatif part, le nouveau n'arrive pas, et le
       * bandeau annonce « enregistré ».
       *
       * On refuse donc, et la fiche reste intacte. L'artiste reprend son envoi.
       */
      if (recue && deplacee === null) {
        throw createError({
          status: 409,
          message: 'Le fichier envoyé n’est plus disponible, merci de le redéposer',
        })
      }

      // Le fichier qu'on remplace ou qu'on retire n'est plus référencé par personne : sans cette
      // suppression, il resterait sur le disque indéfiniment, et lisible par qui a vu son URL.
      const ancienne = artiste[champ]
      if (ancienne && ancienne !== deplacee) aSupprimer.push(ancienne)

      justificatifs[champ] = deplacee
    }

    const misAJour = await prisma.editionArtist.update({
      where: { id: artiste.id },
      data: {
        ...coordonneesBancairesRecues(donnees),
        ...justificatifs,
        ...remiseDeLaFacture(justificatifs),
      },
      select: {
        iban: true,
        bic: true,
        reimbursementReceiptUrl: true,
        consumablesReceiptUrl: true,
        invoiceUrl: true,
        invoiceProvided: true,
      },
    })

    // APRÈS l'écriture, et sans la faire échouer : la trace en base est ce qui compte, et un
    // fichier qui survit à sa référence est un désagrément, pas une perte.
    for (const ancienne of aSupprimer) {
      await supprimerJustificatif(ancienne, artiste.edition, 'artists')
    }

    return createSuccessResponse(misAJour)
  },
  { operationName: 'UpdateMyPaymentInfo' }
)
