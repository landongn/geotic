import { Engine } from '../../../src/Engine';
import { Component } from '../../../src/Component';
import { ArtifactValidator, ValidationError } from '../../../src/serialization/ArtifactValidator';
import { bigintReplacer, bigintReviver } from '../../../src/serialization/SerializationHelpers';

describe('Artifact Validation', () => {
    let engine, world, validator;

    class Health extends Component {
        static properties = {
            current: 100,
            max: 100,
        };
    }

    class Position extends Component {
        static properties = {
            x: 0,
            y: 0,
        };
    }

    beforeEach(() => {
        engine = new Engine();
        engine.registerComponent(Health);
        engine.registerComponent(Position);
        world = engine.createWorld();
        validator = new ArtifactValidator(engine);
    });

    describe('Structure validation', () => {
        it('should reject non-object artifacts', () => {
            expect(() => {
                validator.validate(null);
            }).toThrow(ValidationError);

            expect(() => {
                validator.validate('not an object');
            }).toThrow(ValidationError);
        });

        it('should reject artifacts without entities array', () => {
            expect(() => {
                validator.validate({});
            }).toThrow(ValidationError);

            expect(() => {
                validator.validate({ entities: 'not an array' });
            }).toThrow(ValidationError);
        });

        it('should reject artifacts with invalid meta', () => {
            expect(() => {
                validator.validate({
                    entities: [],
                    meta: 'not an object',
                });
            }).toThrow(ValidationError);
        });

        it('should accept valid artifact structure', () => {
            const artifact = {
                entities: [],
                meta: {
                    schemaVersion: 1,
                    version: '1.0.0',
                },
            };

            expect(() => {
                validator.validate(artifact);
            }).not.toThrow();
        });
    });

    describe('Entity validation', () => {
        it('should reject entities without id', () => {
            const artifact = {
                entities: [
                    { health: { current: 100, max: 100 } },
                ],
                meta: { schemaVersion: 1 },
            };

            expect(() => {
                validator.validate(artifact);
            }).toThrow(ValidationError);
            expect(() => {
                validator.validate(artifact);
            }).toThrow(/must have an id/);
        });

        it('should reject duplicate entity IDs', () => {
            const artifact = {
                entities: [
                    { id: 'entity1', health: { current: 100, max: 100 } },
                    { id: 'entity1', position: { x: 0, y: 0 } },
                ],
                meta: { schemaVersion: 1 },
            };

            expect(() => {
                validator.validate(artifact);
            }).toThrow(ValidationError);
            expect(() => {
                validator.validate(artifact);
            }).toThrow(/Duplicate entity ID/);
        });
    });

    describe('Component validation', () => {
        it('should reject unknown component types', () => {
            const artifact = {
                entities: [
                    { id: 'entity1', unknownComponent: { foo: 'bar' } },
                ],
                meta: { schemaVersion: 1 },
            };

            expect(() => {
                validator.validate(artifact);
            }).toThrow(ValidationError);
            expect(() => {
                validator.validate(artifact);
            }).toThrow(/Unknown component type: unknownComponent/);
        });

        it('should accept registered components', () => {
            const artifact = {
                entities: [
                    { id: 'entity1', health: { current: 100, max: 100 } },
                ],
                meta: { schemaVersion: 1 },
            };

            expect(() => {
                validator.validate(artifact);
            }).not.toThrow();
        });

        it('should allow skipping component validation', () => {
            const validator = new ArtifactValidator(engine, {
                validateComponents: false,
            });

            const artifact = {
                entities: [
                    { id: 'entity1', unknownComponent: { foo: 'bar' } },
                ],
                meta: { schemaVersion: 1 },
            };

            expect(() => {
                validator.validate(artifact);
            }).not.toThrow();
        });
    });

    describe('Reference validation', () => {
        it('should accept valid entity references', () => {
            const artifact = {
                entities: [
                    { id: 'player', position: { x: 0, y: 0 } },
                    {
                        id: 'item',
                        position: {
                            x: 5,
                            y: 5,
                        },
                    },
                ],
                meta: { schemaVersion: 1 },
            };

            expect(() => {
                validator.validate(artifact);
            }).not.toThrow();
        });

        it('should reject invalid entity references', () => {
            // Create a component with a reference property
            class TargetComponent extends Component {
                static properties = {
                    target: null,
                };
            }
            engine.registerComponent(TargetComponent);

            const artifact = {
                entities: [
                    {
                        id: 'player',
                        targetComponent: {
                            // Reference to non-existent entity
                            target: { $ref: 'nonexistent' },
                        },
                    },
                ],
                meta: { schemaVersion: 1 },
            };

            const customValidator = new ArtifactValidator(engine);

            expect(() => {
                customValidator.validate(artifact);
            }).toThrow(ValidationError);
            expect(() => {
                customValidator.validate(artifact);
            }).toThrow(/Invalid entity reference/);
        });

        it('should validate nested references', () => {
            const artifact = {
                entities: [
                    {
                        id: 'player',
                        health: {
                            current: 100,
                            max: 100,
                        },
                        nested: {
                            deep: {
                                ref: { $ref: 'invalid' },
                            },
                        },
                    },
                ],
                meta: { schemaVersion: 1 },
            };

            expect(() => {
                validator.validate(artifact);
            }).toThrow(ValidationError);
        });

        it('should allow skipping reference validation', () => {
            // Create a component with a reference property
            class TargetComponent extends Component {
                static properties = {
                    target: null,
                };
            }
            engine.registerComponent(TargetComponent);

            const validator = new ArtifactValidator(engine, {
                validateReferences: false,
            });

            const artifact = {
                entities: [
                    {
                        id: 'player',
                        targetComponent: {
                            target: { $ref: 'nonexistent' },
                        },
                    },
                ],
                meta: { schemaVersion: 1 },
            };

            expect(() => {
                validator.validate(artifact);
            }).not.toThrow();
        });
    });

    describe('Checksum validation', () => {
        it('should validate matching checksum', () => {
            const entity = world.createEntity();
            entity.add(Health, { current: 50, max: 100 });

            const artifact = world.createArtifact({ checksum: true, includeMetadata: true });

            expect(() => {
                validator.validate(artifact);
            }).not.toThrow();
        });

        it('should reject mismatched checksum', () => {
            const entity = world.createEntity();
            entity.add(Health, { current: 50, max: 100 });

            const artifact = world.createArtifact({ checksum: true, includeMetadata: true });

            // Tamper with artifact
            artifact.entities[0].health.current = 999;

            expect(() => {
                validator.validate(artifact);
            }).toThrow(ValidationError);
            expect(() => {
                validator.validate(artifact);
            }).toThrow(/Checksum mismatch/);
        });

        it('should allow skipping checksum validation', () => {
            const validator = new ArtifactValidator(engine, {
                validateChecksum: false,
            });

            const entity = world.createEntity();
            entity.add(Health, { current: 50, max: 100 });

            const artifact = world.createArtifact({ checksum: true, includeMetadata: true });

            // Tamper with artifact
            artifact.entities[0].health.current = 999;

            expect(() => {
                validator.validate(artifact);
            }).not.toThrow();
        });
    });

    describe('Schema version validation', () => {
        it('should accept older schema versions', () => {
            const artifact = {
                entities: [],
                meta: { schemaVersion: 0 },
            };

            expect(() => {
                validator.validate(artifact);
            }).not.toThrow();
        });

        it('should reject newer schema versions', () => {
            const artifact = {
                entities: [],
                meta: { schemaVersion: 9999 },
            };

            expect(() => {
                validator.validate(artifact);
            }).toThrow(ValidationError);
            expect(() => {
                validator.validate(artifact);
            }).toThrow(/newer than supported/);
        });

        it('should enforce strict version matching if enabled', () => {
            const validator = new ArtifactValidator(engine, {
                strictVersion: true,
            });

            const artifact = {
                entities: [],
                meta: { schemaVersion: 0 },
            };

            expect(() => {
                validator.validate(artifact);
            }).toThrow(ValidationError);
            expect(() => {
                validator.validate(artifact);
            }).toThrow(/Schema version mismatch/);
        });
    });

    describe('Integration with World.loadArtifact', () => {
        it('should validate by default when loading artifact', () => {
            const artifact = {
                entities: [
                    { id: 'entity1', unknownComponent: { foo: 'bar' } },
                ],
                meta: { schemaVersion: 1 },
            };

            expect(() => {
                world.loadArtifact(artifact);
            }).toThrow(ValidationError);
        });

        it('should allow disabling validation when loading', () => {
            const artifact = {
                entities: [
                    { id: 'entity1', unknownComponent: { foo: 'bar' } },
                ],
                meta: { schemaVersion: 1 },
            };

            expect(() => {
                world.loadArtifact(artifact, { validate: false });
            }).not.toThrow();
        });

        it('should pass validation options when loading', () => {
            const artifact = {
                entities: [
                    { id: 'entity1', unknownComponent: { foo: 'bar' } },
                ],
                meta: { schemaVersion: 1 },
            };

            expect(() => {
                world.loadArtifact(artifact, {
                    validationOptions: { validateComponents: false },
                });
            }).not.toThrow();
        });
    });

    describe('ValidationError', () => {
        it('should have proper error properties', () => {
            try {
                validator.validate({ entities: 'invalid' });
            } catch (error) {
                expect(error).toBeInstanceOf(ValidationError);
                expect(error.name).toBe('ValidationError');
                expect(error.code).toBe('INVALID_STRUCTURE');
                expect(error.message).toBeTruthy();
            }
        });
    });
});
