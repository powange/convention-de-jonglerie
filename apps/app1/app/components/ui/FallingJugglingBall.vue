<template>
  <div
    ref="boite"
    data-balle-de-jonglerie
    class="fixed z-30 touch-none select-none"
    :class="attrapee ? 'cursor-grabbing' : 'cursor-grab'"
    :style="style"
    aria-hidden="true"
    @pointerdown="attraper"
  >
    <!-- L'ombre reste au SOL et se resserre à mesure que la balle s'élève : c'est elle qui donne la
         hauteur, qu'aucune translation verticale ne peut exprimer seule. -->
    <div class="pointer-events-none absolute left-1/2 rounded-[50%]" :style="styleDeLOmbre" />
    <!--
      ⚠️ DEUX ÉLÉMENTS, ET DEUX ORIGINES DIFFÉRENTES.

      L'écrasement se fait sur `bottom center` : une balle s'aplatit CONTRE le sol, son point bas
      ne bouge pas. La rotation, elle, se fait sur le centre — c'est un solide qui tourne sur
      lui-même.

      Les réunir sur un seul élément oblige à partager une origine, et `bottom center` fait alors
      ORBITER la balle autour de son point bas : en vol, elle paraît tourner autour d'un axe
      excentré. C'est le défaut que ce découpage corrige.
    -->
    <div class="pointer-events-none" :style="styleDeLEcrasement">
      <div :style="styleDeLaRotation">
        <UiJugglingBall :taille="taille" :couleur-a="couleurA" :couleur-b="couleurB" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  inscrireLaBalle,
  resoudreLesChocs,
  retirerLaBalle,
  type BalleEnScene,
} from '~/composables/useBallesEnScene'

/**
 * Une balle de jonglerie qu'on peut attraper à la souris et relancer.
 *
 * ## Pourquoi une simulation, et non des images-clés CSS
 *
 * La version précédente tombait en `@keyframes` : une trajectoire écrite d'avance, donc incapable
 * de dépendre d'un geste. Dès lors qu'on relance la balle à la souris, la trajectoire se calcule à
 * partir d'une vitesse — il faut intégrer, pas interpoler.
 *
 * ## Quatre choses que la boucle doit faire, et qui ne se voient pas
 *
 * **Borner le pas de temps.** Un onglet en arrière-plan ne reçoit plus d'images : au retour,
 * l'écart depuis la dernière peut valoir plusieurs secondes. Intégré tel quel, il téléporte la
 * balle à travers le sol, hors de l'écran. Mieux vaut une seconde de retard qu'une balle perdue.
 *
 * **S'arrêter.** Une boucle qui tourne indéfiniment sur une page ouverte toute la journée consomme
 * pour rien. Elle se coupe dès que la balle dort, et repart au premier geste.
 *
 * **Capturer le pointeur.** Sans `setPointerCapture`, un lancer vif « décroche » dès que le curseur
 * sort des 56 px de la balle, et le relâchement n'est jamais reçu : la balle resterait collée au
 * curseur jusqu'au prochain clic.
 *
 * **Mesurer la vitesse sur une FENÊTRE, pas sur la dernière image.** Deux positions consécutives
 * donnent une vitesse très bruitée, et un même geste produirait des jets très différents. On
 * moyenne donc sur les derniers ~80 ms.
 *
 * ## Les chocs entre balles
 *
 * Chaque composant simule la sienne, mais elles se voient : `useBallesEnScene` tient le registre
 * des balles à l'écran, et c'est lui qui dit laquelle des deux prend une paire en charge. Lire sa
 * note de tête avant d'y toucher — la règle n'est pas celle qu'on devine.
 *
 * ## Ce qui n'est pas fait
 *
 * Un choc ne transmet **aucune rotation** : l'angle ne suit que le déplacement horizontal. Et les
 * balles ne connaissent du décor que le sol et les deux bords de la fenêtre — elles traversent le
 * contenu de la page. C'est un easter egg, pas un moteur physique.
 *
 * 📍 Ce composant ne sait rien de ce qui le fait apparaître : c'est la page d'accueil qui le monte
 * au Konami Code, et son démontage suffit à tout défaire.
 */
const props = withDefaults(
  defineProps<{
    /** Côté de la balle, en pixels. */
    taille?: number
    /** Position horizontale de départ, en fraction de la largeur (0 à gauche, 1 à droite). */
    departHorizontal?: number
    /** Attente avant la chute initiale, en millisecondes. */
    delai?: number
    couleurA?: string
    couleurB?: string
  }>(),
  {
    taille: 56,
    departHorizontal: 0.08,
    delai: 0,
    couleurA: '#e11d48',
    couleurB: '#fbbf24',
  }
)

/* --------------------------------------------------------------- constantes physiques */

/** Pixels par seconde au carré. Réglée à l'œil : plus bas la balle est lunaire, plus haut sèche. */
const GRAVITE = 2600
/** Part de la vitesse conservée au rebond. En dessous de 0,5 la balle meurt au premier contact. */
const REBOND_SOL = 0.62
const REBOND_MUR = 0.74
/** Freinage horizontal quand elle roule, par seconde. */
const FROTTEMENT_SOL = 0.7
/** En dessous, la balle est considérée endormie — sans quoi elle frémit indéfiniment. */
const SEUIL_REPOS = 12
/** Un lancer très vif reste spectaculaire sans traverser l'écran en une seule image. */
const VITESSE_MAX = 3200
/** ⚠️ Voir la note en tête : un onglet en arrière-plan rendrait sinon un écart énorme. */
const PAS_MAX = 1 / 30
const MARGE_BASSE = 12
/**
 * Rebond entre deux balles, volontairement FAIBLE.
 *
 * Demandé ainsi : deux balles qui se cognent doivent se déranger à peine. Plus haut, elles se
 * repoussent comme des billes d'acier et le tas se disperse au moindre contact.
 */
const REBOND_ENTRE_BALLES = 0.2

/* --------------------------------------------------------------- état */

const boite = ref<HTMLElement | null>(null)
const attrapee = ref(false)

/** Position du coin haut-gauche de la balle, en pixels depuis le coin de la fenêtre. */
const x = ref(0)
const y = ref(-200)
const vx = ref(0)
const vy = ref(0)
const angle = ref(0)
/** Écrasement au contact : 0 ronde, 1 aplatie. Décroît tout seul. */
const ecrasement = ref(0)

let image: number | null = null
let derniereDate = 0
/** Les dernières positions du pointeur, pour en tirer une vitesse de lancer stable. */
let echantillons: { t: number; x: number; y: number }[] = []
let departReporte: ReturnType<typeof setTimeout> | null = null
/** L'inscription au registre partagé, qui permet aux balles de se voir. */
let inscription: BalleEnScene | null = null

const clamper = (valeur: number, min: number, max: number) => Math.min(Math.max(valeur, min), max)

const sol = () => window.innerHeight - props.taille - MARGE_BASSE
const murDroit = () => window.innerWidth - props.taille

/* --------------------------------------------------------------- rendu */

const style = computed(() => ({
  left: `${x.value}px`,
  top: `${y.value}px`,
  width: `${props.taille}px`,
  height: `${props.taille}px`,
}))

/** L'écrasement au contact : origine en bas, le sol ne bouge pas. */
const styleDeLEcrasement = computed(() => ({
  transform: `scale(${1 + ecrasement.value * 0.18}, ${1 - ecrasement.value * 0.22})`,
  transformOrigin: 'bottom center',
}))

/** La rotation propre : origine au CENTRE, sans quoi la balle orbite au lieu de tourner. */
const styleDeLaRotation = computed(() => ({
  transform: `rotate(${angle.value}deg)`,
  transformOrigin: 'center center',
}))

const hauteurAuDessusDuSol = ref(0)

const styleDeLOmbre = computed(() => {
  const proximite = Math.max(0, 1 - hauteurAuDessusDuSol.value / 320)
  const largeur = props.taille * (0.45 + proximite * 0.4)
  return {
    bottom: `${-hauteurAuDessusDuSol.value - 6}px`,
    width: `${largeur}px`,
    height: `${props.taille * 0.14}px`,
    marginLeft: `${-largeur / 2}px`,
    background: `radial-gradient(ellipse, rgb(0 0 0 / ${18 + proximite * 26}%), transparent 72%)`,
  }
})

/* --------------------------------------------------------------- la boucle */

function avancer(maintenant: number) {
  const brut = (maintenant - derniereDate) / 1000
  derniereDate = maintenant
  const pas = Math.min(brut, PAS_MAX) // Le plafond du pas : voir la note en tête.

  if (!attrapee.value) {
    vy.value += GRAVITE * pas
    x.value += vx.value * pas
    y.value += vy.value * pas

    /*
     * Les murs. La balle est REPLACÉE sur le bord avant qu'on inverse sa vitesse : sans ce
     * recalage elle reste hors cadre une image de plus, et peut s'y coincer en rebondissant
     * contre elle-même à chaque tour.
     */
    if (x.value < 0) {
      x.value = 0
      vx.value = Math.abs(vx.value) * REBOND_MUR
    } else if (x.value > murDroit()) {
      x.value = murDroit()
      vx.value = -Math.abs(vx.value) * REBOND_MUR
    }

    if (y.value >= sol()) {
      y.value = sol()
      if (vy.value > SEUIL_REPOS) {
        ecrasement.value = Math.min(1, vy.value / 2200)
        vy.value = -vy.value * REBOND_SOL
      } else {
        vy.value = 0
      }
      vx.value *= 1 - FROTTEMENT_SOL * pas
    }

    // La rotation suit le déplacement horizontal : une balle qui roule sans tourner trahit
    // immédiatement l'illusion. Le facteur vient de son périmètre.
    angle.value += (vx.value / (props.taille * Math.PI)) * 360 * pas
  }

  /*
   * Les chocs entre balles, HORS du bloc ci-dessus — et c'est un correctif, pas un détail de
   * forme : à l'intérieur, une balle tenue à la souris n'en résolvait aucun, et comme ses voisines
   * au repos dorment, on pouvait en enfoncer une dans une autre à la main sans aucune réaction.
   *
   * Après les murs, en revanche : une balle repoussée par une autre doit rester dans le cadre, et
   * c'est le recalage du tour suivant qui s'en charge.
   */
  if (inscription) resoudreLesChocs(inscription, REBOND_ENTRE_BALLES)

  ecrasement.value = Math.max(0, ecrasement.value - pas * 5)
  hauteurAuDessusDuSol.value = Math.max(0, sol() - y.value)

  const dort =
    !attrapee.value &&
    Math.abs(vx.value) < SEUIL_REPOS &&
    Math.abs(vy.value) < SEUIL_REPOS &&
    y.value >= sol() - 0.5 &&
    ecrasement.value === 0

  if (dort) {
    image = null // La boucle s'arrête ici ; un geste la relancera.
    return
  }
  image = requestAnimationFrame(avancer)
}

function reveiller() {
  if (image !== null) return
  derniereDate = performance.now()
  image = requestAnimationFrame(avancer)
}

/* --------------------------------------------------------------- attraper et lancer */

function attraper(evenement: PointerEvent) {
  attrapee.value = true
  vx.value = 0
  vy.value = 0
  echantillons = [{ t: performance.now(), x: evenement.clientX, y: evenement.clientY }]
  // Voir la note en tête : sans capture, un lancer rapide décroche et le relâchement se perd.
  boite.value?.setPointerCapture?.(evenement.pointerId)
  window.addEventListener('pointermove', suivre)
  window.addEventListener('pointerup', lancer)
  window.addEventListener('pointercancel', lancer)
  reveiller()
}

function suivre(evenement: PointerEvent) {
  const t = performance.now()
  x.value = clamper(evenement.clientX - props.taille / 2, 0, murDroit())
  y.value = Math.min(evenement.clientY - props.taille / 2, sol())
  hauteurAuDessusDuSol.value = Math.max(0, sol() - y.value)
  echantillons.push({ t, x: evenement.clientX, y: evenement.clientY })
  // On ne garde que les derniers ~80 ms : au-delà, la moyenne lisse le geste jusqu'à l'effacer.
  echantillons = echantillons.filter((e) => t - e.t <= 80)
}

function lancer(evenement: PointerEvent) {
  attrapee.value = false
  window.removeEventListener('pointermove', suivre)
  window.removeEventListener('pointerup', lancer)
  window.removeEventListener('pointercancel', lancer)
  boite.value?.releasePointerCapture?.(evenement.pointerId)

  const premier = echantillons[0]
  const dernier = echantillons[echantillons.length - 1]
  const duree = premier && dernier ? (dernier.t - premier.t) / 1000 : 0

  if (premier && dernier && duree > 0.004) {
    vx.value = clamper((dernier.x - premier.x) / duree, -VITESSE_MAX, VITESSE_MAX)
    vy.value = clamper((dernier.y - premier.y) / duree, -VITESSE_MAX, VITESSE_MAX)
  } else {
    // Un clic sans geste : on la lâche et elle retombe. Lui inventer une impulsion surprendrait —
    // on n'a rien lancé.
    vx.value = 0
    vy.value = 0
  }
  echantillons = []
  reveiller()
}

/* --------------------------------------------------------------- cycle de vie */

function auRedimensionnement() {
  x.value = clamper(x.value, 0, murDroit())
  y.value = Math.min(y.value, sol())
  reveiller()
}

onMounted(() => {
  x.value = clamper(props.departHorizontal * window.innerWidth, 0, murDroit())

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    /*
     * ⚠️ LA CHUTE INITIALE EST SUPPRIMÉE, pas accélérée : un mouvement ample et non sollicité est
     * exactement ce que ce réglage demande d'éviter. La balle reste attrapable — un déplacement
     * qu'on provoque soi-même n'est pas du même ordre.
     */
    y.value = sol()
    hauteurAuDessusDuSol.value = 0
  } else {
    y.value = -props.taille - 40
    departReporte = setTimeout(reveiller, props.delai)
  }
  window.addEventListener('resize', auRedimensionnement)
  inscription = inscrireLaBalle({
    x,
    y,
    vx,
    vy,
    taille: props.taille,
    tenue: attrapee,
    reveiller,
  })
})

onBeforeUnmount(() => {
  if (inscription) retirerLaBalle(inscription.id)
  if (image !== null) cancelAnimationFrame(image)
  if (departReporte) clearTimeout(departReporte)
  window.removeEventListener('resize', auRedimensionnement)
  window.removeEventListener('pointermove', suivre)
  window.removeEventListener('pointerup', lancer)
  window.removeEventListener('pointercancel', lancer)
})
</script>
