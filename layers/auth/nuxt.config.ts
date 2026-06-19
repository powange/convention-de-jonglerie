// Layer « auth » : pages + endpoints d'authentification (login, register, vérification email,
// réinitialisation de mot de passe, OAuth Google/Facebook). Les utils (auth-utils, emailService),
// le store, le middleware global et les modèles Prisma (User, PasswordResetToken) restent dans le
// cœur de l'app hôte et sont consommés via l'alias `#server` (ce qui rend le layer réutilisable :
// `#server` résout vers le serveur de l'app hôte — app1 aujourd'hui, app2 demain).
export default defineNuxtConfig({})
