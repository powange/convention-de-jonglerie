export default defineNuxtPlugin(() => {
  // Évalué au runtime du serveur (pas au build), donc NUXT_ENV est disponible
  // Production réelle = NODE_ENV=production SANS NUXT_ENV
  // Release/staging = NODE_ENV=production AVEC NUXT_ENV='release'/'staging'
  const isRealProduction = process.env.NODE_ENV === 'production' && !process.env.NUXT_ENV

  useState('isRealProduction', () => isRealProduction)
})
