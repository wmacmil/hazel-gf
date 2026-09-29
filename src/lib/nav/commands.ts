// Keys are presentation; commands are meaning. Modelled on the
// document-configuration-system's docconfig-commands: bindings are keyed
// `context.key`, context bindings win over global ones, resolution is
// stateless, and the app maps command ids to actions in one adapter.
//
// Two focus regions share one focused node, so both trees always move
// together: `tree` is the SvelteFlow operad, `sentence` is the text with its
// phrase-box tree below. hjkl moves in the active region's tree, interpreted
// over that region's geometry; s/d always moves side to side along the
// sentence (a lane, like docconfig's s/d formula lane) and never changes
// tree traversal.

export type Region = 'tree' | 'sentence'
export type CommandContext = Region | 'global'

export const COMMANDS = {
  'region.toggle': 'Switch focus between the tree and the sentence',
  'nav.west': 'Move left in the active tree',
  'nav.east': 'Move right in the active tree',
  'nav.north': 'Move up in the active tree (towards the root)',
  'nav.south': 'Move down in the active tree (towards the leaves)',
  'nav.parent': 'Parent (structural, any layout)',
  'nav.first-child': 'First child (structural, any layout)',
  'nav.previous': 'Previous sibling (structural)',
  'nav.next': 'Next sibling (structural)',
  'word.previous': 'Previous word in the sentence',
  'word.next': 'Next word in the sentence',
  'language.previous': 'Previous language row',
  'language.next': 'Next language row',
  'camera.fit': 'Fit the whole tree in view',
} as const
export type CommandId = keyof typeof COMMANDS

export type KeyProfile = { id: string; label: string; bindings: Record<string, CommandId> }

const directional = (prefix: string, keys: [string, string, string, string]): Record<string, CommandId> => ({
  [`${prefix}.${keys[0]}`]: 'nav.west', [`${prefix}.${keys[1]}`]: 'nav.south',
  [`${prefix}.${keys[2]}`]: 'nav.north', [`${prefix}.${keys[3]}`]: 'nav.east',
})

export const PROFILES: Record<string, KeyProfile> = {
  vim: {
    id: 'vim',
    label: 'vim (hjkl · s/d)',
    bindings: {
      'global.Tab': 'region.toggle',
      ...directional('global', ['h', 'j', 'k', 'l']),
      ...directional('global', ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight']),
      'global.Alt-h': 'nav.parent', 'global.Alt-l': 'nav.first-child',
      'global.Alt-k': 'nav.previous', 'global.Alt-j': 'nav.next',
      'global.s': 'word.previous', 'global.d': 'word.next',
      'global.[': 'language.previous', 'global.]': 'language.next',
      'global.=': 'camera.fit',
    },
  },
}

/** Canonical key spec: modifiers in a fixed order, then the key. */
export function keySpecOf(event: { key: string; code?: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }): string {
  // Alt changes the produced character on macOS (Alt-h → ˙); read the physical letter instead.
  const key = event.altKey && event.code?.startsWith('Key') ? event.code.slice(3).toLowerCase() : event.key
  return `${event.ctrlKey ? 'Ctrl-' : ''}${event.altKey ? 'Alt-' : ''}${event.metaKey ? 'Meta-' : ''}${key}`
}

export function resolveKey(profile: KeyProfile, context: Region, spec: string): CommandId | null {
  return profile.bindings[`${context}.${spec}`] ?? profile.bindings[`global.${spec}`] ?? null
}

/** Every binding targets a known command in a known context. */
export function validateProfile(profile: KeyProfile): string[] {
  return Object.entries(profile.bindings).flatMap(([slot, command]) => {
    const context = slot.split('.')[0]
    const errors: string[] = []
    if (!['global', 'tree', 'sentence'].includes(context)) errors.push(`${slot}: unknown context`)
    if (!(command in COMMANDS)) errors.push(`${slot}: unknown command ${command}`)
    return errors
  })
}
