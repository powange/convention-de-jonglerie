import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { getEffectiveAIConfigAsync } from '#server/utils/ai-config'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { classerLesCandidats } from '#server/utils/veille-classement'

/**
 * Le plafond d'appels par requête.
 *
 * ⚠️ Un appel IA par événement : soumettre une liste de plusieurs centaines d'un seul geste
 * dépasserait tous les délais d'attente — de la requête, du proxy, du navigateur — et l'opérateur
 * n'aurait AUCUN moyen de savoir ce qui a été classé avant la coupure. Borné ici, chaque clic a un
 * coût et une durée prévisibles, et le bilan dit exactement ce qui a été fait.
 */
const LIMITE_MAX = 50
const LIMITE_DEFAUT = 20

const corps = z.object({
  limite: z.number().int().min(1).max(LIMITE_MAX).optional(),
})

/**
 * Soumet au modèle les candidats qu'il n'a pas encore vus.
 *
 * ⚠️ N'écrit JAMAIS `verdict`. L'avis du modèle vit dans `avisIa` / `avisIaLe` / `motifIa`, et un
 * candidat jugé hors sujet reste `A_EXAMINER` : l'avis TRIE, il ne MASQUE pas. Sans cela, une
 * erreur du modèle ferait disparaître une convention sans que personne ne sache qu'elle a été
 * écartée — le défaut le plus coûteux possible ici.
 *
 * 📍 Le bilan distingue trois façons de ne pas aboutir, parce qu'elles n'appellent pas la même
 * réaction : `illisibles` (le modèle a répondu, mais hors format), `echecs` (il n'a pas répondu du
 * tout) et le simple fait qu'il n'y avait rien à classer. Les confondre en « 0 classé » laisserait
 * croire qu'il n'y avait rien à faire.
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const { limite } = corps.parse((await readBody(event).catch(() => ({}))) ?? {})

    /*
     * La configuration IA est lue à CHAQUE appel, et non mise en cache ici : un administrateur
     * peut changer de fournisseur entre deux balayages depuis l'écran de configuration, et un
     * cache local le ferait classer avec l'ancien sans que rien ne le dise.
     */
    const config = await getEffectiveAIConfigAsync()

    const bilan = await classerLesCandidats(limite ?? LIMITE_DEFAUT, config)

    return createSuccessResponse({
      bilan,
      // Rendu à l'écran pour qu'il sache s'il reste du travail à relancer, sans avoir à le deviner
      // du nombre de lignes affichées — qui est filtré, donc sans rapport.
      restants: await prisma.candidatEvenement.count({
        where: { verdict: 'A_EXAMINER', avisIa: null },
      }),
      fournisseur: config.aiProvider ?? null,
    })
  },
  { operationName: 'ClasserCandidatsVeille' }
)
