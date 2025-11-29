/**
 * Artifact Deserializer for Geotic ECS
 * Converts artifact format back into World + Entities
 */

import { bigintReviver } from './SerializationHelpers.js';
import { DEFAULT_DESERIALIZE_OPTIONS, MARKERS } from './constants.js';
import { camelString } from '../util/string-util.js';

export class ArtifactDeserializer {
    constructor(world, options = {}) {
        this.world = world;
        this.options = { ...DEFAULT_DESERIALIZE_OPTIONS, ...options };
        this.entityMap = new Map();
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

        // Three-pass deserialization:
        // Pass 1: Create all entities with IDs
        const entities = this._createEntities(entitiesData);

        // Pass 2: Add components to each entity (with ref placeholders)
        this._addComponents(entitiesData, entities);

        // Pass 3: Resolve entity references
        this._resolveEntityReferences(entities);

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
        const entities = entitiesData.map(data => {
            const entity = this.world.createEntity(data.id);
            this.entityMap.set(data.id, entity);
            return entity;
        });
        return entities;
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
     * Pass 3: Resolve entity references in all components
     *
     * @private
     * @param {Array} entities - Array of entities to process
     */
    _resolveEntityReferences(entities) {
        for (const entity of entities) {
            for (const componentKey in entity.components) {
                const component = entity.components[componentKey];

                if (Array.isArray(component)) {
                    // Array of components
                    component.forEach(comp => {
                        this._resolveComponentReferences(comp);
                    });
                } else if (component && typeof component === 'object' && component.constructor === Object) {
                    // Check if it's a keyed component collection or single component
                    if (component._ckey) {
                        // Single component
                        this._resolveComponentReferences(component);
                    } else {
                        // Keyed components
                        for (const key in component) {
                            this._resolveComponentReferences(component[key]);
                        }
                    }
                } else if (component && component._ckey) {
                    // Single component
                    this._resolveComponentReferences(component);
                }
            }
        }
    }

    /**
     * Resolve entity references in a single component
     *
     * @private
     * @param {Object} component - Component to process
     */
    _resolveComponentReferences(component) {
        for (const key in component) {
            component[key] = this._resolveValue(component[key]);
        }
    }

    /**
     * Recursively resolve a value, replacing reference markers with Entity objects
     *
     * @private
     * @param {*} value - Value to resolve
     * @returns {*} Resolved value
     */
    _resolveValue(value) {
        // Check if value is a reference marker
        if (value && typeof value === 'object' && value[MARKERS.ENTITY_REF]) {
            const entityId = value[MARKERS.ENTITY_REF];
            const entity = this.entityMap.get(entityId);

            if (!entity) {
                // Handle dangling reference according to options
                return this._handleDanglingReference(entityId);
            }

            return entity;
        }

        // Handle arrays
        if (Array.isArray(value)) {
            return value.map(item => this._resolveValue(item));
        }

        // Handle objects
        if (value && typeof value === 'object' && value.constructor === Object) {
            const resolved = {};
            for (const key in value) {
                resolved[key] = this._resolveValue(value[key]);
            }
            return resolved;
        }

        // Primitives and other types
        return value;
    }

    /**
     * Handle dangling entity reference
     *
     * @private
     * @param {string} entityId - Missing entity ID
     * @returns {*} Replacement value
     */
    _handleDanglingReference(entityId) {
        const mode = this.options.danglingRefs;

        if (mode === 'throw') {
            throw new Error(`Dangling entity reference: ${entityId}`);
        }

        if (mode === 'warn') {
            console.warn(`Dangling entity reference: ${entityId} - setting to null`);
            return null;
        }

        // Default: 'null' - silently return null
        return null;
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
