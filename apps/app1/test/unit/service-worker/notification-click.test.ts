import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it, beforeEach, vi } from 'vitest'

/**
 * Garde-fou : le clic sur une notification push doit mener à l'URL qu'elle transporte.
 *
 * `client.navigate()` lève une exception sur une fenêtre que ce Service Worker ne contrôle
 * pas — cas courant sur mobile, la recherche se faisant avec `includeUncontrolled: true`.
 * L'exception remontait alors sans être rattrapée : la fenêtre passait au premier plan sans
 * bouger, restant sur la page déjà affichée. Un artiste cliquant sur « Confirmer la lecture »
 * retombait ainsi sur la page de l'édition en cours.
 *
 * Le fichier source produit du JavaScript par interpolation ; le test en extrait le
 * gestionnaire et l'exécute contre des doublures, plutôt que de le relire à l'œil.
 */

const SOURCE = path.resolve(__dirname, '../../../server/routes/firebase-messaging-sw.js.ts')

/** Extrait le corps du gestionnaire `notificationclick` du modèle de Service Worker. */
function chargerGestionnaire() {
  const source = fs.readFileSync(SOURCE, 'utf8')
  const debut = source.indexOf("self.addEventListener('notificationclick'")
  expect(debut, 'gestionnaire notificationclick introuvable').toBeGreaterThan(-1)

  // Jusqu'à la fermeture du addEventListener, repérée par sa parenthèse en début de ligne
  const fin = source.indexOf('\n})', debut)
  expect(fin, 'fin du gestionnaire introuvable').toBeGreaterThan(debut)

  // Le modèle échappe ses accents graves pour survivre au littéral de gabarit
  const code = source.slice(debut, fin + 3).replace(/\\`/g, '`')

  const contexte: any = {}
  const fabrique = new Function('self', 'clients', 'console', `${code}\nreturn __gestionnaire`)
  return { code, contexte, fabrique }
}

/** Rejoue le gestionnaire avec des doublures et rend ce qui a été appelé. */
async function cliquer({
  url,
  fenetres,
  navigateEchoue = false,
}: {
  url: string
  fenetres: string[]
  navigateEchoue?: boolean
}) {
  const { code } = chargerGestionnaire()

  const appels = { focus: [] as string[], navigate: [] as string[], openWindow: [] as string[] }

  const creerFenetre = (adresse: string) => {
    const fenetre: any = {
      url: adresse,
      focus: vi.fn(() => {
        appels.focus.push(adresse)
        return Promise.resolve(fenetre)
      }),
      navigate: vi.fn((cible: string) => {
        appels.navigate.push(cible)
        return navigateEchoue
          ? Promise.reject(new TypeError('client non contrôlé'))
          : Promise.resolve(fenetre)
      }),
    }
    return fenetre
  }

  const self: any = {
    location: { origin: 'https://juggling-convention.com' },
    addEventListener: (_nom: string, gestionnaire: any) => {
      self.__gestionnaire = gestionnaire
    },
  }
  const clients = {
    matchAll: vi.fn(() => Promise.resolve(fenetres.map(creerFenetre))),
    openWindow: vi.fn((cible: string) => {
      appels.openWindow.push(cible)
      return Promise.resolve(null)
    }),
  }

  new Function('self', 'clients', 'console', 'URL', code)(self, clients, console, URL)

  let attendu: Promise<unknown> = Promise.resolve()
  const evenement = {
    notification: { close: vi.fn(), data: { url } },
    waitUntil: (promesse: Promise<unknown>) => {
      attendu = promesse
    },
  }

  self.__gestionnaire(evenement)
  await attendu
  return appels
}

const CIBLE = '/editions/22/artists/notification/grp-1/confirm'
const CIBLE_ABSOLUE = `https://juggling-convention.com${CIBLE}`

describe('clic sur une notification push', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ouvre une fenêtre quand aucune n’est ouverte', async () => {
    const appels = await cliquer({ url: CIBLE, fenetres: [] })

    expect(appels.openWindow).toEqual([CIBLE_ABSOLUE])
  })

  it('fait naviguer la fenêtre ouverte vers l’URL de la notification', async () => {
    const appels = await cliquer({
      url: CIBLE,
      fenetres: ['https://juggling-convention.com/editions/22'],
    })

    expect(appels.navigate).toEqual([CIBLE_ABSOLUE])
    expect(appels.openWindow).toEqual([])
  })

  it('ouvre une fenêtre quand la navigation échoue, plutôt que de rester sur place', async () => {
    // Le défaut rapporté : la fenêtre passait au premier plan et gardait sa page
    const appels = await cliquer({
      url: CIBLE,
      fenetres: ['https://juggling-convention.com/editions/22'],
      navigateEchoue: true,
    })

    expect(appels.navigate).toEqual([CIBLE_ABSOLUE])
    expect(appels.openWindow).toEqual([CIBLE_ABSOLUE])
  })

  it('se contente de remettre au premier plan une fenêtre déjà sur la bonne page', async () => {
    const appels = await cliquer({ url: CIBLE, fenetres: [CIBLE_ABSOLUE] })

    expect(appels.focus).toEqual([CIBLE_ABSOLUE])
    expect(appels.navigate).toEqual([])
    expect(appels.openWindow).toEqual([])
  })

  it('retombe sur l’accueil quand la notification ne porte pas d’URL', async () => {
    const appels = await cliquer({ url: '', fenetres: [] })

    expect(appels.openWindow).toEqual(['https://juggling-convention.com/'])
  })
})
