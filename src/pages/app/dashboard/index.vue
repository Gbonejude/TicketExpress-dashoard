<script setup>
definePage({
  meta: {
    action: 'read',
    subject: 'dashboard',
  },
})
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-column align-center justify-center text-center py-16">
        <VIcon
          icon="tabler-layout-dashboard"
          size="64"
          color="primary"
          class="mb-4"
        />
        <h1 class="text-h4 font-weight-medium">
          Dashboard de Ticket Express
        </h1>
      </VCardText>
    </VCard>
  </div>
</template>
