/**
 * @jest-environment jsdom
 */

// render.js uses module-level addEventListener calls that require these elements
// to exist in the DOM before the module is loaded.
const MODULE_LEVEL_IDS = [
  'authorize-trigger',
  'settingsModal',
  'settings-save-trigger',
  'logout-trigger',
];

// Map to capture callbacks registered via window.api.receive.
const receivedCallbacks = {};
const mockSend = jest.fn();

function createDomFixtures() {
  MODULE_LEVEL_IDS.forEach((id) => {
    if (!document.getElementById(id)) {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    }
  });

  // Also create login-response-message so replaceText doesn't throw when
  // the response_oauth_url handler fires.
  if (!document.getElementById('login-response-message')) {
    const el = document.createElement('span');
    el.id = 'login-response-message';
    document.body.appendChild(el);
  }
}

beforeAll(() => {
  createDomFixtures();

  // Mock jQuery so the $.when($.ready).then(...) block at the top of render.js
  // doesn't throw.  The callback is swallowed and never invoked, which prevents
  // all the complex UI setup code from running during tests.
  const jQueryChain = {
    hide: jest.fn(),
    show: jest.fn(),
    on: jest.fn(),
    text: jest.fn(),
  };
  const jqFn = jest.fn(() => jQueryChain);
  jqFn.when = jest.fn(() => ({ then: jest.fn() }));
  jqFn.ready = {};
  global.$ = jqFn;

  // Set up window.api *before* the module loads so all window.api.receive
  // registrations are intercepted and stored in receivedCallbacks.
  window.api = {
    send: mockSend,
    receive: jest.fn((channel, fn) => {
      receivedCallbacks[channel] = fn;
    }),
  };

  // Load render.js in an isolated module registry.  All module-level code
  // executes synchronously at this point.
  jest.isolateModules(() => {
    require('../app/render'); // eslint-disable-line global-require
  });
});

// ── response_oauth_url ─────────────────────────────────────────────────────
describe('response_oauth_url handler', () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it('registers a receive listener for response_oauth_url', () => {
    expect(receivedCallbacks.response_oauth_url).toBeDefined();
  });

  it('calls window.api.send with sf_open_browser and the provided URL', () => {
    receivedCallbacks.response_oauth_url({ url: 'https://login.salesforce.com/auth?client_id=test' });

    expect(mockSend).toHaveBeenCalledWith('sf_open_browser', {
      url: 'https://login.salesforce.com/auth?client_id=test',
    });
  });

  it('passes the exact URL from the data payload through to sf_open_browser', () => {
    const testUrl = 'https://custom.salesforce.com/services/oauth2/authorize?response_type=code';
    receivedCallbacks.response_oauth_url({ url: testUrl });

    expect(mockSend).toHaveBeenCalledWith('sf_open_browser', { url: testUrl });
  });

  it('does not call window.api.send with sf_login', () => {
    receivedCallbacks.response_oauth_url({ url: 'https://login.salesforce.com/auth' });

    const loginCall = mockSend.mock.calls.find(([channel]) => channel === 'sf_login');
    expect(loginCall).toBeUndefined();
  });
});
