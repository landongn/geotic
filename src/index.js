export { Engine } from './Engine';
export { Component } from './Component';

// Serialization utilities
export { CURRENT_SCHEMA_VERSION, LEGACY_SCHEMA_VERSION, MARKERS } from './serialization/constants.js';
export { bigintReplacer, bigintReviver } from './serialization/SerializationHelpers.js';
