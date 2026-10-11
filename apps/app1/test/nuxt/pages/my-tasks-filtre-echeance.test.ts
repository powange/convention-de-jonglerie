import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { journeeDans } from '../../../shared/utils/fuseau-edition'

/**
 * Le BRANCHEMENT du filtre d'échéance, et son fuseau — constat B4.
 *
 * ## ⚠️ POURQUOI CE FICHIER EXISTE, alors que la règle a 15 cas unitaires
 *
 * `filtre-echeance-taches.ts` est éprouvé à part. Mais un util juste et branché nulle part ne
 * corrige rien — ce dépôt a payé ce défaut cinq fois, et la couverture fait passer le code mort
 * pour vivant. Ce qui se vérifie ici est que l'ÉCRAN filtre au fuseau de l'édition : c'est le
 * fuseau qui faisait le défaut, et il n'arrive à la règle que si la page le lui passe.
 *
 * ## ⚠️⚠️ COMMENT CE TEST PEUT ÊTRE VERT SANS RIEN PROUVER, et ce qui l'en empêche
 *
 * Le filtre compare l'instant présent au jour de l'échéance. Deux précautions :
 *
 * 1. **l'heure est FIGÉE** (`vi.setSystemTime`), sans quoi les cas seraient verts la journée et
 *    rouges la nuit — donc inutilisables en CI. Seul `Date` est simulé : les minuteries restent
 *    réelles, le montage ayant besoin d'attendre ;
 * 2. **le fuseau de la MACHINE doit différer de celui de l'édition** à cet instant, sinon les deux
 *    découpages tombent le même jour et l'ancien code passerait aussi. Ce n'est pas supposé : une
 *    assertion de harnais le vérifie avant les cas, et échoue en le disant.
 */
const MAINTENANT = new Date('2026-10-11T22:30:00Z')
const FUSEAU_EDITION = 'Europe/Paris' // 00 h 30 le 12 à cet instant

/**
 * Échéance du 12 octobre à 22 h heure de Paris.
 *
 * C'est l'échéance qui départage les deux découpages : « aujourd'hui » vaut le **12** à Paris,
 * mais le **11** pour une machine en UTC. Avant ce lot, elle disparaissait du filtre.
 */
const ECHEANCE_DU_JOUR_SUR_PLACE = '2026-10-12T20:00:00Z'
/** Et celle-ci est hors du jour sur place, pour que le filtre ait quelque chose à écarter. */
const ECHEANCE_HORS_DU_JOUR = '2026-10-20T10:00:00Z'

const adresse = vi.hoisted(() => ({ query: {} as Record<string, unknown> }))

mockNuxtImport('useRoute', () => () => ({ params: { id: '1' }, query: adresse.query }))
mockNuxtImport('useRouter', () => () => ({
  replace: () => {},
  beforeResolve: () => () => {},
  beforeEach: () => () => {},
  afterEach: () => () => {},
}))

vi.mock('~/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 1 } }) }))
vi.mock('~/stores/editions', () => ({
  useEditionStore: () => ({
    loading: false,
    getEditionById: () => ({ id: 1, name: 'Édition de test', timezone: FUSEAU_EDITION }),
    fetchEditionById: async () => undefined,
  }),
}))

const tache = (id: number, titre: string, deadline: string) => ({
  id,
  title: titre,
  description: null,
  status: 'TODO',
  deadline,
  displayOrder: 0,
  group: { id: 3, name: 'Avant la convention' },
  assignments: [],
  tagAssignments: [],
})

registerEndpoint('/api/editions/1/tasks/mine', () => ({
  success: true,
  data: {
    tasks: [
      tache(1, 'Monter le chapiteau', ECHEANCE_DU_JOUR_SUR_PLACE),
      tache(2, 'Ranger le matériel', ECHEANCE_HORS_DU_JOUR),
    ],
  },
}))
registerEndpoint('/api/editions/1/tasks/mine/comments', () => ({ success: true, data: [] }))

import MyTasksPage from '../../../app/pages/editions/[id]/my-tasks.vue'

let monte: { unmount: () => void } | null = null

const monterAvec = async (query: Record<string, unknown>) => {
  adresse.query = query
  const wrapper = await mountSuspended(MyTasksPage, {
    global: {
      stubs: {
        EditionHeader: { template: '<div />' },
        TasksTaskViewModal: { template: '<div />' },
      },
    },
  })
  monte = wrapper
  // La liste arrive d'`onMounted`, donc APRÈS le montage.
  await new Promise((r) => setTimeout(r, 50))
  await wrapper.vm.$nextTick()
  return wrapper.text()
}

describe('Page « mes tâches » — le filtre « aujourd’hui » suit l’édition', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(MAINTENANT)
  })
  afterAll(() => {
    vi.useRealTimers()
  })
  afterEach(() => {
    monte?.unmount()
    monte = null
  })

  it('HARNAIS : le fuseau de la machine découpe un AUTRE jour que celui de l’édition', () => {
    /*
     * Sans cet écart, les deux découpages donneraient le même résultat et les cas suivants
     * seraient verts avec l'ancien code comme avec le nouveau. Si cette assertion tombe, c'est la
     * machine qui a changé de fuseau — pas le correctif.
     */
    expect(journeeDans(MAINTENANT, FUSEAU_EDITION)).not.toBe(journeeDans(MAINTENANT, null))
  })

  it('⚠️ RETIENT LA TÂCHE DUE AUJOURD’HUI SUR PLACE, que le fuseau machine rangeait DEMAIN', async () => {
    const texte = await monterAvec({ due: 'today' })

    expect(texte).toContain('Monter le chapiteau')
    expect(texte).not.toContain('Ranger le matériel')
  })

  it('sans filtre, les deux tâches sont là', async () => {
    /*
     * LE TÉMOIN. Sans lui, une page qui n'afficherait JAMAIS « Ranger le matériel » — liste vide,
     * rendu cassé, point d'API muet — satisferait le cas précédent.
     */
    const texte = await monterAvec({})

    expect(texte).toContain('Monter le chapiteau')
    expect(texte).toContain('Ranger le matériel')
  })
})
