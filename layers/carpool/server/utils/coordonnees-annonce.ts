import { geocodeVille } from '#server/utils/geocoding'

/**
 * Ce qui finit en base comme coordonnée d'une annonce de covoiturage.
 *
 * Un seul endroit décide, parce que quatre points d'API écrivent ces deux colonnes — création et
 * mise à jour, pour les offres comme pour les demandes — et que trois règles doivent valoir
 * partout.
 *
 * **1. Les deux ou aucune.** Une latitude seule n'est pas un point : écrite en base, elle poserait
 * un marqueur sur le méridien de Greenwich. Une moitié de couple est donc jetée, pas complétée.
 *
 * **2. Le client d'abord, le serveur en repli.** Le formulaire tient déjà la coordonnée quand la
 * personne a retenu une suggestion : la réutiliser évite une requête à Nominatim ET garantit que
 * le point est celui qu'elle a choisi — c'est elle qui a tranché entre deux homonymes, et aucune
 * heuristique serveur ne vaut ce choix. Sans coordonnée, on géocode la ville une fois.
 *
 * **3. Une ville sans point est un cas normal.** La ville se saisit LIBREMENT — une correction
 * délibérée : la restreindre aux suggestions laissait le bouton de création grisé sans message. On
 * ne peut donc jamais garantir une coordonnée, et `null` ne doit jamais empêcher la création. La
 * carte nomme ces annonces au lieu de les perdre.
 */
export interface CoordonneesAnnonce {
  latitude: number | null
  longitude: number | null
}

/** Le couple est-il complet ? Une seule des deux valeurs ne décrit aucun lieu. */
function coupleComplet(latitude?: number | null, longitude?: number | null): boolean {
  return typeof latitude === 'number' && typeof longitude === 'number'
}

/**
 * La coordonnée à écrire pour une annonce qu'on CRÉE.
 *
 * `ville` sert uniquement de repli ; si le client a fourni un couple complet, rien n'est demandé à
 * Nominatim.
 */
export async function coordonneesPourCreation(entree: {
  ville: string
  latitude?: number | null
  longitude?: number | null
}): Promise<CoordonneesAnnonce> {
  if (coupleComplet(entree.latitude, entree.longitude)) {
    return { latitude: entree.latitude as number, longitude: entree.longitude as number }
  }

  const trouve = await geocodeVille(entree.ville)
  return { latitude: trouve?.latitude ?? null, longitude: trouve?.longitude ?? null }
}

/**
 * La coordonnée à écrire pour une annonce qu'on MODIFIE — ou `undefined` pour n'y pas toucher.
 *
 * ⚠️ LE PIÈGE QUE CETTE FONCTION EXISTE POUR FERMER : si la ville change et que le client n'envoie
 * pas de nouvelle coordonnée, l'ancienne SURVIT et désigne la ville d'avant. Le marqueur se
 * retrouve à des centaines de kilomètres, sans erreur, sans avertissement, et plausible — c'est
 * bien un point sur une carte.
 *
 * Donc : ville changée sans coordonnée fournie ⇒ on géocode la nouvelle ville, et si cela échoue
 * on EFFACE le point. Pas de point vaut mieux qu'un point faux : l'écran sait nommer une annonce
 * sans coordonnée, il ne sait pas deviner qu'un marqueur ment.
 */
export async function coordonneesPourMiseAJour(entree: {
  villeAvant: string
  villeApres?: string | null
  latitude?: number | null
  longitude?: number | null
}): Promise<CoordonneesAnnonce | undefined> {
  if (coupleComplet(entree.latitude, entree.longitude)) {
    return { latitude: entree.latitude as number, longitude: entree.longitude as number }
  }

  // Le client a explicitement envoyé `null` pour les deux : il retire le point, on obéit.
  if (entree.latitude === null && entree.longitude === null) {
    return { latitude: null, longitude: null }
  }

  const nouvelleVille = entree.villeApres?.trim()
  if (!nouvelleVille || nouvelleVille === entree.villeAvant.trim()) {
    // La ville ne change pas et aucune coordonnée n'est fournie : rien à écrire.
    return undefined
  }

  const trouve = await geocodeVille(nouvelleVille)
  return { latitude: trouve?.latitude ?? null, longitude: trouve?.longitude ?? null }
}
