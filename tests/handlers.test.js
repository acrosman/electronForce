// Use the shared manual mocks so the module loads without side effects.
jest.mock('electron');
jest.mock('../src/settings');
jest.mock('jsforce');
jest.mock('http');

const { handlers } = require('../src/electronForce');

describe('handlers export', () => {
  it('exports a handlers object', () => {
    expect(typeof handlers).toBe('object');
    expect(handlers).not.toBeNull();
  });

  it('does not contain sf_login', () => {
    expect(handlers).not.toHaveProperty('sf_login');
  });

  it('contains sf_oauth_start', () => {
    expect(handlers).toHaveProperty('sf_oauth_start');
    expect(typeof handlers.sf_oauth_start).toBe('function');
  });

  it('contains get_log_messages', () => {
    expect(handlers).toHaveProperty('get_log_messages');
  });

  it('contains sf_logout', () => {
    expect(handlers).toHaveProperty('sf_logout');
  });
});
