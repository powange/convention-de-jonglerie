import { getRequestIP } from 'h3'
import { z } from 'zod'

import { prisma } from '../../utils/prisma'
import { validateAndSanitize, handleValidationError } from '../../utils/validation-schemas'

import type { FeedbackType } from '@prisma/client'

const feedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'general', 'other']),
  subject: z
    .string()
    .min(5, 'Le sujet doit faire au moins 5 caractères')
    .max(200, 'Le sujet ne peut pas dépasser 200 caractères'),
  message: z
    .string()
    .min(20, 'Le message doit faire au moins 20 caractères')
    .max(5000, 'Le message ne peut pas dépasser 5000 caractères'),
  email: z.string().email('Email invalide').optional().or(z.literal('')), // Optionnel, peut être vide
  name: z
    .string()
    .min(2, 'Le nom doit faire au moins 2 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .optional(),
  url: z.string().url('URL invalide').optional().or(z.literal('')),
  captchaToken: z.string().optional(), // Pour les utilisateurs non connectés
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Validation des données
  let validatedData
  try {
    validatedData = validateAndSanitize(feedbackSchema, body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      handleValidationError(error)
    }
    throw error
  }

  const { type, subject, message, email, name, url, captchaToken } = validatedData
  const user = event.context.user
  const isAuthenticated = !!user

  // Si l'utilisateur n'est pas connecté, vérifier le captcha
  if (!isAuthenticated) {
    if (!captchaToken) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Captcha requis pour les utilisateurs non connectés',
      })
    }

    // Bypass reCAPTCHA en dev si activé
    const config = useRuntimeConfig()
    // Lire au runtime avec priorité aux env vars et conversion booléenne sûre
    const recaptchaBypassEnv = process.env.NUXT_RECAPTCHA_DEV_BYPASS
    const recaptchaDevBypass = (recaptchaBypassEnv ?? String(config.recaptchaDevBypass)) === 'true'
    if (recaptchaDevBypass) {
      // Continuer sans vérifier auprès de Google
      // Optionnel: on pourrait journaliser ou marquer le feedback comme issu d'un bypass
    } else {
      // Vérifier le captcha avec Google reCAPTCHA v3
      const recaptchaSecret = process.env.NUXT_RECAPTCHA_SECRET_KEY || config.recaptchaSecretKey
      if (!recaptchaSecret) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Configuration du captcha manquante',
        })
      }

      try {
        const remoteip = getRequestIP(event) || undefined
        interface RecaptchaV3Response {
          success: boolean
          score?: number
          action?: string
          challenge_ts?: string
          hostname?: string
          'error-codes'?: string[]
        }
        const params = new URLSearchParams({
          secret: recaptchaSecret,
          response: captchaToken,
        })
        if (remoteip) params.set('remoteip', remoteip)
        const verification = await $fetch<RecaptchaV3Response>(
          'https://www.google.com/recaptcha/api/siteverify',
          {
            method: 'POST',
            body: params,
          }
        )

        // Attendus v3: success vrai, action correspondante, score >= seuil
        const cfg = config as unknown as {
          recaptchaMinScore?: number | string
          recaptchaExpectedHostname?: string
        }
        const minScore = Number(
          process.env.NUXT_RECAPTCHA_MIN_SCORE ?? cfg.recaptchaMinScore ?? 0.5
        )
        const expectedHost = (
          process.env.NUXT_RECAPTCHA_EXPECTED_HOSTNAME ??
          cfg.recaptchaExpectedHostname ??
          ''
        )
          .toString()
          .trim()
        if (!verification?.success) {
          throw createError({ statusCode: 400, statusMessage: 'Captcha invalide' })
        }
        if (verification?.action && verification.action !== 'feedback') {
          throw createError({ statusCode: 400, statusMessage: 'Captcha action invalide' })
        }
        if (typeof verification?.score === 'number' && verification.score < minScore) {
          throw createError({ statusCode: 400, statusMessage: 'Captcha score insuffisant' })
        }
        if (expectedHost && verification?.hostname && verification.hostname !== expectedHost) {
          throw createError({ statusCode: 400, statusMessage: 'Captcha hostname invalide' })
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du captcha:', error)
        throw createError({
          statusCode: 400,
          statusMessage: 'Erreur lors de la vérification du captcha',
        })
      }
    }

    // Vérifier que le nom est fourni pour les utilisateurs non connectés (email optionnel)
    if (!name) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Le nom est requis pour les utilisateurs non connectés',
      })
    }
  }

  try {
    // Mapper les types du frontend vers les types de la DB
    const typeMapping: Record<string, FeedbackType> = {
      bug: 'BUG',
      feature: 'SUGGESTION',
      general: 'GENERAL',
      other: 'COMPLAINT',
    }
    
    const feedback = await prisma.feedback.create({
      data: {
        type: (typeMapping[type] || 'GENERAL') as FeedbackType,
        subject,
        message,
        email: isAuthenticated ? null : email,
        name: isAuthenticated ? null : name,
        userId: isAuthenticated ? user.id : null,
        userAgent: getHeader(event, 'user-agent'),
        url,
        resolved: false,
      },
      include: {
        user: isAuthenticated
          ? {
              select: { id: true, pseudo: true, email: true },
            }
          : false,
      },
    })

    return {
      success: true,
      message: 'Votre feedback a été envoyé avec succès. Merci pour votre contribution !',
      feedbackId: feedback.id,
    }
  } catch (error) {
    console.error('Erreur lors de la création du feedback:', error)
    throw createError({
      statusCode: 500,
      statusMessage: "Erreur lors de l'envoi du feedback",
    })
  }
})
