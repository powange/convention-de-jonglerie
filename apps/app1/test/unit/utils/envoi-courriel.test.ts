import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const createTransport = vi.hoisted(() => vi.fn())
vi.mock('nodemailer', () => ({ default: { createTransport } }))

import { envoyerCourriel } from '../../../../../layers/core/server/socle/envoi-courriel'

const courriel = {
  to: 'essai@example.com',
  subject: 'Vérifiez votre compte',
  html: '<p class="code">123456</p>',
  text: 'Votre code est : 123456',
}

/**
 * Le transport commun d'app1 et Flowvent. Ce qui est tenu ici : la simulation reste LISIBLE pour
 * une adresse de test (les comptes d'essai y lisent leur code), et l'envoi réel la bloque avant
 * d'ouvrir le moindre transport.
 */
describe('envoyerCourriel', () => {
  let journal: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => ({}))
    journal = vi.spyOn(console, 'log').mockImplementation(() => {})
    createTransport.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('en simulation, écrit le contenu et le code même pour un domaine de test', async () => {
    vi.stubEnv('SEND_EMAILS', 'false')

    expect(await envoyerCourriel(courriel, { nomExpediteur: 'Flowvent' })).toBe(true)

    const lignes = journal.mock.calls.map((appel) => String(appel[0]))
    expect(lignes.some((l) => l.includes('EMAIL SIMULÉ'))).toBe(true)
    expect(journal).toHaveBeenCalledWith('🔑 CODE DANS LE CONTENU:', '123456')
    expect(createTransport).not.toHaveBeenCalled()
  })

  it('en envoi réel, bloque un domaine de test sans ouvrir de transport', async () => {
    vi.stubEnv('SEND_EMAILS', 'true')

    expect(await envoyerCourriel(courriel, { nomExpediteur: 'Flowvent' })).toBe(true)

    const lignes = journal.mock.calls.map((appel) => String(appel[0]))
    expect(lignes.some((l) => l.includes('Email bloqué'))).toBe(true)
    expect(createTransport).not.toHaveBeenCalled()
  })

  it('en envoi réel, expédie sous le nom de l’application', async () => {
    vi.stubEnv('SEND_EMAILS', 'true')
    vi.stubEnv('SMTP_HOST', 'smtp.exemple-reel.fr')
    vi.stubEnv('SMTP_USER', 'contact@exemple-reel.fr')
    vi.stubEnv('SMTP_PASS', 'x')
    vi.stubEnv('SMTP_FROM', '')
    vi.stubEnv('SMTP_BCC', '')
    const sendMail = vi.fn().mockResolvedValue({ rejected: [] })
    createTransport.mockReturnValue({ sendMail })

    await envoyerCourriel(
      { ...courriel, to: 'personne@exemple-reel.fr' },
      { nomExpediteur: 'Flowvent' }
    )

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'personne@exemple-reel.fr',
        from: '"Flowvent" <contact@exemple-reel.fr>',
      })
    )
  })
})
