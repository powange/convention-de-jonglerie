/**
 * Suivi de la restauration d'une sauvegarde.
 *
 * La restauration tourne côté serveur, indépendamment de la fenêtre : on interroge donc son
 * état plutôt que d'attendre la réponse d'une requête. Fermer la page n'interrompt rien, et
 * la rouvrir permet de retrouver l'avancement — ou le verdict final.
 */

export type EtapeRestauration =
  | 'PREPARATION'
  | 'BASE_DE_DONNEES'
  | 'FICHIERS'
  | 'TERMINEE'
  | 'ECHOUEE'
  | 'INTERROMPUE'

export interface EtatRestauration {
  id: string
  etape: EtapeRestauration
  source: string
  storedFilename: string | null
  demarreeA: string
  termineeA: string | null
  octetsEnvoyes: number
  octetsTotal: number
  pourcentage: number
  tableEnCours: string | null
  tablesVues: number
  erreur: string | null
}

const ETAPES_EN_COURS: EtapeRestauration[] = ['PREPARATION', 'BASE_DE_DONNEES', 'FICHIERS']

export const estRestaurationEnCours = (etape: EtapeRestauration) => ETAPES_EN_COURS.includes(etape)

const INTERVALLE_SONDAGE_MS = 1000

export function useBackupRestoreProgress(onTermine?: (etat: EtatRestauration) => void) {
  const etat = ref<EtatRestauration | null>(null)
  const minuteur = ref<ReturnType<typeof setInterval> | null>(null)

  const enCours = computed(() => !!etat.value && estRestaurationEnCours(etat.value.etape))

  const arreterSondage = () => {
    if (minuteur.value) {
      clearInterval(minuteur.value)
      minuteur.value = null
    }
  }

  const rafraichir = async () => {
    let nouvelEtat: EtatRestauration | null
    try {
      const reponse = await $fetch<{ data: { etat: EtatRestauration | null } }>(
        '/api/admin/backup/restore-status'
      )
      nouvelEtat = reponse.data.etat
    } catch {
      // Un aller-retour raté (réseau, redéploiement) ne doit pas interrompre le suivi :
      // le prochain tour retentera.
      return
    }

    const etaitEnCours = enCours.value
    etat.value = nouvelEtat

    if (etaitEnCours && nouvelEtat && !estRestaurationEnCours(nouvelEtat.etape)) {
      arreterSondage()
      onTermine?.(nouvelEtat)
    } else if (!enCours.value) {
      arreterSondage()
    }
  }

  const demarrerSondage = () => {
    arreterSondage()
    minuteur.value = setInterval(() => void rafraichir(), INTERVALLE_SONDAGE_MS)
  }

  /** À appeler dès qu'une restauration vient d'être lancée. */
  const suivre = (etatInitial: EtatRestauration) => {
    etat.value = etatInitial
    demarrerSondage()
  }

  /** Retrouve une restauration déjà en cours, par exemple au chargement de la page. */
  const reprendre = async () => {
    await rafraichir()
    if (enCours.value) demarrerSondage()
  }

  onBeforeUnmount(arreterSondage)

  return { etat, enCours, suivre, reprendre, rafraichir }
}
