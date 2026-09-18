/**
 * Réordonner une liste au doigt comme à la souris.
 *
 * ⚠️ Pourquoi ce composable existe : le glisser-déposer HTML5 (`draggable`, `dragstart`, `drop`)
 * n'est PAS émis par les navigateurs mobiles au toucher. Tous les écrans du site qui l'utilisent
 * sont donc inertes sur téléphone et tablette — et une convention se prépare en marchant pendant
 * le montage, pas assis devant un clavier.
 *
 * Les *pointer events* couvrent les deux mondes avec un seul jeu d'événements. Quatre précautions
 * les rendent utilisables, et ce sont elles qui justifient un composable plutôt qu'une recopie :
 *
 * 0. **Écouter sur la FENÊTRE, pas sur l'élément.** C'est la première, et celle qui se paie le plus
 *    cher quand on l'oublie : `setPointerCapture` ne peut être appelée qu'une fois l'intention
 *    établie, donc après un premier mouvement — et si ce mouvement sort déjà de l'élément, son
 *    `pointermove` part ailleurs et le geste est perdu avant d'avoir commencé. Sur une carte basse,
 *    vingt pixels suffisent à en sortir. Les écouteurs sont donc posés sur `window` au premier
 *    appui et retirés au relâchement.
 *
 * 1. **Un seuil avant de saisir.** Sans lui, le moindre appui verrouille le pointeur et la page ne
 *    défile plus : on ne peut littéralement plus descendre dans la liste. Le glissement ne commence
 *    qu'au-delà de {@link SEUIL_DE_SAISIE} pixels, ce qui laisse passer les défilements et les
 *    tapes.
 * 2. **Le défilement pendant le glissement.** Arrivé en haut ou en bas de la fenêtre, on ne peut
 *    plus avancer : la liste doit suivre d'elle-même tant que le doigt reste dans la zone.
 * 3. **La tape qui suit le glissement.** Un `click` part souvent juste après un relâchement, et
 *    ouvrirait la fiche qu'on vient seulement de déplacer.
 */

/** Distance à parcourir avant qu'un appui devienne un glissement, en pixels. */
const SEUIL_DE_SAISIE = 8

/** Hauteur de la bande, en haut et en bas de la fenêtre, qui déclenche le défilement. */
const BANDE_DE_DEFILEMENT = 72

/** Vitesse maximale du défilement automatique, en pixels par image. */
const VITESSE_DE_DEFILEMENT = 14

export interface OptionsReordonnancement<T> {
  /** La liste affichée, dans l'ordre où elle est rendue. */
  elements: () => T[]
  /** L'identité d'un élément — jamais son rang, qui change en cours de glissement. */
  cle: (element: T) => number | string
  /**
   * Appelé une fois le doigt relevé, avec la liste réordonnée.
   *
   * À l'appelant d'enregistrer et de revenir en arrière en cas d'échec : lui seul sait quel point
   * d'API appeler et ce qu'il faut réafficher.
   *
   * `zone` porte le `data-zone-reordonnable` sous le doigt au moment du relâchement, quand la
   * liste est découpée en zones — les colonnes d'un kanban. `null` sinon.
   */
  auDepot: (ordreFinal: T[], deplace: T, zone: string | null) => void | Promise<void>
  /** Bloque le glissement — un tri actif, un droit manquant. */
  desactive?: () => boolean
}

export function useReordonnancementTactile<T>(options: OptionsReordonnancement<T>) {
  const cleSaisie = ref<number | string | null>(null)
  const cleSurvolee = ref<number | string | null>(null)
  /** La zone sous le doigt, pour les listes découpées en colonnes. */
  const zoneSurvolee = ref<string | null>(null)
  /** Au-dessus ou en dessous de l'élément survolé — ce que le trait d'insertion doit montrer. */
  const cote = ref<'avant' | 'apres' | null>(null)

  /**
   * Un glissement vient-il de se terminer&nbsp;?
   *
   * L'appelant s'en sert pour ignorer le `click` qui suit. La valeur retombe au tour de boucle
   * suivant, une fois l'événement parasite passé.
   */
  const vientDeGlisser = ref(false)

  let departX = 0
  let departY = 0
  let saisieConfirmee = false
  let defilement: number | null = null
  let vitesse = 0

  const enCours = computed(() => cleSaisie.value !== null && saisieConfirmee)

  function arreterDefilement() {
    if (defilement !== null) {
      cancelAnimationFrame(defilement)
      defilement = null
    }
    vitesse = 0
  }

  function boucleDeDefilement() {
    if (vitesse === 0) {
      defilement = null
      return
    }
    window.scrollBy(0, vitesse)
    defilement = requestAnimationFrame(boucleDeDefilement)
  }

  /** Règle la vitesse selon la proximité du bord, et lance la boucle si besoin. */
  function ajusterDefilement(y: number) {
    const hauteur = window.innerHeight
    if (y < BANDE_DE_DEFILEMENT) {
      vitesse = -Math.ceil(
        ((BANDE_DE_DEFILEMENT - y) / BANDE_DE_DEFILEMENT) * VITESSE_DE_DEFILEMENT
      )
    } else if (y > hauteur - BANDE_DE_DEFILEMENT) {
      vitesse = Math.ceil(
        ((y - (hauteur - BANDE_DE_DEFILEMENT)) / BANDE_DE_DEFILEMENT) * VITESSE_DE_DEFILEMENT
      )
    } else {
      vitesse = 0
    }
    if (vitesse !== 0 && defilement === null) {
      defilement = requestAnimationFrame(boucleDeDefilement)
    }
  }

  function detacherEcouteurs() {
    window.removeEventListener('pointermove', auPointerMove)
    window.removeEventListener('pointerup', auPointerUp)
    window.removeEventListener('pointercancel', annuler)
  }

  function reinitialiser() {
    detacherEcouteurs()
    arreterDefilement()
    cleSaisie.value = null
    cleSurvolee.value = null
    zoneSurvolee.value = null
    cote.value = null
    saisieConfirmee = false
  }

  function annuler() {
    reinitialiser()
  }

  function auPointerDown(element: T, event: PointerEvent) {
    if (options.desactive?.()) return
    // Bouton droit et bouton du milieu ne saisissent rien : ils ouvrent des menus.
    if (event.pointerType === 'mouse' && event.button !== 0) return

    cleSaisie.value = options.cle(element)
    departX = event.clientX
    departY = event.clientY
    saisieConfirmee = false

    // Sur la fenêtre : voir la précaution 0 de l'en-tête. Le geste doit survivre à la sortie de
    // l'élément, y compris avant que la moindre capture ait pu être prise.
    window.addEventListener('pointermove', auPointerMove, { passive: false })
    window.addEventListener('pointerup', auPointerUp)
    window.addEventListener('pointercancel', annuler)
  }

  function auPointerMove(event: PointerEvent) {
    if (cleSaisie.value === null) return

    if (!saisieConfirmee) {
      const distance = Math.hypot(event.clientX - departX, event.clientY - departY)
      if (distance < SEUIL_DE_SAISIE) return
      saisieConfirmee = true
    }

    // `preventDefault` empêche le défilement natif de lutter contre le nôtre pendant le glissement.
    event.preventDefault()
    ajusterDefilement(event.clientY)

    // Sous le doigt plutôt que sous la souris : `elementFromPoint` est la seule façon de savoir ce
    // qu'on survole une fois le pointeur capturé, puisque les événements ne partent plus des
    // éléments traversés mais de celui qui capture.
    const sous = document.elementFromPoint(event.clientX, event.clientY)
    zoneSurvolee.value =
      sous?.closest<HTMLElement>('[data-zone-reordonnable]')?.dataset.zoneReordonnable ?? null

    const cible = sous?.closest<HTMLElement>('[data-reordonnable]')
    if (!cible) {
      cleSurvolee.value = null
      cote.value = null
      return
    }

    const cleCible = cible.dataset.reordonnable
    if (cleCible === undefined || cleCible === String(cleSaisie.value)) {
      cleSurvolee.value = null
      cote.value = null
      return
    }

    const boite = cible.getBoundingClientRect()
    // `dataset` ne rend que des chaînes. Les modèles comparent à `task.id`, un nombre : sans cette
    // conversion, `'45' === 45` est faux et le trait d'insertion ne s'affiche jamais — le
    // glissement fonctionne, mais à l'aveugle.
    cleSurvolee.value = /^\d+$/.test(cleCible) ? Number(cleCible) : cleCible
    cote.value = event.clientY < boite.top + boite.height / 2 ? 'avant' : 'apres'
  }

  async function auPointerUp() {
    if (cleSaisie.value === null) return

    const saisie = cleSaisie.value
    const survolee = cleSurvolee.value
    const zone = zoneSurvolee.value
    const position = cote.value
    const avaitGlisse = saisieConfirmee

    reinitialiser()

    if (avaitGlisse) {
      vientDeGlisser.value = true
      // Le `click` parasite part dans la foulée du relâchement : laisser passer un tour suffit.
      setTimeout(() => {
        vientDeGlisser.value = false
      }, 0)
    }

    if (!avaitGlisse) return

    // Déposé dans une zone sans viser de carte — la partie vide d'une colonne. L'appelant décide
    // quoi en faire : sur un kanban, c'est un changement de statut sans changement de rang.
    if (survolee === null || position === null) {
      if (zone !== null) {
        const liste = options.elements()
        const element = liste.find((e) => String(options.cle(e)) === String(saisie))
        if (element) await options.auDepot(liste, element, zone)
      }
      return
    }

    const liste = options.elements()
    const depuis = liste.findIndex((e) => String(options.cle(e)) === String(saisie))
    if (depuis === -1) return

    const sansLui = liste.filter((_, i) => i !== depuis)
    const versIdx = sansLui.findIndex((e) => String(options.cle(e)) === String(survolee))
    if (versIdx === -1) return

    const deplace = liste[depuis]
    if (deplace === undefined) return

    const insertion = position === 'avant' ? versIdx : versIdx + 1
    const ordreFinal = [...sansLui.slice(0, insertion), deplace, ...sansLui.slice(insertion)]

    await options.auDepot(ordreFinal, deplace, zone)
  }

  // Un composant démonté en plein glissement laisserait des écouteurs sur la fenêtre.
  onScopeDispose(() => {
    detacherEcouteurs()
    arreterDefilement()
  })

  return {
    /**
     * Seul `auPointerDown` se lie dans le modèle, avec `:data-reordonnable="cle"` sur le même
     * élément. Le suivi et le relâchement sont écoutés sur la fenêtre, pas sur l'élément.
     */
    auPointerDown,
    cleSaisie,
    cleSurvolee,
    zoneSurvolee,
    cote,
    enCours,
    vientDeGlisser,
  }
}
