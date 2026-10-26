<script lang="ts">
  import FacetIndex from '$lib/components/FacetIndex.svelte';

  let { data } = $props();
</script>

<FacetIndex kind={data.kind} meta={data.meta} items={data.items} />
