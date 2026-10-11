/**
 * Ce qu'on écrit quand on donne ou retire les droits de super administrateur — constat B7.
 *
 * ## Le défaut
 *
 * `User` ne portait **aucune date de promotion**, et l'écran « Activité récente » de
 * l'administration en fabriquait une : il listait les comptes `isGlobalAdmin` dont `updatedAt`
 * datait de moins de trente jours, et annonçait « X est devenu super administrateur ». Or
 * `updatedAt` bouge au moindre geste — changer son téléphone, sa photo, son mot de passe.
 * N'importe quelle modification de profil d'un administrateur produisait donc l'annonce d'une
 * promotion qui n'avait pas eu lieu. Mesuré sur la base de développement : l'unique
 * administrateur y figurait, à tort.
 *
 * ## Pourquoi une fonction, pour deux champs
 *
 * Il y a **deux** points d'écriture — le point d'API de l'administration et le script
 * `scripts/manage-admin.ts` — et rien ne signale qu'un troisième oublie la date : le code
 * compile, l'écran reste muet, et personne ne cherche une ligne qui n'apparaît pas. Les deux
 * champs partent donc ensemble, d'un seul endroit.
 *
 * `null` à la rétrogradation : garder la date d'une promotion révoquée ferait réapparaître
 * l'annonce au prochain balayage, pour quelqu'un qui n'est plus administrateur.
 */
export function donneesDePromotionAdmin(
  isGlobalAdmin: boolean,
  maintenant: Date = new Date()
): { isGlobalAdmin: boolean; promotedAdminAt: Date | null } {
  return {
    isGlobalAdmin,
    // ⚠️ La rétrogradation EFFACE la date : sans cela, le compte resterait annoncé comme
    // promu — et une re-promotion ultérieure porterait la date de la première.
    promotedAdminAt: isGlobalAdmin ? maintenant : null,
  }
}
