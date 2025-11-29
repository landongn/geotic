/**
 * Artifact Deserializer for Geotic ECS
 * Converts artifact format back into World + Entities
 */

import { bigintReviver } from './SerializationHelpers.js';
import { DEFAULT_DESERIALIZE_OPTIONS } from './constants.js';
import { camelString } from '../util/string-util.js';

export class ArtifactDeserializer {
    constructor(world, options = {}) {
        this.world = world;
        this.options = { ...DEFAULT_DESERIALIZE_OPTIONS, ...options };
    }

    /**
     * Deserialize an artifact into the world
     *
     * @param {Object} artifact - Artifact object to deserialize
     * @returns {Array} Array of created entities
     */
    deserialize(artifact) {
        // Apply beforeDeserialize hook
        let processedArtifact = artifact;
        if (this.options.beforeDeserialize) {
            processedArtifact = this.options.beforeDeserialize(artifact);
        }

        // Extract entities data
        const entitiesData = processedArtifact.entities || [];

        // Two-pass deserialization:
        // Pass 1: Create all entities with IDs
        const entities = this._createEntities(entitiesData);

        // Pass 2: Add components to each entity
        this._addComponents(entitiesData, entities);

        // Apply afterDeserialize hook to each entity
        if (this.options.afterDeserialize) {
            entities.forEach(entity => {
                this.options.afterDeserialize(entity);
            });
        }

        return entities;
    }

    /**
     * Pass 1: Create all entities with their IDs
     *
     * @private
     * @param {Array} entitiesData - Array of entity data objects
     * @returns {Array} Array of created Entity objects
     */
    _createEntities(entitiesData) {
        return entitiesData.map(data => {
            return this.world.createEntity(data.id);
        });
    }

    /**
     * Pass 2: Add components to entities
     *
     * @private
     * @param {Array} entitiesData - Array of entity data objects
     * @param {Array} entities - Array of created Entity objects
     */
    _addComponents(entitiesData, entities) {
        entitiesData.forEach((data, idx) => {
            const entity = entities[idx];
            const { id, ...components } = data;

            // Disable query eligibility during component addition
            entity._qeligible = false;

            // Add each component
            for (const componentName in components) {
                this._addComponent(entity, componentName, components[componentName]);
            }

            // Re-enable query eligibility and update queries
            entity._qeligible = true;
            entity._candidacy();
        });
    }

    /**
     * Add a single component to an entity
     *
     * @private
     * @param {Entity} entity - Target entity
     * @param {string} componentName - Component name (camelCase)
     * @param {*} componentData - Component data
     */
    _addComponent(entity, componentName, componentData) {
        // Look up component class from registry
        const type = camelString(componentName);
        const ComponentClass = this.world.engine._components.get(type);

        if (!ComponentClass) {
            if (this.options.strictValidation) {
                throw new Error(`Unknown component type: ${componentName}`);
            }
            console.warn(`Skipping unknown component: ${componentName}`);
            return;
        }

        // Handle multiple component instances
        if (ComponentClass.allowMultiple) {
            // Component data should be array or object
            const values = Array.isArray(componentData)
                ? componentData
                : Object.values(componentData);

            values.forEach(data => {
                entity.add(ComponentClass, data);
            });
        } else {
            // Single component instance
            entity.add(ComponentClass, componentData);
        }
    }

    /**
     * Parse JSON string into artifact object
     *
     * @param {string} jsonString - JSON string
     * @returns {Object} Parsed artifact
     */
    static fromJSON(jsonString) {
        return JSON.parse(jsonString, bigintReviver);
    }
}
