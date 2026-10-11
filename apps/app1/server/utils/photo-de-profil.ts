import { deletePhysicalImageFile } from '#server/utils/image-deletion'

/**
 * Effacer du disque une photo de profil qui ne sert plus — constats B3 et B4.
 *
 * ## Pourquoi cette fonction existe
 *
 * La mise à jour du profil a DEUX occasions d'effacer : le remplacement d'une photo, et son
 * retrait. Aucune des deux ne le faisait, et l'une des deux reposait sur une condition
 * structurellement fausse. Les écrire deux fois côte à côte les aurait fait diverger — c'est
 * exactement ce qui est arrivé entre ce point d'API et `DELETE /api/profile/delete-picture`.
 *
 * ## ⚠️ ON DÉLÈGUE, ON NE RÉÉCRIT PAS
 *
 * `deletePhysicalImageFile` sait déjà tout ce qu'il faut savoir, et son en-tête raconte ce que ce
 * savoir a coûté : les fichiers vivent sous le MONTAGE de nuxt-file-storage et non sous
 * `public/uploads` (qui n'existe pas dans l'image), le nom stocké peut être nu ou complet, et une
 * valeur venue d'OAuth — « https://lh3.googleusercontent.com/… » — n'est pas un fichier de notre
 * disque. Le code remplacé ici recomposait le chemin à la main et retombait sur `deleteFile`
 * directement : il reproduisait donc les deux premiers pièges et ignorait le troisième.
 *
 * 📍 C'est la même fonction que `deleteProfilePicture` emploie, et c'est le but : une seule
 * réponse à « où vit cette photo, et comment l'effacer ».
 *
 * ## ⚠️ UN ÉCHEC NE FAIT JAMAIS ÉCHOUER L'ENREGISTREMENT
 *
 * Décision assumée, et c'est l'inverse du choix fait pour le DÉPLACEMENT du fichier (constat B4,
 * où l'on refuse franchement). La différence : là, l'échec laisse la personne avec une image
 * cassée affichée partout ; ici, il laisse un fichier orphelin sur le disque. Le second se
 * rattrape, le premier se voit. Refuser l'enregistrement du profil parce qu'un vieux fichier
 * résiste serait disproportionné.
 */
export async function effacerAnciennePhoto(
  photoActuelle: string | null,
  userId: number
): Promise<void> {
  if (!photoActuelle) return

  try {
    await deletePhysicalImageFile(photoActuelle, {
      entityType: 'user',
      entityId: userId,
      imageField: 'profilePicture',
      dossier: 'profiles',
    })
  } catch (erreur) {
    console.warn(`[photo-de-profil] ancienne photo non supprimée : ${photoActuelle}`, erreur)
  }
}
