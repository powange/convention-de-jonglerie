/**
 * Ce qu'on envoie pour couper les notifications push, et sur quel périmètre.
 *
 * ⚠️ POURQUOI CETTE FONCTION EXISTE. `unsubscribe` appelait le serveur SANS CORPS, et le serveur
 * lisait ce vide comme « tous les appareils » : couper les notifications sur son téléphone les
 * coupait aussi sur son ordinateur et sa tablette. Rien ne le disait ; on ne s'en apercevait qu'en
 * ne recevant plus rien là où on n'avait rien demandé, des jours plus tard, sans pouvoir relier
 * les deux.
 *
 * Le corps est désormais construit ici, à part du composable, pour une raison de preuve : le
 * `$fetch` de Nuxt n'est pas interceptable proprement depuis un test (ni `stubGlobal`, qui ne le
 * touche pas, ni `registerEndpoint`, dont le contexte ne partage pas les observations du fichier
 * de test). La DÉCISION — quel périmètre, et jamais « tout » par défaut — se vérifie en revanche
 * sans harnais, et c'est elle qui portait le défaut.
 */

/** Corps accepté par `POST /api/notifications/fcm/unsubscribe`. */
export interface CorpsDesabonnementPush {
  deviceId?: string
  token?: string
  all?: true
}

/**
 * Le corps qui désigne CET appareil, et lui seul.
 *
 * Le token accompagne le `deviceId` quand on peut l'obtenir : Firebase fait TOURNER les tokens, et
 * les lignes créées avant la colonne `deviceId` n'en portent pas — le token les retrouve. Chacun
 * des deux critères rattrape ce que l'autre laisse passer, et le serveur les combine en `OR`.
 *
 * Rend `null` quand aucun des deux n'est disponible, plutôt qu'un objet vide. C'est le point
 * important : un corps vide est exactement ce que le serveur interprétait comme « coupe tout,
 * partout ». Mieux vaut ne rien envoyer que d'envoyer la forme du défaut.
 */
export function corpsDesabonnementAppareil(
  deviceId: string | null | undefined,
  token: string | null | undefined
): CorpsDesabonnementPush | null {
  const corps: CorpsDesabonnementPush = {}
  if (deviceId) corps.deviceId = deviceId
  if (token) corps.token = token
  return Object.keys(corps).length > 0 ? corps : null
}

/**
 * Le corps qui coupe TOUS les appareils.
 *
 * Nommé, et jamais déduit d'une absence : c'est tout l'objet de la correction.
 */
export function corpsDesabonnementTousAppareils(): CorpsDesabonnementPush {
  return { all: true }
}
