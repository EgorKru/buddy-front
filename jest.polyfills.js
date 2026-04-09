const { TextDecoder, TextEncoder } = require('util');
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}

if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
}
