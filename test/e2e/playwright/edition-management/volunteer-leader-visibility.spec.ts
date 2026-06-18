import { expect, test } from '@nuxt/test-utils/playwright'

import {
  apiDelete,
  apiPatch,
  apiPost,
  enableVolunteers,
  getVerificationCodeFromLogs,
  loadState,
} from '../helpers'

const BASE = 'http://localhost:3000'
const PASSWORD = 'TestPass123!'

/**
 * Test de visibilité (sécurité) : un RESPONSABLE d'équipe voit les données personnelles
 * (email, téléphone) des bénévoles de son équipe via `teams/:id/members`, alors qu'un bénévole
 * NORMAL (non responsable) reçoit un 403 sur le même endpoint.
 *
 * On crée 2 bénévoles loginables : `create-user-and-add` (candidature ACCEPTED + user MANUAL) puis
 * `register` (ajoute un mot de passe au user MANUAL existant) + `verify-email` (code lu dans les logs).
 */
test.describe.serial("Bénévoles — visibilité des données par les responsables d'équipe", () => {
  const ts = Date.now()
  const leader = {
    email: `lead-visi-e2e-${ts}@example.com`,
    pseudo: `LeadVisi${ts}`,
    prenom: 'Léa',
    nom: 'Responsable',
    userId: 0,
    appId: 0,
  }
  const member = {
    email: `memb-visi-e2e-${ts}@example.com`,
    pseudo: `MembVisi${ts}`,
    prenom: 'Marc',
    nom: 'Membre',
    userId: 0,
    appId: 0,
  }
  let teamId: string | null = null

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test('préparer équipe + responsable + membre (bénévoles loginables)', async ({
    page,
    browser,
  }) => {
    const { editionId } = loadState()
    await enableVolunteers(page, String(editionId))

    // --- Opérations ORGANISATEUR (session `page`) ---
    const teamRes = await apiPost(page, `${BASE}/api/editions/${editionId}/volunteer-teams`, {
      data: { name: `Équipe Visibilité E2E ${ts}` },
    })
    expect(teamRes.ok(), `POST team: ${await teamRes.text()}`).toBe(true)
    teamId = ((await teamRes.json())?.data ?? {})?.id
    expect(teamId).toBeTruthy()

    // Créer les 2 bénévoles acceptés (users MANUAL non vérifiés)
    for (const v of [leader, member]) {
      const add = await apiPost(
        page,
        `${BASE}/api/editions/${editionId}/volunteers/create-user-and-add`,
        { data: { email: v.email, prenom: v.prenom, nom: v.nom } }
      )
      expect(add.ok(), `create-user-and-add ${v.email}: ${await add.text()}`).toBe(true)
      const d = (await add.json())?.data ?? {}
      v.userId = d?.user?.id
      v.appId = d?.application?.id
      expect(v.userId, `userId ${v.email}`).toBeTruthy()
      expect(v.appId, `appId ${v.email}`).toBeTruthy()
    }

    // Affecter les 2 à l'équipe ; le responsable devient leader
    for (const v of [leader, member]) {
      const patch = await apiPatch(
        page,
        `${BASE}/api/editions/${editionId}/volunteers/applications/${v.appId}/teams`,
        { data: { teams: [teamId] } }
      )
      expect(patch.ok(), `teams.patch ${v.email}: ${await patch.text()}`).toBe(true)
    }
    const lead = await apiPatch(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/applications/${leader.appId}/teams/${teamId}/leader`,
      { data: { isLeader: true } }
    )
    expect(lead.ok(), `leader.patch: ${await lead.text()}`).toBe(true)

    // --- Rendre les bénévoles loginables, dans des contextes ISOLÉS ---
    // (verify-email connecte automatiquement le user → ne JAMAIS le faire sur la session organisateur)
    for (const v of [leader, member]) {
      const ctx = await browser.newContext()
      try {
        const ap = await ctx.newPage()
        const reg = await apiPost(ap, `${BASE}/api/auth/register`, {
          data: { email: v.email, password: PASSWORD, pseudo: v.pseudo },
        })
        expect(reg.ok(), `register ${v.email}: ${await reg.text()}`).toBe(true)

        let code = ''
        await expect(async () => {
          code = getVerificationCodeFromLogs()
        }).toPass({ timeout: 10000, intervals: [500] })
        const ver = await apiPost(ap, `${BASE}/api/auth/verify-email`, {
          data: { email: v.email, code },
        })
        expect(ver.ok(), `verify-email ${v.email}: ${await ver.text()}`).toBe(true)
      } finally {
        await ctx.close()
      }
    }
  })

  test("le responsable voit les données perso (email) des membres de l'équipe", async ({
    browser,
  }) => {
    const { editionId } = loadState()
    const ctx = await browser.newContext()
    try {
      const p = await ctx.newPage()
      const login = await apiPost(p, `${BASE}/api/auth/login`, {
        data: { identifier: leader.email, password: PASSWORD },
      })
      expect(login.ok(), `login responsable: ${await login.text()}`).toBe(true)

      const members = await p.request.get(
        `${BASE}/api/editions/${editionId}/volunteers/teams/${teamId}/members`
      )
      expect(members.ok(), `members (responsable) statut ${members.status()}`).toBe(true)
      const body = await members.json()
      const list = Array.isArray(body) ? body : (body?.data ?? [])
      // Le responsable voit l'email du membre (donnée personnelle réservée aux responsables)
      expect(JSON.stringify(list)).toContain(member.email)
    } finally {
      await ctx.close()
    }
  })

  test('un bénévole normal (non responsable) ne voit pas les membres (403)', async ({
    browser,
  }) => {
    const { editionId } = loadState()
    const ctx = await browser.newContext()
    try {
      const p = await ctx.newPage()
      const login = await apiPost(p, `${BASE}/api/auth/login`, {
        data: { identifier: member.email, password: PASSWORD },
      })
      expect(login.ok(), `login membre: ${await login.text()}`).toBe(true)

      const members = await p.request.get(
        `${BASE}/api/editions/${editionId}/volunteers/teams/${teamId}/members`
      )
      expect(members.status()).toBe(403)
    } finally {
      await ctx.close()
    }
  })

  test('nettoyage : candidatures et équipe', async ({ page }) => {
    const { editionId } = loadState()
    for (const v of [leader, member]) {
      if (v.appId) {
        await apiDelete(
          page,
          `${BASE}/api/editions/${editionId}/volunteers/applications/${v.appId}`
        )
      }
    }
    if (teamId) {
      await apiDelete(page, `${BASE}/api/editions/${editionId}/volunteer-teams/${teamId}`)
    }
  })
})
