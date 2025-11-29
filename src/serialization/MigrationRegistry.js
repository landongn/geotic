/**
 * Migration Registry for Geotic ECS
 * Manages schema version migrations for artifacts
 */

import { CURRENT_SCHEMA_VERSION } from './constants.js';

export class MigrationRegistry {
    constructor() {
        // Map of migrations: { fromVersion: { toVersion: migrationFn } }
        this._migrations = new Map();
    }

    /**
     * Register a migration function
     *
     * @param {number} fromVersion - Source schema version
     * @param {number} toVersion - Target schema version
     * @param {Function} migrationFn - Migration function (artifact) => artifact
     */
    register(fromVersion, toVersion, migrationFn) {
        if (typeof migrationFn !== 'function') {
            throw new Error('Migration must be a function');
        }

        if (!this._migrations.has(fromVersion)) {
            this._migrations.set(fromVersion, new Map());
        }

        this._migrations.get(fromVersion).set(toVersion, migrationFn);
    }

    /**
     * Check if a migration path exists between versions
     *
     * @param {number} fromVersion - Source schema version
     * @param {number} toVersion - Target schema version
     * @returns {boolean} True if migration path exists
     */
    hasMigration(fromVersion, toVersion) {
        return this._findMigrationPath(fromVersion, toVersion).length > 0;
    }

    /**
     * Migrate an artifact from one version to another
     *
     * @param {Object} artifact - Artifact to migrate
     * @param {number} targetVersion - Target schema version (defaults to current)
     * @returns {Object} Migrated artifact
     */
    migrate(artifact, targetVersion = CURRENT_SCHEMA_VERSION) {
        // Determine source version
        const sourceVersion = artifact.meta?.schemaVersion ?? 0;

        // No migration needed
        if (sourceVersion === targetVersion) {
            return artifact;
        }

        // Find migration path
        const path = this._findMigrationPath(sourceVersion, targetVersion);

        if (path.length === 0) {
            throw new Error(
                `No migration path from version ${sourceVersion} to ${targetVersion}`
            );
        }

        // Apply migrations in sequence
        let migratedArtifact = artifact;

        for (const step of path) {
            const migrationFn = this._migrations.get(step.from).get(step.to);
            migratedArtifact = migrationFn(migratedArtifact);

            // Update schema version in metadata
            if (migratedArtifact.meta) {
                migratedArtifact.meta.schemaVersion = step.to;
            }
        }

        return migratedArtifact;
    }

    /**
     * Find shortest migration path between versions using BFS
     *
     * @private
     * @param {number} fromVersion - Source version
     * @param {number} toVersion - Target version
     * @returns {Array} Array of migration steps: [{ from, to }, ...]
     */
    _findMigrationPath(fromVersion, toVersion) {
        if (fromVersion === toVersion) {
            return [];
        }

        // BFS to find shortest path
        const queue = [{ version: fromVersion, path: [] }];
        const visited = new Set([fromVersion]);

        while (queue.length > 0) {
            const { version, path } = queue.shift();

            // Check all outgoing migrations from current version
            const outgoingMigrations = this._migrations.get(version);

            if (!outgoingMigrations) {
                continue;
            }

            for (const [nextVersion, _] of outgoingMigrations) {
                if (visited.has(nextVersion)) {
                    continue;
                }

                const newPath = [...path, { from: version, to: nextVersion }];

                // Found target version
                if (nextVersion === toVersion) {
                    return newPath;
                }

                visited.add(nextVersion);
                queue.push({ version: nextVersion, path: newPath });
            }
        }

        // No path found
        return [];
    }

    /**
     * Get all registered migrations
     *
     * @returns {Array} Array of migration descriptors: [{ from, to }, ...]
     */
    getMigrations() {
        const migrations = [];

        for (const [fromVersion, toMap] of this._migrations) {
            for (const [toVersion, _] of toMap) {
                migrations.push({ from: fromVersion, to: toVersion });
            }
        }

        return migrations;
    }

    /**
     * Clear all registered migrations
     */
    clear() {
        this._migrations.clear();
    }
}
