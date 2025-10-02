/**
 * Utilitaire pour gérer les interactions avec l'API HelloAsso
 * Utilise le SDK officiel helloasso-node
 */

import HelloAsso from 'helloasso-node'

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
 * Crée et configure une instance du client API HelloAsso
 */
function createHelloAssoClient(accessToken: string): HelloAsso.ApiClient {
  const client = HelloAsso.ApiClient.instance
  client.basePath = HELLOASSO_API_URL

  // Configurer l'authentification OAuth2
  const oauth2 = client.authentications['OAuth2'] as any
  oauth2.accessToken = accessToken

  return client
}

/**
 * Récupère un token d'accès OAuth2 depuis l'API HelloAsso
 */
export async function getHelloAssoAccessToken(credentials: HelloAssoCredentials): Promise<string> {
  try {
    console.log("🔑 [HelloAsso] Récupération du token d'accès...")
    console.log('🔑 [HelloAsso] API URL:', HELLOASSO_API_URL)
    console.log('🔑 [HelloAsso] Client ID:', credentials.clientId)

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

    console.log("✅ [HelloAsso] Token d'accès obtenu avec succès")
    return response.access_token
  } catch (error: any) {
    console.error('❌ [HelloAsso] Erreur lors de la récupération du token:', error)
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
    console.log('📋 [HelloAsso] Récupération du formulaire...')
    console.log('📋 [HelloAsso] Organization Slug:', formIdentifier.organizationSlug)
    console.log('📋 [HelloAsso] Form Type:', formIdentifier.formType)
    console.log('📋 [HelloAsso] Form Slug:', formIdentifier.formSlug)

    // Créer le client API
    createHelloAssoClient(accessToken)

    // Créer l'instance de l'API Formulaires
    const formulairesApi = new HelloAsso.FormulairesApi()

    // Récupérer le formulaire avec promesse
    return new Promise((resolve, reject) => {
      formulairesApi.organizationsOrganizationSlugFormsFormTypeFormSlugPublicGet(
        formIdentifier.organizationSlug,
        formIdentifier.formType as any,
        formIdentifier.formSlug,
        (error: any, data: any, _response: any) => {
          if (error) {
            console.error('❌ [HelloAsso] Erreur lors de la récupération du formulaire:', error)

            // Gestion des erreurs spécifiques
            if (error.status === 401) {
              reject(
                createError({
                  statusCode: 401,
                  message: "Token d'accès invalide ou expiré",
                })
              )
            } else if (error.status === 404) {
              reject(
                createError({
                  statusCode: 404,
                  message:
                    'Formulaire introuvable. Vérifiez que le formulaire est publié et que les paramètres (slug organisation, type, slug formulaire) sont corrects.',
                })
              )
            } else if (error.status === 403) {
              reject(
                createError({
                  statusCode: 403,
                  message:
                    'Accès refusé. Vérifiez que votre client API a le privilège "AccessPublicData".',
                })
              )
            } else {
              reject(
                createError({
                  statusCode: 400,
                  message: error.message || 'Erreur lors de la récupération du formulaire',
                })
              )
            }
          } else {
            console.log('✅ [HelloAsso] Formulaire récupéré:', data.title)
            resolve(data)
          }
        }
      )
    })
  } catch (error: any) {
    console.error('❌ [HelloAsso] Erreur dans getHelloAssoForm:', error)
    throw error
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
        const optionId = option.id || option.name || ''
        if (optionId && !allOptionsMap.has(optionId)) {
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
    type: option.type || 'TextInput',
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
 * Récupère une page de commandes d'un formulaire HelloAsso
 */
async function getHelloAssoOrdersPage(
  accessToken: string,
  formIdentifier: HelloAssoFormIdentifier,
  pageIndex: number,
  pageSize: number,
  withDetails: boolean
): Promise<{
  data: Array<{
    id: number
    payer: {
      firstName: string
      lastName: string
      email: string
    }
    items: Array<{
      id: number
      amount: number
      name: string
      priceCategory: string
      qrCode?: string
      type: string
      state: string
      user?: {
        firstName: string
        lastName: string
        email: string
      }
      customFields?: Array<{
        name: string
        answer: string
      }>
    }>
  }>
  pagination: {
    pageIndex: number
    pageSize: number
    totalPages: number
    totalCount: number
  }
}> {
  // Créer le client API
  createHelloAssoClient(accessToken)

  // Créer l'instance de l'API Commandes
  const commandesApi = new HelloAsso.CommandesApi()

  // Récupérer les commandes avec promesse
  return new Promise((resolve, reject) => {
    commandesApi.organizationsOrganizationSlugFormsFormTypeFormSlugOrdersGet(
      formIdentifier.organizationSlug,
      formIdentifier.formSlug,
      formIdentifier.formType as any,
      {
        withDetails,
        pageIndex,
        pageSize,
        withCount: true,
      },
      (error: any, data: any, _response: any) => {
        if (error) {
          console.error('❌ [HelloAsso] Erreur lors de la récupération des commandes:', error)

          // Gestion des erreurs spécifiques
          if (error.status === 401) {
            reject(
              createError({
                statusCode: 401,
                message: "Token d'accès invalide ou expiré",
              })
            )
          } else if (error.status === 404) {
            reject(
              createError({
                statusCode: 404,
                message: 'Formulaire introuvable',
              })
            )
          } else if (error.status === 403) {
            reject(
              createError({
                statusCode: 403,
                message: 'Accès refusé. Vérifiez les permissions de votre client API',
              })
            )
          } else {
            reject(
              createError({
                statusCode: 400,
                message: error.message || 'Erreur lors de la récupération des commandes',
              })
            )
          }
        } else {
          resolve(data)
        }
      }
    )
  })
}

/**
 * Récupère toutes les commandes d'un formulaire HelloAsso (toutes les pages)
 */
export async function getHelloAssoOrders(
  credentials: HelloAssoCredentials,
  formIdentifier: HelloAssoFormIdentifier,
  options?: {
    withDetails?: boolean
    pageSize?: number
  }
): Promise<{
  data: Array<{
    id: number
    payer: {
      firstName: string
      lastName: string
      email: string
    }
    items: Array<{
      id: number
      amount: number
      name: string
      priceCategory: string
      qrCode?: string
      type: string
      state: string
      user?: {
        firstName: string
        lastName: string
        email: string
      }
      customFields?: Array<{
        name: string
        answer: string
      }>
    }>
  }>
  pagination: {
    pageIndex: number
    pageSize: number
    totalPages: number
    totalCount: number
  }
}> {
  try {
    console.log('📦 [HelloAsso] Récupération des commandes...')
    console.log('📦 [HelloAsso] Organization Slug:', formIdentifier.organizationSlug)
    console.log('📦 [HelloAsso] Form Type:', formIdentifier.formType)
    console.log('📦 [HelloAsso] Form Slug:', formIdentifier.formSlug)
    console.log('📦 [HelloAsso] Options:', options)

    // 1. Obtenir un token d'accès
    const accessToken = await getHelloAssoAccessToken(credentials)

    const pageSize = options?.pageSize ?? 100
    const withDetails = options?.withDetails ?? true
    let currentPage = 1
    const allOrders: Array<any> = []

    // 2. Récupérer la première page pour connaître le nombre total de pages
    console.log('📦 [HelloAsso] Récupération de la page 1...')
    const firstPageResult = await getHelloAssoOrdersPage(
      accessToken,
      formIdentifier,
      currentPage,
      pageSize,
      withDetails
    )

    allOrders.push(...firstPageResult.data)

    const totalPages = firstPageResult.pagination.totalPages
    const totalCount = firstPageResult.pagination.totalCount

    console.log(`📦 [HelloAsso] Total: ${totalCount} commandes sur ${totalPages} pages`)

    // 3. Récupérer les pages suivantes si nécessaire
    if (totalPages > 1) {
      for (currentPage = 2; currentPage <= totalPages; currentPage++) {
        console.log(`📦 [HelloAsso] Récupération de la page ${currentPage}/${totalPages}...`)
        const pageResult = await getHelloAssoOrdersPage(
          accessToken,
          formIdentifier,
          currentPage,
          pageSize,
          withDetails
        )
        allOrders.push(...pageResult.data)
      }
    }

    console.log(`✅ [HelloAsso] ${allOrders.length} commandes récupérées au total`)

    return {
      data: allOrders,
      pagination: {
        pageIndex: 1,
        pageSize: allOrders.length,
        totalPages: 1,
        totalCount: allOrders.length,
      },
    }
  } catch (error: any) {
    console.error('❌ [HelloAsso] Erreur dans getHelloAssoOrders:', error)
    throw error
  }
}

/**
 * Recherche un billet par QR code dans les commandes
 */
export async function findTicketByQRCode(
  credentials: HelloAssoCredentials,
  formIdentifier: HelloAssoFormIdentifier,
  qrCode: string
): Promise<{
  found: boolean
  ticket?: {
    id: number
    name: string
    amount: number
    state: string
    user: {
      firstName: string
      lastName: string
      email: string
    }
    order: {
      id: number
      payer: {
        firstName: string
        lastName: string
        email: string
      }
    }
  }
}> {
  try {
    // Récupérer toutes les commandes avec détails (pagination à gérer si nécessaire)
    const orders = await getHelloAssoOrders(credentials, formIdentifier, {
      withDetails: true,
      pageSize: 100, // Ajuster selon les besoins
    })

    // Rechercher le billet avec le QR code correspondant
    for (const order of orders.data) {
      for (const item of order.items) {
        if (item.qrCode === qrCode) {
          return {
            found: true,
            ticket: {
              id: item.id,
              name: item.name,
              amount: item.amount,
              state: item.state,
              user: item.user || order.payer,
              order: {
                id: order.id,
                payer: order.payer,
              },
            },
          }
        }
      }
    }

    return { found: false }
  } catch (error: any) {
    console.error('Erreur lors de la recherche du billet:', error)
    throw error
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
