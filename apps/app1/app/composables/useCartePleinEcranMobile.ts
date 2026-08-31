import { useElementBounding, useMediaQuery } from '@vueuse/core'

import type { Ref } from 'vue'

/**
 * Carte plein écran sur mobile, avec son panneau du bas.
 *
 * Deux pages s'en servent : la carte du site publique et sa page de gestion. Le mécanisme tient
 * en trois idées — une hauteur mesurée plutôt que calculée, un tiroir non modal qui laisse
 * manipuler la carte, et des crans dont vaul garde la main sauf le temps d'un repli.
 *
 * Chacune de ces idées a coûté une mesure : les commentaires qui suivent disent laquelle, et ce
 * qui arrive quand on s'en écarte. C'est précisément pourquoi ce code ne doit exister qu'une fois.
 *
 * @param carte  L'instance Leaflet, avertie quand la hauteur change — sans quoi elle continue de
 *               dessiner pour l'ancienne taille : tuiles manquantes et clics décalés.
 */
export function useCartePleinEcranMobile(carte: Ref<unknown>) {
  /**
   * En dessous de `lg`, la carte occupe tout ce qui reste sous elle jusqu'au bas de l'écran.
   *
   * La hauteur est **mesurée** et non calculée : ce qui la surplombe — barre d'onglets de l'édition,
   * sélecteur de vue, encart hors ligne — change de hauteur selon l'édition et la largeur de
   * l'écran. Une formule en dur se décalerait au premier onglet ajouté.
   *
   * `dvh` et non `vh` : sur mobile, la barre d'URL se rétracte au défilement, et `vh` fige la
   * hauteur d'avant rétractation — la carte dépasserait alors du bas.
   */
  const mapSectionRef = ref<HTMLElement | null>(null)
  const estMobile = useMediaQuery('(max-width: 1023px)')

  /**
   * Une ref de fonction plutôt qu'un `ref="…"` nommé : la section n'existe qu'une fois zones et
   * marqueurs chargés, donc bien après `onMounted`, et deux branches d'affichage se la partagent.
   */
  const enregistrerSection = (el: unknown) => {
    if (el) {
      mapSectionRef.value = el as HTMLElement
      return
    }
    // Vue passe `null` au démontage. Ne pas effacer aveuglément : en basculant d'une vue à l'autre,
    // la nouvelle section s'enregistre parfois avant que l'ancienne ne se retire, et l'effacement
    // emporterait alors la référence qu'on vient d'obtenir. On ne libère que si l'élément retenu a
    // réellement quitté le document.
    if (mapSectionRef.value && !mapSectionRef.value.isConnected) mapSectionRef.value = null
  }

  /**
   * Position de la section, suivie en continu.
   *
   * Observée plutôt que mesurée à la main : au moment où l'élément entre dans le DOM, il n'est pas
   * encore positionné et toute mesure immédiate vaut zéro. `useElementBounding` s'appuie sur un
   * ResizeObserver et se remet à jour quand la géométrie change pour de bon — rotation de l'écran,
   * barre d'onglets qui passe sur deux lignes, encart hors ligne qui apparaît.
   */
  const { top: hautSection, height: hauteurRendue } = useElementBounding(mapSectionRef)

  const carteHauteur = computed(() => {
    // `hautSection` est relatif à la fenêtre : le défilement s'y ajoute pour obtenir une distance
    // au haut du document, qui elle ne bouge pas quand on fait défiler la page.
    const haut = Math.round(hautSection.value + (import.meta.client ? window.scrollY : 0))
    // Zéro signale une mise en page pas encore faite : s'y fier donnerait une carte haute d'un écran
    // entier, débordant largement par le bas.
    if (haut <= 0) return '24rem'
    // Un plancher évite une carte inutilisable sur un écran très court ou en paysage.
    return `max(20rem, calc(100dvh - ${haut}px))`
  })

  /**
   * Crans du panneau, du plus discret au plein écran.
   *
   * Un cran est, selon la documentation du composant, « % of the screen a given snap point should
   * take up » : vaul translate le panneau d'après la hauteur de la **fenêtre**, jamais d'après la
   * sienne. D'où deux règles qui vont ensemble.
   *
   * **Le dernier cran vaut `1`.** À 0,92, vaul poussait 8 % du panneau — 67 px mesurés — sous le
   * bord bas de l'écran, emportant la fin de la liste, qu'aucun défilement ne rattrapait.
   *
   * **Le panneau doit faire toute la hauteur de l'écran** (`max-h-full` plus bas), sinon un cran en
   * pixels n'en découvre que `valeur − (écran − panneau)`. C'était la vraie cause des « 27 px
   * retranchés par vaul » que ce commentaire attribuait naguère à la bibliothèque : le thème
   * donnait au panneau 96 % de l'écran, et les 4 % manquants se retiraient de chaque cran.
   *
   * Le premier cran est en pixels : une poignée doit garder la même hauteur quel que soit le
   * téléphone, là où un pourcentage la ferait maigrir sur les petits écrans — précisément ceux où
   * elle doit rester saisissable. Sa valeur est calée sur le contenu : le bandeau de poignée occupe
   * les 28 premiers pixels et le titre s'arrête vers 80, le premier filtre commençant juste après.
   * Le cran s'arrête avant lui — au repos on voit la poignée et le titre, rien de tronqué.
   *
   * Cela suppose un titre sur une seule ligne. S'il venait à passer sur deux — traduction plus
   * longue, écran très étroit — il faudrait mesurer l'en-tête à l'exécution plutôt que de figer.
   *
   * Le cran actif n'est volontairement pas piloté depuis ici : lier `activeSnapPoint` figeait le
   * panneau entre deux crans dès qu'on le tirait ailleurs que par la poignée, et il y restait.
   * Mesuré : arrêt à 486 px, sans retour, là où vaul laissé libre revient proprement à 511.
   */
  const CRANS_PANNEAU = ['84px', 0.5, 1]
  const panneauOuvert = ref(true)

  /**
   * Habillage du panneau.
   *
   * La poignée est étendue à toute la largeur : vaul cale sa zone de préhension dessus, et celle
   * d'origine — 48 px au centre — obligeait à viser une bande étroite juste au-dessus de la carte.
   * Un doigt qui la manquait tombait sur Leaflet, qui faisait défiler le plan au lieu d'ouvrir le
   * panneau. Mesuré : de 48 px de large à 390, et le panneau s'ouvre désormais depuis n'importe quel
   * point de la largeur. La barre visible est redessinée en pseudo-élément — elle reste un indice
   * sans redevenir la seule prise.
   */
  const UI_PANNEAU = {
    // Le thème pose déjà `h-full` dès qu'il y a des crans, mais une variante antérieure plafonne à
    // `max-h-[96%]` ; ce plafond est ce qui donnait au panneau 810 px pour un écran de 844. Le
    // lever rend aux crans la hauteur qu'ils annoncent (voir `CRANS_PANNEAU`). Le panneau n'occupe
    // pas pour autant tout l'écran en permanence : c'est le cran actif qui décide de ce qu'on en
    // découvre.
    content: 'lg:hidden max-h-full',
    // Le thème ne donne au corps que `flex-1` et place son propre défilement sur le conteneur, qui
    // enveloppe aussi l'en-tête. Le déplacer ici garde le titre fixe et ne fait défiler que la
    // liste — et `overflow-y-auto` autorise au passage ce fils de boîte flexible à rétrécir sous
    // la taille de son contenu, sans quoi il déborderait au lieu de défiler.
    body: 'overflow-y-auto',
    // Bandeau de poignée resserré : la marge du thème (16 px) et une hauteur de 32 laissaient
    // 48 px de vide au-dessus du titre. Ramené à 28. La zone de préhension de vaul reste haute de
    // 44 px indépendamment de ce bandeau — on gagne du blanc sans rétrécir la cible tactile.
    //
    // Centrage par marge automatique et non par `flex` : le thème impose son propre mode d'affichage
    // à la poignée, et la barre visible se retrouvait plaquée contre le bord gauche.
    handle:
      "!mt-2 !w-full !h-5 !bg-transparent !rounded-none pt-2 before:content-[''] before:block " +
      'before:mx-auto before:w-12 before:h-1.5 before:rounded-full before:bg-accented',
  }

  /**
   * Leaflet garde en mémoire la taille de son conteneur : sans cet avertissement, il continue de
   * dessiner pour l'ancienne — tuiles manquantes en bas et clics décalés par rapport à ce qu'on voit.
   *
   * Le déclencheur est la hauteur **réellement rendue**, observée par `useElementBounding`, et
   * non la chaîne CSS calculée : les deux sont disponibles ici, et la première décrit la
   * géométrie que Leaflet doit apprendre, quand la seconde n'en est qu'une expression.
   *
   * L'instance est surveillée avec elle : selon la page, la carte naît avant ou après que la
   * hauteur se stabilise.
   */
  watch([hauteurRendue, carte], () =>
    nextTick(() => {
      // La carte est exposée en lecture seule, ce qui efface le type de ses méthodes. Le
      // transtypage ne contourne pas une protection : il rend seulement visible une méthode que
      // l'instance possède bel et bien à l'exécution.
      const instance = carte.value as { invalidateSize?: () => void } | null
      instance?.invalidateSize?.()
    })
  )

  /**
   * Cran imposé de l'extérieur, le temps d'un repli.
   *
   * `undefined` la plupart du temps : la propriété est alors absente et vaul gère seul ses crans.
   * La lier en permanence le fige entre deux positions dès qu'on tire le panneau ailleurs que par la
   * poignée — vaul n'émet alors aucun changement, la valeur imposée reste la même, et plus rien ne
   * remet la feuille en place. Mesuré : arrêt définitif à 555 px, entre le repos et la moitié.
   *
   * On ne prend donc la main que pour redescendre le panneau, et on la rend juste après.
   */
  const cranImpose = ref<string | number | undefined>(undefined)
  let minuterieRepli: ReturnType<typeof setTimeout> | undefined

  /** Rend la main à vaul, qu'on la lui ait reprise par minuterie ou par un geste de l'utilisateur. */
  const rendreLaMain = () => {
    clearTimeout(minuterieRepli)
    cranImpose.value = undefined
  }

  /**
   * Redescend le panneau au repos après un choix : sans cela, il masque le point qu'on vient de
   * demander à voir.
   */
  const replierPanneau = () => {
    clearTimeout(minuterieRepli)
    cranImpose.value = CRANS_PANNEAU[0]
    // Rendre la main une fois l'animation finie. Trop tôt, la feuille repartirait d'où elle venait.
    // Un geste de l'utilisateur pendant ce délai la rend aussitôt, via `@drag` : sans cela, une main
    // posée sur le panneau dans cette fenêtre retomberait sur le blocage décrit plus haut.
    minuterieRepli = setTimeout(rendreLaMain, 600)
  }

  onBeforeUnmount(() => clearTimeout(minuterieRepli))

  return {
    /** Vrai en dessous de `lg`, seuil auquel la mise en page bascule. */
    estMobile,
    /** À poser en `:ref` sur la section qui contient la carte. */
    enregistrerSection,
    /** Valeur CSS à donner à la variable `--carte-hauteur`. */
    carteHauteur,
    CRANS_PANNEAU,
    UI_PANNEAU,
    panneauOuvert,
    cranImpose,
    /** À brancher sur `@drag` du tiroir. */
    rendreLaMain,
    /** Redescend le panneau après un choix, pour ne pas masquer ce qu'on vient de demander. */
    replierPanneau,
  }
}
