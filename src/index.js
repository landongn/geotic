export { Engine } from './Engine';
export { Component } from './Component';

// Serialization utilities
export { CURRENT_SCHEMA_VERSION, LEGACY_SCHEMA_VERSION, MARKERS } from './serialization/constants.js';
export { bigintReplacer, bigintReviver } from './serialization/SerializationHelpers.js';
export { MigrationRegistry } from './serialization/MigrationRegistry.js';
export { ArtifactValidator, ValidationError } from './serialization/ArtifactValidator.js';
