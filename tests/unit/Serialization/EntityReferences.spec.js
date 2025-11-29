import { Engine } from '../../../src/Engine';
import { Component } from '../../../src/Component';
import { bigintReplacer, bigintReviver } from '../../../src/serialization/SerializationHelpers';

describe('Entity Reference Serialization', () => {
    let engine, world;

    // Component with single entity reference
    class EquipmentSlot extends Component {
        static properties = {
            name: 'hand',
            item: null  // Single entity reference
        };
    }

    // Component with array of entity references
    class Inventory extends Component {
        static properties = {
            items: [],     // Array of entity references
            capacity: 10
        };
    }

    // Component for items
    class Item extends Component {
        static properties = {
            name: '',
            value: 0
        };
    }

    // Component with nested references
    class Container extends Component {
        static properties = {
            contents: {
                items: []
            }
        };
    }

    beforeEach(() => {
        engine = new Engine();
        engine.registerComponent(EquipmentSlot);
        engine.registerComponent(Inventory);
        engine.registerComponent(Item);
        engine.registerComponent(Container);
        world = engine.createWorld();
    });

    describe('Single entity references', () => {
        it('should serialize single entity reference', () => {
            // Create entities
            const player = world.createEntity();
            const sword = world.createEntity();
            sword.add(Item, { name: 'Sword', value: 100 });

            player.add(EquipmentSlot, {
                name: 'mainHand',
                item: sword
            });

            // Serialize
            const artifact = world.createArtifact();
            const jsonStr = JSON.stringify(artifact, bigintReplacer);

            // Verify reference is encoded
            expect(jsonStr).toContain('"$ref"');
            expect(jsonStr).toContain(sword.id);
        });

        it('should deserialize single entity reference', () => {
            // Create entities
            const player = world.createEntity();
            const sword = world.createEntity();
            sword.add(Item, { name: 'Sword', value: 100 });

            player.add(EquipmentSlot, {
                name: 'mainHand',
                item: sword
            });

            // Serialize
            const artifact = world.createArtifact();
            const jsonStr = JSON.stringify(artifact, bigintReplacer);

            // Deserialize into new world
            const world2 = engine.createWorld();
            world2.loadArtifact(JSON.parse(jsonStr, bigintReviver));

            // Verify reference is resolved
            const entities = Array.from(world2.getEntities());
            const playerEntity = entities.find(e => e.has(EquipmentSlot));
            const swordEntity = entities.find(e => e.has(Item));

            expect(playerEntity).toBeDefined();
            expect(swordEntity).toBeDefined();
            expect(playerEntity.equipmentSlot.item).toBe(swordEntity);
            expect(playerEntity.equipmentSlot.item.item.name).toBe('Sword');
        });

        it('should handle null entity references', () => {
            const player = world.createEntity();
            player.add(EquipmentSlot, {
                name: 'mainHand',
                item: null
            });

            const artifact = world.createArtifact();
            const jsonStr = JSON.stringify(artifact, bigintReplacer);

            const world2 = engine.createWorld();
            world2.loadArtifact(JSON.parse(jsonStr, bigintReviver));

            const entities = Array.from(world2.getEntities());
            expect(entities[0].equipmentSlot.item).toBeNull();
        });
    });

    describe('Array of entity references', () => {
        it('should serialize array of entity references', () => {
            const player = world.createEntity();
            const sword = world.createEntity();
            const shield = world.createEntity();

            sword.add(Item, { name: 'Sword' });
            shield.add(Item, { name: 'Shield' });

            player.add(Inventory, {
                items: [sword, shield],
                capacity: 20
            });

            const artifact = world.createArtifact();
            const jsonStr = JSON.stringify(artifact, bigintReplacer);

            expect(jsonStr).toContain(sword.id);
            expect(jsonStr).toContain(shield.id);
        });

        it('should deserialize array of entity references', () => {
            const player = world.createEntity();
            const sword = world.createEntity();
            const shield = world.createEntity();

            sword.add(Item, { name: 'Sword' });
            shield.add(Item, { name: 'Shield' });

            player.add(Inventory, {
                items: [sword, shield],
                capacity: 20
            });

            const artifact = world.createArtifact();
            const jsonStr = JSON.stringify(artifact, bigintReplacer);

            const world2 = engine.createWorld();
            world2.loadArtifact(JSON.parse(jsonStr, bigintReviver));

            const entities = Array.from(world2.getEntities());
            const playerEntity = entities.find(e => e.has(Inventory));

            expect(playerEntity.inventory.items).toHaveLength(2);
            expect(playerEntity.inventory.items[0].item.name).toBe('Sword');
            expect(playerEntity.inventory.items[1].item.name).toBe('Shield');
        });
    });

    describe('Nested entity references', () => {
        it('should serialize nested entity references', () => {
            const chest = world.createEntity();
            const coin = world.createEntity();

            coin.add(Item, { name: 'Gold Coin' });

            chest.add(Container, {
                contents: {
                    items: [coin]
                }
            });

            const artifact = world.createArtifact();
            const jsonStr = JSON.stringify(artifact, bigintReplacer);

            expect(jsonStr).toContain(coin.id);
        });

        it('should deserialize nested entity references', () => {
            const chest = world.createEntity();
            const coin = world.createEntity();

            coin.add(Item, { name: 'Gold Coin' });

            chest.add(Container, {
                contents: {
                    items: [coin]
                }
            });

            const artifact = world.createArtifact();
            const jsonStr = JSON.stringify(artifact, bigintReplacer);

            const world2 = engine.createWorld();
            world2.loadArtifact(JSON.parse(jsonStr, bigintReviver));

            const entities = Array.from(world2.getEntities());
            const chestEntity = entities.find(e => e.has(Container));

            expect(chestEntity.container.contents.items).toHaveLength(1);
            expect(chestEntity.container.contents.items[0].item.name).toBe('Gold Coin');
        });
    });

    describe('Resolve references option', () => {
        it('should include referenced entities when resolveReferences is true', () => {
            const player = world.createEntity();
            const sword = world.createEntity();

            sword.add(Item, { name: 'Sword' });
            player.add(Inventory, { items: [sword] });

            // Serialize only player, but resolve references
            const artifact = world.createArtifact({
                entities: [player],
                resolveReferences: true
            });

            // Should include both player and sword
            expect(artifact.entities).toHaveLength(2);
            const ids = artifact.entities.map(e => e.id);
            expect(ids).toContain(player.id);
            expect(ids).toContain(sword.id);
        });

        it('should NOT include referenced entities when resolveReferences is false', () => {
            const player = world.createEntity();
            const sword = world.createEntity();

            sword.add(Item, { name: 'Sword' });
            player.add(Inventory, { items: [sword] });

            // Serialize only player, don't resolve references
            const artifact = world.createArtifact({
                entities: [player],
                resolveReferences: false
            });

            // Should only include player
            expect(artifact.entities).toHaveLength(1);
            expect(artifact.entities[0].id).toBe(player.id);
        });

        it('should resolve references up to maxDepth', () => {
            // Create a chain: player -> chest -> item
            const player = world.createEntity();
            const chest = world.createEntity();
            const item = world.createEntity();

            item.add(Item, { name: 'Gem' });
            chest.add(Container, { contents: { items: [item] } });
            player.add(Inventory, { items: [chest] });

            // Resolve with maxDepth: 1 (should get player + chest, but not item)
            const artifact = world.createArtifact({
                entities: [player],
                resolveReferences: true,
                maxDepth: 1
            });

            expect(artifact.entities).toHaveLength(2);
            const ids = artifact.entities.map(e => e.id);
            expect(ids).toContain(player.id);
            expect(ids).toContain(chest.id);
            expect(ids).not.toContain(item.id);
        });
    });

    describe('Dangling references', () => {
        it('should handle dangling references with danglingRefs: null', () => {
            const player = world.createEntity();
            const sword = world.createEntity();

            sword.add(Item, { name: 'Sword' });
            player.add(Inventory, { items: [sword] });

            // Serialize both entities
            const artifact = world.createArtifact();
            const jsonStr = JSON.stringify(artifact, bigintReplacer);

            // Manually remove sword from artifact
            const parsed = JSON.parse(jsonStr, bigintReviver);
            parsed.entities = parsed.entities.filter(e => !e.item);

            // Deserialize with dangling reference - disable validation
            const world2 = engine.createWorld();
            world2.loadArtifact(parsed, { danglingRefs: 'null', validate: false });

            const entities = Array.from(world2.getEntities());
            const playerEntity = entities.find(e => e.has(Inventory));

            // Dangling reference should be null
            expect(playerEntity.inventory.items[0]).toBeNull();
        });

        it('should throw on dangling references with danglingRefs: throw', () => {
            const player = world.createEntity();
            const sword = world.createEntity();

            sword.add(Item, { name: 'Sword' });
            player.add(Inventory, { items: [sword] });

            const artifact = world.createArtifact();
            const jsonStr = JSON.stringify(artifact, bigintReplacer);

            // Remove sword from artifact
            const parsed = JSON.parse(jsonStr, bigintReviver);
            parsed.entities = parsed.entities.filter(e => !e.item);

            const world2 = engine.createWorld();

            // Should throw error - disable validation to test deserializer error handling
            expect(() => {
                world2.loadArtifact(parsed, { danglingRefs: 'throw', validate: false });
            }).toThrow('Dangling entity reference');
        });
    });
});
