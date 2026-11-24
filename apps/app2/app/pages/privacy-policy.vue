<template>
  <UContainer class="max-w-4xl py-8">
    <h1 class="mb-8 text-3xl font-bold">Politique de confidentialité</h1>

    <p>
      Cette page explique quelles données Flowvent recueille, pourquoi, combien de temps elles sont
      conservées et comment exercer vos droits. Elle décrit ce que l'application fait réellement :
      si son fonctionnement change, cette page change avec lui.
    </p>

    <section v-for="section in sections" :id="section.id" :key="section.id" class="mt-8">
      <h2 class="mb-4 text-2xl font-semibold">{{ section.titre }}</h2>
      <p v-for="(paragraphe, i) in section.paragraphes" :key="`p-${i}`" class="mt-3">
        {{ paragraphe }}
      </p>
      <ul v-if="section.liste" class="mt-3 ml-4 list-disc space-y-2 pl-4">
        <li v-for="(element, i) in section.liste" :key="`l-${i}`">
          <span v-if="element.libelle" class="font-medium">{{ element.libelle }} : </span>
          {{ element.texte }}
        </li>
      </ul>
    </section>

    <section id="contact" class="mt-8">
      <h2 class="mb-4 text-2xl font-semibold">11. Contact</h2>
      <p>
        Pour toute question concernant cette politique ou pour exercer vos droits, vous pouvez nous
        contacter à :
      </p>
      <p class="mt-2 font-medium">
        E-mail :
        <ULink :to="`mailto:${adresseDeContact}`" class="underline">{{ adresseDeContact }}</ULink>
      </p>
    </section>

    <USeparator class="mt-8" />
    <p class="mt-8 text-sm text-muted">Dernière mise à jour : {{ derniereMiseAJour }}</p>
  </UContainer>
</template>

<script setup lang="ts">
// ⚠️ Cette page doit rester VRAIE. Elle est exigée par Google et Meta pour la connexion OAuth, et
// opposable au titre du RGPD : toute donnée, tout cookie ou tout prestataire ajouté à l'application
// doit y être reporté. Chaque affirmation ci-dessous a été vérifiée dans le code (schéma Prisma,
// gestionnaires du layer `layers/auth`, cookies posés) au moment de l'écrire.

// Adresse lue de la configuration (NUXT_PUBLIC_CONTACT_EMAIL), comme dans app1.
const adresseDeContact = useRuntimeConfig().public.contactEmail as string
const contact = adresseDeContact
const derniereMiseAJour = '24 novembre 2026'

interface Section {
  id: string
  titre: string
  paragraphes?: string[]
  liste?: { libelle?: string; texte: string }[]
}

const sections: Section[] = [
  {
    id: 'responsable',
    titre: '1. Responsable du traitement',
    paragraphes: [
      `Le responsable du traitement est Flowvent, joignable à l'adresse ${contact}.`,
      "Le service est hébergé sur un serveur situé en France, exploité par l'éditeur de Flowvent.",
    ],
  },
  {
    id: 'donnees',
    titre: '2. Données recueillies',
    liste: [
      {
        libelle: 'Votre compte',
        texte:
          "adresse e-mail, pseudo, prénom et nom, et votre mot de passe sous forme chiffrée (haché) : il n'est jamais conservé en clair.",
      },
      {
        libelle: 'Connexion avec Google ou Facebook',
        texte:
          "si vous choisissez ce mode de connexion, nous recevons de ce service votre identifiant chez lui, votre adresse e-mail, votre nom et votre photo de profil. Nous ne recevons jamais votre mot de passe Google ou Facebook, et nous n'accédons ni à vos contacts ni à vos publications.",
      },
      {
        libelle: 'Vos événements',
        texte:
          'les informations que vous saisissez pour organiser un événement : nom, description, lieu et date.',
      },
      {
        libelle: 'Votre abonnement',
        texte:
          "la formule choisie, son statut et sa date d'échéance. Le paiement est actuellement simulé : aucune donnée bancaire n'est demandée ni conservée.",
      },
      {
        libelle: 'Données techniques',
        texte:
          "la date de votre dernière connexion ; les codes de vérification d'adresse (valables 15 minutes) et les liens de réinitialisation de mot de passe (valables 1 heure) ; votre adresse IP, utilisée en mémoire pour limiter les tentatives de connexion répétées, sans être enregistrée en base.",
      },
    ],
  },
  {
    id: 'finalites',
    titre: '3. Pourquoi nous les utilisons',
    liste: [
      {
        texte:
          'Créer et gérer votre compte, vous permettre de vous connecter et de gérer vos événements et votre abonnement — base légale : exécution du service que vous demandez.',
      },
      {
        texte:
          "Vérifier votre adresse e-mail, protéger les comptes contre les tentatives d'intrusion et prévenir les abus — base légale : notre intérêt légitime à assurer la sécurité du service.",
      },
    ],
    paragraphes: [
      "Vos données ne sont ni vendues, ni louées, ni utilisées à des fins publicitaires. Flowvent n'utilise aucun outil de mesure d'audience ni de publicité.",
    ],
  },
  {
    id: 'cookies',
    titre: '4. Cookies et stockage dans votre navigateur',
    paragraphes: [
      "Flowvent n'utilise que des cookies strictement nécessaires à son fonctionnement ; ils ne requièrent donc pas votre consentement.",
    ],
    liste: [
      {
        libelle: 'Cookie de session',
        texte:
          'chiffré, il vous garde connecté. Il expire au bout de 30 jours, ou dès que vous vous déconnectez.',
      },
      {
        libelle: 'Cookies de connexion Google ou Facebook',
        texte:
          'temporaires (10 minutes au plus), ils protègent la connexion contre la falsification et vous ramènent à la page de départ.',
      },
      {
        libelle: 'Préférence de thème',
        texte:
          'votre choix entre mode clair et mode sombre est enregistré dans votre navigateur, jamais transmis à nos serveurs.',
      },
    ],
  },
  {
    id: 'destinataires',
    titre: '5. Qui y a accès',
    liste: [
      {
        libelle: "L'éditeur de Flowvent",
        texte: 'seul, pour faire fonctionner le service et répondre à vos demandes.',
      },
      {
        libelle: 'Cloudflare',
        texte:
          'intermédiaire réseau entre votre navigateur et notre serveur, pour la sécurité et la disponibilité du site. Il voit passer les requêtes, et donc votre adresse IP. Cloudflare peut traiter ces données hors de l’Union européenne, dans le cadre des garanties prévues par le RGPD (Data Privacy Framework et clauses contractuelles types).',
      },
      {
        libelle: 'Google ou Meta (Facebook)',
        texte:
          'uniquement si vous choisissez de vous connecter avec leur service : la connexion se fait alors chez eux, selon leurs propres règles de confidentialité.',
      },
    ],
  },
  {
    id: 'conservation',
    titre: '6. Durée de conservation',
    paragraphes: [
      'Les données de votre compte, de vos événements et de votre abonnement sont conservées tant que votre compte existe, et supprimées lorsque vous en demandez la suppression.',
      'Les codes de vérification et les liens de réinitialisation cessent de fonctionner après 15 minutes et 1 heure respectivement.',
    ],
  },
  {
    id: 'droits',
    titre: '7. Vos droits',
    paragraphes: [
      `Conformément au RGPD, vous pouvez accéder à vos données, les faire rectifier ou effacer, en limiter le traitement, vous y opposer, et en obtenir une copie dans un format réutilisable. Pour exercer l'un de ces droits, écrivez à ${contact} depuis l'adresse de votre compte.`,
      'Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (www.cnil.fr).',
    ],
  },
  {
    id: 'suppression',
    titre: '8. Supprimer votre compte et vos données',
    paragraphes: [
      `Pour supprimer votre compte, écrivez à ${contact} depuis l'adresse e-mail de votre compte, en indiquant « Suppression de compte ». Votre compte, vos événements et votre abonnement sont alors effacés définitivement, dans un délai de 30 jours au plus, et nous vous confirmons la suppression par e-mail.`,
      'Si vous vous êtes connecté avec Facebook, vous pouvez aussi retirer l’accès de Flowvent depuis Facebook : Paramètres et confidentialité → Paramètres → Applications et sites web → Flowvent → Supprimer. Faites ensuite la demande ci-dessus pour que vos données soient effacées de nos serveurs.',
    ],
  },
  {
    id: 'securite',
    titre: '9. Sécurité des données',
    paragraphes: [
      "Les échanges avec le site sont chiffrés (HTTPS), les mots de passe sont stockés hachés, la session est un cookie chiffré, et la base de données n'est pas exposée sur Internet. Les tentatives de connexion répétées sont limitées.",
    ],
  },
  {
    id: 'modifications',
    titre: '10. Modifications de la politique',
    paragraphes: [
      'Cette politique peut être mise à jour, notamment quand le service évolue. La date de dernière mise à jour figure en bas de page ; en cas de modification substantielle, nous vous en informerons sur le site.',
    ],
  },
]

useSeoMeta({
  title: 'Politique de confidentialité — Flowvent',
  description:
    'Données recueillies par Flowvent, finalités, cookies, durée de conservation et exercice de vos droits.',
  robots: 'index, follow',
})
</script>
