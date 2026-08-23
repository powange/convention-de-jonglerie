import { editionSurPlace, RAYON_SUR_PLACE_KM } from '~~/shared/utils/geolocalisation'

interface EditionEnCours {
  id: number
  nom: string
  latitude: number
  longitude: number
  estBenevole: boolean
}

/** Marque de session : une seule redirection automatique, même si l'on revient à l'accueil. */
const CLE_SESSION = 'edition-sur-place-proposee'

/**
 * Emmène l'utilisateur sur l'édition où il se trouve, quand il en existe une en cours.
 *
 * Trois précautions dictent la forme de ce composable :
 *
 * — La position ne quitte jamais l'appareil. Le serveur donne les éditions en cours, le
 *   navigateur calcule la distance. Rien n'est transmis ni conservé.
 * — La permission n'est jamais demandée à l'aveugle. On interroge d'abord l'API des permissions :
 *   sans autorisation déjà accordée, on ne déclenche aucune fenêtre du navigateur — une demande
 *   surgie sans raison se solde souvent par un refus définitif, qui condamnerait la
 *   fonctionnalité.
 * — La redirection n'a lieu qu'une fois par session. Sans cela, qui ouvre l'application pour
 *   chercher autre chose se retrouverait renvoyé sur l'édition à chaque tentative.
 */
export function useEditionSurPlace() {
  const enCours = ref(false)

  const dejaPropose = () => {
    try {
      return sessionStorage.getItem(CLE_SESSION) === '1'
    } catch {
      // Navigation privée ou stockage refusé : mieux vaut ne rien proposer que de le refaire
      // à chaque page.
      return true
    }
  }

  const marquerPropose = () => {
    try {
      sessionStorage.setItem(CLE_SESSION, '1')
    } catch {
      // Sans stockage, on s'abstient plutôt que d'insister.
    }
  }

  /** La position, seulement si l'autorisation est DÉJÀ accordée. */
  const positionSiAutorisee = async (): Promise<GeolocationPosition | null> => {
    if (!import.meta.client || !navigator.geolocation) return null

    if (navigator.permissions?.query) {
      try {
        const etat = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
        if (etat.state !== 'granted') return null
      } catch {
        // Certains navigateurs ne savent pas interroger cette permission : on s'abstient plutôt
        // que de faire surgir une demande non sollicitée.
        return null
      }
    } else {
      // LIMITE CONNUE : sans API des permissions — Safari au premier chef — l'état de
      // l'autorisation est inconnaissable, et la détection ne se déclenche donc jamais. La
      // lever suppose d'accepter une demande de position non sollicitée, ou d'ajouter un
      // bouton explicite : c'est un arbitrage de conception, pas un oubli.
      return null
    }

    return new Promise((resoudre) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resoudre(position),
        () => resoudre(null),
        { timeout: 8000, maximumAge: 5 * 60 * 1000 }
      )
    })
  }

  /**
   * Cherche une édition en cours autour de l'utilisateur et y emmène, le cas échéant.
   * Ne fait rien si aucune édition ne se déroule, ce qui est le cas la plupart du temps.
   */
  const detecterEtRediriger = async () => {
    if (!import.meta.client || dejaPropose() || enCours.value) return
    enCours.value = true

    try {
      const reponse = await $fetch<{ editions: EditionEnCours[] }>(
        '/api/editions/en-cours-localisees'
      )
      const editions = reponse?.editions ?? []
      if (editions.length === 0) return

      const position = await positionSiAutorisee()
      if (!position) return

      const trouvee = editionSurPlace(
        { latitude: position.coords.latitude, longitude: position.coords.longitude },
        editions,
        RAYON_SUR_PLACE_KM
      )
      if (!trouvee) return

      marquerPropose()

      // Un bénévole accepté vient chercher son planning, pas la présentation de l'édition.
      const destination = trouvee.estBenevole
        ? `/editions/${trouvee.id}/volunteers`
        : `/editions/${trouvee.id}`

      await navigateTo({ path: destination, query: { surPlace: trouvee.nom } })
    } catch {
      // Une détection qui échoue ne doit pas se voir : l'utilisateur n'a rien demandé.
    } finally {
      enCours.value = false
    }
  }

  return { detecterEtRediriger }
}
