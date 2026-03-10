const os = require('os');
const path = require('path');

module.exports = {
  app: {
    getPath: jest.fn(() => path.join(os.tmpdir(), 'electronforce-test')),
  },
  shell: {
    openExternal: jest.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => true),
    // Passthrough: encode the string into a Buffer so round-trips work in tests.
    encryptString: jest.fn((str) => Buffer.from(str, 'utf8')),
    // Passthrough: decode the Buffer back to the original string.
    decryptString: jest.fn((buf) => buf.toString('utf8')),
  },
};
