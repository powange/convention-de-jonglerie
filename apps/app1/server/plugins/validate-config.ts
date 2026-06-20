import type { NitroApp } from 'nitropack'

/**
 * Plugin de validation de la configuration critique au démarrage du serveur.
 *
 * Empêche le démarrage de l'application si des variables d'environnement
 * critiques pour la sécurité sont absentes ou invalides.
 */
export default function validateConfigPlugin(_nitroApp: NitroApp) {
  const sessionPassword = process.env.NUXT_SESSION_PASSWORD

  if (!sessionPassword) {
    throw new Error(
      '[SECURITY] NUXT_SESSION_PASSWORD est requis. ' +
        "Cette variable est utilisée pour chiffrer les cookies de session et d'impersonation. " +
        'Générer une valeur avec : openssl rand -base64 32'
    )
  }

  if (sessionPassword.length < 32) {
    throw new Error(
      '[SECURITY] NUXT_SESSION_PASSWORD doit contenir au moins 32 caractères ' +
        `(${sessionPassword.length} fournis). ` +
        'Générer une valeur suffisamment longue avec : openssl rand -base64 32'
    )
  }
}
