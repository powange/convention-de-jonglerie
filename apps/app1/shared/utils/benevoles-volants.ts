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

/** Une équipe, réduite à ce que la règle en lit. */
export interface EquipePourVolants {
  isFloatingTeam?: boolean | null
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
