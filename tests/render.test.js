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

  // Settings form fields and status message.
  ['settings-consumer-key', 'settings-consumer-secret', 'settings-login-url'].forEach((id) => {
    if (!document.getElementById(id)) {
      const el = document.createElement('input');
      el.id = id;
      document.body.appendChild(el);
    }
  });

  if (!document.getElementById('settings-status-message')) {
    const el = document.createElement('span');
    el.id = 'settings-status-message';
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

  it('does not call window.api.send at all (browser is opened by main process)', () => {
    receivedCallbacks.response_oauth_url({ url: 'https://login.salesforce.com/auth?client_id=test' });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('updates login-response-message with a waiting-for-authorization notice', () => {
    receivedCallbacks.response_oauth_url({ url: 'https://custom.salesforce.com/services/oauth2/authorize?response_type=code' });

    const el = document.getElementById('login-response-message');
    expect(el.innerText).toBe('Waiting for authorization in browser\u2026');
  });

  it('does not call window.api.send with sf_login', () => {
    receivedCallbacks.response_oauth_url({ url: 'https://login.salesforce.com/auth' });

    const loginCall = mockSend.mock.calls.find(([channel]) => channel === 'sf_login');
    expect(loginCall).toBeUndefined();
  });
});
// ── response_settings ──────────────────────────────────────────────────────
describe('response_settings handler', () => {
  beforeEach(() => {
    // Reset field values before each test.
    document.getElementById('settings-consumer-key').value = '';
    document.getElementById('settings-consumer-secret').value = '';
    document.getElementById('settings-login-url').value = '';
    document.getElementById('settings-status-message').innerText = '';
  });

  it('registers a receive listener for response_settings', () => {
    expect(receivedCallbacks.response_settings).toBeDefined();
  });

  it('populates fields with empty strings when response values are empty strings', () => {
    receivedCallbacks.response_settings({
      status: true,
      message: '',
      response: { consumerKey: '', consumerSecret: '', loginUrl: '' },
    });

    expect(document.getElementById('settings-consumer-key').value).toBe('');
    expect(document.getElementById('settings-consumer-secret').value).toBe('');
    expect(document.getElementById('settings-login-url').value).toBe('https://login.salesforce.com');
  });

  it('populates fields with provided non-empty values', () => {
    receivedCallbacks.response_settings({
      status: true,
      message: '',
      response: {
        consumerKey: 'myKey',
        consumerSecret: 'mySecret',
        loginUrl: 'https://test.salesforce.com',
      },
    });

    expect(document.getElementById('settings-consumer-key').value).toBe('myKey');
    expect(document.getElementById('settings-consumer-secret').value).toBe('mySecret');
    expect(document.getElementById('settings-login-url').value).toBe('https://test.salesforce.com');
  });

  it('sets status message to "Settings saved." when status is true and message is "Settings Saved"', () => {
    receivedCallbacks.response_settings({
      status: true,
      message: 'Settings Saved',
      response: { consumerKey: 'k', consumerSecret: 's', loginUrl: 'https://login.salesforce.com' },
    });

    expect(document.getElementById('settings-status-message').innerText).toBe('Settings saved.');
  });

  it('shows error message text when status is false', () => {
    receivedCallbacks.response_settings({
      status: false,
      message: 'Failed to save settings.',
      response: {},
    });

    expect(document.getElementById('settings-status-message').innerText).toBe('Failed to save settings.');
  });

  it('falls back to generic error text when status is false and message is absent', () => {
    receivedCallbacks.response_settings({
      status: false,
      message: '',
      response: {},
    });

    expect(document.getElementById('settings-status-message').innerText).toBe('An error occurred saving settings.');
  });
});
