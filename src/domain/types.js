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
 * @property {string} characterId
 * @property {PlannedChange[]} changes
 */

/**
 * @typedef {Object} ApplyPlanResult
 * @property {string[]} nextPreparedSpellIds
 * @property {{ added: string[], removed: string[], replaced: Array<{from: string, to: string}> }} summary
 */

export {};
