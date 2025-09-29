import { sendRedirect, getQuery, setCookie, getCookie, getRequestURL, createError } from 'h3'
import { $fetch } from 'ofetch'

import { prisma } from '../../utils/prisma'

function slugifyPseudo(base: string) {
  const clean =
    base
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 30) || 'user'
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
  const clientId = process.env.NUXT_OAUTH_FACEBOOK_CLIENT_ID
  const clientSecret = process.env.NUXT_OAUTH_FACEBOOK_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.error(
      'Facebook OAuth non configuré: définir NUXT_OAUTH_FACEBOOK_CLIENT_ID et NUXT_OAUTH_FACEBOOK_CLIENT_SECRET'
    )
    return sendRedirect(event, '/login')
  }

  const url = getRequestURL(event)
  const redirectUri = process.env.NUXT_OAUTH_FACEBOOK_REDIRECT_URL || `${url.origin}/auth/facebook`
  const query = getQuery(event) as Record<string, string | undefined>

  // Étape 1: Rediriger vers Facebook si absence de code
  if (!query.code) {
    const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    // Conserver un état court (10 min)
    setCookie(event, 'oauth_state_fb', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    })

    // Conserver le paramètre returnTo dans un cookie séparé
    const returnTo = query.returnTo as string
    if (returnTo) {
      setCookie(event, 'oauth_returnTo_fb', returnTo, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 600,
      })
    }

    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'email,public_profile')
    authUrl.searchParams.set('state', state)

    return sendRedirect(event, authUrl.toString())
  }

  // Étape 2: Retour Facebook: valider l'état
  const sentState = query.state
  const cookieState = getCookie(event, 'oauth_state_fb')
  if (!sentState || !cookieState || sentState !== cookieState) {
    throw createError({ statusCode: 400, message: 'Invalid OAuth state' })
  }

  // Échanger le code contre un access_token
  const tokenEndpoint = 'https://graph.facebook.com/v18.0/oauth/access_token'
  const tokenParams = new URLSearchParams()
  tokenParams.set('client_id', clientId)
  tokenParams.set('client_secret', clientSecret)
  tokenParams.set('code', String(query.code))
  tokenParams.set('redirect_uri', redirectUri)

  const tokenRes = await $fetch<any>(`${tokenEndpoint}?${tokenParams.toString()}`, {
    method: 'GET',
  })

  const accessToken = tokenRes.access_token as string | undefined
  if (!accessToken) {
    console.error('Facebook OAuth: access_token manquant', tokenRes)
    return sendRedirect(event, '/login')
  }

  // Récupérer le profil utilisateur
  const fields = ['id', 'name', 'first_name', 'last_name', 'email', 'picture.type(large)'].join(',')
  const userInfo = await $fetch<any>(
    `https://graph.facebook.com/me?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(accessToken)}`
  )

  const email = userInfo?.email as string | undefined
  const name = (userInfo?.name as string | undefined) || ''
  const givenName = (userInfo?.first_name as string | undefined) || ''
  const familyName = (userInfo?.last_name as string | undefined) || ''
  const picture = (userInfo?.picture?.data?.url as string | undefined) || ''

  // Facebook peut ne pas renvoyer d'email selon la configuration/permissions
  if (!email) {
    console.error('Facebook OAuth: email indisponible dans userinfo (permission email manquante ?)')
    return sendRedirect(event, '/login')
  }

  // Essayer de retrouver l'utilisateur par email
  let dbUser = await prisma.user.findUnique({ where: { email } })

  // Créer l'utilisateur si inexistant
  if (!dbUser) {
    const [prenomRaw, ...rest] = name.trim().split(/\s+/)
    const prenom = (givenName || prenomRaw || email.split('@')[0]).trim()
    const nom = (familyName || rest.join(' ') || 'Facebook').trim()
    const basePseudo = email.split('@')[0]
    const pseudo = await uniquePseudo(basePseudo)

    dbUser = await prisma.user.create({
      data: {
        email,
        pseudo,
        nom,
        prenom,
        password: null, // Pas de mot de passe pour les utilisateurs OAuth
        authProvider: 'facebook',
        isEmailVerified: true,
        ...(picture ? { profilePicture: picture } : {}),
      },
    })
  }

  // Mettre à jour la photo de profil si elle est vide et que Facebook fournit une image
  if (dbUser && !dbUser.profilePicture && picture) {
    try {
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: { profilePicture: picture },
      })
    } catch (e) {
      console.warn('Impossible de mettre à jour la photo de profil depuis Facebook:', e)
    }
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
      profilePicture: dbUser.profilePicture,
      isGlobalAdmin: dbUser.isGlobalAdmin,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
      isEmailVerified: dbUser.isEmailVerified,
    },
  })

  // Récupérer le returnTo depuis le cookie et nettoyer le cookie
  const returnTo = getCookie(event, 'oauth_returnTo_fb')
  if (returnTo) {
    setCookie(event, 'oauth_returnTo_fb', '', { maxAge: 0 }) // Supprimer le cookie
  }

  // Valider et utiliser returnTo ou rediriger vers la page d'accueil
  const finalRedirect =
    returnTo && !returnTo.includes('/login') && !returnTo.includes('/auth/') ? returnTo : '/'
  return sendRedirect(event, finalRedirect)
})
