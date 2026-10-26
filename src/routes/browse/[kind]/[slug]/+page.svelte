<script lang="ts">
  import FacetLanding from '$lib/components/FacetLanding.svelte';

  let { data } = $props();
</script>

<FacetLanding
  kind={data.kind}
  meta={data.meta}
  item={data.item}
  documents={data.documents}
  siblings={data.siblings}
/>
