import Component from './Component';
import EntityEvent from './EntityEvent';
import camelcase from 'camelcase';

export default class Entity {
    #id = null;
    #components = {};
    #ecs = null;

    get ecs() {
        return this.#ecs;
    }

    get components() {
        return this.#components;
    }

    constructor(ecs, id = null) {
        this.#ecs = ecs;
        this.#id = id || ecs.generateId();
        Object.defineProperty(this, 'id', {
            value: this.#id,
            enumerable: true,
            writable: false,
        });
    }

    has(typeOrClass, key = null) {
        const type = this.ecs.components._getType(typeOrClass);
        const hasType = this.hasOwnProperty(camelcase(type));

        if (hasType && key) {
            return this[camelcase(type)].hasOwnProperty(key);
        }

        return hasType;
    }

    get(typeOrClass, key = null) {
        const type = this.ecs.components._getType(typeOrClass);
        const components = this[camelcase(type)];

        if (components && key) {
            return components[key];
        }

        return components;
    }

    add(typeOrClass, properties = {}) {
        const component = this.ecs.components.create(typeOrClass, properties);
        const accessor = camelcase(component.type);

        if (!component) {
            console.warn(
                `"${typeOrClass}" component cannot be added, since it is not registered.`
            );
            return false;
        }

        if (!component.allowMultiple) {
            if (this.has(component.type)) {
                console.warn(
                    `"${component.type}" component has allowMultiple set to ${component.allowMultiple}. Trying to add a "${component.type}" component to an entity which already has one.`
                );
                return false;
            }

            this.components[accessor] = component;

            Object.defineProperty(this, accessor, {
                enumerable: true,
                configurable: true,
                get() {
                    return this.components[accessor];
                },
            });

            component._onAttached(this);
            return true;
        }

        if (!component.keyProperty) {
            if (!this.components[accessor]) {
                this.components[accessor] = [];
                Object.defineProperty(this, accessor, {
                    configurable: true,
                    enumerable: true,
                    get() {
                        return this.components[accessor];
                    },
                });
            }

            this.components[accessor].push(component);

            component._onAttached(this);

            return true;
        }

        if (!component.key) {
            console.warn(
                `"${component.type}" component has a falsy key of "${component.key}". The keyProperty is set to "${component.keyProperty}".`
            );
            return false;
        }

        if (!this.components[accessor]) {
            this.components[accessor] = {};
            Object.defineProperty(this, accessor, {
                configurable: true,
                enumerable: true,
                get() {
                    return this.components[accessor];
                },
            });
        }

        this.components[accessor][component.key] = component;

        component._onAttached(this);

        return true;
    }

    owns(component) {
        return component.entity === this;
    }

    remove(typeOrClassOrComponent, key = null) {
        const isComponent = typeOrClassOrComponent instanceof Component;
        key = isComponent ? typeOrClassOrComponent.key : key;

        const definition = this.ecs.components.get(typeOrClassOrComponent);

        const accessor = camelcase(definition.type);

        if (definition.allowMultiple) {
            if (!definition.keyProperty) {
                if (isComponent) {
                    const all = this.components[accessor];

                    if (!all) {
                        console.warn(
                            `Trying to remove a "${definition.type}" component from an entity, but it wasn't found.`
                        );
                        return;
                    }

                    const index = all.indexOf(typeOrClassOrComponent);

                    if (index > -1) {
                        all.splice(index, 1);
                        typeOrClassOrComponent._onDetached();

                        if (all.length === 0) {
                            delete this[accessor];
                            delete this.components[accessor];
                        }

                        return true;
                    }
                } else {
                    for (const instance of this.components[accessor]) {
                        instance._onDetached();
                    }

                    delete this[accessor];
                    delete this.components[accessor];

                    return true;
                }
            }

            if (!key) {
                console.warn(
                    `Trying to remove a "${definition.type}" component which allows multiple without specifying an key.`
                );
                return;
            }

            const all = this.components[accessor];
            const component = all[key];

            if (component) {
                delete all[key];
                component._onDetached();
                return component;
            } else {
                console.warn(
                    `Trying to remove a "${definition.type}" component from an entity at "${key}", but it wasn't found.`
                );
                return;
            }
        }

        if (accessor in this) {
            const component = this.components[accessor];

            delete this[accessor];
            delete this.components[accessor];
            component._onDetached();

            return component;
        }

        console.warn(
            `Trying to remove a "${definition.type}" component from an entity, but it wasn't found.`
        );
    }

    serialize() {
        return Object.entries(this.components).reduce(
            (o, [key, value]) => {
                if (value instanceof Component) {
                    return {
                        ...o,
                        [key]: value.serialize(),
                    };
                }

                return {
                    ...o,
                    [key]: Object.entries(value).reduce(
                        (o2, [k2, v2]) => ({
                            ...o2,
                            [k2]: v2.serialize(),
                        }),
                        {}
                    ),
                };
            },
            {
                id: this.id,
            }
        );
    }

    fireEvent(name, data) {
        const evt = new EntityEvent(name, data);

        for (const component of Object.values(this.components)) {
            if (component instanceof Component) {
                component._onEvent(evt);

                if (evt.prevented) {
                    return evt;
                }
            } else {
                for (const nestedComponent of Object.values(component)) {
                    nestedComponent._onEvent(evt);

                    if (evt.prevented) {
                        return evt;
                    }
                }
            }
        }

        return evt;
    }
}
