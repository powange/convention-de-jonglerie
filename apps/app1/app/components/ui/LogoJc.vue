<template>
  <!-- Logo inline : les parties initialement noires utilisent currentColor pour s'adapter au mode sombre -->
  <svg
    :class="['block', $attrs.class]"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 7270 7270"
    role="img"
    :aria-label="$t('common.logo')"
    fill="none"
  >
    <defs>
      <mask id="logo-c-mask">
        <rect width="100%" height="100%" fill="white" />
        <circle cx="4813" cy="3500" r="1100" fill="black" />
        <polygon points="4813,3500 6900,2500 6900,4500" fill="black" />
      </mask>
      <clipPath id="logo-chevron-clip">
        <path
          d="M0,0 H7270 V7270 H0 Z M4813,1490 A2010,2010 0 1,1 4812,1490 Z"
          clip-rule="evenodd"
        />
      </clipPath>
    </defs>

    <!-- Partie rouge -->
    <g fill="#dd2e21">
      <circle cx="4926" cy="6309" r="713" />
      <circle cx="4813" cy="3500" r="1900" mask="url(#logo-c-mask)" />
    </g>
    <!-- Partie variable (currentColor pour dark mode) -->
    <g fill="currentColor">
      <path
        d="M 1460 5932 l 0 -412 43 6 c 60 9 298 -13 414 -36 246 -51 512 -167 728 -319 192 -135 400 -345 533 -539 l 50 -73 56 75 c 110 149 269 307 409 406 37 27 63 51 57 55 -6 3 -22 29 -36 57 -53 105 -330 407 -519 566 -107 90 -298 217 -450 300 -344 187 -729 292 -1167 318 l -118 7 0 -411 z"
        clip-path="url(#logo-chevron-clip)"
      />
      <path
        d="M 1350 5089 c -185 -18 -396 -94 -522 -187 -29 -21 -82 -70 -118 -109 -186 -199 -280 -498 -280 -893 l 0 -130 375 0 375 0 0 133 c 1 278 56 418 190 480 36 17 65 21 146 21 89 0 107 -3 157 -27 91 -45 134 -111 163 -248 12 -60 15 -226 16 -1020 l 1 -949 382 0 382 0 -3 943 c -1 642 -6 969 -14 1027 -68 501 -262 771 -648 900 -148 49 -425 76 -602 59 z"
      />
      <circle cx="1998" cy="1000" r="731" />
    </g>
  </svg>
</template>

<script setup lang="ts">
// Pas de logique nécessaire : la couleur est héritée via currentColor.
</script>

<style scoped>
/* Optionnel: assurer un rendu net */
svg {
  shape-rendering: geometricPrecision;
}
</style>
