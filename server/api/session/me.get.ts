import { requireUserSession } from '#imports'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  return { user }
})
