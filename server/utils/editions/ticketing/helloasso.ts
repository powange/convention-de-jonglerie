/**
 * Utilitaire pour gérer les interactions avec l'API HelloAsso
 */

// URL de base de l'API HelloAsso (configurable via variable d'environnement)
const HELLOASSO_API_URL = process.env.HELLOASSO_API_URL || 'https://api.helloasso.com'

interface HelloAssoTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface HelloAssoFormResponse {
  title: string
  formSlug: string
  organizationName: string
  state: string
  formType: string
  tiers?: HelloAssoTier[]
  [key: string]: any
}

interface HelloAssoTier {
  id: number
  label?: string
  name?: string
  description?: string
  price: number
  minAmount?: number
  maxAmount?: number
  isActive: boolean
  extraOptions?: HelloAssoExtraOption[]
}

interface HelloAssoExtraOption {
  id: number | string
  name?: string
  label?: string
  description?: string
  type: string
  isMandatory?: boolean
  isRequired?: boolean
  values?: string[]
  choices?: string[]
}

interface HelloAssoCredentials {
  clientId: string
  clientSecret: string
}

interface HelloAssoFormIdentifier {
  organizationSlug: string
  formType: string
  formSlug: string
}

/**
 * Récupère un token d'accès OAuth2 depuis l'API HelloAsso
 */
export async function getHelloAssoAccessToken(credentials: HelloAssoCredentials): Promise<string> {
  try {
    const response = await $fetch<HelloAssoTokenResponse>(`${HELLOASSO_API_URL}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
    })

    if (!response || !response.access_token) {
      throw new Error("Impossible d'obtenir un token d'accès")
    }

    return response.access_token
  } catch (error: any) {
    console.error('Erreur lors de la récupération du token HelloAsso:', error)
    throw createError({
      statusCode: 401,
      message: 'Identifiants HelloAsso invalides',
    })
  }
}

/**
 * Récupère les informations d'un formulaire HelloAsso
 */
export async function getHelloAssoForm(
  accessToken: string,
  formIdentifier: HelloAssoFormIdentifier
): Promise<HelloAssoFormResponse> {
  try {
    const formUrl = `${HELLOASSO_API_URL}/v5/organizations/${formIdentifier.organizationSlug}/forms/${formIdentifier.formType}/${formIdentifier.formSlug}/public`

    const response = await $fetch<HelloAssoFormResponse>(formUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response) {
      throw new Error('Impossible de récupérer les informations du formulaire')
    }

    return response
  } catch (error: any) {
    console.error('Erreur lors de la récupération du formulaire HelloAsso:', error)

    // Analyser l'erreur pour donner un message clair
    if (error.statusCode === 401 || error.status === 401) {
      throw createError({
        statusCode: 401,
        message: "Token d'accès invalide ou expiré",
      })
    } else if (error.statusCode === 404 || error.status === 404) {
      throw createError({
        statusCode: 404,
        message:
          "Formulaire introuvable. Vérifiez le slug de l'organisation, le type et le slug du formulaire.",
      })
    } else if (error.statusCode === 403 || error.status === 403) {
      throw createError({
        statusCode: 403,
        message: 'Accès refusé. Vérifiez les permissions de votre client API HelloAsso.',
      })
    }

    throw createError({
      statusCode: 400,
      message: error.message || 'Erreur lors de la récupération du formulaire',
    })
  }
}

/**
 * Teste la connexion à l'API HelloAsso avec les credentials fournis
 */
export async function testHelloAssoConnection(
  credentials: HelloAssoCredentials,
  formIdentifier: HelloAssoFormIdentifier
): Promise<{
  success: boolean
  form: {
    name: string
    organizationName: string
    state: string
    formType: string
  }
}> {
  // 1. Obtenir un token
  const accessToken = await getHelloAssoAccessToken(credentials)

  // 2. Récupérer le formulaire
  const formResponse = await getHelloAssoForm(accessToken, formIdentifier)

  // 3. Retourner les informations du formulaire
  return {
    success: true,
    form: {
      name: formResponse.title || formResponse.formSlug,
      organizationName: formResponse.organizationName,
      state: formResponse.state,
      formType: formResponse.formType,
    },
  }
}

/**
 * Récupère les tarifs et options d'un formulaire HelloAsso
 */
export async function getHelloAssoTiersAndOptions(
  credentials: HelloAssoCredentials,
  formIdentifier: HelloAssoFormIdentifier
): Promise<{
  success: boolean
  form: {
    name: string
    organizationName: string
    state: string
  }
  tiers: Array<{
    id: number
    name: string
    description?: string
    price: number
    minAmount?: number
    maxAmount?: number
    isActive: boolean
  }>
  options: Array<{
    id: number | string
    name: string
    description?: string
    type: string
    isRequired: boolean
    choices: string[]
  }>
}> {
  // 1. Obtenir un token
  const accessToken = await getHelloAssoAccessToken(credentials)

  // 2. Récupérer le formulaire
  const formResponse = await getHelloAssoForm(accessToken, formIdentifier)

  // 3. Extraire les tarifs
  const tiers = formResponse.tiers || []

  // 4. Extraire les options depuis extraOptions de chaque tier
  const allOptionsMap = new Map<number | string, HelloAssoExtraOption>()

  tiers.forEach((tier: HelloAssoTier) => {
    if (tier.extraOptions && Array.isArray(tier.extraOptions)) {
      tier.extraOptions.forEach((option: HelloAssoExtraOption) => {
        const optionId = option.id || option.name
        if (!allOptionsMap.has(optionId)) {
          allOptionsMap.set(optionId, option)
        }
      })
    }
  })

  const options = Array.from(allOptionsMap.values())

  console.log(`Found ${tiers.length} tiers and ${options.length} extra options`)

  // 5. Formater les données pour le frontend
  const formattedTiers = tiers.map((tier: HelloAssoTier) => ({
    id: tier.id,
    name: tier.label || tier.name || '',
    description: tier.description,
    price: tier.price,
    minAmount: tier.minAmount,
    maxAmount: tier.maxAmount,
    isActive: tier.isActive,
  }))

  const formattedOptions = options.map((option: HelloAssoExtraOption) => ({
    id: option.id ?? option.name ?? '',
    name: option.name ?? option.label ?? '',
    description: option.description,
    type: option.type,
    isRequired: option.isMandatory ?? option.isRequired ?? false,
    choices: option.values ?? option.choices ?? [],
  }))

  return {
    success: true,
    form: {
      name: formResponse.title || formResponse.formSlug,
      organizationName: formResponse.organizationName,
      state: formResponse.state,
    },
    tiers: formattedTiers,
    options: formattedOptions,
  }
}

/**
 * Type pour exporter les interfaces
 */
export type {
  HelloAssoCredentials,
  HelloAssoFormIdentifier,
  HelloAssoTokenResponse,
  HelloAssoFormResponse,
  HelloAssoTier,
  HelloAssoExtraOption,
}
