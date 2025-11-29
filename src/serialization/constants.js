/**
 * Constants for serialization system
 */

/**
 * Current schema version for artifact format
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Legacy schema version (pre-versioning system)
 */
export const LEGACY_SCHEMA_VERSION = 0;

/**
 * Special markers for encoded values
 */
export const MARKERS = {
    ENTITY_REF: '$ref',
    BIGINT: '$bigint',
    DATE: '$date',
};

/**
 * Default options for serialization
 */
export const DEFAULT_SERIALIZE_OPTIONS = {
    // Format options
    format: 'json',
    pretty: false,

    // Content options
    includeMetadata: true,
    includeComponentRegistry: false,
    includeWorldState: false,

    // Entity filtering
    entities: null,              // Array of entities or null for all
    filter: null,                // Function: (entity) => boolean
    excludeTransient: true,      // Skip entities with serializable=false

    // Component filtering
    excludeComponents: [],       // Array of component names to skip
    onlyComponents: null,        // Array of component names (null = all)

    // Reference handling
    resolveReferences: false,    // Auto-include referenced entities
    maxDepth: 3,                 // Max reference traversal depth
    danglingRefs: 'null',        // 'null' | 'throw' | 'warn' | 'skip'

    // Performance
    validate: true,              // Validate component schemas
    checksum: false,             // Calculate integrity checksum

    // Versioning
    schemaVersion: CURRENT_SCHEMA_VERSION,
    gameVersion: null,
    metadata: {},

    // Hooks
    beforeSerialize: null,       // (entity) => entity
    afterSerialize: null,        // (artifact) => artifact
};

/**
 * Default options for deserialization
 */
export const DEFAULT_DESERIALIZE_OPTIONS = {
    // Validation
    validate: true,              // Validate artifact before loading
    strictValidation: false,     // Throw on validation errors vs. warn

    // Migration
    autoMigrate: true,           // Automatically migrate old schemas

    // Reference handling
    danglingRefs: 'null',        // How to handle missing entity references

    // Hooks
    beforeDeserialize: null,     // (artifact) => artifact
    afterDeserialize: null,      // (entity) => entity
};
