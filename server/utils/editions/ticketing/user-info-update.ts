export interface UserInfoUpdate {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
}

/**
 * Met à jour les informations d'un ou plusieurs utilisateurs après validation d'entrée
 * Vérifie que l'email n'est pas déjà utilisé par un autre utilisateur
 *
 * @param userIds - IDs des utilisateurs à mettre à jour
 * @param userInfo - Nouvelles informations utilisateur
 * @throws Error si l'email est déjà utilisé par un autre utilisateur
 */
export async function updateUserInfo(userIds: number[], userInfo: UserInfoUpdate) {
  // Si aucune donnée à mettre à jour, retourner immédiatement
  if (!userInfo || Object.keys(userInfo).length === 0) {
    return
  }

  // Si l'email est fourni, vérifier qu'il n'est pas déjà utilisé par un autre utilisateur
  if (userInfo.email !== undefined && userInfo.email !== null) {
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
        statusCode: 409,
        message: `L'email ${userInfo.email} est déjà utilisé par un autre utilisateur`,
      })
    }
  }

  // Préparer les données à mettre à jour (mapping des noms de champs)
  const userUpdateData: any = {}
  if (userInfo.firstName !== undefined) userUpdateData.prenom = userInfo.firstName
  if (userInfo.lastName !== undefined) userUpdateData.nom = userInfo.lastName
  if (userInfo.email !== undefined) userUpdateData.email = userInfo.email
  if (userInfo.phone !== undefined) userUpdateData.phone = userInfo.phone

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
