import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * L'écran de veille des conventions : ce qu'il affiche, et ce qu'il demande au serveur.
 *
 * ## ⚠️ CE QUE CES CAS CHERCHENT À ATTRAPER
 *
 * Trois défauts qui seraient **invisibles** à la relecture et sans message d'erreur :
 *
 * 1. **Les compteurs d'onglets déduits de la liste courante.** L'API les calcule sur toute la
 *    table, sans les filtres, précisément parce qu'ils servent d'onglets. Si l'écran affichait
 *    `candidats.length`, il montrerait le nombre de la liste filtrée — donc toujours le même que
 *    ce qu'on a sous les yeux, et n'informerait de rien. Le jeu d'essai ci-dessous ne contient
 *    donc que **deux** candidats pour des comptes de **12 / 3 / 40** : une confusion se verrait.
 * 2. **La pastille « déjà importé » posée partout ou nulle part.** Deux candidats, un seul
 *    importé : les deux sens sont éprouvés, et le sens dangereux (tout marquer) ferait disparaître
 *    du travail derrière le filtre de masquage.
 * 3. **Un verdict en échec annoncé comme un succès.** `Promise.allSettled` est là pour qu'un échec
 *    isolé ne masque pas les verdicts passés ; encore faut-il que l'écran le dise.
 *
 * ## Et un témoin
 *
 * Comme la réponse est bouchonnée, un écran qui n'appellerait plus rien au montage afficherait
 * quand même zéro partout et plusieurs cas resteraient verts. Le premier cas assère donc l'appel
 * lui-même, **avec son filtre de départ**.
 */

/** Un candidat réduit à ce que l'écran lit. */
const candidat = (surcharges: Record<string, unknown> = {}) => ({
  id: 1,
  source: 'jugglingedge',
  url: 'https://jugglingedge.com/event.php?EventID=6485',
  titre: 'Convention témoin',
  debut: '2026-11-20T00:00:00.000Z',
  jours: 3,
  pays: 'Allemagne',
  lieu: 'Francfort',
  adresse: null,
  verdict: 'A_EXAMINER',
  verdictLe: null,
  decouvertLe: '2026-11-01T00:00:00.000Z',
  dejaImporte: false,
  ...surcharges,
})

const IMPORTE = candidat({
  id: 2,
  url: 'https://jugglingedge.com/event.php?EventID=7000',
  titre: 'Déjà en base',
  dejaImporte: true,
})

const REPONSE_CANDIDATS = {
  data: {
    candidats: [candidat(), IMPORTE],
    sources: [
      {
        cle: 'jugglingedge',
        nom: 'JugglingEdge',
        urlDeLaListe: 'https://jugglingedge.com/events.php',
      },
    ],
    pays: ['Allemagne', 'France'],
    // Volontairement sans rapport avec la longueur de la liste ci-dessus (2).
    comptes: { A_EXAMINER: 12, CONVENTION: 3, REFUSE: 40 },
  },
}

const appels = vi.hoisted(() => ({ liste: [] as { url: string; options: any }[] }))

/*
 * `vi.stubGlobal` plutôt qu'un `vi.mock('#imports')` : `test/setup.ts` bouchonne déjà `#imports`
 * globalement, et un second bouchon local l'écraserait — au prix de tout ce que le setup y pose.
 * `useApiAction` comme l'appel direct de la page passent tous deux par `$fetch`.
 */
const fetchBouchon = vi.hoisted(() => {
  const bouchon: any = vi.fn(async (url: string, options: any = {}) => {
    ;(globalThis as any).__appelsVeille.liste.push({ url, options })
    if (String(url).includes('/candidats')) return (globalThis as any).__reponseVeille
    if (String(url).includes('/verdict')) {
      if ((globalThis as any).__verdictEchoue) throw new Error('refusé')
      return { data: {} }
    }
    if (String(url).includes('/rafraichir')) return { data: { bilans: [] } }
    return {}
  })
  /*
   * ⚠️ `create` et `raw` ne sont pas décoratifs. Au démarrage, Nuxt DÉRIVE son client du `$fetch`
   * global : `.nuxt/fetch.mjs` appelle `globalThis.$fetch.create(…)`. Un bouchon qui n'offre
   * qu'une fonction fait donc échouer `setupNuxt` — et les cas sortent **SAUTÉS**, pas rouges :
   * le fichier n'arrive pas à se charger, et son rouge ne prouverait rien.
   */
  bouchon.create = () => bouchon
  bouchon.raw = bouchon
  return bouchon
})

;(globalThis as any).__appelsVeille = appels
vi.stubGlobal('$fetch', fetchBouchon)

const page = () => import('../../../app/pages/admin/veille.vue').then((m) => m.default)

/**
 * Monte la page, `UTooltip` neutralisé.
 *
 * ⚠️ `UTooltip` réclame un `TooltipProviderContext`, que `UApp` fournit en vrai mais qu'un montage
 * isolé n'a pas : sans ce bouchon, chaque infobulle lève `Injection Symbol(TooltipProviderContext)
 * not found` — cinq erreurs NON GÉRÉES qui font échouer le fichier entier, y compris les cas qui
 * n'ont rien à voir. Le bouchon est un passe-plat : le bouton qu'il contient reste rendu et
 * cliquable, et l'infobulle n'est pas ce que ces cas éprouvent.
 */
const monter = async () =>
  mountSuspended(await page(), {
    global: { stubs: { UTooltip: { template: '<div><slot /></div>' } } },
  })

describe('Page /admin/veille', () => {
  beforeEach(() => {
    appels.liste = []
    fetchBouchon.mockClear()
    ;(globalThis as any).__reponseVeille = REPONSE_CANDIDATS
    ;(globalThis as any).__verdictEchoue = false
  })

  it('le témoin : charge les candidats au montage, filtrés sur « à examiner »', async () => {
    /*
     * Sans ce cas, un écran qui n'appellerait plus rien afficherait zéro partout et les autres
     * cas resteraient verts. Et le filtre de départ compte : arriver sur « refusés » mettrait
     * sous les yeux la pile où il n'y a rien à faire.
     */
    await monter()

    const chargement = appels.liste.find((appel) => appel.url.includes('/candidats'))
    expect(chargement).toBeDefined()
    expect(chargement!.options.query.verdict).toBe('A_EXAMINER')
  })

  it('⚠️ affiche les compteurs RENDUS PAR L’API, et non la longueur de la liste', async () => {
    const wrapper = await monter()

    const compteurs = wrapper.findAll('.text-2xl').map((noeud) => noeud.text())
    expect(compteurs).toEqual(['12', '3', '40'])
    // Le filet : la liste en contient deux. Si l'écran la comptait, on lirait 2 quelque part.
    expect(compteurs).not.toContain('2')
  })

  it('⚠️ ne marque « déjà importé » que le candidat qui l’est', async () => {
    /*
     * Les deux sens dans un seul cas : une pastille posée partout, comme une pastille jamais
     * posée, échoue ici. Le sens « partout » est le dangereux — il fait disparaître du travail
     * derrière le filtre de masquage.
     */
    const wrapper = await monter()

    /*
     * Visé par ATTRIBUT et non par nom d'icône : `check-badge` n'apparaît pas tel quel dans le
     * HTML rendu, et un compte à zéro se lisait alors comme « aucune pastille » — un faux
     * négatif qui aurait fait corriger la page au lieu du test.
     */
    expect(wrapper.findAll('[data-deja-importe]')).toHaveLength(1)
  })

  it('📍 recharge avec le verdict de l’onglet choisi', async () => {
    const wrapper = await monter()
    appels.liste = []

    // Visé par IDENTITÉ et non par position : `.cursor-pointer[2]` désignait un autre élément,
    // et un index survit à un réagencement du gabarit sans que rien ne le signale.
    await wrapper.find('[data-onglet="REFUSE"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const rechargement = appels.liste.find((appel) => appel.url.includes('/candidats'))
    expect(rechargement).toBeDefined()
    expect(rechargement!.options.query.verdict).toBe('REFUSE')
  })
})
