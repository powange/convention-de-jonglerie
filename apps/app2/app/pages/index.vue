<template>
  <div>
    <!-- Accroche : ce que fait Flowvent, en une phrase, et un aperçu de l'événement « à la carte ». -->
    <UPageHero
      orientation="horizontal"
      headline="Le flow de vos événements"
      title="Tout votre événement, au même endroit."
      description="Bénévoles, billetterie, artistes, repas, matériel, trésorerie&nbsp;: Flowvent réunit les outils d'organisation de votre festival, de votre convention ou de votre rencontre associative. Vous n'activez que ceux dont vous avez besoin."
      :links="liensAccroche"
      :ui="{ headline: 'text-primary' }"
    >
      <!-- Aperçu décoratif : il illustre les modules qu'on allume, il ne se manipule pas. -->
      <UCard aria-hidden="true" class="shadow-xl ring-1 ring-default" :ui="{ body: 'space-y-3' }">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate font-semibold">Festival des arts de la rue</p>
            <p class="flex items-center gap-1 text-sm text-muted">
              <UIcon name="i-heroicons-calendar-days" /> 12 – 14 juillet
            </p>
          </div>
          <UBadge color="secondary" variant="subtle" label="3 organisateurs" class="shrink-0" />
        </div>
        <USeparator />
        <ul class="space-y-2">
          <li
            v-for="(module, i) in modules"
            :key="module.cle"
            class="flex items-center gap-3 rounded-md px-2 py-1.5"
            :class="i < MODULES_ALLUMES ? 'bg-elevated' : 'opacity-60'"
          >
            <UIcon :name="module.icone" class="size-5 shrink-0 text-primary" />
            <span class="flex-1 truncate text-sm">{{ module.libelle }}</span>
            <UBadge
              :color="i < MODULES_ALLUMES ? 'success' : 'neutral'"
              variant="subtle"
              size="sm"
              :label="i < MODULES_ALLUMES ? 'Activé' : 'Désactivé'"
            />
          </li>
        </ul>
      </UCard>
    </UPageHero>

    <!-- Les modules : lus dans le catalogue partagé, un module porté plus tard y apparaît seul. -->
    <UPageSection
      id="modules"
      headline="Les modules"
      title="Un outil par besoin, tous reliés"
      description="Chaque module se branche sur le même événement et les mêmes personnes&nbsp;: un bénévole retrouve ses créneaux, ses repas et son billet au même endroit."
    >
      <UPageGrid class="xl:grid-cols-4">
        <UPageCard
          v-for="module in modules"
          :key="module.cle"
          :icon="module.icone"
          :title="module.libelle"
          :description="presentation[module.cle]"
          spotlight
        />
        <UPageCard
          icon="i-heroicons-user-group"
          title="Co-organisateurs"
          description="Invitez votre équipe et donnez à chacun les droits de son domaine&nbsp;: la billetterie à l'une, le stock à l'autre."
          spotlight
        />
      </UPageGrid>
    </UPageSection>

    <!-- Le parcours, en quatre étapes. -->
    <UPageSection
      id="comment"
      headline="Comment ça marche"
      title="Prêt en quelques minutes"
      :ui="{ root: 'bg-elevated/50' }"
    >
      <ol class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="(etape, i) in etapes" :key="etape.titre" class="flex flex-col gap-3">
          <span
            class="flex size-10 items-center justify-center rounded-full bg-primary font-bold text-inverted"
          >
            {{ i + 1 }}
          </span>
          <h3 class="font-semibold text-highlighted">{{ etape.titre }}</h3>
          <p class="text-sm text-muted">{{ etape.description }}</p>
        </li>
      </ol>
    </UPageSection>

    <!-- Pourquoi Flowvent. -->
    <UPageSection
      headline="Pourquoi Flowvent"
      title="Pensé pour les équipes d'organisation"
      :features="atouts"
    />

    <!-- Dernier appel, avec l'abonnement en clair. -->
    <UPageSection :ui="{ container: 'pt-0 sm:pt-0 lg:pt-0' }">
      <UPageCTA
        variant="subtle"
        title="Lancez votre prochain événement"
        description="Le compte est gratuit, et la formule Découverte suffit pour un premier événement. Quand il grandit, les formules Association, Festival et Grand festival relèvent les plafonds de bénévoles, d'artistes et d'événements. Tous les modules sont compris dans chacune."
        :links="liensFinaux"
      />

      <UAlert
        class="mt-8"
        color="warning"
        variant="subtle"
        icon="i-heroicons-information-circle"
        title="Version de démonstration"
        description="Le paiement est simulé : aucun prestataire réel n'est appelé et aucune carte n'est demandée. L'abonnement s'active immédiatement."
      />
    </UPageSection>
  </div>
</template>

<script setup lang="ts">
import type { ButtonProps, PageFeatureProps } from '@nuxt/ui'

import { modulesDisponibles, type CleModule } from '#shared/modules-evenement'

// Connecté, on n'a rien à faire sur la vitrine : `guest-only` envoie au tableau de bord.
definePageMeta({ middleware: 'guest-only' })

useSeoMeta({
  title: "Flowvent — Organisation d'événements",
  description:
    "Bénévoles, billetterie, artistes, repas, stock et trésorerie\u00a0: tous les outils d'organisation de votre événement, au même endroit.",
})

const modules = modulesDisponibles()

/** Dans l'aperçu de l'accroche, les premiers modules sont allumés, les autres non. */
const MODULES_ALLUMES = 5

/*
 * Le catalogue décrit chaque module pour l'organisateur qui l'allume ; l'accueil le présente à
 * quelqu'un qui découvre Flowvent. `Record<CleModule, …>` : un module ajouté au catalogue fait
 * échouer le typage tant que sa présentation manque, au lieu d'afficher une carte vide.
 */
const presentation: Record<CleModule, string> = {
  benevoles:
    'Une page publique pour candidater, des équipes, un planning des créneaux, les échanges entre bénévoles et les rappels.',
  carte: 'Dessinez les zones et les repères du lieu, pour que chacun sache où aller.',
  stock: 'Inventaire du matériel, emplacements sur le site et suivi des prêts.',
  artistes:
    'Artistes invités, spectacles, appels à spectacles, et un espace où chaque artiste suit sa venue.',
  repas: 'Les repas des bénévoles, des artistes et des organisateurs, et leur validation.',
  billetterie: "Vos tarifs et commandes HelloAsso, et le contrôle des billets à l'entrée.",
  tresorerie: 'Dépenses, recettes et justificatifs, avec les montants de tous les modules.',
  faq: 'Les réponses aux questions que tout le monde pose, sur une page publique à partager.',
}

const liensAccroche: ButtonProps[] = [
  { label: 'Créer mon compte', to: '/login', size: 'xl', icon: 'i-heroicons-rocket-launch' },
  {
    label: 'Comment ça marche',
    to: '#comment',
    size: 'xl',
    color: 'neutral',
    variant: 'subtle',
    trailingIcon: 'i-heroicons-arrow-down',
  },
]

const liensFinaux: ButtonProps[] = [
  { label: 'Créer mon compte', to: '/login', icon: 'i-heroicons-rocket-launch' },
  {
    label: 'Voir les tarifs',
    to: '/pricing',
    color: 'neutral',
    variant: 'subtle',
    trailingIcon: 'i-heroicons-arrow-right',
  },
]

const etapes = [
  {
    titre: 'Créez votre compte',
    description: "Une adresse e-mail suffit, ou votre compte Google. C'est gratuit.",
  },
  {
    titre: 'Créez votre événement',
    description: 'Indiquez le nom, le lieu et les dates. La formule gratuite suffit pour démarrer.',
  },
  {
    titre: 'Activez vos modules',
    description: 'Allumez seulement ce qui vous sert. Désactiver un module ne supprime rien.',
  },
  {
    titre: 'Embarquez votre équipe',
    description:
      'Invitez vos co-organisateurs. Les bénévoles et les artistes vous rejoignent par la page publique.',
  },
]

const atouts: PageFeatureProps[] = [
  {
    icon: 'i-heroicons-squares-plus',
    title: 'À la carte',
    description:
      "Un petit événement n'a pas besoin de tout. Vous n'allumez que les modules utiles, sans que le prix change, et vous changez d'avis quand vous voulez.",
  },
  {
    icon: 'i-heroicons-link',
    title: 'Tout est relié',
    description:
      "Les modules partagent les mêmes personnes\u00a0: plus de tableurs à recopier d'un outil à l'autre.",
  },
  {
    icon: 'i-heroicons-shield-check',
    title: 'Des droits par domaine',
    description:
      'Chaque co-organisateur voit et modifie ce qui le concerne. Le propriétaire garde la main sur tout.',
  },
  {
    icon: 'i-heroicons-device-phone-mobile',
    title: 'Dans la poche',
    description:
      'Bénévoles et organisateurs consultent leur planning depuis leur téléphone, sur place.',
  },
  {
    icon: 'i-heroicons-globe-europe-africa',
    title: 'Au bon fuseau',
    description: "Les horaires suivent le fuseau de l'événement, où que se trouve votre équipe.",
  },
  {
    icon: 'i-heroicons-credit-card',
    title: 'Un prix à votre taille',
    description:
      "Tous les modules dans chaque formule, gratuit pour démarrer, puis dès 7 € par mois à l'année. Vos co-organisateurs n'ont pas besoin de leur propre abonnement.",
  },
]
</script>
