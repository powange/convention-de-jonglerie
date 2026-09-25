/**
 * Remet en haut le panneau de gestion quand on change de page.
 *
 * **Le défaut.** On arrivait sur une page de gestion déjà défilée, au niveau où l'on avait laissé
 * la page précédente. Signalé à l'usage, puis mesuré : `document.documentElement.scrollHeight`
 * vaut exactement la hauteur de la fenêtre sur ces écrans, et `window.scrollY` invariablement 0.
 * Autrement dit **la fenêtre ne défile pas du tout** — c'est le corps de `UDashboardPanel` qui
 * défile (`scrollHeight` 1483 pour 600 px visibles, relevé sur l'accueil de gestion).
 *
 * Or la remise à zéro de Nuxt agit sur la fenêtre. Elle s'exécutait donc correctement, et sans
 * aucun effet : le panneau, lui, gardait son `scrollTop` d'une route à l'autre. Rien n'était cassé
 * dans Nuxt, et c'est pourquoi la piste `viewTransition` — la première envisagée — était fausse.
 *
 * **Pourquoi un plugin et non `router.options.ts`.** Redéfinir `scrollBehavior` aurait remplacé
 * celui de Nuxt pour tout le site, et fait perdre ses nuances : l'attente de la transition de page,
 * `scrollBehaviorType`, le `scrollToTop` de `definePageMeta`. Ce plugin s'ajoute sans rien retirer —
 * Nuxt continue de gouverner la fenêtre, on ne s'occupe que du panneau.
 *
 * **Pourquoi le retour arrière n'est pas traité ici.** Une première version mémorisait la position
 * quittée pour la rendre au retour. Elle a été retirée après mesure, et pas pour la raison qu'on
 * croirait : le navigateur ne restaure PAS le défilement de ce conteneur — sans code, le retour
 * arrive à 0. La restitution, elle, n'a jamais atteint mieux que **283 sur une position quittée à
 * 883**, parce que le panneau n'a pas sa hauteur finale au moment où la route se règle, et que le
 * navigateur écrête. Trois formes ont été essayées et mesurées : vingt images, un délai de mille
 * millisecondes, puis un `ResizeObserver` sur le panneau et ses enfants avec deux secondes et demie
 * de budget. Les trois rendent 283.
 *
 * Plutôt qu'une restitution à moitié juste, dont la valeur dépendrait du temps de rendu du jour, le
 * panneau remonte en haut : c'est prévisible, et le défaut signalé disparaît. Rendre la position
 * exacte reste faisable — il faudrait attendre que le contenu soit établi, ce que ni les images ni
 * les millisecondes ne savent dire — mais c'est un autre sujet que celui-ci.
 */
const SELECTEUR = '.zone-defilante-gestion'

export default defineNuxtPlugin(() => {
  const router = useRouter()

  /**
   * Une navigation d'historique laisse le navigateur faire.
   *
   * Les crochets du routeur ne disent pas d'où vient la navigation ; `popstate` le dit, et précède
   * toujours la résolution de la route. Le drapeau se consomme une fois, pour qu'un `popstate`
   * isolé ne teinte pas la navigation suivante.
   */
  let navigationHistorique = false
  window.addEventListener('popstate', () => {
    navigationHistorique = true
  })

  router.afterEach(async (to, from) => {
    // `afterEach` plutôt que le crochet `page:finish` : ce dernier ne se déclenche pas quand seule
    // la `query` change, or c'est précisément un cas qu'il faut reconnaître pour ne RIEN faire.
    //
    // Un changement de `query` seul n'est pas un changement de page : les colonnes visibles d'un
    // tableau, la catégorie ouverte de l'accueil mobile et les filtres vivent tous dans l'URL, et
    // les cocher ne doit pas renvoyer l'utilisateur en haut de son écran.
    const historique = navigationHistorique
    navigationHistorique = false
    if (historique || to.path === from.path) return

    // Le temps que le nouvel écran soit en place : agir avant laisserait le navigateur reposer le
    // panneau là où le contenu précédent l'avait mis.
    await nextTick()
    const el = document.querySelector<HTMLElement>(SELECTEUR)
    if (!el) return

    // Une ancre dans l'URL garde la priorité sur le haut de page — c'est ce que Nuxt fait pour la
    // fenêtre, et ce qu'on attend d'un lien qui désigne un endroit précis.
    if (to.hash) {
      let cible: HTMLElement | null = null
      try {
        cible = el.querySelector<HTMLElement>(to.hash)
      } catch {
        // Une ancre n'est pas forcément un sélecteur CSS valide (`#1`, par exemple).
        cible = null
      }
      if (cible) {
        el.scrollTop = cible.offsetTop
        return
      }
    }

    el.scrollTop = 0
  })
})
