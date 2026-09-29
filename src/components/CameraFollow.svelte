<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte'
  import { DEFAULT_CAMERA, cameraGoalForNode, cameraTarget } from '../lib/nav/graph-theory'

  /**
   * The camera follows keyboard focus only (docconfig graph-interaction theory §4):
   * each keyboard move bumps `request.seq`; pointer clicks never do. The goal is
   * zoom-center with a 1.05 floor that never zooms out an already enlarged view.
   */
  let { request, width, height, fitSeq }: {
    request: { nodeId: string; seq: number } | undefined
    width: number
    height: number
    fitSeq: number
  } = $props()
  const flow = useSvelteFlow()
  let handled = 0
  let fitted = 0

  $effect(() => {
    if (!request || request.seq === handled || !width || !height) return
    handled = request.seq
    const node = flow.getNode(request.nodeId)
    if (!node) return
    const rect = { x: node.position.x, y: node.position.y, width: node.measured?.width ?? 188, height: node.measured?.height ?? 92 }
    const goal = cameraGoalForNode(request.nodeId, DEFAULT_CAMERA)
    void flow.setViewport(cameraTarget(goal, flow.getViewport(), { width, height }, rect), { duration: goal.durationMs })
  })

  $effect(() => {
    if (fitSeq === fitted) return
    fitted = fitSeq
    void flow.fitView({ padding: 0.12, duration: 160 })
  })
</script>
