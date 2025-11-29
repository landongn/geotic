/**
 * Artifact Validator for Geotic ECS
 * Validates artifact integrity and structure
 */

import { calculateChecksum } from './SerializationHelpers.js';
import { CURRENT_SCHEMA_VERSION } from './constants.js';

export class ValidationError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'ValidationError';
        this.code = code;
    }
}

export class ArtifactValidator {
    constructor(engine, options = {}) {
        this.engine = engine;
        this.options = {
            validateChecksum: true,
            validateComponents: true,
            validateReferences: true,
            strictVersion: false,
            ...options,
        };
    }

    /**
     * Validate an artifact
     *
     * @param {Object} artifact - Artifact to validate
     * @throws {ValidationError} If validation fails
     */
    validate(artifact) {
        // Basic structure validation
        this._validateStructure(artifact);

        // Checksum validation
        if (this.options.validateChecksum && artifact.meta?.checksum) {
            this._validateChecksum(artifact);
        }

        // Schema version validation
        this._validateSchemaVersion(artifact);

        // Entity validation
        this._validateEntities(artifact);

        // Component validation
        if (this.options.validateComponents) {
            this._validateComponents(artifact);
        }

        // Reference validation
        if (this.options.validateReferences) {
            this._validateReferences(artifact);
        }
    }

    /**
     * Validate basic artifact structure
     *
     * @private
     * @param {Object} artifact - Artifact to validate
     */
    _validateStructure(artifact) {
        if (!artifact || typeof artifact !== 'object') {
            throw new ValidationError('Artifact must be an object', 'INVALID_STRUCTURE');
        }

        if (!Array.isArray(artifact.entities)) {
            throw new ValidationError('Artifact must have entities array', 'INVALID_STRUCTURE');
        }

        if (artifact.meta && typeof artifact.meta !== 'object') {
            throw new ValidationError('Artifact meta must be an object', 'INVALID_STRUCTURE');
        }
    }

    /**
     * Validate checksum
     *
     * @private
     * @param {Object} artifact - Artifact to validate
     */
    _validateChecksum(artifact) {
        const dataStr = JSON.stringify(artifact.entities);
        const calculatedChecksum = calculateChecksum(dataStr);

        if (calculatedChecksum !== artifact.meta.checksum) {
            throw new ValidationError(
                'Checksum mismatch - artifact may be corrupted',
                'CHECKSUM_MISMATCH'
            );
        }
    }

    /**
     * Validate schema version
     *
     * @private
     * @param {Object} artifact - Artifact to validate
     */
    _validateSchemaVersion(artifact) {
        const schemaVersion = artifact.meta?.schemaVersion ?? 0;

        if (this.options.strictVersion && schemaVersion !== CURRENT_SCHEMA_VERSION) {
            throw new ValidationError(
                `Schema version mismatch: expected ${CURRENT_SCHEMA_VERSION}, got ${schemaVersion}`,
                'VERSION_MISMATCH'
            );
        }

        if (schemaVersion > CURRENT_SCHEMA_VERSION) {
            throw new ValidationError(
                `Artifact schema version ${schemaVersion} is newer than supported version ${CURRENT_SCHEMA_VERSION}`,
                'VERSION_TOO_NEW'
            );
        }
    }

    /**
     * Validate entities array
     *
     * @private
     * @param {Object} artifact - Artifact to validate
     */
    _validateEntities(artifact) {
        const entityIds = new Set();

        for (const entity of artifact.entities) {
            // Check entity structure
            if (!entity || typeof entity !== 'object') {
                throw new ValidationError('Entity must be an object', 'INVALID_ENTITY');
            }

            // Check entity ID
            if (!entity.id) {
                throw new ValidationError('Entity must have an id', 'MISSING_ENTITY_ID');
            }

            // Check for duplicate IDs
            if (entityIds.has(entity.id)) {
                throw new ValidationError(
                    `Duplicate entity ID: ${entity.id}`,
                    'DUPLICATE_ENTITY_ID'
                );
            }

            entityIds.add(entity.id);
        }
    }

    /**
     * Validate components
     *
     * @private
     * @param {Object} artifact - Artifact to validate
     */
    _validateComponents(artifact) {
        for (const entity of artifact.entities) {
            const { id, ...components } = entity;

            for (const componentName in components) {
                // Check if component is registered
                const ComponentClass = this.engine._components.get(componentName);

                if (!ComponentClass) {
                    throw new ValidationError(
                        `Unknown component type: ${componentName}`,
                        'UNKNOWN_COMPONENT'
                    );
                }
            }
        }
    }

    /**
     * Validate entity references
     *
     * @private
     * @param {Object} artifact - Artifact to validate
     */
    _validateReferences(artifact) {
        // Build set of valid entity IDs
        const validIds = new Set(artifact.entities.map(e => e.id));

        // Check all references
        for (const entity of artifact.entities) {
            this._validateEntityReferences(entity, validIds);
        }
    }

    /**
     * Validate entity references within an entity
     *
     * @private
     * @param {Object} entity - Entity to validate
     * @param {Set} validIds - Set of valid entity IDs
     */
    _validateEntityReferences(entity, validIds) {
        const { id, ...components } = entity;

        for (const componentName in components) {
            this._validateValueReferences(components[componentName], validIds);
        }
    }

    /**
     * Recursively validate references in a value
     *
     * @private
     * @param {*} value - Value to validate
     * @param {Set} validIds - Set of valid entity IDs
     */
    _validateValueReferences(value, validIds) {
        // Check if value is a reference marker
        if (value && typeof value === 'object' && value.$ref) {
            if (!validIds.has(value.$ref)) {
                throw new ValidationError(
                    `Invalid entity reference: ${value.$ref}`,
                    'INVALID_REFERENCE'
                );
            }
            return;
        }

        // Handle arrays
        if (Array.isArray(value)) {
            value.forEach(item => this._validateValueReferences(item, validIds));
            return;
        }

        // Handle objects
        if (value && typeof value === 'object' && value.constructor === Object) {
            for (const key in value) {
                this._validateValueReferences(value[key], validIds);
            }
        }
    }
}
