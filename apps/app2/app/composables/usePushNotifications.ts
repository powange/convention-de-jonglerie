/**
 * Les notifications push sur CET appareil (Web Push standard, cf. server/utils/push.ts).
 *
 * `etat` :
 * - `inconnu` : pas encore vérifié (rendu serveur, ou avant `rafraichir`) ;
 * - `indisponible` : navigateur sans push, ou push éteint côté serveur (pas de clés). Sur iPhone,
 *   le push n'existe que dans une application installée sur l'écran d'accueil ;
 * - `refuse` : la permission a été refusée — seul le navigateur peut la rendre ;
 * - `inactif` : possible, pas activé ;
 * - `actif` : cet appareil reçoit les notifications du compte.
 *
 * L'état est partagé (cloche, profil) : `useState`.
 */
export type EtatPush = 'inconnu' | 'indisponible' | 'refuse' | 'inactif' | 'actif'

/** La clé publique VAPID (base64 URL) → les octets qu'attend `pushManager.subscribe`. */
function versOctets(base64: string): Uint8Array<ArrayBuffer> {
  const complement = '='.repeat((4 - (base64.length % 4)) % 4)
  const brut = atob((base64 + complement).replace(/-/g, '+').replace(/_/g, '/'))
  const octets = new Uint8Array(new ArrayBuffer(brut.length))
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i)
  return octets
}

function pushPrisEnCharge(): boolean {
  return (
    import.meta.client &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Le service worker prêt, ou `null` s'il ne l'est pas dans le délai (hors ligne, non enregistré). */
async function workerPret(delaiMs = 10_000): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), delaiMs)),
  ])
}

export function usePushNotifications() {
  const etat = useState<EtatPush>('push-etat', () => 'inconnu')
  const clePublique = useState<string | null>('push-cle', () => null)

  async function lireCle(): Promise<string | null> {
    if (clePublique.value) return clePublique.value
    const { clePublique: cle } = await $fetch<{ clePublique: string | null }>('/api/push/cle')
    clePublique.value = cle
    return cle
  }

  /**
   * Relit l'état de cet appareil ; s'il est abonné, renvoie son abonnement au serveur, ce qui le
   * rattache au compte connecté (un appareil passé d'un compte à l'autre).
   */
  async function rafraichir() {
    if (!pushPrisEnCharge()) {
      etat.value = 'indisponible'
      return
    }
    try {
      if (!(await lireCle())) {
        etat.value = 'indisponible'
        return
      }
      if (Notification.permission === 'denied') {
        etat.value = 'refuse'
        return
      }
      const enregistrement = await workerPret()
      const abonnement = await enregistrement?.pushManager.getSubscription()
      if (abonnement && Notification.permission === 'granted') {
        await $fetch('/api/push/abonnements', { method: 'POST', body: abonnement.toJSON() })
        etat.value = 'actif'
      } else {
        etat.value = 'inactif'
      }
    } catch {
      etat.value = 'inactif'
    }
  }

  /** À appeler depuis un geste (clic) : iOS refuse la demande de permission autrement. */
  async function activer(): Promise<boolean> {
    if (!pushPrisEnCharge()) return false
    const cle = await lireCle()
    if (!cle) {
      etat.value = 'indisponible'
      return false
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      etat.value = permission === 'denied' ? 'refuse' : 'inactif'
      return false
    }
    const enregistrement = await workerPret()
    if (!enregistrement) throw new Error('Service worker indisponible')
    const abonnement =
      (await enregistrement.pushManager.getSubscription()) ??
      (await enregistrement.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: versOctets(cle),
      }))
    await $fetch('/api/push/abonnements', { method: 'POST', body: abonnement.toJSON() })
    etat.value = 'actif'
    return true
  }

  /** Cet appareil ne reçoit plus rien : retiré du serveur, puis désabonné dans le navigateur. */
  async function desactiver() {
    if (!pushPrisEnCharge()) return
    const enregistrement = await workerPret()
    const abonnement = await enregistrement?.pushManager.getSubscription()
    if (abonnement) {
      await $fetch('/api/push/abonnements', {
        method: 'DELETE',
        body: { endpoint: abonnement.endpoint },
      }).catch(() => null)
      await abonnement.unsubscribe().catch(() => false)
    }
    etat.value = Notification.permission === 'denied' ? 'refuse' : 'inactif'
  }

  /**
   * À la déconnexion, AVANT de fermer la session : cet appareil cesse de recevoir les notifications
   * du compte — la personne suivante sur ce téléphone ne doit pas voir celles de la précédente. Ne
   * lève jamais, et n'attend pas plus de quelques secondes.
   */
  async function desabonnerAvantDeconnexion() {
    if (!pushPrisEnCharge()) return
    try {
      const enregistrement = await workerPret(3000)
      const abonnement = await enregistrement?.pushManager.getSubscription()
      if (!abonnement) return
      await $fetch('/api/push/abonnements', {
        method: 'DELETE',
        body: { endpoint: abonnement.endpoint },
      }).catch(() => null)
      await abonnement.unsubscribe().catch(() => false)
      etat.value = 'inactif'
    } catch {
      // La déconnexion passe avant tout.
    }
  }

  return { etat, rafraichir, activer, desactiver, desabonnerAvantDeconnexion }
}
