import PrefabComponent from './PrefabComponent';
import Prefab from './Prefab';
import { camelString } from './util/string-util';

export class PrefabRegistry {
    _prefabs = {};
    _engine = null;

    constructor(engine) {
        this._engine = engine;
    }

    deserialize(data) {
        const registered = this.get(data.name);

        if (registered) {
            return registered;
        }

        const prefab = new Prefab(data.name);

        let inherit;

        if (Array.isArray(data.inherit)) {
            inherit = data.inherit;
        } else if (typeof data.inherit === 'string') {
            inherit = [data.inherit];
        } else {
            inherit = [];
        }

        prefab.inherit = inherit.map((parent) => {
            const ref = this.get(parent);

            if (!ref) {
                console.warn(
                    `Prefab "${data.name}" cannot inherit from Prefab "${parent}" because is not registered yet! Prefabs must be registered in the right order.`
                );
                return parent;
            }

            return ref;
        });

        const comps = data.components || [];

        comps.forEach((componentData) => {
            if (typeof componentData === 'string') {
                const ckey = camelString(componentData);
                const clazz = this._engine._components.get(ckey);

                if (clazz) {
                    prefab.addComponent(new PrefabComponent(clazz));

                    return;
                }
            }

            if (typeof componentData === 'object') {
                const ckey = camelString(componentData.type);
                const clazz = this._engine._components.get(ckey);

                if (clazz) {
                    prefab.addComponent(
                        new PrefabComponent(
                            clazz,
                            componentData.properties,
                            componentData.overwrite
                        )
                    );

                    return;
                }
            }

            console.warn(
                `Unrecognized component reference "${componentData}" in prefab "${data.name}". Ensure the component is registered before the prefab.`
            );
        });

        return prefab;
    }

    register(data) {
        const prefab = this.deserialize(data);

        this._prefabs[prefab.name] = prefab;
    }

    get(name) {
        return this._prefabs[name];
    }

    create(world, name, properties = {}) {
        const prefab = this.get(name);

        if (!prefab) {
            console.warn(
                `Could not instantiate prefab "${name}" since it is not registered`
            );

            return;
        }

        const entity = world.createEntity();

        entity._qeligible = false;
        if (properties.serializable) {
            entity.serializable = properties.serializable;
        }

        prefab.applyToEntity(entity, properties);

        entity._qeligible = true;
        entity._candidacy();

        return entity;
    }
}
