/**
 * L'invitation à installer l'application, partagée entre le bandeau et le menu utilisateur.
 *
 * ⚠️ POURQUOI UN ÉTAT DE MODULE. Le navigateur n'émet `beforeinstallprompt` QU'UNE FOIS, et
 * l'objet qu'il fournit ne peut être consommé qu'une fois. Deux composants qui l'écouteraient
 * chacun de leur côté se disputeraient le même événement : le second n'aurait jamais rien. Le
 * bandeau et l'entrée du menu lisent donc le même état, capté une seule fois.
 */

const REPORT_JOURS = 7
const CLE_REPORT = 'pwa-dismissed'
const DELAI_AVANT_BANDEAU_MS = 5000

/** L'objet du navigateur, consommable une seule fois. */
let promptDiffere: { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null = null

/** Vrai dès que le navigateur a proposé l'installation et qu'elle n'a pas encore eu lieu. */
const installationPossible = ref(false)

/** Vrai quand le bandeau doit être à l'écran. Distinct du précédent : l'entrée du menu, elle,
 * reste offerte même après un report. */
const bandeauVisible = ref(false)

let ecouteursPoses = false
let minuterie: ReturnType<typeof setTimeout> | null = null

/**
 * Le report est-il encore valable ?
 *
 * ⚠️ Chaque accès à `localStorage` est entouré d'un `try/catch` : en navigation privée verrouillée
 * ou avec les données de site bloquées, la simple LECTURE lève. Sans garde, l'invitation
 * n'apparaîtrait plus du tout pour ces visiteurs — et la panne serait invisible, puisqu'un bandeau
 * absent ne se distingue pas d'un bandeau non demandé.
 */
function reportEncoreValable(): boolean {
  try {
    const depuis = localStorage.getItem(CLE_REPORT)
    if (!depuis) return false
    const instant = Number.parseInt(depuis, 10)
    if (Number.isNaN(instant)) return false
    return instant > Date.now() - REPORT_JOURS * 24 * 60 * 60 * 1000
  } catch {
    // Stockage inaccessible : on ne se souvient de rien, et l'invitation reste possible.
    return false
  }
}

function memoriserLeReport() {
  try {
    localStorage.setItem(CLE_REPORT, Date.now().toString())
  } catch {
    // Rien à faire : le report ne durera que le temps de la page.
  }
}

/** L'application tourne-t-elle déjà installée ? */
function dejaInstallee(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

export function useInvitePwa() {
  const { t } = useI18n()
  const toast = useToast()
  const route = useRoute()

  /**
   * Le bandeau ne s'affiche que hors des écrans de saisie — et le critère est RÉÉVALUÉ à chaque
   * changement de page : entrer dans un formulaire alors que le bandeau est déjà là doit le faire
   * disparaître, sans quoi l'interruption serait simplement décalée.
   */
  const routeAutorisee = computed(() => invitePwaAutorisee(route.path))

  const afficherLeBandeau = computed(
    () => bandeauVisible.value && installationPossible.value && routeAutorisee.value
  )

  /** L'entrée du menu, elle, ne dépend pas de la route : c'est un geste volontaire. */
  const entreeDeMenuDisponible = computed(() => installationPossible.value)

  const installer = async () => {
    if (!promptDiffere) return

    try {
      promptDiffere.prompt()
      const { outcome } = await promptDiffere.userChoice

      if (outcome === 'accepted') {
        bandeauVisible.value = false
        installationPossible.value = false
        toast.add({
          title: t('pwa.install.success.title'),
          description: t('pwa.install.success.description'),
          icon: 'i-heroicons-check-circle',
          color: 'success',
        })
      } else {
        /*
         * Refus dans la boîte du navigateur : on referme le bandeau et on mémorise le report.
         * L'ancien code laissait le bandeau ouvert, si bien qu'un refus laissait l'invitation à
         * l'écran — et il fallait la fermer une seconde fois.
         */
        bandeauVisible.value = false
        memoriserLeReport()
        toast.add({
          title: t('pwa.install.cancelled.title'),
          description: t('pwa.install.cancelled.description'),
          icon: 'i-heroicons-information-circle',
          color: 'neutral',
        })
      }

      promptDiffere = null
    } catch (error) {
      console.error("Erreur lors de l'installation:", error)
      toast.add({
        title: t('pwa.install.error.title'),
        description: t('pwa.install.error.description'),
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error',
      })
    }
  }

  const reporter = () => {
    bandeauVisible.value = false
    memoriserLeReport()
  }

  /**
   * Pose les écouteurs du navigateur, UNE SEULE FOIS pour toute l'application.
   *
   * Appelé par le bandeau, qui vit dans `app.vue` : c'est le seul composant présent sur toutes les
   * pages, donc le seul qui puisse garantir que l'événement ne sera pas manqué.
   */
  const ecouterLeNavigateur = () => {
    if (ecouteursPoses || !import.meta.client) return
    ecouteursPoses = true

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      promptDiffere = e as any
      installationPossible.value = true

      /*
       * Le délai reste, mais il ne sert plus à la même chose : il évitait d'ouvrir une modale sur
       * une page à peine chargée. Un bandeau ne bloquant rien, c'est désormais une simple
       * politesse — on laisse la page s'afficher avant de proposer quelque chose.
       */
      if (dejaInstallee() || reportEncoreValable()) return

      minuterie = setTimeout(() => {
        bandeauVisible.value = true
      }, DELAI_AVANT_BANDEAU_MS)
    })

    window.addEventListener('appinstalled', () => {
      bandeauVisible.value = false
      installationPossible.value = false
      promptDiffere = null
      if (minuterie) clearTimeout(minuterie)
    })
  }

  return {
    afficherLeBandeau,
    entreeDeMenuDisponible,
    installer,
    reporter,
    ecouterLeNavigateur,
  }
}
