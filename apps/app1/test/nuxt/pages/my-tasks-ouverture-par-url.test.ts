import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Ce que l'adresse porte, et ce que la page y réécrit — réglés test par test. */
const adresse = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  remplacements: [] as Array<Record<string, unknown>>,
}))

/*
 * ⚠️ `mockNuxtImport` ET NON `vi.mock('vue-router')` : dans une page, `useRoute` et `useRouter`
 * arrivent par l'AUTO-IMPORT de Nuxt, et remplacer le module `vue-router` ne les intercepte pas.
 * C'est par là que j'ai commencé : l'identifiant d'édition sortait alors `NaN`, le `createError`
 * du haut de page partait, et l'écran affichait « Édition introuvable » — un échec qui ne parlait
 * ni de tâche ni d'adresse.
 */
mockNuxtImport('useRoute', () => () => ({ params: { id: '1' }, query: adresse.query }))
mockNuxtImport('useRouter', () => () => ({
  replace: (arg: { query?: Record<string, unknown> }) => {
    /*
     * ⚠️ ON N'ENREGISTRE QUE LES REMPLACEMENTS QUI PORTENT UNE `query`, et ce n'est pas du
     * confort : les greffons de Nuxt appellent eux-mêmes `replace` pendant le démarrage de
     * l'application. Sans ce filtre, leur appel ÉCRASAIT l'adresse du test — la page voyait alors
     * une requête vide, n'ouvrait rien, et l'échec accusait le correctif.
     */
    if (!arg || typeof arg !== 'object' || arg.query === undefined) return
    adresse.remplacements.push(arg.query)
    // La page relit `route.query` ensuite : on reproduit l'effet du remplacement.
    adresse.query = { ...arg.query }
  },
  /*
   * ⚠️ LES TROIS CROCHETS SONT OBLIGATOIRES, et leur absence ne parle pas de ce test : un
   * greffon de Nuxt (`navigation-repaint.client`) appelle `useRouter().beforeResolve` au premier
   * temps mort. Sans eux, « router.beforeResolve is not a function » remonte en erreur non gérée
   * — et Vitest SAUTE alors les quatre cas, ce qui se lit « 4 skipped » et non « 4 failed ».
   */
  beforeResolve: () => () => {},
  beforeEach: () => () => {},
  afterEach: () => () => {},
}))

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 1 } }),
}))

vi.mock('~/stores/editions', () => ({
  useEditionStore: () => ({
    loading: false,
    getEditionById: () => ({ id: 1, name: 'Édition de test', tasksEnabled: true }),
    fetchEditionById: async () => undefined,
  }),
}))

const TACHE_NOTIFIEE = 77
const AUTRE_TACHE = 12

const tache = (id: number, titre: string) => ({
  id,
  title: titre,
  description: null,
  status: 'TODO',
  deadline: null,
  displayOrder: 0,
  group: { id: 3, name: 'Avant la convention' },
  assignments: [],
  tagAssignments: [],
})

/** Les tâches QUI SONT LES MIENNES : c'est dans cette liste, et nulle part ailleurs, qu'on cherche. */
registerEndpoint('/api/editions/1/tasks/mine', () => ({
  success: true,
  data: {
    tasks: [tache(AUTRE_TACHE, 'Ranger le matériel'), tache(TACHE_NOTIFIEE, 'Monter le chapiteau')],
  },
}))

import MyTasksPage from '../../../app/pages/editions/[id]/my-tasks.vue'

/**
 * Une notification de tâche doit OUVRIR la tâche — constat B2.
 *
 * ## Le défaut, en deux moitiés
 *
 * Les notifications « tâche assignée » et « nouveau commentaire » visaient `/gestion/tasks`, page
 * réservée à `canManageTasks` : pour un assigné qui n'est que bénévole accepté, le lien menait sur
 * un écran dont le premier appel répond **403**. Et aucune des trois — le rappel d'échéance
 * compris, qui visait pourtant la bonne page — n'ouvrait la tâche : on arrivait devant SA LISTE
 * ENTIÈRE, à charge de retrouver celle dont on venait de nous parler.
 *
 * ## ⚠️ CE QUE CE TEST MESURE, ET CE QU'IL AURAIT PU MESURER POUR RIEN
 *
 * Il assère que la MODALE EST OUVERTE SUR LA BONNE TÂCHE. Deux tests plus faciles ne prouveraient
 * rien : vérifier que `?task=` survit au montage est vrai même si personne ne le lit — ce dépôt a
 * déjà payé ce test creux —, et vérifier que la modale « existe » serait vrai alors qu'elle est
 * fermée, puisqu'elle est rendue en permanence dans le gabarit.
 *
 * 📍 Deux tâches dans la liste, pas une : avec une seule, une page qui ouvrirait n'importe quelle
 * tâche — la première venue — passerait le cas principal.
 */
const modale = {
  props: ['open', 'task', 'editionId'],
  template: '<div v-if="open" data-modale-tache>{{ task?.id }}</div>',
}

let monte: { unmount: () => void } | null = null

const monterAvec = async (query: Record<string, unknown>) => {
  adresse.query = query
  adresse.remplacements = []
  const wrapper = await mountSuspended(MyTasksPage, {
    global: {
      stubs: {
        TasksTaskViewModal: modale,
        // Rien à voir avec ce test, et il réclame la moitié du store des éditions.
        EditionHeader: { template: '<div />' },
      },
    },
  })
  monte = wrapper
  // Le chargement part d'`onMounted` : la liste arrive APRÈS le montage, et c'est elle qui décide.
  await new Promise((r) => setTimeout(r, 50))
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('Page « mes tâches » — ouverture par l’adresse', () => {
  beforeEach(() => {
    adresse.remplacements = []
  })
  afterEach(() => {
    monte?.unmount()
    monte = null
  })

  it('⚠️ OUVRE LA TÂCHE QUE L’ADRESSE DÉSIGNE, et pas une autre', async () => {
    const page = await monterAvec({ task: String(TACHE_NOTIFIEE) })

    const ouverte = page.find('[data-modale-tache]')
    expect(ouverte.exists(), "la modale n'est pas ouverte").toBe(true)
    expect(ouverte.text()).toBe(String(TACHE_NOTIFIEE))
  })

  it('retire le paramètre de l’adresse, pour qu’un rechargement ne la rouvre pas', async () => {
    await monterAvec({ task: String(TACHE_NOTIFIEE), status: 'TODO' })

    expect(adresse.remplacements.length, "l'adresse n'a pas été réécrite").toBeGreaterThan(0)
    const derniere = adresse.remplacements[adresse.remplacements.length - 1]!
    expect(derniere).not.toHaveProperty('task')
    // ⚠️ Et le reste de l'adresse SURVIT : un lien peut porter un filtre en plus de la tâche.
    expect(derniere.status).toBe('TODO')
  })

  it('n’ouvre rien quand l’adresse ne désigne aucune tâche', async () => {
    /*
     * LE TÉMOIN. Sans lui, une page qui ouvrirait la modale à CHAQUE visite satisferait le premier
     * cas — et « mes tâches » s'ouvrirait sur une tâche au hasard chaque fois qu'on y arrive.
     */
    const page = await monterAvec({})

    expect(page.find('[data-modale-tache]').exists()).toBe(false)
    // Rien à consommer, donc rien à réécrire : l'adresse est laissée tranquille.
    expect(adresse.remplacements).toHaveLength(0)
  })

  it('ignore en silence une tâche qui n’est pas dans ma liste', async () => {
    /*
     * Un lien d'hier, ou une tâche dont on s'est fait retirer. Surtout : l'identifiant vient d'une
     * ADRESSE, qui se modifie à la main — chercher dans la liste reçue est ce qui empêche d'ouvrir
     * par ce chemin une tâche qui ne nous est pas assignée.
     */
    const page = await monterAvec({ task: '999999' })

    expect(page.find('[data-modale-tache]').exists()).toBe(false)
    // Le paramètre part quand même : il a été consommé, le laisser le ferait rejouer.
    expect(adresse.remplacements.length).toBeGreaterThan(0)
    expect(adresse.remplacements[adresse.remplacements.length - 1]!).not.toHaveProperty('task')
  })
})
