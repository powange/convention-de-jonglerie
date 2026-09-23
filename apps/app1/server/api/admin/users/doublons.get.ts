import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { chercherLesDoublons, type CompteAComparer } from '~~/shared/utils/doublons-utilisateurs'

/**
 * GET /api/admin/users/doublons
 *
 * Les comptes qui semblent appartenir à une même personne, groupés par motif de rapprochement.
 *
 * Lecture seule et sans effet : cette route CONSTATE. Aucune fusion, aucune suppression — l'écran
 * qui la consomme non plus.
 *
 * Le rapprochement se fait en mémoire et non en SQL, à dessein : les quatre règles vivent dans
 * `shared/utils/doublons-utilisateurs`, testées sur des tableaux, et une règle recopiée en SQL
 * finirait par dire autre chose que celle qu'on a vérifiée. Le coût reste modeste — quelques
 * centaines de comptes, quatre parcours, une table de hachage par motif — et la sélection se
 * limite aux champs qui servent à comparer.
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const comptes = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        pseudo: true,
        nom: true,
        prenom: true,
        phone: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    const grappes = chercherLesDoublons(comptes as CompteAComparer[])

    /*
     * Les comptes concernés, et eux seuls, accompagnent les grappes.
     *
     * L'écran a besoin de les afficher — adresse, pseudo, date d'inscription — et les redemander
     * un par un ferait autant d'appels que de lignes. Renvoyer les 384 comptes du fichier, en
     * revanche, enverrait des adresses que l'écran n'affichera jamais.
     */
    const idsConcernes = new Set(grappes.flatMap((g) => g.comptes))

    return {
      grappes,
      comptes: comptes
        .filter((c) => idsConcernes.has(c.id))
        .map((c) => ({
          id: c.id,
          email: c.email,
          pseudo: c.pseudo,
          nom: c.nom,
          prenom: c.prenom,
          phone: c.phone,
          createdAt: c.createdAt,
        })),
      /** Le total sert à dire « 384 comptes examinés », ce qui donne son sens à « 6 grappes ». */
      comptesExamines: comptes.length,
    }
  },
  { operationName: 'GetUserDuplicates' }
)
