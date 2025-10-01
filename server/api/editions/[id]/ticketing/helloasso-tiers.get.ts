import { canAccessEditionData } from '../../../../utils/edition-permissions'
import { decrypt } from '../../../../utils/encryption'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette configuration',
    })

  // Récupérer la configuration HelloAsso
  const config = await prisma.externalTicketing.findUnique({
    where: { editionId },
    include: {
      helloAssoConfig: true,
    },
  })

  if (!config || !config.helloAssoConfig) {
    throw createError({
      statusCode: 404,
      message: 'Configuration HelloAsso introuvable',
    })
  }

  const haConfig = config.helloAssoConfig

  try {
    // Déchiffrer le client secret
    const clientSecret = decrypt(haConfig.clientSecret)

    // 1. Obtenir un token OAuth2
    const tokenResponse = await $fetch('https://api.helloasso.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: haConfig.clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenResponse || !tokenResponse.access_token) {
      throw new Error("Impossible d'obtenir un token")
    }

    // 2. Récupérer les informations du formulaire avec les tarifs
    const formUrl = `https://api.helloasso.com/v5/organizations/${haConfig.organizationSlug}/forms/${haConfig.formType}/${haConfig.formSlug}/public`

    const formResponse = await $fetch(formUrl, {
      headers: {
        Authorization: `Bearer ${tokenResponse.access_token}`,
      },
    })

    if (!formResponse) {
      throw new Error("Impossible d'accéder au formulaire")
    }

    // 3. Extraire les tarifs et options
    const tiers = formResponse.tiers || []

    // Les options sont dans extraOptions de chaque tier
    // On va collecter toutes les options uniques de tous les tarifs
    const allOptionsMap = new Map()

    tiers.forEach((tier: any) => {
      if (tier.extraOptions && Array.isArray(tier.extraOptions)) {
        tier.extraOptions.forEach((option: any) => {
          const optionId = option.id || option.name
          if (!allOptionsMap.has(optionId)) {
            allOptionsMap.set(optionId, option)
          }
        })
      }
    })

    const options = Array.from(allOptionsMap.values())

    console.log(`Found ${tiers.length} tiers and ${options.length} extra options`)

    // Transformer les données pour le frontend
    const formattedTiers = tiers.map((tier: any) => ({
      id: tier.id,
      name: tier.label || tier.name,
      description: tier.description,
      price: tier.price,
      minAmount: tier.minAmount,
      maxAmount: tier.maxAmount,
      isActive: tier.isActive,
    }))

    const formattedOptions = options.map((option: any) => ({
      id: option.id || option.name,
      name: option.name || option.label,
      description: option.description,
      type: option.type,
      isRequired: option.isMandatory || option.isRequired,
      choices: option.values || option.choices || [],
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
  } catch (error: any) {
    console.error('HelloAsso tiers fetch error:', error)

    let errorMessage = 'Erreur lors de la récupération des tarifs HelloAsso'

    if (error.statusCode === 401 || error.status === 401) {
      errorMessage = 'Identifiants invalides. Vérifiez votre configuration HelloAsso.'
    } else if (error.statusCode === 404 || error.status === 404) {
      errorMessage = 'Formulaire introuvable.'
    } else if (error.statusCode === 403 || error.status === 403) {
      errorMessage = 'Accès refusé.'
    } else if (error.message) {
      errorMessage = error.message
    }

    throw createError({
      statusCode: 400,
      message: errorMessage,
    })
  }
})
