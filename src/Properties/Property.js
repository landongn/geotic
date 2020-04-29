export default class Property {
    component;

    constructor(component, value) {
        this.component = component;
        this.set(value);
    }

    get ecs() {
        return this.component.ecs;
    }

    get descriptor() {
        return {
            enumerable: true,
            get: () => this.get(),
            set: (v) => this.set(v),
        };
    }

    get() {
        return undefined;
    }

    set(value) {}

    serialize() {
        return undefined;
    }

    cleanupReference(entity) {}
}
