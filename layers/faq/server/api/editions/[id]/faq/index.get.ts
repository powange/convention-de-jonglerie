import { useFaqPorts } from '#server/faq/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { optionalAuth } from '#server/utils/auth-utils'
import { aAccesGestionEdition } from '#server/utils/permissions/acces-gestion-edition'
import {
  canManageFAQ,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/faq
 *
 * Liste les entrées de FAQ d'une édition.
 * - Organisateur avec `canManageFAQ` : toutes les entrées (publiques + privées)
 * - Visiteur ou query `?publicOnly=1` : seulement les entrées `isPublic = true`
 *
 * Le query param `publicOnly` permet à la page publique d'éviter de recevoir
 * les entrées privées même si l'utilisateur connecté est éditeur.
 *
 * Trois publics, donc, et non deux : entre le gestionnaire et le visiteur il y a ceux à qui la
 * barre latérale propose la FAQ sans qu'ils détiennent `manageFAQ` — responsable d'équipe,
 * organisateur sans ce droit précis. Ils ne lisent que les entrées publiques, comme un visiteur,
 * mais `faqPagePublic` ne les concerne pas : ce drapeau dit « pas encore montré AU PUBLIC », et
 * c'est ainsi que le schéma le documente.
 */
export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)
    const publicOnly = getQuery(event).publicOnly === '1'

    const edition = await getEditionWithPermissions(editionId, {
      userId: optionalAuth(event)?.id,
    })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }

    const user = optionalAuth(event)
    const isFaqManager = !!user && canManageFAQ(edition, user)

    // Visibilité FAQ propre au domaine via le port (le layer ne lit plus les flags faqEnabled /
    // faqPagePublic sur l'Edition ; jonglerie : ils en viennent, générique : autre résolution).
    const { enabled: faqEnabled, pagePublic: faqPagePublic } =
      await useFaqPorts().directory.getFaqVisibility(editionId)

    /*
     * Côté visiteur, si la page publique est désactivée ou le module FAQ off, on ne fuit pas
     * l'info et on ne tape pas la table.
     *
     * L'accès à la gestion lève la seconde condition, jamais la première : un module éteint n'a
     * rien à montrer à personne. Cette nuance manquait, et elle cassait la page de gestion de la
     * FAQ — `fetchEntries` y est attendu au premier niveau du `setup`, si bien que le 404 ne
     * vidait pas une liste, il empêchait la page de s'afficher. Deux occurrences en production.
     *
     * La vérification n'est faite qu'en dernier recours : elle coûte trois requêtes, et les deux
     * cas de loin les plus fréquents — le gestionnaire et le visiteur d'une FAQ publiée — sont
     * tranchés avant d'y arriver.
     */
    /*
     * Qui peut voir la page PUBLIQUE d'une FAQ pas encore publiée : celui qui la gère, et plus
     * largement celui qui entre dans l'espace de gestion. C'est le verdict rendu plus bas sous
     * `publicPageVisible`, et c'est ce qui dispense la page de le recalculer — cf. le constat B6.
     */
    let peutApercevoir = isFaqManager

    if (!isFaqManager && !faqEnabled) {
      throw createError({ status: 404, message: 'FAQ non disponible' })
    }
    if (!isFaqManager && !faqPagePublic) {
      peutApercevoir = !!user && (await aAccesGestionEdition(edition, user))
      if (!peutApercevoir) {
        throw createError({ status: 404, message: 'FAQ non disponible' })
      }
    }

    // Pour la page publique, on force toujours le filtre isPublic même si
    // l'utilisateur gère la FAQ (sinon il verrait les privées sur le public).
    const restrictToPublic = !isFaqManager || publicOnly

    const entries = await prisma.faqEntry.findMany({
      where: {
        editionId,
        ...(restrictToPublic ? { isPublic: true } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        question: true,
        answer: true,
        isPublic: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return createSuccessResponse({
      faqEnabled,
      faqPagePublic,
      /*
       * ⚠⚠ LE VERDICT, ET IL ÉVITE QUE DEUX ENDROITS RÉPONDENT À LA MÊME QUESTION — constat B6.
       *
       * La page publique décidait elle-même, sur `faqEnabled && faqPagePublic`, sans regarder qui
       * demande : un éditeur ne pouvait donc JAMAIS relire sa FAQ avant de l'avoir publiée, même
       * en navigation interne où son cookie accompagne la requête. Le serveur, lui, le savait déjà
       * — c'est lui qui vient de décider de ne pas répondre 404.
       *
       * Un module ÉTEINT ne montre rien à personne sur la page publique, pas même à qui le gère :
       * c'est la règle que porte le commentaire ci-dessus, et `faqEnabled &&` la tient.
       */
      publicPageVisible: faqEnabled && (faqPagePublic || peutApercevoir),
      entries,
    })
  },
  { operationName: 'GetFaqEntries' }
)
