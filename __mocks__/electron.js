const os = require('os');
const path = require('path');

module.exports = {
  app: {
    getPath: jest.fn(() => path.join(os.tmpdir(), 'electronforce-test')),
  },
};
