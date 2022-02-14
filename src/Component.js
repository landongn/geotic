export class Component {
    static allowMultiple = false;
    static keyProperty = null;
    static serializable = true;
    static properties = {};

    get world() {
        return this.entity.world;
    }

    get serializable() {
        return this.constructor.serializable;
    }

    get allowMultiple() {
        return this.constructor.allowMultiple;
    }

    get keyProperty() {
        return this.constructor.keyProperty;
    }

    constructor(properties = {}) {
        Object.assign(this, this.constructor.properties, properties);
    }

    destroy() {
        this.entity.remove(this);
    }

    _onDestroyed() {
        this.onDestroyed();
        delete this.entity;
    }

    _onEvent(evt) {
        this.onEvent(evt);

        if (typeof this[evt.handlerName] === 'function') {
            this[evt.handlerName](evt);
        }
    }

    _onAttached(entity) {
        this.entity = entity;
        this.onAttached(entity);
    }

    serialize() {
        const ob = {};

        for (const key in this.constructor.properties) {
            ob[key] = this[key];
        }

        // entries will only return enumerable key/value pairs within the instance, and not the prototype chain. 
        Object.entries(this).forEach(([key, value]) => {
            if (['world', 'entity'].indexOf(key) === -1) {
                ob[key] = value;
            }
            
        });

        return ob;
    }

    onAttached(entity) {}
    onDestroyed() {}
    onEvent(evt) {}
}
