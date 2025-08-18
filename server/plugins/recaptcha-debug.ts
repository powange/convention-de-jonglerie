export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  // Log minimal pour diagnostiquer l’injection des vars au run
  console.log('[recaptcha-debug] public.siteKey:', Boolean(config.public?.recaptchaSiteKey), '| secret set:', Boolean(config.recaptchaSecretKey))
})
