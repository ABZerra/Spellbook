/**
 * @typedef {Object} Spell
 * @property {string} id
 * @property {string} name
 * @property {number} level
 * @property {string[]} tags
 */

/**
 * @typedef {'add' | 'remove' | 'replace'} ChangeType
 */

/**
 * @typedef {Object} PlannedChange
 * @property {ChangeType} type
 * @property {string} spellId
 * @property {string=} replacementSpellId
 * @property {string=} note
 */

/**
 * @typedef {Object} PendingPlan
 * @property {PlannedChange[]} changes
 */

/**
 * @typedef {Object} ApplyPlanResult
 * @property {string[]} nextPreparedSpellIds
 * @property {{ added: string[], removed: string[], replaced: Array<{from: string, to: string}> }} summary
 */

/**
 * @typedef {Object} LongRestSnapshot
 * @property {string} id
 * @property {string} appliedAt
 * @property {{ added: string[], removed: string[], replaced: Array<{from: string, to: string}> }} summary
 * @property {string[]} beforePreparedSpellIds
 * @property {string[]} afterPreparedSpellIds
 * @property {PlannedChange[]} appliedChanges
 */

/**
 * @typedef {Object} CharacterState
 * @property {'local-character'} id
 * @property {string} name
 * @property {string[]} activePreparedSpellIds
 * @property {PendingPlan} pendingPlan
 * @property {LongRestSnapshot[]} history
 */

/**
 * @typedef {Object} AppState
 * @property {1} schemaVersion
 * @property {string} updatedAt
 * @property {CharacterState} character
 */

export {};
