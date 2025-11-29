/**
 * Artifact Serializer for Geotic ECS
 * Converts World + Entities into artifact format with metadata
 */

import { bigintReplacer, calculateChecksum } from './SerializationHelpers.js';
import { DEFAULT_SERIALIZE_OPTIONS, CURRENT_SCHEMA_VERSION } from './constants.js';

export class ArtifactSerializer {
    constructor(world, options = {}) {
        this.world = world;
        this.options = { ...DEFAULT_SERIALIZE_OPTIONS, ...options };
    }

    /**
     * Serialize the world into an artifact
     *
     * @returns {Object} Artifact object
     */
    serialize() {
        // Collect entities to serialize
        const entities = this._collectEntities();

        // Serialize each entity
        const serializedEntities = entities.map(entity => this._serializeEntity(entity));

        // Build artifact
        const artifact = {
            entities: serializedEntities,
        };

        // Add metadata if requested
        if (this.options.includeMetadata) {
            artifact.meta = this._createMetadata();
        }

        // Calculate checksum if requested
        if (this.options.checksum && artifact.meta) {
            const dataStr = JSON.stringify(artifact.entities);
            artifact.meta.checksum = calculateChecksum(dataStr);
        }

        // Apply afterSerialize hook
        if (this.options.afterSerialize) {
            return this.options.afterSerialize(artifact);
        }

        return artifact;
    }

    /**
     * Collect entities to serialize based on options
     *
     * @private
     * @returns {Array} Array of entities
     */
    _collectEntities() {
        let entities;

        // Use provided entity list or all entities
        if (this.options.entities) {
            entities = this.options.entities;
        } else {
            entities = Array.from(this.world.getEntities());
        }

        // Filter by serializable flag if excludeTransient is true
        if (this.options.excludeTransient) {
            entities = entities.filter(e => e.serializable !== false);
        }

        // Apply custom filter function
        if (this.options.filter) {
            entities = entities.filter(this.options.filter);
        }

        return entities;
    }

    /**
     * Serialize a single entity
     *
     * @private
     * @param {Entity} entity - Entity to serialize
     * @returns {Object} Serialized entity data
     */
    _serializeEntity(entity) {
        // Apply beforeSerialize hook
        let processedEntity = entity;
        if (this.options.beforeSerialize) {
            processedEntity = this.options.beforeSerialize(entity);
        }

        // Get base serialization from entity
        const data = processedEntity.serialize();

        // Filter components if needed
        if (this.options.excludeComponents.length > 0 || this.options.onlyComponents) {
            data = this._filterComponents(data);
        }

        return data;
    }

    /**
     * Filter components based on include/exclude lists
     *
     * @private
     * @param {Object} entityData - Entity data with components
     * @returns {Object} Filtered entity data
     */
    _filterComponents(entityData) {
        const { id, ...components } = entityData;
        const filtered = { id };

        for (const componentName in components) {
            // Skip if in exclude list
            if (this.options.excludeComponents.includes(componentName)) {
                continue;
            }

            // Skip if onlyComponents is set and component not in list
            if (this.options.onlyComponents && !this.options.onlyComponents.includes(componentName)) {
                continue;
            }

            filtered[componentName] = components[componentName];
        }

        return filtered;
    }

    /**
     * Create metadata block for artifact
     *
     * @private
     * @returns {Object} Metadata object
     */
    _createMetadata() {
        return {
            version: '1.0.0',
            schemaVersion: this.options.schemaVersion,
            timestamp: Date.now(),
            gameVersion: this.options.gameVersion,
            ...this.options.metadata,
        };
    }

    /**
     * Convert artifact to JSON string
     *
     * @param {Object} artifact - Artifact object
     * @returns {string} JSON string
     */
    toJSON(artifact) {
        const indent = this.options.pretty ? 2 : undefined;
        return JSON.stringify(artifact, bigintReplacer, indent);
    }
}
