import { requireUserSession } from '#auth-utils'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  return { user }
})
