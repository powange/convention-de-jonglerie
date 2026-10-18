import { useSession } from 'h3'

import type { SessionImpersonation } from '#shared/types/api'
import type { H3Event } from 'h3'

const IMPERSONATION_SESSION_NAME = 'impersonation'

/*
 * ⚠️ UNE SEULE définition, dans `shared/types/api.ts`. Il y en avait trois, et elles ne
 * s'accordaient pas : celle-ci, une déclaration ambiante de `#auth-utils` qui annonçait
 * `originalUserNom`/`originalUserPrenom` NON nuls, et une troisième dans
 * `SessionMeResponse.impersonation` dont deux champs sur trois n'existaient nulle part.
 */
export type ImpersonationData = SessionImpersonation

function getSessionConfig() {
  const password = useRuntimeConfig().session?.password || useRuntimeConfig().sessionPassword
  if (!password) {
    throw createError({
      status: 500,
      message: "NUXT_SESSION_PASSWORD est requis pour le système d'impersonation",
    })
  }
  return {
    password,
    name: IMPERSONATION_SESSION_NAME,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    },
    maxAge: 60 * 60 * 24, // 24 heures
  }
}

/**
 * Définit les données d'impersonation dans une session scellée (chiffrée/signée)
 */
export async function setImpersonationCookie(event: H3Event, data: ImpersonationData) {
  const session = await useSession<ImpersonationData>(event, getSessionConfig())
  await session.update(data)
}

/**
 * Récupère les données d'impersonation depuis la session scellée
 */
export async function getImpersonationCookie(event: H3Event): Promise<ImpersonationData | null> {
  const session = await useSession<ImpersonationData>(event, getSessionConfig())
  if (!session.data || !session.data.active) return null
  return session.data
}

/**
 * Supprime la session d'impersonation
 */
export async function clearImpersonationCookie(event: H3Event) {
  const session = await useSession<ImpersonationData>(event, getSessionConfig())
  await session.clear()
}
