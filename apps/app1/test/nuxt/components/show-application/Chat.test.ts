import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

import ShowApplicationChat from '../../../../app/components/show-application/Chat.vue'

/**
 * Le fil de discussion d'une candidature de spectacle, et son chargement des messages anciens.
 *
 * ## ⚠️ LE DÉFAUT (constat B3, second site)
 *
 * Le composant lisait `pagination.hasMore`. Le point d'API des messages répond par
 * `createPaginatedResponse`, qui nomme ce drapeau **`hasNextPage`**. Le champ lu n'existait donc
 * pas : `undefined`, et la garde de `loadMoreMessages` refermait la porte. Au-delà des cinquante
 * derniers messages, **rien n'était accessible** dans le fil d'une candidature — sans erreur, sans
 * indice, le défilement ne rapportait simplement jamais rien.
 *
 * La référence était typée `{ total: number; hasMore: boolean }` : deux champs que cette réponse ne
 * porte pas. C'est ce typage inventé qui a laissé passer la faute, et le mock de CE fichier
 * répétait la même forme — le test consacrait le défaut au lieu de l'attraper.
 *
 * ## ⚠️⚠️ CE QUE CES CAS REMPLACENT
 *
 * Quatre cas qui n'assertaient que l'existence du composant : « il est défini », « il a un nom »,
 * « il a des props ». Ils seraient restés verts avec le défaut, et le resteraient si le composant
 * n'affichait plus rien du tout. Ce qui se mesure ici, c'est un GESTE : on défile vers le haut, et
 * l'on regarde si une seconde page est demandée.
 */
const messagerie = {
  fetchMessages: vi.fn(),
  sendMessage: vi.fn(),
  markMessageAsRead: vi.fn(),
}

vi.mock('../../../../app/composables/useMessenger', () => ({
  useMessenger: () => messagerie,
}))

/*
 * ⚠️ DE VRAIS `ref`, ET NON `{ value: [] }`. Le composant les surveille : un objet nu rend « Invalid
 * watch source », le watcher ne s'installe pas, et l'on cherche la cause dans le composant.
 */
vi.mock('../../../../app/composables/useMessengerStream', () => ({
  useMessengerStream: () => ({
    realtimeMessages: ref([]),
    isConnected: ref(false),
    messageUpdates: ref([]),
    clearMessages: vi.fn(),
    clearMessageUpdates: vi.fn(),
  }),
}))

/*
 * ⚠️ `registerEndpoint`, ET NON `vi.stubGlobal('$fetch', …)`. Dans l'environnement Nuxt, `$fetch`
 * est l'instance d'ofetch du runtime : la remplacer sur `globalThis` ne l'atteint pas, et
 * `useApiAction` continue d'appeler le vrai. La conversation n'existait alors jamais, le composant
 * n'affichait que son état vide, et les deux cas échouaient sur « les messages doivent avoir été
 * chargés » — en accusant le composant.
 */
registerEndpoint('/api/show-applications/7/conversation', () => ({
  exists: true,
  conversationId: 'c1',
  isParticipant: true,
}))

/**
 * Un message, à la forme de `ConversationMessage`.
 *
 * ⚠️ `participant.user`, et non `sender` : la liste lit `message.participant.user.id` pour savoir
 * si le message est le mien. Une forme approximative fait lever le `computed` de `MessageList`, la
 * liste ne se rend pas, et l'on cherche la cause dans le composant testé.
 */
const message = (id: string) => ({
  id,
  content: `message ${id}`,
  createdAt: new Date('2026-06-15T10:00:00Z'),
  editedAt: null,
  deletedAt: null,
  replyToId: null,
  replyTo: null,
  participant: {
    id: `p-${id}`,
    user: { id: 2, pseudo: 'Artiste', profilePicture: null, emailHash: 'x' },
  },
})

/** La pagination telle que `createPaginatedResponse` la rend — six champs, et pas d'autres. */
const pagination = (page: number, totalCount: number, limit = 50) => ({
  page,
  limit,
  totalCount,
  totalPages: Math.ceil(totalCount / limit),
  hasNextPage: page * limit < totalCount,
  hasPrevPage: page > 1,
})

describe('ShowApplicationChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    messagerie.markMessageAsRead.mockResolvedValue(true)
  })

  /** Le composant monté sur une conversation de 120 messages, dont 50 chargés. */
  const monter = async (totalCount: number) => {
    messagerie.fetchMessages.mockResolvedValue({
      data: Array.from({ length: 50 }, (_, i) => message(`m-${i}`)),
      pagination: pagination(1, totalCount),
    })

    const composant = await mountSuspended(ShowApplicationChat, {
      props: { applicationId: 7 },
      global: {
        // `UTooltip` exige un `TooltipProvider`, que `UApp` fournit dans l'application mais qu'un
        // montage isolé n'a pas : son `setup` lève, et la liste des messages ne se rend pas du
        // tout. Le remplacer par son contenu suffit, ce n'est pas l'infobulle qu'on observe ici.
        stubs: { UTooltip: { template: '<div><slot /></div>' } },
      },
    })
    await vi.waitFor(() => {
      expect(messagerie.fetchMessages, 'les messages doivent avoir été chargés').toHaveBeenCalled()
    })
    return composant
  }

  /** Défiler jusqu'en haut du fil, comme on le fait pour remonter la discussion. */
  const defilerEnHaut = async (composant: Awaited<ReturnType<typeof monter>>) => {
    const zone = composant.find('.overflow-y-auto')
    expect(zone.exists(), 'la zone de défilement doit être rendue').toBe(true)
    Object.defineProperty(zone.element, 'scrollTop', { value: 0, configurable: true })
    await zone.trigger('scroll')
  }

  it('⚠️ DEMANDE LES MESSAGES PLUS ANCIENS quand il en reste', async () => {
    const composant = await monter(120)
    messagerie.fetchMessages.mockClear()

    await defilerEnHaut(composant)

    expect(messagerie.fetchMessages).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ offset: 50 })
    )
  })

  it('n’en demande pas quand tout est chargé', async () => {
    /*
     * LE TÉMOIN. Sans lui, un défilement qui rechargerait À CHAQUE FOIS satisferait le cas
     * ci-dessus — et le fil repartirait en boucle sur la même page à chaque mouvement de doigt.
     */
    const composant = await monter(50)
    messagerie.fetchMessages.mockClear()

    await defilerEnHaut(composant)

    expect(messagerie.fetchMessages).not.toHaveBeenCalled()
  })

  it('accepte l’identifiant de candidature en propriété', () => {
    // Non-régression de l'interface du composant : c'est par là que l'écran le branche.
    const props = ShowApplicationChat.props || ShowApplicationChat.__props
    expect(props).toBeDefined()
    expect(Array.isArray(props) ? props.includes('applicationId') : 'applicationId' in props).toBe(
      true
    )
  })
})
