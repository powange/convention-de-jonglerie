import { clearUserSession } from '#imports'

export default defineEventHandler(async (event) => {
  try {
    // Vider la session corrompue
    await clearUserSession(event)

    return {
      success: true,
      message: 'Session cleared. Please log in again.',
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    }
  }
})
