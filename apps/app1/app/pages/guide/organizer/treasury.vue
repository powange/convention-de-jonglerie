<template>
  <div>
    <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
      {{ t('subtitle') }}
    </p>

    <div class="space-y-6">
      <GuideSection icon="i-heroicons-power" :title="t('sections.enable.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.enable.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.enable.module') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.enable.permission')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.enable.private') }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-chart-pie" :title="t('sections.overview.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.overview.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"
              ><strong>{{ t('sections.overview.expenses.label') }}</strong> —
              {{ t('sections.overview.expenses.desc') }}</span
            >
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"
              ><strong>{{ t('sections.overview.incomes.label') }}</strong> —
              {{ t('sections.overview.incomes.desc') }}</span
            >
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"
              ><strong>{{ t('sections.overview.balance.label') }}</strong> —
              {{ t('sections.overview.balance.desc') }}</span
            >
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400"
              ><strong>{{ t('sections.overview.reimburse.label') }}</strong> —
              {{ t('sections.overview.reimburse.desc') }}</span
            >
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-hashtag" :title="t('sections.codes.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.codes.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.codes.create') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.codes.free') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.codes.delete') }}</span>
          </li>
        </ul>
        <UAlert
          icon="i-heroicons-arrow-path"
          color="neutral"
          variant="subtle"
          :title="t('sections.codes.reuseTitle')"
          :description="t('sections.codes.reuseText')"
        />
      </GuideSection>

      <GuideSection
        icon="i-heroicons-pencil-square"
        :title="t('sections.entries.title')"
        color="blue"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.entries.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.entries.kind') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.entries.fields') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.entries.code') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.entries.receipt')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-clock" :title="t('sections.forecast.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.forecast.intro') }}</p>
        <UAlert
          icon="i-heroicons-scale"
          color="neutral"
          variant="subtle"
          :title="t('sections.forecast.balanceTitle')"
          :description="t('sections.forecast.balanceText')"
        />
      </GuideSection>

      <GuideSection icon="i-heroicons-banknotes" :title="t('sections.advances.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.advances.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.advances.who') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.advances.track') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.advances.mark') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.advances.expenseOnly')
            }}</span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection icon="i-heroicons-link" :title="t('sections.calculated.title')" color="blue">
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.calculated.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-star" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.calculated.artists')
            }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-ticket" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{
              t('sections.calculated.ticketing')
            }}</span>
          </li>
        </ul>
        <UAlert
          icon="i-heroicons-information-circle"
          color="info"
          variant="subtle"
          :title="t('sections.calculated.sourceTitle')"
          :description="t('sections.calculated.sourceText')"
        />
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.calculated.codes') }}</p>
      </GuideSection>

      <GuideSection
        icon="i-heroicons-document-arrow-down"
        :title="t('sections.export.title')"
        color="blue"
      >
        <p class="text-gray-600 dark:text-gray-400">{{ t('sections.export.intro') }}</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.export.stats') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.export.tables') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.export.columns') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-heroicons-check-circle" class="size-5 text-blue-500 mt-0.5 shrink-0" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('sections.export.noCode') }}</span>
          </li>
        </ul>
      </GuideSection>
    </div>
  </div>
</template>

<script setup lang="ts">
// Le guide est rédigé en français uniquement : ses libellés ne passent pas par i18n, sinon ils
// s'afficheraient sous forme de clés brutes pour les visiteurs dont l'interface est dans une
// autre langue. Ils sont définis ici et rendus tels quels. Cf. l'encart du layout, qui invite
// les non-francophones à utiliser la traduction intégrée de leur navigateur.
const messages = {
  title: 'Trésorerie',
  subtitle:
    'Tenez les charges et les produits de votre édition, et sortez-en un document comptable.',
  sections: {
    enable: {
      title: 'Ouvrir la trésorerie',
      intro:
        "La trésorerie est un module comme les autres : elle ne s'affiche que si vous l'activez, et ne s'ouvre qu'à qui vous en donnez le droit.",
      module:
        "Activez le module « Trésorerie » depuis les informations de l'édition, avec les autres modules.",
      permission:
        'Accordez le droit « Gérer la trésorerie » aux personnes concernées. Il existe au niveau de la convention — valable pour toutes les éditions, pratique pour un trésorier permanent — ou pour une seule édition.',
      private:
        "Aucun montant n'est public : la trésorerie n'est visible que de l'équipe d'organisation habilitée. Rien n'en apparaît sur la page de l'édition.",
    },
    overview: {
      title: 'Les chiffres de tête',
      intro: 'La page s’ouvre sur quatre indicateurs, qui donnent la situation en un coup d’œil.',
      expenses: {
        label: 'Charges',
        desc: 'le total des dépenses, avec la part déjà réglée indiquée en dessous.',
      },
      incomes: {
        label: 'Produits',
        desc: 'le total des recettes, réglées ou attendues, selon la même distinction.',
      },
      balance: {
        label: 'Solde',
        desc: "les produits moins les charges, réglés ou non. C'est le résultat de l'édition, indépendamment de ce qui a déjà circulé.",
      },
      reimburse: {
        label: 'À rembourser',
        desc: "ce que l'association doit aux personnes ayant avancé des frais de leur poche. Cliquez pour voir qui, et combien.",
      },
    },
    codes: {
      title: "Les codes d'imputation",
      intro:
        "Un code d'imputation range une dépense ou une recette dans une catégorie comptable. C'est lui qui permet de regrouper, de sous-totaliser, et de produire un document exploitable par un comptable.",
      create:
        'Créez vos codes depuis « Gérer les codes » : un code (par exemple 6257) et son libellé (Rémunérations d’intermédiaires).',
      free: "Le code et le libellé sont entièrement libres : rien ne présume d'un plan comptable national. Les définir une fois évite surtout la saisie ligne à ligne, qui produirait « 6257 » et « 6 257 » côte à côte sans regroupement possible.",
      delete:
        'Supprimer un code retire l’imputation des lignes concernées, sans jamais toucher à leur montant.',
      reuseTitle: 'Les codes appartiennent à la convention, pas à l’édition',
      reuseText:
        "Un plan comptable se réutilise d'une année sur l'autre : les codes créés pour une édition sont immédiatement disponibles pour les suivantes. Vous ne les ressaisissez pas chaque année, et les comparaisons d'une édition à l'autre restent possibles.",
    },
    entries: {
      title: 'Saisir une ligne',
      intro:
        "Les dépenses et recettes propres à l'édition se saisissent à la main, une ligne à la fois.",
      kind: 'Choisissez la nature — charge ou produit. Le montant se saisit toujours positif : c’est la nature qui porte le sens.',
      fields: 'Donnez un intitulé, et une description si la ligne mérite une explication.',
      code: "Rattachez la ligne à un code d'imputation. Une ligne sans code reste comptée : elle est simplement regroupée à part, sous « Sans imputation ».",
      receipt:
        "Joignez un justificatif — la photo du ticket de caisse ou de la facture, prise depuis le téléphone au moment de l'achat. C'est le moment où on l'a en main.",
    },
    forecast: {
      title: 'Engagé et réglé',
      intro:
        'Cocher « Prévisionnel » sur une ligne signale un montant attendu mais pas encore payé : une facture reçue, un cachet promis, une subvention annoncée.',
      balanceTitle: 'Ce que la case change, et ce qu’elle ne change pas',
      balanceText:
        "Le solde ne bouge pas : la dépense est engagée, elle compte. En revanche le « réglé » cesse de l'inclure. Vous lisez donc deux choses à la fois — où en est le résultat de l'édition, et combien est réellement sorti de la caisse à ce jour. Décochez la case une fois le paiement fait.",
    },
    advances: {
      title: 'Les avances de frais',
      intro:
        "Sur une convention, quelqu'un paie presque toujours de sa poche en attendant. La ligne peut porter cette information plutôt que de vivre dans un carnet à part.",
      who: 'Indiquez qui a avancé la dépense, en le cherchant parmi les personnes de l’édition.',
      track:
        "L'indicateur « À rembourser » de la page totalise ces avances par personne : vous savez à tout moment ce que l'association doit, et à qui.",
      mark: 'Marquez une avance comme remboursée une fois la personne remboursée.',
      expenseOnly:
        "L'avance n'a de sens que sur une charge : sur une recette, le champ reste sans effet.",
    },
    calculated: {
      title: 'Ce qui arrive tout seul',
      intro:
        'Deux modules alimentent la trésorerie sans que vous ayez à ressaisir quoi que ce soit :',
      artists: 'les artistes — cachets, défraiements de trajet et consommables ;',
      ticketing:
        'la billetterie — billets comptés comme participants (remboursements déduits), dons, et ventes annexes.',
      sourceTitle: 'Ces lignes ne sont pas recopiées, elles sont relues',
      sourceText:
        "Un montant corrigé chez l'artiste ou dans la billetterie se répercute immédiatement dans la trésorerie. C'est pourquoi on ne les modifie pas ici : le bouton « Ouvrir la source » vous emmène à l'endroit où la correction se fait. Une copie, elle, aurait exigé une resynchronisation et aurait fini par diverger en silence.",
      codes:
        "Vous choisissez en revanche le code d'imputation de chaque origine — un code pour l'ensemble des cachets, pas un par artiste, comme le ferait un comptable.",
    },
    export: {
      title: 'Exporter en PDF',
      intro:
        "Le bouton « Export PDF » produit un document à envoyer au trésorier, au comptable ou à présenter en assemblée générale — sans recopier l'écran dans un tableur.",
      stats:
        'Les chiffres clés ouvrent le document : charges, produits, solde, en réglé et en engagé.',
      tables:
        'Suivent deux tableaux, les charges puis les produits, regroupés par code avec un sous-total par code et un total général. La forme d’un compte de résultat.',
      columns:
        "Le code et son libellé occupent deux colonnes distinctes, et ne sont écrits que sur la première ligne de chaque groupe : c'est ce qui permet de trier, filtrer et recopier le document comme un document comptable.",
      noCode:
        'Les lignes sans code ferment la marche plutôt que d’être écartées — le total du document correspond ainsi toujours à celui de l’écran.',
    },
  },
}

const t = (path: string): string =>
  path.split('.').reduce<any>((value, key) => value?.[key], messages) ?? path

definePageMeta({ layout: 'guide', title: 'Guide - Trésorerie' })

useHead({
  title: 'Guide Trésorerie | Convention de Jonglerie',
  meta: [
    {
      name: 'description',
      content:
        "Guide organisateur : tenir la trésorerie d'une édition — codes d'imputation, charges et produits, montants engagés, avances de frais et export PDF.",
    },
  ],
})
</script>
