import { prisma } from '../../utils/prisma'
import { sendRedirect, getQuery, setCookie, getCookie, getRequestURL, createError } from 'h3'
import bcrypt from 'bcryptjs'
import { $fetch } from 'ofetch'

function slugifyPseudo(base: string) {
  const clean = base.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30) || 'user'
  return clean
}

async function uniquePseudo(base: string) {
  const pseudo = slugifyPseudo(base)
  let i = 0
  while (true) {
    const candidate = i === 0 ? pseudo : `${pseudo}${i}`
    const exists = await prisma.user.findUnique({ where: { pseudo: candidate } })
    if (!exists) return candidate
    i++
  }
}

export default defineEventHandler(async (event) => {
  const clientId = process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID
  const clientSecret = process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.error('Google OAuth non configuré: définir NUXT_OAUTH_GOOGLE_CLIENT_ID et NUXT_OAUTH_GOOGLE_CLIENT_SECRET')
    return sendRedirect(event, '/login')
  }

  const url = getRequestURL(event)
  const redirectUri = process.env.NUXT_OAUTH_GOOGLE_REDIRECT_URL || `${url.origin}/auth/google`
  const query = getQuery(event) as Record<string, string | undefined>

  // Étape 1: Rediriger vers Google si absence de code
  if (!query.code) {
    const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    // Conserver un état court (10 min)
    setCookie(event, 'oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600
    })

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'openid email profile')
    authUrl.searchParams.set('prompt', 'select_account')
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('include_granted_scopes', 'true')
    authUrl.searchParams.set('state', state)

    return sendRedirect(event, authUrl.toString())
  }

  // Étape 2: Retour Google: valider l'état
  const sentState = query.state
  const cookieState = getCookie(event, 'oauth_state')
  if (!sentState || !cookieState || sentState !== cookieState) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid OAuth state' })
  }

  // Échanger le code contre des jetons
  const tokenEndpoint = 'https://oauth2.googleapis.com/token'
  const form = new URLSearchParams()
  form.set('client_id', clientId)
  form.set('client_secret', clientSecret)
  form.set('code', String(query.code))
  form.set('grant_type', 'authorization_code')
  form.set('redirect_uri', redirectUri)

  const tokenRes = await $fetch<any>(tokenEndpoint, {
    method: 'POST',
    body: form,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })

  const accessToken = tokenRes.access_token as string | undefined
  if (!accessToken) {
    console.error('Google OAuth: access_token manquant', tokenRes)
    return sendRedirect(event, '/login')
  }

  // Récupérer le profil utilisateur
  const userInfo = await $fetch<any>('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  const email = userInfo?.email as string | undefined
  const name = (userInfo?.name as string | undefined) || ''
  if (!email) {
    console.error('Google OAuth: email manquant dans userinfo')
    return sendRedirect(event, '/login')
  }

  // Essayer de retrouver l'utilisateur par email
  let dbUser = await prisma.user.findUnique({ where: { email } })

  // Créer l'utilisateur si inexistant
  if (!dbUser) {
    const [prenomRaw, ...rest] = name.trim().split(/\s+/)
    const prenom = prenomRaw || email.split('@')[0]
    const nom = rest.join(' ') || 'Google'
    const basePseudo = email.split('@')[0]
    const pseudo = await uniquePseudo(basePseudo)

    // Générer un mot de passe aléatoire (non utilisé pour Google), stocké hashé via bcrypt
    const randomPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    const hashed = await bcrypt.hash(randomPassword, 10)

    dbUser = await prisma.user.create({
      data: {
        email,
        pseudo,
        nom,
        prenom,
        password: hashed,
        isEmailVerified: true
      }
    })
  }

  // Ouvrir la session utilisateur
  const { setUserSession } = (await import('#imports')) as any
  await setUserSession(event, {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      pseudo: dbUser.pseudo,
      nom: dbUser.nom,
      prenom: dbUser.prenom,
      isGlobalAdmin: dbUser.isGlobalAdmin,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
      isEmailVerified: dbUser.isEmailVerified
    }
  })

  return sendRedirect(event, '/')
})
