<script lang="ts">
  import { useNodesInitialized, useSvelteFlow } from '@xyflow/svelte'

  /** Re-fit the viewport once cards are measured, and again whenever `key` (the tree) changes. */
  let { key }: { key: string } = $props()
  const { fitView } = useSvelteFlow()
  const initialized = useNodesInitialized()

  $effect(() => {
    void key
    // Two frames: the rebuilt nodes are measured before the viewport is fitted.
    if (initialized.current) requestAnimationFrame(() => requestAnimationFrame(() => fitView({ padding: 0.12, duration: 150 })))
  })
</script>
