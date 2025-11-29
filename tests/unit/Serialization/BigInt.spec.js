import { Engine } from '../../../src/Engine';
import { Component } from '../../../src/Component';
import { bigintReplacer, bigintReviver } from '../../../src/serialization/SerializationHelpers';

describe('BigInt Serialization', () => {
    let engine, world;

    // Test component with BigInt properties
    class BigIntComponent extends Component {
        static properties = {
            largeNumber: 0n,
            regularNumber: 42,
            nestedData: {
                bigValue: 0n,
                normalValue: 10
            }
        };
    }

    beforeEach(() => {
        engine = new Engine();
        engine.registerComponent(BigIntComponent);
        world = engine.createWorld();
    });

    describe('bigintReplacer', () => {
        it('should encode BigInt values as special objects', () => {
            const data = { value: 12345678901234567890n };
            const json = JSON.stringify(data, bigintReplacer);
            expect(json).toBe('{"value":{"$bigint":"12345678901234567890"}}');
        });

        it('should skip internal ECS fields', () => {
            const data = {
                _cbits: 123n,
                _cbit: 456n,
                _qeligible: true,
                world: {},
                entity: {},
                normalField: 42
            };
            const json = JSON.stringify(data, bigintReplacer);
            const parsed = JSON.parse(json);

            expect(parsed._cbits).toBeUndefined();
            expect(parsed._cbit).toBeUndefined();
            expect(parsed._qeligible).toBeUndefined();
            expect(parsed.world).toBeUndefined();
            expect(parsed.entity).toBeUndefined();
            expect(parsed.normalField).toBe(42);
        });

        it('should handle nested BigInt values', () => {
            const data = {
                nested: {
                    deepValue: 999999999999999999n
                }
            };
            const json = JSON.stringify(data, bigintReplacer);
            expect(json).toContain('"$bigint":"999999999999999999"');
        });

        it('should handle arrays with BigInt values', () => {
            const data = {
                values: [1n, 2n, 3n]
            };
            const json = JSON.stringify(data, bigintReplacer);
            const parsed = JSON.parse(json);

            expect(parsed.values[0]).toEqual({ $bigint: '1' });
            expect(parsed.values[1]).toEqual({ $bigint: '2' });
            expect(parsed.values[2]).toEqual({ $bigint: '3' });
        });
    });

    describe('bigintReviver', () => {
        it('should decode BigInt special objects', () => {
            const json = '{"value":{"$bigint":"12345678901234567890"}}';
            const data = JSON.parse(json, bigintReviver);
            expect(data.value).toBe(12345678901234567890n);
            expect(typeof data.value).toBe('bigint');
        });

        it('should handle nested BigInt values', () => {
            const json = '{"nested":{"deepValue":{"$bigint":"999999999999999999"}}}';
            const data = JSON.parse(json, bigintReviver);
            expect(data.nested.deepValue).toBe(999999999999999999n);
        });

        it('should handle arrays with BigInt values', () => {
            const json = '{"values":[{"$bigint":"1"},{"$bigint":"2"},{"$bigint":"3"}]}';
            const data = JSON.parse(json, bigintReviver);

            expect(data.values[0]).toBe(1n);
            expect(data.values[1]).toBe(2n);
            expect(data.values[2]).toBe(3n);
        });
    });

    describe('Component with BigInt properties', () => {
        it('should serialize and deserialize BigInt component properties', () => {
            const entity = world.createEntity();
            entity.add(BigIntComponent, {
                largeNumber: 9007199254740991n,
                nestedData: {
                    bigValue: 123456789012345n,
                    normalValue: 20
                }
            });

            // Serialize using new artifact API
            const artifact = world.createArtifact();

            // Verify BigInt is in serialized form
            const jsonStr = JSON.stringify(artifact, bigintReplacer);
            expect(jsonStr).toContain('"$bigint"');

            // Create new world and deserialize
            const world2 = engine.createWorld();
            world2.loadArtifact(JSON.parse(jsonStr, bigintReviver));

            // Verify BigInt values are restored
            const entities = Array.from(world2.getEntities());
            expect(entities.length).toBe(1);

            const restoredEntity = entities[0];
            expect(restoredEntity.bigIntComponent.largeNumber).toBe(9007199254740991n);
            expect(restoredEntity.bigIntComponent.nestedData.bigValue).toBe(123456789012345n);
            expect(restoredEntity.bigIntComponent.nestedData.normalValue).toBe(20);
        });

        it('should handle zero BigInt values', () => {
            const entity = world.createEntity();
            entity.add(BigIntComponent, { largeNumber: 0n });

            const artifact = world.createArtifact();
            const jsonStr = JSON.stringify(artifact, bigintReplacer);

            const world2 = engine.createWorld();
            world2.loadArtifact(JSON.parse(jsonStr, bigintReviver));

            const entities = Array.from(world2.getEntities());
            expect(entities[0].bigIntComponent.largeNumber).toBe(0n);
        });

        it('should handle negative BigInt values', () => {
            const entity = world.createEntity();
            entity.add(BigIntComponent, { largeNumber: -9007199254740991n });

            const artifact = world.createArtifact();
            const jsonStr = JSON.stringify(artifact, bigintReplacer);

            const world2 = engine.createWorld();
            world2.loadArtifact(JSON.parse(jsonStr, bigintReviver));

            const entities = Array.from(world2.getEntities());
            expect(entities[0].bigIntComponent.largeNumber).toBe(-9007199254740991n);
        });
    });

    describe('Internal _cbits field handling', () => {
        it('should not serialize entity _cbits field', () => {
            const entity = world.createEntity();
            entity.add(BigIntComponent);

            // Entity should have _cbits set
            expect(entity._cbits).toBeDefined();
            expect(typeof entity._cbits).toBe('bigint');

            // Serialize
            const artifact = world.createArtifact();
            const jsonStr = JSON.stringify(artifact, bigintReplacer);

            // _cbits should not appear in JSON
            expect(jsonStr).not.toContain('_cbits');
        });

        it('should reconstruct _cbits during deserialization', () => {
            const entity = world.createEntity();
            entity.add(BigIntComponent);

            const originalCbits = entity._cbits;

            // Serialize and deserialize
            const artifact = world.createArtifact();
            const jsonStr = JSON.stringify(artifact, bigintReplacer);

            const world2 = engine.createWorld();
            world2.loadArtifact(JSON.parse(jsonStr, bigintReviver));

            const entities = Array.from(world2.getEntities());
            const restoredEntity = entities[0];

            // _cbits should be reconstructed correctly
            expect(restoredEntity._cbits).toBe(originalCbits);
        });
    });
});
