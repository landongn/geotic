import { Entity } from './Entity';
import { Query } from './Query';
import { camelString } from './util/string-util';
import { ArtifactSerializer } from './serialization/ArtifactSerializer.js';
import { ArtifactDeserializer } from './serialization/ArtifactDeserializer.js';
import { ArtifactValidator } from './serialization/ArtifactValidator.js';
import { LEGACY_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION } from './serialization/constants.js';

export class World {
    _id = 0;
    _queries = [];
    _entities = new Map();

    constructor(engine) {
        this.engine = engine;
    }

    createId() {
        return ++this._id + Math.random().toString(36).substr(2, 9);
    }

    getEntity(id) {
        return this._entities.get(id);
    }

    getEntities() {
        return this._entities.values();
    }

    createEntity(id = this.createId()) {
        const entity = new Entity(this, id);

        this._entities.set(id, entity);

        return entity;
    }

    destroyEntity(id) {
        const entity = this.getEntity(id);

        if (entity) {
            entity.destroy();
        }
    }

    destroyEntities() {
        this._entities.forEach((entity) => {
            entity.destroy();
        });
    }

    destroy() {
        this.destroyEntities();
        this._id = 0;
        this._queries = [];
        this._entities = new Map();
    }

    createQuery(filters) {
        const query = new Query(this, filters);

        this._queries.push(query);

        return query;
    }

    createPrefab(name, properties = {}) {
        return this.engine._prefabs.create(this, name, properties);
    }

    serialize(entities) {
        const json = [];
        const list = entities ? entities : Array.from(this._entities.values());

        list.forEach((e) => {
            if (!e.serializable) {return}
            json.push(e.serialize());
        });

        return {
            entities: json,
        };
    }

    cloneEntity(entity) {
        const data = entity.serialize();

        data.id = this.createId();

        return this._deserializeEntity(data);
    }

    deserialize(data) {
        for (const entityData of data.entities) {
            this._createOrGetEntityById(entityData.id);
        }

        for (const entityData of data.entities) {
            this._deserializeEntity(entityData);
        }
    }

    _createOrGetEntityById(id) {
        return this.getEntity(id) || this.createEntity(id);
    }

    _deserializeEntity(data) {
        const { id, ...components } = data;
        const entity = this._createOrGetEntityById(id);
        entity._qeligible = false;

        Object.entries(components).forEach(([key, value]) => {
            const type = camelString(key);
            const def = this.engine._components.get(type);

            if (def.allowMultiple) {
                Object.values(value).forEach((d) => {
                    entity.add(def, d);
                });
            } else {
                entity.add(def, value);
            }
        });

        entity._qeligible = true;
        entity._candidacy();

        return entity;
    }

    /**
     * Create an artifact (save state) from the world
     * Advanced serialization with metadata, validation, and options
     *
     * @param {Object} [options={}] - Serialization options
     * @returns {Object} Artifact object
     */
    createArtifact(options = {}) {
        const serializer = new ArtifactSerializer(this, options);
        return serializer.serialize();
    }

    /**
     * Load an artifact (save state) into the world
     * Supports both legacy format and new artifact format with auto-detection
     *
     * @param {Object} artifact - Artifact object to load
     * @param {Object} [options={}] - Load options
     * @param {boolean} [options.validate=true] - Validate artifact before loading
     * @param {boolean} [options.autoMigrate=true] - Automatically migrate to current schema
     * @param {Object} [options.validationOptions] - Options for ArtifactValidator
     * @returns {Array} Array of loaded entities
     */
    loadArtifact(artifact, options = {}) {
        const {
            validate = true,
            autoMigrate = true,
            validationOptions = {},
            ...deserializeOptions
        } = options;

        // Auto-detect legacy format (no meta block)
        if (!artifact.meta) {
            // Legacy format: use existing deserialize method
            this.deserialize(artifact);
            return Array.from(this._entities.values());
        }

        // Apply auto-migration if enabled
        let processedArtifact = artifact;
        if (autoMigrate) {
            const sourceVersion = artifact.meta?.schemaVersion ?? 0;
            if (sourceVersion !== CURRENT_SCHEMA_VERSION) {
                processedArtifact = this.engine._migrations.migrate(artifact, CURRENT_SCHEMA_VERSION);
            }
        }

        // Validate artifact if enabled
        if (validate) {
            const validator = new ArtifactValidator(this.engine, validationOptions);
            validator.validate(processedArtifact);
        }

        // Deserialize artifact
        const deserializer = new ArtifactDeserializer(this, deserializeOptions);
        return deserializer.deserialize(processedArtifact);
    }

    /**
     * Validate an artifact for integrity and compatibility
     *
     * @param {Object} artifact - Artifact to validate
     * @returns {Object} Validation result {valid: boolean, errors: Array}
     */
    validateArtifact(artifact) {
        // Phase 3: Will be implemented with ArtifactValidator
        // For now, basic validation
        const errors = [];

        if (!artifact.entities || !Array.isArray(artifact.entities)) {
            errors.push('Missing or invalid entities array');
        }

        if (artifact.meta && artifact.meta.schemaVersion === undefined) {
            errors.push('Missing schema version in metadata');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Migrate an artifact to the current schema version
     *
     * @param {Object} artifact - Artifact to migrate
     * @param {number} [targetVersion] - Target schema version (defaults to current)
     * @returns {Object} Migrated artifact
     */
    migrateArtifact(artifact, targetVersion) {
        // Phase 3: Will be implemented with MigrationRegistry
        // For now, return artifact unchanged
        console.warn('Migration not yet implemented - returning artifact unchanged');
        return artifact;
    }

    _candidate(entity) {
        this._queries.forEach((q) => q.candidate(entity));
    }

    _destroyed(id) {
        return this._entities.delete(id);
    }
}
