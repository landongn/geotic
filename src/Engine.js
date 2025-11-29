import { ComponentRegistry } from './ComponentRegistry';
import { PrefabRegistry } from './PrefabRegistry';
import { World } from './World';
import { MigrationRegistry } from './serialization/MigrationRegistry.js';

export class Engine {
    _components = new ComponentRegistry();
    _prefabs = new PrefabRegistry(this);
    _migrations = new MigrationRegistry();

    registerComponent(clazz) {
        this._components.register(clazz);
    }

    registerPrefab(data) {
        this._prefabs.register(data);
    }

    /**
     * Register a schema migration function
     *
     * @param {number} fromVersion - Source schema version
     * @param {number} toVersion - Target schema version
     * @param {Function} migrationFn - Migration function (artifact) => artifact
     */
    registerMigration(fromVersion, toVersion, migrationFn) {
        this._migrations.register(fromVersion, toVersion, migrationFn);
    }

    createWorld() {
        return new World(this);
    }

    destroyWorld(world) {
        world.destroy();
    }
}
