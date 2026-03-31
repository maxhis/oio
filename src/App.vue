<script setup lang="ts">
import { RouterView } from "vue-router";

import { useDocumentMeta } from "./composables/useDocumentMeta";

useDocumentMeta();
</script>

<template>
  <RouterView />
</template>
