// Ported from the document-configuration-system's @operadic-wiki/graph-theory
// (worktrees/typed-anchor-zipper/docconfig-graph-theory/src/{types,navigation,camera}.ts,
// feature/local-surface-revisions-v1, 2026-09-22), trimmed to navigation and camera
// planning. Framework-free; same laws: keys emit directions, a strategy interprets
// them over the active projection's geometry, ties are deterministic, pointer focus
// never emits a camera goal, and zoom-center never zooms out.

export type Direction = 'west' | 'east' | 'north' | 'south'
export type StructuralMove = 'parent' | 'first-child' | 'previous' | 'next'
export type LayoutOrientation = 'left-to-right' | 'top-to-bottom'
export type NavigationStrategyId = 'spatial-v1' | 'structural-v1' | 'hybrid-tree-v1'
export type SpatialAlgorithmId = 'css-nav-grid-v1' | 'css-nav-normal-v1'
export type CameraFocusMode = 'zoom-center' | 'center' | 'reveal'

export interface GraphPoint { readonly x: number; readonly y: number }
export interface GraphRect extends GraphPoint { readonly width: number; readonly height: number }
export interface GraphGeometry { readonly rects: ReadonlyMap<string, GraphRect> }

export interface GraphNavigationConfig {
  readonly strategy: NavigationStrategyId
  readonly spatialAlgorithm: SpatialAlgorithmId
  readonly boundary: 'stop' | 'wrap'
  /** What previous/next mean structurally: siblings, or preorder. */
  readonly structuralSequence: 'siblings' | 'preorder'
  /**
   * hazel-gf addition. `center` (the original): a candidate is in the half-plane
   * if its centre is. `edge` (the W3C spatial-navigation rule): it must lie beyond
   * the current rectangle's edge — needed for nested phrase boxes, where a child's
   * centre can sit to the right of its parent's.
   */
  readonly halfPlane?: 'center' | 'edge'
}

export interface StructuralNavigationIndex {
  readonly roots: readonly string[]
  readonly focusable: ReadonlySet<string>
  readonly parent: ReadonlyMap<string, string>
  readonly firstChild: ReadonlyMap<string, string>
  readonly previousSibling: ReadonlyMap<string, string>
  readonly nextSibling: ReadonlyMap<string, string>
  readonly previous: ReadonlyMap<string, string>
  readonly next: ReadonlyMap<string, string>
}

export interface NavigationContext {
  readonly focusedId: string | null
  readonly structure: StructuralNavigationIndex
  readonly geometry: GraphGeometry
  readonly orientation: LayoutOrientation
}

export type NavigationIntent =
  | { readonly kind: 'direction'; readonly direction: Direction }
  | { readonly kind: 'structure'; readonly move: StructuralMove }

export interface NavigationDecision {
  readonly targetId: string
  readonly strategy: NavigationStrategyId
  readonly reason: 'spatial' | 'structural' | 'boundary-wrap'
  readonly score?: number
}

const center = (rect: GraphRect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })

function structuralMove(context: NavigationContext, move: StructuralMove, config: GraphNavigationConfig): string | null {
  const { structure, focusedId } = context
  if (!focusedId || !structure.focusable.has(focusedId)) return structure.roots[0] ?? null
  if (move === 'parent') return structure.parent.get(focusedId) ?? null
  if (move === 'first-child') return structure.firstChild.get(focusedId) ?? null
  const map = config.structuralSequence === 'siblings'
    ? move === 'previous' ? structure.previousSibling : structure.nextSibling
    : move === 'previous' ? structure.previous : structure.next
  return map.get(focusedId) ?? null
}

function directionalStructuralMove(direction: Direction, orientation: LayoutOrientation): StructuralMove {
  if (orientation === 'left-to-right') {
    return direction === 'west' ? 'parent' : direction === 'east' ? 'first-child' : direction === 'north' ? 'previous' : 'next'
  }
  return direction === 'north' ? 'parent' : direction === 'south' ? 'first-child' : direction === 'west' ? 'previous' : 'next'
}

function spatial(context: NavigationContext, direction: Direction, config: GraphNavigationConfig): NavigationDecision | null {
  const current = context.focusedId ?? context.structure.roots[0] ?? null
  const originRect = current ? context.geometry.rects.get(current) : null
  if (!current || !originRect) return null
  const origin = center(originRect)
  let best: NavigationDecision | null = null
  for (const id of context.structure.focusable) {
    if (id === current) continue
    const candidateRect = context.geometry.rects.get(id)
    if (!candidateRect) continue
    const candidate = center(candidateRect)
    const dx = candidate.x - origin.x
    const dy = candidate.y - origin.y
    const primary = direction === 'west' ? -dx : direction === 'east' ? dx : direction === 'north' ? -dy : dy
    if (primary <= 0) continue
    if (config.halfPlane === 'edge') {
      const beyond = direction === 'east' ? candidateRect.x >= originRect.x + originRect.width
        : direction === 'west' ? candidateRect.x + candidateRect.width <= originRect.x
          : direction === 'south' ? candidateRect.y >= originRect.y + originRect.height
            : candidateRect.y + candidateRect.height <= originRect.y
      if (!beyond) continue
    }
    const cross = direction === 'west' || direction === 'east' ? Math.abs(dy) : Math.abs(dx)
    const score = config.spatialAlgorithm === 'css-nav-grid-v1' ? primary + cross * 2 : Math.hypot(primary, cross) + cross * 0.25
    if (!best || score < (best.score ?? Infinity) || (score === best.score && id.localeCompare(best.targetId) < 0)) {
      best = { targetId: id, strategy: config.strategy, reason: 'spatial', score }
    }
  }
  if (best || config.boundary === 'stop') return best
  const candidates = [...context.structure.focusable].filter(id => id !== current && context.geometry.rects.has(id))
  if (!candidates.length) return null
  const axis = direction === 'west' || direction === 'east' ? 'x' : 'y'
  const targetId = candidates.sort((left, right) => {
    const a = center(context.geometry.rects.get(left)!)[axis]
    const b = center(context.geometry.rects.get(right)!)[axis]
    return (direction === 'west' || direction === 'north' ? b - a : a - b) || left.localeCompare(right)
  })[0]!
  return { targetId, strategy: config.strategy, reason: 'boundary-wrap' }
}

export function resolveNavigation(context: NavigationContext, intent: NavigationIntent, config: GraphNavigationConfig): NavigationDecision | null {
  if (intent.kind === 'structure') {
    const targetId = structuralMove(context, intent.move, config)
    return targetId ? { targetId, strategy: config.strategy, reason: 'structural' } : null
  }
  const topologyMove = directionalStructuralMove(intent.direction, context.orientation)
  if (config.strategy === 'structural-v1') {
    const targetId = structuralMove(context, topologyMove, config)
    return targetId ? { targetId, strategy: config.strategy, reason: 'structural' } : null
  }
  const constructionDirection = context.orientation === 'left-to-right'
    ? intent.direction === 'west' || intent.direction === 'east'
    : intent.direction === 'north' || intent.direction === 'south'
  if (config.strategy === 'hybrid-tree-v1' && constructionDirection) {
    const targetId = structuralMove(context, topologyMove, config)
    return targetId ? { targetId, strategy: config.strategy, reason: 'structural' } : null
  }
  return spatial(context, intent.direction, config)
}

/* ---------------- camera goals ---------------- */

export interface GraphViewportSnapshot { readonly x: number; readonly y: number; readonly zoom: number }
export interface GraphCameraConfig { readonly focusMode: CameraFocusMode; readonly focusZoom: number; readonly durationMs: number }
export type CameraGoal =
  | { readonly kind: 'center-node'; readonly nodeId: string; readonly minimumZoom?: number; readonly preserveHigherZoom: boolean; readonly durationMs: number }
  | { readonly kind: 'reveal-node'; readonly nodeId: string; readonly padding: number; readonly durationMs: number }

export function cameraGoalForNode(nodeId: string, config: GraphCameraConfig): CameraGoal {
  if (config.focusMode === 'reveal') return { kind: 'reveal-node', nodeId, padding: 24, durationMs: config.durationMs }
  return {
    kind: 'center-node', nodeId, minimumZoom: config.focusMode === 'zoom-center' ? config.focusZoom : undefined,
    preserveHigherZoom: true, durationMs: config.durationMs,
  }
}

/** Where the camera should go for a goal: centered on the node, never zooming out an enlarged view. */
export function cameraTarget(goal: CameraGoal, current: GraphViewportSnapshot, viewport: { width: number; height: number }, rect: GraphRect): GraphViewportSnapshot {
  if (goal.kind === 'reveal-node') {
    const shift = (start: number, end: number, extent: number) => {
      if (end - start > extent - goal.padding * 2) return extent / 2 - (start + end) / 2
      if (start < goal.padding) return goal.padding - start
      if (end > extent - goal.padding) return extent - goal.padding - end
      return 0
    }
    return {
      x: current.x + shift(current.x + rect.x * current.zoom, current.x + (rect.x + rect.width) * current.zoom, viewport.width),
      y: current.y + shift(current.y + rect.y * current.zoom, current.y + (rect.y + rect.height) * current.zoom, viewport.height),
      zoom: current.zoom,
    }
  }
  const zoom = goal.preserveHigherZoom ? Math.max(current.zoom, goal.minimumZoom ?? current.zoom) : goal.minimumZoom ?? current.zoom
  return { x: viewport.width / 2 - zoom * (rect.x + rect.width / 2), y: viewport.height / 2 - zoom * (rect.y + rect.height / 2), zoom }
}

/** docconfig's "spatial document" camera default: zoom-center, floor 1.05, 160 ms. */
export const DEFAULT_CAMERA: GraphCameraConfig = { focusMode: 'zoom-center', focusZoom: 1.05, durationMs: 160 }
