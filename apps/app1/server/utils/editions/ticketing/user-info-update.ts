import { getEmailHash } from '#server/utils/email-hash'
import { adresseAEcrire, comptesQuiRefusent } from '~~/shared/utils/adresse-modifiable-au-guichet'

export interface UserInfoUpdate {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
}

/**
 * Met à jour les informations d'un ou plusieurs utilisateurs après validation d'entrée.
 *
 * **L'adresse de courriel n'est modifiable que tant qu'elle n'est pas vérifiée.** Ce champ existe
 * pour corriger la faute de frappe d'un artiste, d'un organisateur ou d'un bénévole ajouté à la
 * main — cas où le compte vient d'être créé et n'a jamais servi. Il n'a jamais servi à changer
 * l'adresse de quelqu'un qui utilise déjà son compte, et le laisser faire ouvrait une prise de
 * compte : la réinitialisation de mot de passe envoie son lien à l'adresse inscrite sans rien
 * exiger de plus, et ce point d'API est ouvert aux bénévoles en créneau de contrôle d'accès.
 *
 * La règle vit dans `adresse-modifiable-au-guichet`, avec ses tests. Elle distingue trois cas, et
 * c'est le troisième qui compte autant que les autres : une adresse IDENTIQUE à celle déjà
 * enregistrée n'est pas un changement. L'écran pré-remplit ce champ et l'envoie à chaque
 * validation — refuser sur la seule présence de l'adresse bloquerait toute entrée d'une personne
 * au compte vérifié, c'est-à-dire la file entière.
 *
 * @param userIds - IDs des utilisateurs à mettre à jour
 * @param userInfo - Nouvelles informations utilisateur
 * @throws 409 si l'adresse est déjà prise, 403 si elle est figée par une vérification
 */
export async function updateUserInfo(userIds: number[], userInfo: UserInfoUpdate) {
  // Si aucune donnée à mettre à jour, retourner immédiatement
  if (!userInfo || Object.keys(userInfo).length === 0) {
    return
  }

  // Les comptes visés, tels qu'ils sont AUJOURD'HUI : c'est la comparaison avec leur adresse
  // actuelle qui distingue une correction d'un renvoi du champ pré-rempli.
  const comptes = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, isEmailVerified: true },
  })

  let ecrireLAdresse = false

  if (userInfo.email !== undefined && userInfo.email !== null) {
    const figes = comptesQuiRefusent(comptes, userInfo.email)
    if (figes.length > 0) {
      throw createError({
        status: 403,
        message:
          'Cette adresse est déjà vérifiée et ne peut plus être modifiée ici. La personne peut la changer depuis son profil.',
      })
    }

    ecrireLAdresse = adresseAEcrire(comptes, userInfo.email)

    // L'unicité n'est vérifiée que si l'on écrit réellement : sinon, renvoyer sa propre adresse
    // sur un compte inchangé pouvait déclencher un 409 sans que rien ne soit demandé.
    if (ecrireLAdresse) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: userInfo.email,
          id: {
            notIn: userIds, // Exclure les utilisateurs qu'on est en train de mettre à jour
          },
        },
      })

      if (existingUser) {
        throw createError({
          status: 409,
          message: `L'email ${userInfo.email} est déjà utilisé par un autre utilisateur`,
        })
      }
    }
  }

  // Préparer les données à mettre à jour (mapping des noms de champs)
  const userUpdateData: any = {}
  if (userInfo.firstName !== undefined) userUpdateData.prenom = userInfo.firstName
  if (userInfo.lastName !== undefined) userUpdateData.nom = userInfo.lastName
  if (userInfo.phone !== undefined) userUpdateData.phone = userInfo.phone
  if (ecrireLAdresse && userInfo.email) {
    userUpdateData.email = userInfo.email
    // L'empreinte du gravatar suit l'adresse. Ce chemin ne la recalculait pas, contrairement à
    // `profile/update.put.ts` : l'avatar continuait d'afficher celui de l'adresse fautive, et
    // rien ne le signalait.
    userUpdateData.emailHash = getEmailHash(userInfo.email)
  }

  // Mettre à jour les utilisateurs
  if (Object.keys(userUpdateData).length > 0) {
    await prisma.user.updateMany({
      where: {
        id: {
          in: userIds,
        },
      },
      data: userUpdateData,
    })
  }
}
