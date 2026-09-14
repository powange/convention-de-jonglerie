/**
 * Les bénévoles volants : à disposition, sans créneau fixe.
 *
 * Certaines conventions comptent des bénévoles qui ne prennent aucun créneau à l'avance et restent
 * disponibles pour ce qui n'était pas prévu — une équipe qui prend du retard, une tâche plus lourde
 * qu'annoncé. Ils rendent service autrement, et ne sont pas tenus au volume d'heures demandé aux
 * autres.
 *
 * ⚠️ La notion vit sur l'ÉQUIPE, pas sur le bénévole : être volant, c'est appartenir à une équipe
 * marquée comme telle. Rien n'a donc été ajouté à la candidature — le rattachement aux équipes
 * existait déjà, de même que les objets à remettre et la conversation d'équipe, qui servent tous
 * les deux ici sans une ligne de plus.
 *
 * ⚠️ Ce fichier est lu par le SERVEUR (l'assignation automatique) et par l'ÉCRAN (les
 * statistiques) : il vit dans `shared/` pour cette raison, et ne doit rien importer — il est aussi
 * chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Une équipe, réduite à ce que les règles en lisent. */
export interface EquipePourVolants {
  isFloatingTeam?: boolean | null
  /**
   * Équipe AUTONOME : elle se gère à part et réserve ses membres.
   *
   * Même effet que « volante » sur l'ÉQUIPE — créneaux hors des heures à pourvoir, non remplis
   * automatiquement —, effet inverse sur les PERSONNES : la volante les libère de leur volume
   * d'heures et les propose en renfort, l'autonome les garde tenues à leurs heures et hors de la
   * page des renforts.
   */
  isAutonomousTeam?: boolean | null
}

/**
 * Cette équipe regroupe-t-elle des volants&nbsp;?
 *
 * `null` ou `undefined` — une réponse d'API antérieure à ce réglage — vaut NON : le défaut du
 * schéma est `false`, et une donnée manquante ne doit pas dispenser quelqu'un de ses heures.
 */
export function estEquipeVolante(equipe: EquipePourVolants | null | undefined): boolean {
  return equipe?.isFloatingTeam === true
}

/** Cette équipe se gère-t-elle à part&nbsp;? */
export function estEquipeAutonome(equipe: EquipePourVolants | null | undefined): boolean {
  return equipe?.isAutonomousTeam === true
}

/**
 * Cette équipe est-elle hors des décomptes de CHARGE&nbsp;?
 *
 * Ce que les deux réglages ont en commun, écrit une seule fois : ni les heures à pourvoir, ni
 * l'assignation automatique ne s'occupent de ses créneaux. Les faire diverger produirait une
 * édition dont les totaux dépendraient du réglage choisi plutôt que de ce qu'il y a à faire.
 */
export function estEquipeHorsCharge(equipe: EquipePourVolants | null | undefined): boolean {
  return estEquipeVolante(equipe) || estEquipeAutonome(equipe)
}

/**
 * Ce bénévole est-il RÉSERVÉ à ses équipes autonomes&nbsp;?
 *
 * Vrai quand il appartient à au moins une équipe et que toutes sont autonomes. L'assignation
 * automatique ne lui donne alors aucun créneau : ni ailleurs, puisqu'il est réservé, ni chez lui,
 * puisqu'une équipe autonome ne se remplit pas toute seule.
 *
 * La double appartenance ANNULE la réserve, et c'est un choix : rattacher quelqu'un à une seconde
 * équipe, c'est avoir décidé de le partager. La règle reprend donc exactement la forme de
 * `estHorsDesComptes` — « toutes ses équipes », jamais « au moins une ».
 */
export function estReserve(equipes: readonly EquipePourVolants[] | null | undefined): boolean {
  if (!Array.isArray(equipes) || equipes.length === 0) return false
  return equipes.every(estEquipeAutonome)
}

/**
 * Ce bénévole doit-il être écarté de l'assignation automatique&nbsp;?
 *
 * Les deux cas s'y rejoignent, pour des raisons opposées : le volant parce qu'il n'a pas d'heures
 * à faire, le réservé parce que ses heures ne se décident pas ici.
 */
export function estHorsAssignationAutomatique(
  equipes: readonly EquipePourVolants[] | null | undefined
): boolean {
  return estHorsDesComptes(equipes) || estReserve(equipes)
}

/**
 * Ce bénévole est-il volant&nbsp;?
 *
 * Vrai dès qu'il appartient à UNE équipe volante, même s'il en a d'autres. Sert à l'affichage — un
 * repère dans la liste, un message sur son espace — et non aux calculs&nbsp;: pour ceux-là, voir
 * `estHorsDesComptes`, qui est nettement plus exigeant.
 */
export function estVolant(equipes: readonly EquipePourVolants[] | null | undefined): boolean {
  return Array.isArray(equipes) && equipes.some(estEquipeVolante)
}

/**
 * Ce bénévole échappe-t-il au décompte des heures&nbsp;?
 *
 * **La règle du module**, et la seule qui décide quoi que ce soit. Deux conditions, et il faut
 * bien les deux :
 *
 * 1. Il appartient à au moins une équipe.
 * 2. TOUTES ses équipes sont volantes.
 *
 * La seconde est ce qui distingue « à disposition » de « dispensé » : quelqu'un qui est à la fois
 * en cuisine et volant reste un bénévole ordinaire, et l'assignation automatique doit lui donner
 * ses heures de cuisine. C'est n'être QUE volant qui exempte.
 *
 * La première n'est pas une précaution défensive mais le cas le plus courant : un bénévole accepté
 * sans équipe est précisément celui que l'assignation automatique doit placer — c'est elle qui lui
 * attribuera ses équipes d'après les créneaux retenus. Le traiter comme un volant reviendrait à
 * vider l'assignation automatique de son objet.
 *
 * Le raisonnement n'est pas nouveau ici : les statistiques appliquent déjà le même aux
 * organisateurs, qui « ne comptent que s'ils tiennent un créneau ».
 */
export function estHorsDesComptes(
  equipes: readonly EquipePourVolants[] | null | undefined
): boolean {
  if (!Array.isArray(equipes) || equipes.length === 0) return false
  return equipes.every(estEquipeVolante)
}

/** Un bénévole, réduit à ses équipes. */
export interface BenevolePourVolants {
  equipes?: readonly EquipePourVolants[] | null
}

/**
 * Les bénévoles qui entrent dans les décomptes.
 *
 * Écrit ici plutôt que répété en `filter` à chaque appel : la règle est lue par l'assignation
 * automatique et par deux calculs de statistiques, et l'expérience de ce dépôt est qu'une règle
 * recopiée finit appliquée à un endroit de moins qu'annoncé.
 */
export function benevolesDesComptes<B extends BenevolePourVolants>(benevoles: readonly B[]): B[] {
  return benevoles.filter((benevole) => !estHorsDesComptes(benevole?.equipes))
}
