import { z } from 'zod'

const bodySchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  organizationSlug: z.string().min(1),
  formType: z.string().min(1),
  formSlug: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const body = bodySchema.parse(await readBody(event))

  try {
    // 1. Obtenir un token OAuth2 avec Client Credentials
    const tokenResponse = await $fetch('https://api.helloasso.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: body.clientId,
        client_secret: body.clientSecret,
      }),
    })

    if (!tokenResponse || !tokenResponse.access_token) {
      throw new Error("Impossible d'obtenir un token")
    }

    // 2. Tester l'accès au formulaire avec le token
    const formUrl = `https://api.helloasso.com/v5/organizations/${body.organizationSlug}/forms/${body.formType}/${body.formSlug}/public`

    const formResponse = await $fetch(formUrl, {
      headers: {
        Authorization: `Bearer ${tokenResponse.access_token}`,
      },
    })

    if (!formResponse) {
      throw new Error("Impossible d'accéder au formulaire")
    }

    // 3. Retourner les informations du formulaire
    return {
      success: true,
      message: 'Connexion réussie',
      form: {
        name: formResponse.title || formResponse.formSlug,
        organizationName: formResponse.organizationName,
        state: formResponse.state,
        formType: formResponse.formType,
      },
    }
  } catch (error: any) {
    console.error('HelloAsso test error:', error)

    // Analyser l'erreur pour donner un message clair
    let errorMessage = 'Erreur lors de la connexion à HelloAsso'

    if (error.statusCode === 401 || error.status === 401) {
      errorMessage = 'Identifiants invalides. Vérifiez votre Client ID et Client Secret.'
    } else if (error.statusCode === 404 || error.status === 404) {
      errorMessage =
        "Formulaire introuvable. Vérifiez le slug de l'organisation, le type et le slug du formulaire."
    } else if (error.statusCode === 403 || error.status === 403) {
      errorMessage = 'Accès refusé. Vérifiez les permissions de votre client API HelloAsso.'
    } else if (error.message) {
      errorMessage = error.message
    }

    throw createError({
      statusCode: 400,
      message: errorMessage,
    })
  }
})
