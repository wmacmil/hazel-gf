<script lang="ts">
  import { useNodesInitialized, useSvelteFlow } from '@xyflow/svelte'
  import { FLOW_MIN_ZOOM } from '../lib/layout'

  /**
   * Fit the scene on entry and when a different tree is loaded (`key` = the root's id),
   * never on selection, hover, or pointer focus: the camera follows keyboard focus only
   * (docconfig graph-interaction theory §4). Clicking a node used to re-fit, because
   * selecting it re-evaluated `initialized` and re-ran this effect.
   */
  let { key }: { key: string } = $props()
  const { fitView } = useSvelteFlow()
  const initialized = useNodesInitialized()
  let fitted: string | undefined

  $effect(() => {
    const current = key
    if (!initialized.current || current === fitted) return
    fitted = current
    // Two frames: the rebuilt nodes are measured before the viewport is fitted.
    // Never below FLOW_MIN_ZOOM: a large tree overflows and is panned (the camera follows keys) rather than shrunk illegible.
    requestAnimationFrame(() => requestAnimationFrame(() => fitView({ padding: 0.12, duration: 150, minZoom: FLOW_MIN_ZOOM })))
  })
</script>
