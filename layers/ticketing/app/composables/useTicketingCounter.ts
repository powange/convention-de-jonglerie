import { ref, computed, onBeforeUnmount, watch } from 'vue'

interface Counter {
  id: number
  name: string
  token: string
  value: number
  editionId: number
  createdAt: string
  updatedAt: string
  /**
   * Qui a modifié la valeur en dernier. `null` tant que personne n'y a touché depuis l'ajout du
   * champ — les compteurs existants n'ont évidemment pas d'historique rétroactif.
   */
  lastActor?: { id?: number; pseudo: string } | null
}

interface CounterUpdate {
  counterId: number
  value: number
  /** Qui vient de modifier. `null` si la diffusion ne le porte pas. */
  lastActorPseudo?: string | null
  name: string
  updatedAt: string
}

interface PendingOperation {
  type: 'increment' | 'decrement' | 'reset'
  step?: number
  timestamp: number
  id: string
}

/**
 * Le serveur a-t-il REFUSÉ, ou n'a-t-il simplement pas répondu&nbsp;?
 *
 * ## ⚠️ POURQUOI CETTE DISTINCTION DÉCIDE DE TOUT ICI
 *
 * La file d'attente de ce compteur existe pour le hors-ligne : on garde le geste et on le rejoue
 * quand le réseau revient. Elle mettait en attente **toute** erreur — y compris un refus
 * définitif : un `step` invalide (400), un jeton régénéré (404), une session expirée (401).
 *
 * Une opération que le serveur refusera toujours ne part jamais. Et comme la synchronisation
 * s'arrêtait à la première erreur, elle restait **en tête de file et retenait toutes les
 * suivantes** : l'écran annonçait « 1 opération en attente » indéfiniment, avec un total optimiste
 * faux, jusqu'au rechargement de la page.
 *
 * Un 4xx est donc définitif — on l'abandonne en le disant. Une coupure réseau ou un 5xx est
 * passager — on garde le geste. `408` et `429` sont des 4xx qu'on retente malgré tout : l'un dit
 * « trop lent », l'autre « trop vite », et aucun des deux ne dit « jamais ».
 */
const CODES_A_RETENTER = new Set([408, 429])

function refusDefinitif(erreur: unknown): boolean {
  const code =
    (erreur as { statusCode?: number; response?: { status?: number } })?.statusCode ??
    (erreur as { response?: { status?: number } })?.response?.status
  if (typeof code !== 'number') return false // pas de réponse du tout : coupure réseau
  return code >= 400 && code < 500 && !CODES_A_RETENTER.has(code)
}

/**
 * La file d'attente survit au rechargement de la page.
 *
 * ## ⚠️ LE DÉFAUT (constat F1)
 *
 * Le mode hors-ligne reposait sur un `ref` **en mémoire**. Or le téléphone qu'on tient à l'entrée
 * d'une convention est précisément l'appareil qui décharge ses onglets — et la personne qui voit la
 * pastille rouge « Déconnecté » **recharge la page pour réparer**. Les gestes en attente
 * disparaissaient alors **sans un message**, et le compteur reprenait la valeur du serveur : les
 * entrées comptées hors ligne étaient perdues, et rien ne le disait.
 *
 * La file est donc écrite dans `localStorage`, par édition ET par jeton — deux compteurs ouverts
 * côte à côte ne doivent pas mélanger leurs gestes.
 *
 * ## Pourquoi `localStorage` et pas autre chose
 *
 * Ce qui attend là est **propre à cet appareil** : des gestes que le serveur n'a pas vus. Les
 * envoyer ailleurs n'aurait pas de sens, et le navigateur est le seul endroit qui survive à un
 * rechargement sans réseau.
 *
 * ⚠️ Chaque accès est gardé : en navigation privée, avec les données de site bloquées, ou sur un
 * quota plein, `localStorage` **lève** au lieu de rendre `null`. Un compteur qui refuserait de
 * s'ouvrir pour cela serait pire que le défaut qu'on corrige.
 */
const clefDeFile = (editionId: number, token: string) => `cdj-compteur-file-${editionId}-${token}`

/**
 * Le navigateur sait-il stocker&nbsp;?
 *
 * ⚠️ On teste la PRÉSENCE de `localStorage`, et non `import.meta.client`. Les deux coïncident en
 * production, mais pas ailleurs : le rendu serveur n'a pas de `localStorage`, et un test unitaire
 * n'est pas « client » tout en en fournissant un. Tester ce dont on a réellement besoin évite une
 * persistance silencieusement morte sous le harnais — c'est-à-dire des tests verts sur rien.
 */
const stockageDisponible = () => typeof localStorage !== 'undefined'

function lireLaFile(editionId: number, token: string): PendingOperation[] {
  try {
    const brut = localStorage.getItem(clefDeFile(editionId, token))
    if (!brut) return []
    const file = JSON.parse(brut)
    // On ne fait pas confiance à ce qu'on relit : un format changé ne doit pas casser l'écran.
    return Array.isArray(file) ? file.filter((o) => o && typeof o.id === 'string' && o.type) : []
  } catch {
    return []
  }
}

function ecrireLaFile(editionId: number, token: string, file: PendingOperation[]): void {
  try {
    if (file.length === 0) localStorage.removeItem(clefDeFile(editionId, token))
    else localStorage.setItem(clefDeFile(editionId, token), JSON.stringify(file))
  } catch {
    // Rien à faire : le geste reste en mémoire pour cette session, ce qui vaut mieux que de lever.
  }
}

/**
 * Composable pour gérer un compteur de billetterie avec synchronisation temps réel
 * et support du mode hors-ligne avec file d'attente
 */
export function useTicketingCounter(editionId: number, token: string) {
  const counter = ref<Counter | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const activeConnections = ref(0)
  const isConnected = ref(false)
  const isUpdating = ref(false)
  const isSyncing = ref(false)
  /*
   * Relue depuis le navigateur dès la création : si l'onglet a été rechargé, les gestes en attente
   * sont déjà là quand le premier rendu a lieu — `displayValue` les rajoute à la valeur serveur,
   * donc le total affiché est juste sans attendre quoi que ce soit.
   */
  const pendingOperations = ref<PendingOperation[]>(
    stockageDisponible() ? lireLaFile(editionId, token) : []
  )

  /*
   * ⚠️ `deep: true` est nécessaire, et ce n'est pas du zèle : la file est tantôt REMPLACÉE
   * (`filter` à la synchronisation) tantôt MUTÉE (`push` à la mise en attente). Un watcher
   * superficiel manquerait précisément le cas qui compte — le geste qu'on vient d'ajouter.
   */
  watch(
    pendingOperations,
    (file) => {
      if (stockageDisponible()) ecrireLaFile(editionId, token, file)
    },
    { deep: true }
  )
  const localValue = ref(0) // Valeur locale optimiste

  let eventSource: EventSource | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let isDisconnecting = false // Flag pour éviter les doubles déconnexions
  const _MAX_RECONNECT_DELAY = 30000 // 30 secondes (prévu pour usage futur)

  // ID de session unique pour cette connexion SSE - généré une seule fois
  const sessionId = ref<string>('')

  // Initialiser le sessionId si ce n'est pas déjà fait
  if (!sessionId.value) {
    sessionId.value = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    if (import.meta.dev) {
      console.log(`[Counter SSE] SessionId généré: ${sessionId.value}`)
    }
  }

  /**
   * Calcule la valeur affichée (valeur serveur + opérations en attente)
   */
  const displayValue = computed(() => {
    if (!counter.value) return localValue.value

    let value = counter.value.value
    // Appliquer les opérations en attente
    for (const op of pendingOperations.value) {
      if (op.type === 'increment') {
        value += op.step || 1
      } else if (op.type === 'decrement') {
        value -= op.step || 1
      } else if (op.type === 'reset') {
        value = 0
      }
    }
    return Math.max(0, value) // Ne jamais descendre sous 0
  })

  /**
   * Génère un ID unique pour une opération
   */
  const generateOperationId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Récupère les données du compteur
   */
  const fetchCounter = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ success: boolean; data: { counter: Counter } }>(
        `/api/editions/${editionId}/ticketing/counters/token/${token}`
      )
      counter.value = response.data.counter
      localValue.value = response.data.counter.value
    } catch (err: any) {
      error.value =
        err?.data?.message || err?.message || 'Erreur lors de la récupération du compteur'
      console.error('Error fetching counter:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Synchronise les opérations en attente avec le serveur
   */
  const syncPendingOperations = async () => {
    if (pendingOperations.value.length === 0 || isSyncing.value) return

    isSyncing.value = true
    const operations = [...pendingOperations.value]

    if (import.meta.dev) {
      console.log(`[Counter] Synchronisation de ${operations.length} opération(s) en attente...`)
    }

    for (const op of operations) {
      try {
        if (op.type === 'increment') {
          await $fetch(`/api/editions/${editionId}/ticketing/counters/token/${token}/increment`, {
            method: 'PATCH',
            body: { step: op.step || 1 },
          })
        } else if (op.type === 'decrement') {
          await $fetch(`/api/editions/${editionId}/ticketing/counters/token/${token}/decrement`, {
            method: 'PATCH',
            body: { step: op.step || 1 },
          })
        } else if (op.type === 'reset') {
          // Par IDENTIFIANT, pas par jeton : la remise à zéro est réservée aux gestionnaires
          // (voir `reset` plus bas). Si le compteur n'a pas été chargé, on ne peut pas la rejouer.
          if (!counter.value) throw new Error('Compteur inconnu : remise à zéro impossible')
          await $fetch(`/api/editions/${editionId}/ticketing/counters/${counter.value.id}/reset`, {
            method: 'PATCH',
          })
        }

        // Retirer l'opération de la file d'attente
        pendingOperations.value = pendingOperations.value.filter((o) => o.id !== op.id)
      } catch (err) {
        console.error('[Counter] Erreur lors de la synchronisation:', err)
        /*
         * ⚠️ UN REFUS DÉFINITIF EST ABANDONNÉ, PAS GARDÉ.
         *
         * Le `break` d'origine retenait toute la file derrière l'opération fautive, et celle-ci ne
         * passerait jamais. On la retire donc, et on le DIT — un geste perdu en silence est pire
         * qu'un geste refusé : la personne au comptoir croirait avoir compté.
         *
         * Une erreur passagère, elle, garde sa place et arrête la boucle : l'ordre des opérations
         * compte sur un compteur, et rejouer la suite sans la précédente donnerait un total faux.
         */
        if (refusDefinitif(err)) {
          pendingOperations.value = pendingOperations.value.filter((o) => o.id !== op.id)
          /*
           * ⚠️ ET LA VALEUR OPTIMISTE EST DÉFAITE, sinon l'écran garderait le geste abandonné.
           *
           * `increment` avait ajouté le pas, `decrement` l'avait retiré en bornant à zéro : on
           * rend donc l'inverse, borné de même. Un `reset` n'est PAS défait — il avait mis la
           * valeur à zéro, et la valeur d'avant est perdue. On recharge alors depuis le serveur,
           * seul endroit qui la connaisse encore.
           */
          if (op.type === 'increment') {
            localValue.value = Math.max(0, localValue.value - (op.step ?? 1))
          } else if (op.type === 'decrement') {
            localValue.value += op.step ?? 1
          } else {
            void fetchCounter()
          }
          error.value =
            (err as { data?: { message?: string } })?.data?.message ??
            'Une opération en attente a été refusée et abandonnée'
          continue
        }
        // On garde les opérations en attente en cas d'échec passager
        break
      }
    }

    isSyncing.value = false
    if (import.meta.dev) {
      console.log(
        `[Counter] Synchronisation terminée. ${pendingOperations.value.length} opération(s) restante(s)`
      )
    }
  }

  /**
   * Se connecte au flux SSE pour les mises à jour en temps réel
   */
  const connectSSE = () => {
    if (eventSource) {
      eventSource.close()
    }

    const url = `/api/editions/${editionId}/ticketing/counters/token/${token}/stream?sessionId=${sessionId.value}`
    if (import.meta.dev) {
      console.log(`[Counter SSE] Connexion avec sessionId: ${sessionId.value}`)
    }
    eventSource = new EventSource(url, { withCredentials: true })

    eventSource.addEventListener('connected', (event) => {
      const data = JSON.parse(event.data)
      isConnected.value = true
      activeConnections.value = data.activeConnections || 0
      if (import.meta.dev) {
        console.log('[Counter SSE] Connecté:', data)
      }

      // Synchroniser les opérations en attente dès la reconnexion
      if (pendingOperations.value.length > 0) {
        if (import.meta.dev) {
          console.log(
            `[Counter SSE] Reconnexion détectée, ${pendingOperations.value.length} opération(s) à synchroniser`
          )
        }
        syncPendingOperations()
      }
    })

    eventSource.addEventListener('counter-update', (event) => {
      const update: CounterUpdate = JSON.parse(event.data)
      if (counter.value && update.counterId === counter.value.id) {
        counter.value.value = update.value
        counter.value.updatedAt = update.updatedAt
        // Toujours réécrit, y compris à `null` : garder l'ancien nom à côté d'un nouveau total
        // attribuerait le geste à la mauvaise personne.
        // Pas d'identifiant ici : la diffusion ne porte que le pseudo, et en inventer un
        // reviendrait à désigner un compte au hasard. L'écran n'affiche que le pseudo.
        counter.value.lastActor = update.lastActorPseudo ? { pseudo: update.lastActorPseudo } : null
      }
    })

    eventSource.addEventListener('ping', (event) => {
      const data = JSON.parse(event.data)
      activeConnections.value = data.activeConnections || 0
    })

    eventSource.onerror = (err) => {
      console.error('[Counter SSE] Erreur:', err)
      isConnected.value = false

      // Ne pas tenter de reconnexion si on est en train de déconnecter volontairement
      if (isDisconnecting) {
        if (import.meta.dev) {
          console.log('[Counter SSE] Erreur ignorée : déconnexion en cours')
        }
        return
      }

      // Tentative de reconnexion
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }

      reconnectTimeout = setTimeout(() => {
        if (import.meta.dev) {
          console.log('[Counter SSE] Tentative de reconnexion...')
        }
        connectSSE()
      }, 5000)
    }
  }

  /**
   * Déconnecte le flux SSE
   */
  const disconnectSSE = async () => {
    // Éviter les doubles déconnexions
    if (isDisconnecting) {
      if (import.meta.dev) {
        console.log('[Counter SSE] Déconnexion déjà en cours, ignorée')
      }
      return
    }

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }

    if (eventSource) {
      isDisconnecting = true
      if (import.meta.dev) {
        console.log(
          `[Counter SSE] Déconnexion explicite - envoi du signal au serveur (session: ${sessionId.value})`
        )
      }

      // Envoyer un signal de déconnexion au serveur AVANT de fermer
      try {
        await $fetch(`/api/editions/${editionId}/ticketing/counters/token/${token}/disconnect`, {
          method: 'POST',
          body: { sessionId: sessionId.value },
        })
        if (import.meta.dev) {
          console.log(`[Counter SSE] Signal de déconnexion envoyé avec succès`)
        }
      } catch (err) {
        console.error('[Counter SSE] Erreur lors de la déconnexion:', err)
      }

      eventSource.close()
      eventSource = null
      isConnected.value = false
      isDisconnecting = false
    }
  }

  /**
   * Incrémente le compteur (avec support hors-ligne)
   */
  /**
   * Un pas utilisable, quoi qu'ait saisi l'écran.
   *
   * ⚠️ Le champ « pas » est un `v-model.number` : vidé par l'utilisateur, il ne rend pas `0` mais
   * la chaîne vide. `Number.isFinite` l'écarte — là où `Math.max(1, NaN)` rendrait `NaN`, piège
   * déjà payé ailleurs dans ce dépôt. Le serveur refusait alors en 400, et ce refus jammait la
   * file ; il est maintenant abandonné proprement, mais autant ne pas l'émettre.
   */
  const pasUtilisable = (step: unknown): number =>
    typeof step === 'number' && Number.isFinite(step) && step > 0 ? Math.trunc(step) : 1

  const increment = async (pasDemande: number = 1) => {
    if (!counter.value) return
    const step = pasUtilisable(pasDemande)

    // Créer l'opération en attente
    const operation: PendingOperation = {
      type: 'increment',
      step,
      timestamp: Date.now(),
      id: generateOperationId(),
    }

    // Si hors-ligne, ajouter à la file d'attente
    if (!isConnected.value) {
      if (import.meta.dev) {
        console.log('[Counter] Hors-ligne : opération mise en attente', operation)
      }
      pendingOperations.value.push(operation)
      localValue.value += step
      return
    }

    // Si en ligne, essayer d'envoyer directement
    isUpdating.value = true
    try {
      await $fetch(`/api/editions/${editionId}/ticketing/counters/token/${token}/increment`, {
        method: 'PATCH',
        body: { step },
      })
      // La mise à jour sera reçue via SSE
      /*
       * ⚠️ ET ON PROFITE DE CE SUCCÈS POUR VIDER LA FILE.
       *
       * Elle n'était rejouée qu'à l'événement SSE `connected` — donc **jamais** tant que le flux
       * restait ouvert. Une opération mise en attente par un échec passager (un 502 de
       * redéploiement, une coupure de quelques secondes) y dormait jusqu'au rechargement de la
       * page, alors que la connexion était revenue depuis longtemps.
       *
       * Un envoi direct qui réussit est la meilleure preuve que le serveur répond de nouveau.
       * L'appel n'est pas attendu : le geste de l'utilisateur ne doit pas traîner derrière la file.
       */
      if (pendingOperations.value.length > 0) void syncPendingOperations()
    } catch (err: any) {
      /*
       * ⚠️ UN REFUS DÉFINITIF NE VA PAS EN FILE.
       *
       * Ce bloc mettait en attente **toute** erreur. Or un 4xx — `step` invalide, jeton régénéré,
       * session expirée — ne passera jamais : l'opération dormait en tête de file et retenait
       * toutes les suivantes. L'écran annonçait « 1 opération en attente » jusqu'au rechargement,
       * avec un total optimiste faux.
       *
       * On remonte donc l'erreur sans rien mettre en file, et **sans toucher la valeur
       * affichée** : annoncer un comptage qui n'a pas eu lieu est le défaut à éviter ici.
       */
      if (refusDefinitif(err)) {
        error.value = err?.data?.message || err?.message || "Erreur lors de l'incrémentation"
        throw err
      }

      // En cas d'échec, mettre en attente
      if (import.meta.dev) {
        console.log("[Counter] Échec de l'envoi : opération mise en attente", err)
      }
      pendingOperations.value.push(operation)
      localValue.value += step
      error.value = err?.data?.message || err?.message || "Erreur lors de l'incrémentation"
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  /**
   * Décrémente le compteur (avec support hors-ligne)
   */
  const decrement = async (pasDemande: number = 1) => {
    if (!counter.value) return
    const step = pasUtilisable(pasDemande)

    // Créer l'opération en attente
    const operation: PendingOperation = {
      type: 'decrement',
      step,
      timestamp: Date.now(),
      id: generateOperationId(),
    }

    // Si hors-ligne, ajouter à la file d'attente
    if (!isConnected.value) {
      if (import.meta.dev) {
        console.log('[Counter] Hors-ligne : opération mise en attente', operation)
      }
      pendingOperations.value.push(operation)
      localValue.value = Math.max(0, localValue.value - step)
      return
    }

    // Si en ligne, essayer d'envoyer directement
    isUpdating.value = true
    try {
      await $fetch(`/api/editions/${editionId}/ticketing/counters/token/${token}/decrement`, {
        method: 'PATCH',
        body: { step },
      })
      // La mise à jour sera reçue via SSE
      /*
       * ⚠️ ET ON PROFITE DE CE SUCCÈS POUR VIDER LA FILE.
       *
       * Elle n'était rejouée qu'à l'événement SSE `connected` — donc **jamais** tant que le flux
       * restait ouvert. Une opération mise en attente par un échec passager (un 502 de
       * redéploiement, une coupure de quelques secondes) y dormait jusqu'au rechargement de la
       * page, alors que la connexion était revenue depuis longtemps.
       *
       * Un envoi direct qui réussit est la meilleure preuve que le serveur répond de nouveau.
       * L'appel n'est pas attendu : le geste de l'utilisateur ne doit pas traîner derrière la file.
       */
      if (pendingOperations.value.length > 0) void syncPendingOperations()
    } catch (err: any) {
      /*
       * ⚠️ UN REFUS DÉFINITIF NE VA PAS EN FILE.
       *
       * Ce bloc mettait en attente **toute** erreur. Or un 4xx — `step` invalide, jeton régénéré,
       * session expirée — ne passera jamais : l'opération dormait en tête de file et retenait
       * toutes les suivantes. L'écran annonçait « 1 opération en attente » jusqu'au rechargement,
       * avec un total optimiste faux.
       *
       * On remonte donc l'erreur sans rien mettre en file, et **sans toucher la valeur
       * affichée** : annoncer un comptage qui n'a pas eu lieu est le défaut à éviter ici.
       */
      if (refusDefinitif(err)) {
        error.value = err?.data?.message || err?.message || 'Erreur lors de la décrémentation'
        throw err
      }

      // En cas d'échec, mettre en attente
      if (import.meta.dev) {
        console.log("[Counter] Échec de l'envoi : opération mise en attente", err)
      }
      pendingOperations.value.push(operation)
      localValue.value = Math.max(0, localValue.value - step)
      error.value = err?.data?.message || err?.message || 'Erreur lors de la décrémentation'
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  /**
   * Réinitialise le compteur à 0 (avec support hors-ligne).
   *
   * Réservée aux **gestionnaires** de la billetterie, contrairement à l'incrément et au
   * décrément : elle passe par la route par identifiant, qui exige `canManageTicketingById`.
   * La route jumelle par jeton a été supprimée — la garder aurait laissé n'importe quel compte
   * détenteur du lien remettre le compteur à zéro depuis l'API, bouton caché ou non.
   *
   * Le partage par QR code reste ce qu'il est : qui tient le lien compte les entrées. Mais
   * remettre à zéro efface un décompte de soirée sans retour possible, et ce n'est pas le même
   * geste que d'ajouter une entrée.
   */
  const reset = async () => {
    if (!counter.value) return

    // Créer l'opération en attente
    const operation: PendingOperation = {
      type: 'reset',
      timestamp: Date.now(),
      id: generateOperationId(),
    }

    // Si hors-ligne, ajouter à la file d'attente
    if (!isConnected.value) {
      if (import.meta.dev) {
        console.log('[Counter] Hors-ligne : opération mise en attente', operation)
      }
      pendingOperations.value.push(operation)
      localValue.value = 0
      return
    }

    // Si en ligne, essayer d'envoyer directement
    isUpdating.value = true
    try {
      await $fetch(`/api/editions/${editionId}/ticketing/counters/${counter.value.id}/reset`, {
        method: 'PATCH',
      })
      // La mise à jour sera reçue via SSE
      /*
       * ⚠️ ET ON PROFITE DE CE SUCCÈS POUR VIDER LA FILE.
       *
       * Elle n'était rejouée qu'à l'événement SSE `connected` — donc **jamais** tant que le flux
       * restait ouvert. Une opération mise en attente par un échec passager (un 502 de
       * redéploiement, une coupure de quelques secondes) y dormait jusqu'au rechargement de la
       * page, alors que la connexion était revenue depuis longtemps.
       *
       * Un envoi direct qui réussit est la meilleure preuve que le serveur répond de nouveau.
       * L'appel n'est pas attendu : le geste de l'utilisateur ne doit pas traîner derrière la file.
       */
      if (pendingOperations.value.length > 0) void syncPendingOperations()
    } catch (err: any) {
      /*
       * ⚠️ UN REFUS DÉFINITIF NE VA PAS EN FILE.
       *
       * Ce bloc mettait en attente **toute** erreur. Or un 4xx — `step` invalide, jeton régénéré,
       * session expirée — ne passera jamais : l'opération dormait en tête de file et retenait
       * toutes les suivantes. L'écran annonçait « 1 opération en attente » jusqu'au rechargement,
       * avec un total optimiste faux.
       *
       * On remonte donc l'erreur sans rien mettre en file, et **sans toucher la valeur
       * affichée** : annoncer un comptage qui n'a pas eu lieu est le défaut à éviter ici.
       */
      if (refusDefinitif(err)) {
        error.value = err?.data?.message || err?.message || 'Erreur lors de la réinitialisation'
        throw err
      }

      // En cas d'échec, mettre en attente
      if (import.meta.dev) {
        console.log("[Counter] Échec de l'envoi : opération mise en attente", err)
      }
      pendingOperations.value.push(operation)
      localValue.value = 0
      error.value = err?.data?.message || err?.message || 'Erreur lors de la réinitialisation'
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  /**
   * Initialise le compteur (fetch + SSE)
   */
  const init = async () => {
    // Déconnecter toute connexion SSE existante avant d'en créer une nouvelle
    disconnectSSE()
    await fetchCounter()
    connectSSE()
  }

  // Nettoyage à la destruction du composant
  onBeforeUnmount(() => {
    disconnectSSE()
  })

  return {
    counter: computed(() => counter.value),
    displayValue: computed(() => displayValue.value), // Valeur affichée avec opérations en attente
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    activeConnections: computed(() => activeConnections.value),
    isConnected: computed(() => isConnected.value),
    isUpdating: computed(() => isUpdating.value),
    isSyncing: computed(() => isSyncing.value),
    pendingCount: computed(() => pendingOperations.value.length),
    fetchCounter,
    increment,
    decrement,
    reset,
    init,
    disconnect: disconnectSSE,
  }
}

/**
 * Composable pour gérer la liste des compteurs d'une édition
 */
export function useTicketingCountersList(editionId: number) {
  const counters = ref<Counter[]>([])

  const { execute: fetchCounters, loading: fetchLoading } = useApiAction(
    `/api/editions/${editionId}/ticketing/counters`,
    {
      method: 'GET',
      silent: true,
      onSuccess: (response: any) => {
        counters.value = response.counters
      },
    }
  )

  const createCounterBody = ref({ name: '' })
  const { execute: executeCreate, loading: createLoading } = useApiAction(
    `/api/editions/${editionId}/ticketing/counters`,
    {
      method: 'POST',
      body: () => createCounterBody.value,
      silent: true,
      onSuccess: (response: any) => {
        counters.value.unshift(response.counter)
      },
    }
  )

  const createCounter = async (name: string): Promise<Counter> => {
    createCounterBody.value = { name }
    const result = await executeCreate()
    return (result as any).counter
  }

  const { execute: executeDelete, loadingId: deleteLoadingId } = useApiActionById(
    (id) => `/api/editions/${editionId}/ticketing/counters/${id}`,
    {
      method: 'DELETE',
      silent: true,
      onSuccess: (_response: any, id?: string | number) => {
        counters.value = counters.value.filter((c) => c.id !== Number(id))
      },
    }
  )

  const deleteCounter = async (counterId: number) => {
    await executeDelete(counterId)
  }

  const loading = computed(
    () => fetchLoading.value || createLoading.value || deleteLoadingId.value !== null
  )

  return {
    counters: computed(() => counters.value),
    loading,
    fetchCounters,
    createCounter,
    deleteCounter,
  }
}
