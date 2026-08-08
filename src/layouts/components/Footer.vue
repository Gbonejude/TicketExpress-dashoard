<template>
  <div class="h-100 d-flex align-center justify-md-space-between justify-center">
    <!-- 👉 Footer: left content -->
    <!--
      « Conçu avec ❤️ par » plutôt que « Made With ❤️ By » : c'était la dernière
      phrase anglaise d'une interface entièrement en français, et elle se lisait
      en bas de chaque écran.
    -->
    <span class="d-flex align-center text-medium-emphasis">
      &copy;
      {{ new Date().getFullYear() }}
      &middot;
      Conçu avec
      <VIcon
        icon="tabler-heart-filled"
        color="error"
        size="1.25rem"
        class="mx-1"
      />
      par <span class="text-primary ms-1">Ticket Express</span>
    </span>
  </div>
</template>
