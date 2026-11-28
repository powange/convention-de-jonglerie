import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

/*
 * ⚠️ Lu COMME DU TEXTE puis transpilé, et non importé : un fichier TypeScript d'app2 ne se
 * transforme qu'avec le tsconfig que Nuxt génère dans `apps/app2/.nuxt`, absent de la CI d'app1.
 */
const APP2 = resolve(__dirname, '../../../../app2')
const { outputText } = ts.transpileModule(
  readFileSync(resolve(APP2, 'server/utils/push-sw.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
)
const g: Record<string, any> = {}
new Function('exports', outputText)(g)

/** Exécute le code du service worker avec un faux `self`, et rend ses écouteurs. */
function monter(fenetres: { url: string; focus: () => unknown }[] = []) {
  const ecouteurs: Record<string, (e: any) => void> = {}
  const self = {
    location: { origin: 'https://flowvent.org' },
    addEventListener: (type: string, f: (e: any) => void) => (ecouteurs[type] = f),
    registration: { showNotification: vi.fn(() => Promise.resolve()) },
    clients: {
      matchAll: vi.fn(() => Promise.resolve(fenetres)),
      openWindow: vi.fn(() => Promise.resolve(null)),
    },
  }
  new Function('self', g.BLOC_PUSH_SW)(self)
  return { ecouteurs, self }
}

/** Déclenche un écouteur et attend ce qu'il a passé à `waitUntil`. */
async function declencher(f: (e: any) => void, evenement: Record<string, unknown>) {
  let attente: Promise<unknown> = Promise.resolve()
  f({ ...evenement, waitUntil: (p: Promise<unknown>) => (attente = p) })
  await attente
}

/**
 * Le service worker de Flowvent, partie push (apps/app2/server/utils/push-sw.ts) : ce qu'il affiche
 * d'une notification reçue, et la page qu'il ouvre au toucher.
 */
describe('Flowvent — service worker, notifications push', () => {
  const contenu = {
    titre: 'Échange de créneau validé ✅',
    message: 'Votre échange sur Festival a été validé.',
    url: '/events/Az-CoZ7B6H/volunteers',
    icone: '/api/events/Az-CoZ7B6H/application/icone?taille=192&v=abc',
    tag: 'notification-1',
    actions: [
      { action: 'ouvrir', titre: 'Voir mes créneaux', url: '/events/Az-CoZ7B6H/volunteers' },
    ],
  }

  it('affiche titre, texte, icône de l’événement et bouton', async () => {
    const { ecouteurs, self } = monter()
    await declencher(ecouteurs.push!, { data: { json: () => contenu } })
    expect(self.registration.showNotification).toHaveBeenCalledWith(contenu.titre, {
      body: contenu.message,
      icon: contenu.icone,
      tag: 'notification-1',
      renotify: true,
      data: { url: contenu.url, urls: { ouvrir: contenu.url } },
      actions: [{ action: 'ouvrir', title: 'Voir mes créneaux' }],
    })
  })

  it('prévient les pages ouvertes, pour que leur cloche se mette à jour', async () => {
    const postMessage = vi.fn()
    const { ecouteurs } = monter([
      { url: 'https://flowvent.org/dashboard', focus: vi.fn(), postMessage } as any,
    ])
    await declencher(ecouteurs.push!, { data: { json: () => contenu } })
    expect(postMessage).toHaveBeenCalledWith({
      type: 'flowvent:push',
      titre: contenu.titre,
      url: contenu.url,
    })
  })

  it('se rabat sur l’icône et le titre de Flowvent', async () => {
    const { ecouteurs, self } = monter()
    await declencher(ecouteurs.push!, { data: { json: () => ({ message: 'Bonjour' }) } })
    const [titre, options] = self.registration.showNotification.mock.calls[0] as any[]
    expect(titre).toBe('Flowvent')
    expect(options.icon).toBe('/favicons/android-chrome-192x192.png?v=v1')
    expect(options.data.url).toBe('/')
  })

  it('au toucher, ouvre la page de la notification', async () => {
    const { ecouteurs, self } = monter()
    const close = vi.fn()
    await declencher(ecouteurs.notificationclick!, {
      action: '',
      notification: { close, data: { url: '/events/Az-CoZ7B6H/volunteers', urls: {} } },
    })
    expect(close).toHaveBeenCalled()
    expect(self.clients.openWindow).toHaveBeenCalledWith(
      'https://flowvent.org/events/Az-CoZ7B6H/volunteers'
    )
  })

  it('le bouton ouvre SA page', async () => {
    const { ecouteurs, self } = monter()
    await declencher(ecouteurs.notificationclick!, {
      action: 'ouvrir',
      notification: { close: vi.fn(), data: { url: '/', urls: { ouvrir: '/events/X/gestion' } } },
    })
    expect(self.clients.openWindow).toHaveBeenCalledWith('https://flowvent.org/events/X/gestion')
  })

  it('une fenêtre déjà ouverte sur la page passe au premier plan, sans en ouvrir une autre', async () => {
    const focus = vi.fn()
    const { ecouteurs, self } = monter([
      { url: 'https://flowvent.org/dashboard', focus: vi.fn() },
      { url: 'https://flowvent.org/events/X/volunteers', focus },
    ])
    await declencher(ecouteurs.notificationclick!, {
      action: '',
      notification: { close: vi.fn(), data: { url: '/events/X/volunteers', urls: {} } },
    })
    expect(focus).toHaveBeenCalled()
    expect(self.clients.openWindow).not.toHaveBeenCalled()
  })
})
