/**
 * Empêche deux synchronisations simultanées de se disputer les mêmes lignes.
 *
 * La synchronisation HelloAsso écrit en masse — suppressions, upserts de tarifs, d'options et de
 * champs personnalisés — dans des transactions. Deux appels concurrents pour la même édition
 * prennent des verrous sur les mêmes lignes et s'attendent mutuellement, jusqu'à ce que MySQL
 * abandonne au bout de cinquante secondes : « Lock wait timeout exceeded » (code 1205).
 *
 * Le coût dépasse de loin l'appel fautif : chaque requête bloquée retient une connexion pendant
 * toute l'attente. Quelques rechargements suffisent à épuiser le pool, et c'est alors toute
 * l'application qui répond en erreur — panne observée en production le 23 août 2026.
 *
 * Plutôt que de refuser le second appel, on lui rend le résultat du premier : deux onglets qui
 * demandent la même chose obtiennent la même réponse, et une seule synchronisation s'exécute.
 *
 * Portée : la mémoire du processus. Avec plusieurs instances, chacune sérialise les siennes —
 * ce qui couvre le cas observé, où la concurrence vient d'un même utilisateur sur plusieurs
 * onglets, mais ne remplacerait pas un verrou en base si l'application était répartie.
 */
const enCours = new Map<string, Promise<unknown>>()

export function synchronisationUnique<T>(cle: string, travail: () => Promise<T>): Promise<T> {
  const dejaEnCours = enCours.get(cle)
  if (dejaEnCours) return dejaEnCours as Promise<T>

  const promesse = travail().finally(() => {
    enCours.delete(cle)
  })

  enCours.set(cle, promesse)
  return promesse
}

/** Nombre de synchronisations en cours — pour les tests. */
export function synchronisationsEnCours(): number {
  return enCours.size
}
