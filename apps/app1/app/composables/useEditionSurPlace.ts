import type { PeriodeEdition } from '~~/shared/utils/presence-edition'

import { editionSurPlace, RAYON_SUR_PLACE_KM } from '~~/shared/utils/geolocalisation'

interface EditionEnCours {
  id: number
  nom: string
  latitude: number
  longitude: number
  /** Montage, événement ou démontage — sert à formuler le bandeau d'arrivée. */
  periode: PeriodeEdition
  /**
   * Où emmener cette personne-là, décidé par le serveur : lui seul connaît son rôle sur cette
   * édition. Le client n'a pas à le redevenir — deux jugements finiraient par différer.
   */
  destination: string
}

/** Marque de session : une seule redirection automatique, même si l'on revient à l'accueil. */
const CLE_SESSION = 'edition-sur-place-proposee'

/**
 * Emmène l'utilisateur sur l'édition où il se trouve, quand il y en a une.
 *
 * La fenêtre déborde les dates publiques : le montage et le démontage en font partie. Pendant
 * ces deux périodes, seuls sont concernés ceux qui ont une raison d'être là — organisateurs et
 * bénévoles acceptés. Le serveur s'en charge et ne renvoie que ce qui les regarde.
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

  /**
   * Y a-t-il, en ce moment, une édition qui concerne cette personne ? Renseigné après
   * consultation du serveur.
   *
   * « Qui la concerne » et non « qui se déroule » : pendant le montage et le démontage, le
   * serveur n'annonce l'édition qu'aux organisateurs et aux bénévoles acceptés. Le bouton qui
   * s'appuie sur ce drapeau ne promet donc jamais une recherche qui ne pourrait aboutir.
   *
   * Partagé par `useState` et non par un `ref` local : chaque appel du composable crée sinon sa
   * propre instance, et le drapeau renseigné par la page d'accueil n'atteindrait jamais le
   * bouton qui s'en sert pour décider de s'afficher.
   */
  const editionEnCoursExiste = useState('edition-sur-place-existe', () => false)

  /**
   * Une détection est en cours et pourrait emmener ailleurs.
   *
   * Sert à le dire : mesurer une position demande une à deux secondes, pendant lesquelles
   * l'utilisateur commence à lire l'accueil. Sans annonce, le changement de page est subi.
   */
  const detectionEnCours = useState('edition-sur-place-detection', () => false)

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
      // Sans API des permissions — Safari au premier chef — l'état de l'autorisation est
      // inconnaissable. On s'abstient de toute demande automatique ; c'est `demanderPosition`,
      // déclenché par l'utilisateur, qui prend alors le relais.
      return null
    }

    return new Promise((resoudre) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resoudre(position),
        () => resoudre(null),
        // Une position vieille de quelques minutes suffit amplement à situer quelqu'un sur un
        // site de convention, et évite de réveiller le capteur : c'est le cas le plus rapide.
        { timeout: 8000, maximumAge: 10 * 60 * 1000 }
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
    detectionEnCours.value = true

    try {
      // Les deux opérations sont indépendantes : les enchaîner ajoutait l'attente du serveur à
      // celle du capteur, alors que la seconde est de loin la plus longue. Menées de front, le
      // temps total revient à celle qui traîne, non à leur somme.
      //
      // Demander la position en parallèle ne déclenche aucune fenêtre : `positionSiAutorisee`
      // s'abstient tant que l'autorisation n'est pas déjà accordée. Le principe tient donc —
      // rien ne surgit sans consentement préalable.
      const [reponse, position] = await Promise.all([
        $fetch<{ editions: EditionEnCours[] }>('/api/editions/en-cours-localisees'),
        positionSiAutorisee(),
      ])

      const editions = reponse?.editions ?? []
      editionEnCoursExiste.value = editions.length > 0
      if (editions.length === 0 || !position) return

      const trouvee = editionSurPlace(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          precisionM: position.coords.accuracy,
        },
        editions,
        RAYON_SUR_PLACE_KM
      )
      if (!trouvee) return

      marquerPropose()

      await navigateTo({
        path: trouvee.destination,
        query: { surPlace: trouvee.nom, periode: trouvee.periode },
      })
    } catch {
      // Une détection qui échoue ne doit pas se voir : l'utilisateur n'a rien demandé.
    } finally {
      enCours.value = false
      detectionEnCours.value = false
    }
  }

  /**
   * Demande la position à la suite d'un geste de l'utilisateur, puis emmène sur l'édition.
   *
   * Nécessaire là où l'état de l'autorisation ne peut être consulté : la détection automatique
   * ne s'y déclenche jamais, et sans ce recours la fonctionnalité resterait lettre morte sur
   * une bonne part des téléphones. Le geste vaut consentement : la demande du navigateur n'est
   * plus une surprise, elle répond à un clic.
   *
   * Rend `false` quand rien n'a été trouvé, pour que l'appelant puisse le dire — une recherche
   * silencieuse qui n'aboutit pas laisse croire à une panne.
   */
  const demanderPosition = async (): Promise<{ trouve: boolean; diagnostic?: string }> => {
    if (!import.meta.client || !navigator.geolocation) return { trouve: false }

    try {
      const reponse = await $fetch<{ editions: EditionEnCours[] }>(
        '/api/editions/en-cours-localisees'
      )
      const editions = reponse?.editions ?? []
      editionEnCoursExiste.value = editions.length > 0
      if (editions.length === 0) return { trouve: false }

      const mesure = await new Promise<
        { position: GeolocationPosition } | { echec: GeolocationPositionError }
      >((resoudre) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resoudre({ position }),
          (echec) => resoudre({ echec }),
          // L'utilisateur a cliqué : il accepte d'attendre, et le GPS mérite d'être sollicité —
          // c'est lui qui fait la différence entre une mesure à quelques mètres et une position
          // déduite du réseau, imprécise de plusieurs kilomètres.
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 60 * 1000 }
        )
      })

      if ('echec' in mesure) {
        // Un échec de localisation ne disait rien du tout : ni refus, ni expiration, ni origine
        // non sécurisée — or le navigateur refuse la géolocalisation hors HTTPS, ce qui arrive
        // dès qu'on ouvre le serveur de développement depuis un téléphone par son adresse IP.
        const raisons: Record<number, string> = {
          1: 'autorisation refusée (ou origine non sécurisée : la géolocalisation exige HTTPS)',
          2: 'position indisponible',
          3: 'délai dépassé',
        }
        const raison = raisons[mesure.echec.code] || 'cause inconnue'
        return {
          trouve: false,
          diagnostic: `position non obtenue — ${raison}${
            mesure.echec.message ? ` (${mesure.echec.message})` : ''
          }`,
        }
      }

      const position = mesure.position

      const trouvee = editionSurPlace(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          precisionM: position.coords.accuracy,
        },
        editions,
        RAYON_SUR_PLACE_KM
      )
      if (!trouvee) return { trouve: false }

      marquerPropose()
      await navigateTo({
        path: trouvee.destination,
        query: { surPlace: trouvee.nom, periode: trouvee.periode },
      })
      return { trouve: true }
    } catch {
      return { trouve: false }
    }
  }

  return { detecterEtRediriger, demanderPosition, editionEnCoursExiste, detectionEnCours }
}
