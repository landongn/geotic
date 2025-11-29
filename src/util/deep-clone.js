import { bigintReplacer, bigintReviver } from '../serialization/SerializationHelpers.js';

export const deepClone = (ob) => JSON.parse(JSON.stringify(ob, bigintReplacer), bigintReviver);
