<template>
  <svg
    :width="taille"
    :height="taille"
    viewBox="0 0 100 100"
    :aria-hidden="libelle ? undefined : 'true'"
    :role="libelle ? 'img' : undefined"
    :aria-label="libelle || undefined"
    class="shrink-0"
  >
    <defs>
      <!--
        ⚠️ UN IDENTIFIANT UNIQUE PAR INSTANCE. Un `id` figé ferait que trois balles sur la même page
        partageraient un seul dégradé : le navigateur résout `url(#…)` sur le PREMIER qu'il trouve,
        et les suivantes hériteraient de son éclairage — ou disparaîtraient si celle qui le porte
        venait à être démontée.
      -->
      <radialGradient :id="idVolume" cx="33%" cy="27%" r="80%">
        <!-- Le volume en trois temps : la lumière en haut à gauche, un ventre neutre, et
             l'assombrissement du bord qui fait la rondeur. -->
        <stop offset="0%" stop-color="#fff" stop-opacity="0.45" />
        <stop offset="42%" stop-color="#fff" stop-opacity="0" />
        <stop offset="100%" stop-color="#000" stop-opacity="0.42" />
      </radialGradient>
    </defs>

    <circle cx="50" cy="50" r="48" :fill="couleurA" />

    <!--
      LE PANNEAU CENTRAL, et c'est lui qui fait la balle de JONGLERIE plutôt qu'une bille.

      Deux arcs d'ellipse de même rayon tracés en sens inverse forment une lentille : c'est la
      projection d'un fuseau sphérique, soit exactement ce que donnent deux coutures de part et
      d'autre de la balle. `rx` vaut un peu plus de la moitié de `ry` — au-delà le panneau mange la
      sphère, en deçà il s'affine en amande.
    -->
    <path d="M 50 2 A 26 48 0 0 1 50 98 A 26 48 0 0 1 50 2 Z" :fill="couleurB" />

    <!-- Les coutures : un trait sombre et discret, qui marque le relief sans dessiner un contour. -->
    <path
      d="M 50 2 A 26 48 0 0 1 50 98 M 50 2 A 26 48 0 0 0 50 98"
      fill="none"
      stroke="#000"
      stroke-width="1.2"
      opacity="0.28"
    />

    <!-- Le dégradé par-dessus les panneaux, et non dessous : il doit les OMBRER, pas être couvert
         par eux. C'est ce qui empêche la balle de paraître plate. -->
    <circle cx="50" cy="50" r="48" :fill="`url(#${idVolume})`" />

    <!-- Le reflet spéculaire, incliné pour ne pas ressembler à une tache. -->
    <ellipse
      cx="33"
      cy="28"
      rx="12"
      ry="8"
      fill="#fff"
      opacity="0.4"
      transform="rotate(-30 33 28)"
    />
  </svg>
</template>

<script setup lang="ts">
/**
 * Une balle de jonglerie, dessinée en SVG.
 *
 * ## Pourquoi un composant et non une icône
 *
 * Le dépôt impose Nuxt Icon pour les ICÔNES, et interdit d'importer des SVG pour cet usage. Ici il
 * ne s'agit pas d'une icône d'interface mais d'une illustration : deux panneaux colorés, un volume
 * et un reflet, dont les couleurs se règlent à l'appel. Aucune bibliothèque d'icônes ne rend ça.
 *
 * ## Ce qui a été éprouvé
 *
 * Quatre dessins ont été rendus dans un navigateur et REGARDÉS avant de choisir : une sphère lisse
 * manquait de « jonglerie », un découpage en quartiers paraissait de travers, et un parallèle
 * ajouté en faisait une planète. Celui-ci garde les panneaux — ce qui la rend reconnaissable — et
 * leur ajoute l'ombrage qui lui donne du volume.
 *
 * Vérifié aussi sur fond clair comme sur fond sombre, et **jusqu'à 24 px** : à cette taille les
 * coutures disparaissent mais les deux couleurs tiennent, et la forme se lit encore.
 */
withDefaults(
  defineProps<{
    /** Côté du carré, en pixels. En dessous de 24, les coutures ne se distinguent plus. */
    taille?: number
    /** La couleur des deux panneaux latéraux. */
    couleurA?: string
    /** Celle du panneau central. */
    couleurB?: string
    /**
     * Le nom à annoncer. VIDE PAR DÉFAUT : une balle d'easter egg est décorative, et un lecteur
     * d'écran n'a pas à l'énumérer. Le renseigner la rend annonçable quand elle porte un sens.
     */
    libelle?: string
  }>(),
  {
    taille: 48,
    couleurA: '#e11d48',
    couleurB: '#fbbf24',
    libelle: '',
  }
)

/** Un identifiant stable et unique, y compris au rendu serveur. Voir la note dans `<defs>`. */
const idVolume = `balle-volume-${useId()}`
</script>
