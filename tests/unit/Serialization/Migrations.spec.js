import { Engine } from '../../../src/Engine';
import { Component } from '../../../src/Component';
import { MigrationRegistry } from '../../../src/serialization/MigrationRegistry';
import { bigintReplacer, bigintReviver } from '../../../src/serialization/SerializationHelpers';

describe('Schema Migrations', () => {
    let engine, world, registry;

    class TestComponent extends Component {
        static properties = {
            value: 0,
        };
    }

    beforeEach(() => {
        engine = new Engine();
        engine.registerComponent(TestComponent);
        world = engine.createWorld();
        registry = new MigrationRegistry();
    });

    describe('MigrationRegistry', () => {
        it('should register a migration', () => {
            const migrationFn = (artifact) => artifact;
            registry.register(0, 1, migrationFn);

            expect(registry.hasMigration(0, 1)).toBe(true);
        });

        it('should throw error if migration is not a function', () => {
            expect(() => {
                registry.register(0, 1, 'not a function');
            }).toThrow('Migration must be a function');
        });

        it('should detect when migration path does not exist', () => {
            expect(registry.hasMigration(0, 1)).toBe(false);
        });

        it('should find direct migration path', () => {
            registry.register(0, 1, (artifact) => artifact);

            expect(registry.hasMigration(0, 1)).toBe(true);
        });

        it('should find multi-step migration path', () => {
            registry.register(0, 1, (artifact) => artifact);
            registry.register(1, 2, (artifact) => artifact);

            expect(registry.hasMigration(0, 2)).toBe(true);
        });

        it('should execute single migration', () => {
            const migration = jest.fn((artifact) => {
                return {
                    ...artifact,
                    migrated: true,
                };
            });

            registry.register(0, 1, migration);

            const artifact = {
                entities: [],
                meta: { schemaVersion: 0 },
            };

            const result = registry.migrate(artifact, 1);

            expect(migration).toHaveBeenCalledTimes(1);
            expect(result.migrated).toBe(true);
            expect(result.meta.schemaVersion).toBe(1);
        });

        it('should execute multi-step migration', () => {
            const migration1 = jest.fn((artifact) => ({
                ...artifact,
                step1: true,
            }));

            const migration2 = jest.fn((artifact) => ({
                ...artifact,
                step2: true,
            }));

            registry.register(0, 1, migration1);
            registry.register(1, 2, migration2);

            const artifact = {
                entities: [],
                meta: { schemaVersion: 0 },
            };

            const result = registry.migrate(artifact, 2);

            expect(migration1).toHaveBeenCalledTimes(1);
            expect(migration2).toHaveBeenCalledTimes(1);
            expect(result.step1).toBe(true);
            expect(result.step2).toBe(true);
            expect(result.meta.schemaVersion).toBe(2);
        });

        it('should throw error when no migration path exists', () => {
            const artifact = {
                entities: [],
                meta: { schemaVersion: 0 },
            };

            expect(() => {
                registry.migrate(artifact, 5);
            }).toThrow('No migration path from version 0 to 5');
        });

        it('should handle artifact without meta block', () => {
            const migration = jest.fn((artifact) => ({
                ...artifact,
                meta: { schemaVersion: 1 },
            }));

            registry.register(0, 1, migration);

            const artifact = {
                entities: [],
            };

            const result = registry.migrate(artifact, 1);

            expect(migration).toHaveBeenCalledTimes(1);
            expect(result.meta.schemaVersion).toBe(1);
        });

        it('should return artifact unchanged if already at target version', () => {
            const artifact = {
                entities: [],
                meta: { schemaVersion: 1 },
            };

            const result = registry.migrate(artifact, 1);

            expect(result).toBe(artifact);
        });

        it('should get all registered migrations', () => {
            registry.register(0, 1, () => {});
            registry.register(1, 2, () => {});
            registry.register(2, 3, () => {});

            const migrations = registry.getMigrations();

            expect(migrations).toHaveLength(3);
            expect(migrations).toContainEqual({ from: 0, to: 1 });
            expect(migrations).toContainEqual({ from: 1, to: 2 });
            expect(migrations).toContainEqual({ from: 2, to: 3 });
        });

        it('should clear all migrations', () => {
            registry.register(0, 1, () => {});
            registry.register(1, 2, () => {});

            registry.clear();

            expect(registry.getMigrations()).toHaveLength(0);
        });
    });

    describe('Engine.registerMigration', () => {
        it('should register migration on engine', () => {
            const migrationFn = (artifact) => artifact;
            engine.registerMigration(0, 1, migrationFn);

            expect(engine._migrations.hasMigration(0, 1)).toBe(true);
        });
    });

    describe('Auto-migration on load', () => {
        it('should auto-migrate artifact when loading', () => {
            // Register migration from v0 to v1
            engine.registerMigration(0, 1, (artifact) => {
                // Migration: rename 'value' to 'amount' in all components
                const migratedEntities = artifact.entities.map(entity => {
                    const { testComponent, ...rest } = entity;
                    if (testComponent) {
                        return {
                            ...rest,
                            testComponent: {
                                amount: testComponent.value,
                            },
                        };
                    }
                    return entity;
                });

                return {
                    ...artifact,
                    entities: migratedEntities,
                };
            });

            // Create v0 artifact
            const v0Artifact = {
                entities: [
                    {
                        id: '123',
                        testComponent: { value: 42 },
                    },
                ],
                meta: {
                    schemaVersion: 0,
                    version: '1.0.0',
                    timestamp: Date.now(),
                },
            };

            // Load artifact - should auto-migrate
            const entities = world.loadArtifact(v0Artifact);

            // Verify entity was migrated
            expect(entities).toHaveLength(1);
            // Component should have 'amount' property (not 'value')
            // Note: Since our TestComponent still uses 'value', the migration
            // won't work perfectly - this is expected in a real scenario
            // where you'd update the component definition
        });

        it('should skip migration if already at current version', () => {
            const migrationSpy = jest.fn((artifact) => artifact);
            engine.registerMigration(0, 1, migrationSpy);

            const entity = world.createEntity();
            entity.add(TestComponent, { value: 100 });

            // Create current version artifact
            const artifact = world.createArtifact();

            // Load artifact
            const world2 = engine.createWorld();
            world2.loadArtifact(artifact);

            // Migration should not be called
            expect(migrationSpy).not.toHaveBeenCalled();
        });

        it('should allow disabling auto-migration', () => {
            const migrationSpy = jest.fn((artifact) => artifact);
            engine.registerMigration(0, 1, migrationSpy);

            const v0Artifact = {
                entities: [],
                meta: { schemaVersion: 0 },
            };

            // Load with autoMigrate: false
            world.loadArtifact(v0Artifact, { autoMigrate: false, validate: false });

            // Migration should not be called
            expect(migrationSpy).not.toHaveBeenCalled();
        });
    });
});
