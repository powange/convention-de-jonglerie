import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, vi } from 'vitest'

import { FUSEAU_DES_TACHES, TACHES_PLANIFIEES } from '../../../../server/utils/scheduled-tasks'

const taches = vi.hoisted(() => ({ runTask: vi.fn() }))

/*
 * ⚠️ `runTask` EST UNE GLOBALE de Nitro, pas un import : le planificateur ne l'importe pas. La
 * boucher ailleurs n'intercepterait rien, et le verrou qu'on mesure ici lancerait les vraies
 * tâches — donc Prisma, donc la base.
 */
vi.stubGlobal('runTask', taches.runTask)

/*
 * ⚠️ `defineNitroPlugin` AUSSI, et pour la même raison : c'est une globale de Nitro, appelée au
 * CHARGEMENT du module. Sans elle, l'import échoue sur « defineNitroPlugin is not defined » et le
 * fichier ne rend aucun test — un échec qui ne dit rien de ce qu'on voulait mesurer.
 */
vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)

const { _pourLesTests } = await import('../../../../server/plugins/scheduler')

/**
 * Le planificateur des tâches — constat A6.
 *
 * ## ⚠️ DEUX DÉFAUTS
 *
 * 1. **Aucun fuseau.** Ni l'image Docker ni les piles ne posent `TZ`, et `CronJob.from` ne recevait
 *    pas de `timeZone` : « Quotidien à 9h » partait à **11 h** en été française, « 2h du matin » à
 *    4 h. L'écran d'administration annonçait des heures que personne ne pouvait vérifier.
 * 2. **Aucune garde de recouvrement.** `volunteer-reminders` tourne **chaque minute** et envoie des
 *    notifications — SMTP, FCM, autant d'attentes réseau. Rien ne vérifiait que l'exécution
 *    précédente était finie : un envoi lent se recouvrait avec le suivant, et le même rappel
 *    pouvait partir deux fois.
 *
 * ## ⚠️⚠️ CE QUI REND LE PREMIER CAS NON CREUX
 *
 * Le fuseau passé à `CronJob` n'est pas observable depuis l'extérieur sans monter un vrai cron et
 * attendre. Ce qui est observable, et ce qui compte, c'est que **le planificateur et le catalogue
 * disent la même chose** : les deux listes avaient déjà divergé une fois dans ce dépôt. Le
 * planificateur lit désormais ses expressions cron DANS le catalogue — un cas le vérifie en lisant
 * la source, un autre vérifie que le fuseau y est bien passé.
 */
describe('le planificateur', () => {
  const SOURCE = join(process.cwd(), 'server/plugins/scheduler.ts')

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    _pourLesTests.enCours.clear()
  })

  describe('la garde de recouvrement', () => {
    it('⚠️ IGNORE UN PASSAGE QUAND LE PRÉCÉDENT N’EST PAS FINI', async () => {
      /*
       * Le premier appel est tenu ouvert : c'est la situation d'un envoi de notifications lent, et
       * la seule où le défaut se produit. Un faux `runTask` qui résoudrait tout de suite ne
       * reproduirait rien, et ce fichier serait vert avant comme après.
       */
      let libererLePremier!: () => void
      taches.runTask.mockImplementation(
        () => new Promise<void>((resoudre) => (libererLePremier = resoudre))
      )

      const premier = _pourLesTests.lancerSansRecouvrement('volunteer-reminders')
      await vi.waitFor(() => expect(taches.runTask).toHaveBeenCalledTimes(1))

      // Le tick suivant, une minute plus tard : il doit repartir sans rien lancer.
      await _pourLesTests.lancerSansRecouvrement('volunteer-reminders')
      expect(taches.runTask).toHaveBeenCalledTimes(1)

      libererLePremier()
      await premier
    })

    it('reprend dès que la précédente est terminée', async () => {
      /*
       * LE TÉMOIN. Sans lui, un verrou qu'on ne relâcherait jamais satisferait le cas ci-dessus —
       * et la tâche ne tournerait plus qu'une seule fois dans la vie du conteneur, ce qui est pire
       * que le recouvrement.
       */
      taches.runTask.mockResolvedValue(undefined)

      await _pourLesTests.lancerSansRecouvrement('volunteer-reminders')
      await _pourLesTests.lancerSansRecouvrement('volunteer-reminders')

      expect(taches.runTask).toHaveBeenCalledTimes(2)
    })

    it('⚠️ RELÂCHE LE VERROU MÊME QUAND LA TÂCHE LÈVE', async () => {
      /*
       * Second témoin, et le plus coûteux s'il manquait : une tâche qui échoue une fois bloquerait
       * définitivement toutes ses exécutions suivantes. Le `finally` est ce qui l'évite.
       */
      taches.runTask.mockRejectedValueOnce(new Error('SMTP injoignable'))

      await expect(
        _pourLesTests.lancerSansRecouvrement('volunteer-reminders')
      ).resolves.toBeUndefined()
      expect(_pourLesTests.enCours.has('volunteer-reminders')).toBe(false)

      taches.runTask.mockResolvedValue(undefined)
      await _pourLesTests.lancerSansRecouvrement('volunteer-reminders')
      expect(taches.runTask).toHaveBeenCalledTimes(2)
    })

    it('ne bloque pas une AUTRE tâche', async () => {
      // Le verrou est par tâche : un `volunteer-reminders` lent ne doit pas retenir la purge du
      // journal d'erreurs, qui n'a rien à voir avec lui.
      let liberer!: () => void
      taches.runTask.mockImplementationOnce(
        () => new Promise<void>((resoudre) => (liberer = resoudre))
      )

      const lente = _pourLesTests.lancerSansRecouvrement('volunteer-reminders')
      await vi.waitFor(() => expect(taches.runTask).toHaveBeenCalledTimes(1))

      taches.runTask.mockResolvedValue(undefined)
      await _pourLesTests.lancerSansRecouvrement('purge-journal-erreurs')

      expect(taches.runTask).toHaveBeenCalledTimes(2)
      liberer()
      await lente
    })
  })

  describe('l’accord avec le catalogue', () => {
    it('⚠️ PASSE LE FUSEAU À CHAQUE TÂCHE', async () => {
      /*
       * C'était le défaut : aucun `timeZone`, donc l'heure du conteneur. Un seul endroit le pose
       * désormais — et c'est précisément ce qui rend ce cas suffisant, là où neuf blocs recopiés
       * auraient demandé neuf vérifications.
       */
      const source = await readFile(SOURCE, 'utf8')

      expect(source).toContain('timeZone: FUSEAU_DES_TACHES')
      expect(FUSEAU_DES_TACHES).toBe('Europe/Paris')
    })

    it('⚠️ N’ÉCRIT PLUS AUCUNE EXPRESSION CRON EN DUR', async () => {
      /*
       * Les deux listes avaient déjà divergé dans ce dépôt — une tâche affichée sans pouvoir être
       * lancée, une autre qui tournait sans apparaître. Le planificateur lit maintenant le
       * catalogue : il n'y a plus deux endroits où écrire une heure, donc plus d'écart possible.
       */
      const source = await readFile(SOURCE, 'utf8')
      const expressionsEnDur = source.match(/cronTime:\s*'[^']+'/g) ?? []

      expect(expressionsEnDur).toEqual([])
      expect(source).toContain('cronTime: tache.cronExpression')
    })

    it('planifie exactement les tâches du catalogue', async () => {
      // Le témoin de l'accord : une boucle sur le catalogue, et non une liste parallèle. Si
      // quelqu'un revenait à des appels nommés un par un, l'un d'eux finirait par manquer.
      const source = await readFile(SOURCE, 'utf8')

      expect(source).toContain('for (const tache of TACHES_PLANIFIEES) planifier(tache.name)')
      expect(TACHES_PLANIFIEES.length).toBeGreaterThanOrEqual(9)
    })
  })
})
