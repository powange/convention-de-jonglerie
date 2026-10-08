import type { Ref } from 'vue'

/**
 * Le registre des balles présentes à l'écran, pour qu'elles puissent se heurter.
 *
 * ## Pourquoi un registre
 *
 * Chaque balle simule sa propre trajectoire dans sa propre boucle. Tant qu'elles s'ignoraient,
 * cela suffisait. Pour qu'elles se heurtent, il faut qu'une balle puisse lire la position et la
 * vitesse des autres — d'où cet état partagé, volontairement minuscule.
 *
 * ## ⚠️ Qui résout quoi, et pourquoi c'est la question centrale
 *
 * Chaque balle a sa boucle : un choc entre A et B serait donc examiné DEUX fois par image, une
 * fois par chacune. Résolu deux fois, l'impact est deux fois trop fort — et les deux balles se
 * repoussent en tremblant au lieu de se séparer. Une seule des deux doit donc prendre la paire en
 * charge, et c'est `aLaChargeDeLaPaire` qui tranche.
 *
 * Le critère naturel — « la plus petite des deux » — a un angle mort qu'une mesure a révélé : il
 * suppose que celle qui résout la paire tourne. Or une balle **au repos dort** (sa boucle
 * s'arrête), et une balle **tenue à la souris** ne simule rien. Dans les deux cas, personne ne
 * résout : on enfonçait une balle dans une autre à la main sans la moindre réaction. D'où la règle
 * en trois temps du bas de ce fichier.
 *
 * ## Ce que ce fichier ne fait pas
 *
 * Aucune boucle commune, aucun ordonnancement : ce n'est pas un moteur physique, et un easter egg
 * n'en justifie pas un. Les balles restent indépendantes ; elles se contentent de se voir.
 */
export interface BalleEnScene {
  id: number
  /** Coin haut-gauche, en pixels depuis le coin de la fenêtre. */
  x: Ref<number>
  y: Ref<number>
  vx: Ref<number>
  vy: Ref<number>
  taille: number
  /**
   * Vrai quand un pointeur la tient. Elle est alors **immobile au sens des chocs** : c'est le
   * geste qui dicte sa position, et la repousser reviendrait à lutter contre la souris.
   */
  tenue: Ref<boolean>
  /** Relance la boucle de cette balle, qui a pu s'endormir. */
  reveiller: () => void
}

/**
 * Au niveau du module, donc partagé par toutes les instances.
 *
 * 📍 L'inscription se fait dans `onMounted`, donc jamais côté serveur : ce tableau ne risque pas de
 * fuir d'une requête à l'autre.
 */
const enScene: BalleEnScene[] = []
let prochainId = 1

export function inscrireLaBalle(balle: Omit<BalleEnScene, 'id'>): BalleEnScene {
  const inscrite = { ...balle, id: prochainId++ }
  enScene.push(inscrite)
  return inscrite
}

export function retirerLaBalle(id: number) {
  const place = enScene.findIndex((b) => b.id === id)
  if (place !== -1) enScene.splice(place, 1)
}

/**
 * Qui, de `moi` et `autre`, prend la paire en charge. Voir la note en tête du fichier.
 *
 * L'ordre des trois cas compte : une balle tenue passe AVANT la règle des identifiants, sans quoi
 * une balle tenue d'identifiant élevé laisserait la paire à une voisine qui dort.
 */
function aLaChargeDeLaPaire(moi: BalleEnScene, autre: BalleEnScene): boolean {
  // Deux balles tenues à deux doigts : aucune ne peut céder, il n'y a rien à résoudre.
  if (moi.tenue.value && autre.tenue.value) return false
  // Une balle tenue tourne forcément (sa boucle ne s'endort pas) : elle prend toutes ses paires.
  if (moi.tenue.value) return true
  if (autre.tenue.value) return false
  // Deux balles libres : la plus petite, pour n'en traiter qu'une sur les deux.
  return autre.id > moi.id
}

/**
 * Résout les chocs de `moi` contre les balles qu'elle doit traiter.
 *
 * @param rebond part de la vitesse d'approche restituée. L'utilisateur l'a voulue FAIBLE : deux
 *   balles qui se cognent doivent se déranger à peine, pas se repousser comme des billes d'acier.
 */
export function resoudreLesChocs(moi: BalleEnScene, rebond: number) {
  for (const autre of enScene) {
    if (autre.id === moi.id) continue
    if (!aLaChargeDeLaPaire(moi, autre)) continue

    const rayonA = moi.taille / 2
    const rayonB = autre.taille / 2
    const dx = autre.x.value + rayonB - (moi.x.value + rayonA)
    const dy = autre.y.value + rayonB - (moi.y.value + rayonA)
    const distance = Math.hypot(dx, dy)
    const contact = rayonA + rayonB

    if (distance >= contact) continue

    /*
     * Deux balles exactement superposées n'ont pas de direction de séparation : on en invente une,
     * verticale. Sans ce cas, la division par zéro produit des `NaN` qui se propagent dans les
     * positions — et les balles disparaissent définitivement, sans erreur.
     */
    const nx = distance > 0.001 ? dx / distance : 0
    const ny = distance > 0.001 ? dy / distance : 1

    /*
     * Comment l'écart et l'impulsion se répartissent entre les deux. À masses égales, chacune en
     * prend la moitié ; face à une balle tenue, celle qui est libre encaisse TOUT — c'est le
     * comportement d'une masse infinie, et c'est ce qui permet de pousser une balle à la souris.
     */
    const partMoi = moi.tenue.value ? 0 : autre.tenue.value ? 1 : 0.5
    const partAutre = 1 - partMoi

    // Les séparer d'abord : sinon elles restent imbriquées et se re-heurtent à chaque image.
    const chevauchement = contact - distance
    moi.x.value -= nx * chevauchement * partMoi
    moi.y.value -= ny * chevauchement * partMoi
    autre.x.value += nx * chevauchement * partAutre
    autre.y.value += ny * chevauchement * partAutre

    /*
     * Réveiller dès qu'on l'a DÉPLACÉE, et non seulement quand on lui transmet de la vitesse :
     * poussée vers le haut alors que sa boucle dort, elle resterait suspendue en l'air sans que la
     * gravité ne s'applique jamais.
     */
    if (partAutre > 0) autre.reveiller()

    // La vitesse d'approche le long de la normale. Positive : elles s'éloignent déjà, rien à faire.
    const vitesseNormale =
      (autre.vx.value - moi.vx.value) * nx + (autre.vy.value - moi.vy.value) * ny
    if (vitesseNormale >= 0) continue

    const impulsion = -(1 + rebond) * vitesseNormale
    moi.vx.value -= impulsion * nx * partMoi
    moi.vy.value -= impulsion * ny * partMoi
    autre.vx.value += impulsion * nx * partAutre
    autre.vy.value += impulsion * ny * partAutre
  }
}

/** Réservé aux tests : le registre vit au niveau du module et survivrait d'un cas à l'autre. */
export function viderLeRegistrePourLesTests() {
  enScene.length = 0
  prochainId = 1
}
