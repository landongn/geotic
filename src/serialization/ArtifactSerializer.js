/**
 * Artifact Serializer for Geotic ECS
 * Converts World + Entities into artifact format with metadata
 */

import { bigintReplacer, calculateChecksum } from './SerializationHelpers.js';
import { DEFAULT_SERIALIZE_OPTIONS, CURRENT_SCHEMA_VERSION, MARKERS } from './constants.js';
import { Entity } from '../Entity.js';
import { Component } from '../Component.js';

export class ArtifactSerializer {
    constructor(world, options = {}) {
        this.world = world;
        this.options = { ...DEFAULT_SERIALIZE_OPTIONS, ...options };
        this.referencedEntities = new Set();
        this.processedEntities = new Set();
    }

    /**
     * Serialize the world into an artifact
     *
     * @returns {Object} Artifact object
     */
    serialize() {
        // Reset reference tracking
        this.referencedEntities.clear();
        this.processedEntities.clear();

        // Collect entities to serialize
        let entities = this._collectEntities();

        // Mark initial entities as processed
        entities.forEach(e => this.processedEntities.add(e.id));

        // Serialize each entity
        const serializedEntities = entities.map(entity => this._serializeEntity(entity));

        // If resolveReferences is enabled, include referenced entities
        if (this.options.resolveReferences) {
            const additionalEntities = this._collectReferencedEntities();
            additionalEntities.forEach(entity => {
                serializedEntities.push(this._serializeEntity(entity));
            });
        }

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

        // Skip non-serializable entities
        if (!processedEntity.serializable) {
            return null;
        }

        // Manually serialize components to detect Entity references
        const data = { id: processedEntity.id };

        for (const key in processedEntity.components) {
            // Skip if in exclude list
            if (this.options.excludeComponents.includes(key)) {
                continue;
            }

            // Skip if onlyComponents is set and component not in list
            if (this.options.onlyComponents && !this.options.onlyComponents.includes(key)) {
                continue;
            }

            const componentValue = processedEntity.components[key];

            // Serialize component(s)
            if (componentValue instanceof Component) {
                data[key] = this._serializeComponent(componentValue);
            } else if (Array.isArray(componentValue)) {
                data[key] = componentValue.map(c => this._serializeComponent(c));
            } else if (componentValue && typeof componentValue === 'object') {
                // Keyed components
                const serialized = {};
                for (const k in componentValue) {
                    serialized[k] = this._serializeComponent(componentValue[k]);
                }
                data[key] = serialized;
            }
        }

        return data;
    }

    /**
     * Serialize a component, detecting and encoding entity references
     *
     * @private
     * @param {Component} component - Component to serialize
     * @returns {Object} Serialized component data
     */
    _serializeComponent(component) {
        const data = {};

        // Get component properties
        for (const key in component.constructor.properties) {
            const value = component[key];
            data[key] = this._encodeValue(value);
        }

        return data;
    }


    /**
     * Recursively encode a value, replacing Entity objects with references
     *
     * @private
     * @param {*} value - Value to encode
     * @returns {*} Encoded value
     */
    _encodeValue(value) {
        // Check if value is an Entity
        if (value instanceof Entity) {
            // Track this reference
            this.referencedEntities.add(value);

            // Return reference marker
            return { [MARKERS.ENTITY_REF]: value.id };
        }

        // Handle arrays
        if (Array.isArray(value)) {
            return value.map(item => this._encodeValue(item));
        }

        // Handle objects
        if (value && typeof value === 'object' && value.constructor === Object) {
            const encoded = {};
            for (const key in value) {
                encoded[key] = this._encodeValue(value[key]);
            }
            return encoded;
        }

        // Primitives and other types
        return value;
    }

    /**
     * Collect referenced entities that should be included
     *
     * @private
     * @returns {Array} Array of referenced entities
     */
    _collectReferencedEntities() {
        const toInclude = [];
        const visited = new Set(this.processedEntities);
        let depth = 0;

        // BFS to collect referenced entities up to maxDepth
        let currentLevel = Array.from(this.referencedEntities);

        while (currentLevel.length > 0 && depth < this.options.maxDepth) {
            const nextLevel = [];

            for (const entity of currentLevel) {
                if (visited.has(entity.id)) {
                    continue;
                }

                visited.add(entity.id);
                toInclude.push(entity);
                this.processedEntities.add(entity.id);

                // Find references in this entity
                const prevRefs = new Set(this.referencedEntities);
                this._serializeEntity(entity);

                // Add newly discovered references to next level
                for (const ref of this.referencedEntities) {
                    if (!prevRefs.has(ref) && !visited.has(ref.id)) {
                        nextLevel.push(ref);
                    }
                }
            }

            currentLevel = nextLevel;
            depth++;
        }

        return toInclude;
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
