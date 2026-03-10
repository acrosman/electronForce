/**
 * @jest-environment jsdom
 */

// render.js uses module-level addEventListener calls that require these elements
// to exist in the DOM before the module is loaded.
const MODULE_LEVEL_IDS = [
  'connect-logout-trigger',
  'settingsModal',
  'settings-save-trigger',
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

  // Elements updated by response_login / response_logout.
  ['org-status', 'api-request-form'].forEach((id) => {
    if (!document.getElementById(id)) {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    }
  });

  if (!document.getElementById('active-org-id')) {
    const el = document.createElement('span');
    el.id = 'active-org-id';
    document.body.appendChild(el);
  }

  if (!document.getElementById('raw-response')) {
    const el = document.createElement('pre');
    el.id = 'raw-response';
    document.body.appendChild(el);
  }

  // Settings form fields and status message.
  ['settings-consumer-key', 'settings-consumer-secret', 'settings-login-url', 'settings-callback-port'].forEach((id) => {
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

  // Mock bootstrap so the connect-logout-trigger click handler can call
  // bootstrap.Modal.getOrCreateInstance without throwing in jsdom.
  global.bootstrap = {
    Modal: {
      getOrCreateInstance: jest.fn(() => ({ show: jest.fn() })),
    },
  };

  // Mock jQuery so the $.when($.ready).then(...) block at the top of render.js
  // doesn't throw.  The callback is swallowed and never invoked, which prevents
  // all the complex UI setup code from running during tests.
  const jQueryChain = {
    hide: jest.fn(),
    show: jest.fn(),
    on: jest.fn(),
    text: jest.fn(),
    jsonViewer: jest.fn(),
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
// ── response_login ────────────────────────────────────────────────────────
describe('response_login handler', () => {
  beforeEach(() => {
    mockSend.mockClear();
    // Reset connect button to the disconnected state.
    const btn = document.getElementById('connect-logout-trigger');
    btn.textContent = 'Create New Connection';
    btn.classList.remove('btn-warning');
    btn.classList.add('btn-info');
    document.getElementById('org-status').style.display = 'none';
    document.getElementById('api-request-form').style.display = 'none';
  });

  it('registers a receive listener for response_login', () => {
    expect(receivedCallbacks.response_login).toBeDefined();
  });

  it('changes the button text to "Log Out" on successful login', () => {
    receivedCallbacks.response_login({
      status: true,
      message: 'Login Successful',
      response: { organizationId: '00Dxx0000001gEQ' },
      request: { username: 'user@example.com' },
    });

    expect(document.getElementById('connect-logout-trigger').textContent).toBe('Log Out');
  });

  it('adds btn-warning class and removes btn-info on login', () => {
    receivedCallbacks.response_login({
      status: true,
      message: 'Login Successful',
      response: { organizationId: '00Dxx0000001gEQ' },
      request: { username: 'user@example.com' },
    });

    const btn = document.getElementById('connect-logout-trigger');
    expect(btn.classList.contains('btn-warning')).toBe(true);
    expect(btn.classList.contains('btn-info')).toBe(false);
  });

  it('shows org-status on successful login', () => {
    receivedCallbacks.response_login({
      status: true,
      message: 'Login Successful',
      response: { organizationId: '00Dxx0000001gEQ' },
      request: { username: 'user@example.com' },
    });

    expect(document.getElementById('org-status').style.display).toBe('block');
  });

  it('does not change the button when status is false', () => {
    receivedCallbacks.response_login({ status: false, message: 'Failed' });

    expect(document.getElementById('connect-logout-trigger').textContent).toBe('Create New Connection');
  });
});

// ── response_logout ───────────────────────────────────────────────────────
describe('response_logout handler', () => {
  beforeEach(() => {
    mockSend.mockClear();
    // Simulate a connected state before logout.
    const btn = document.getElementById('connect-logout-trigger');
    btn.textContent = 'Log Out';
    btn.classList.add('btn-warning');
    btn.classList.remove('btn-info');
    document.getElementById('org-status').style.display = 'block';
    document.getElementById('api-request-form').style.display = 'block';
  });

  it('registers a receive listener for response_logout', () => {
    expect(receivedCallbacks.response_logout).toBeDefined();
  });

  it('resets the button text to "Create New Connection"', () => {
    receivedCallbacks.response_logout({ status: true, message: 'Logout Successful' });

    expect(document.getElementById('connect-logout-trigger').textContent).toBe('Create New Connection');
  });

  it('adds btn-info class and removes btn-warning after logout', () => {
    receivedCallbacks.response_logout({ status: true, message: 'Logout Successful' });

    const btn = document.getElementById('connect-logout-trigger');
    expect(btn.classList.contains('btn-info')).toBe(true);
    expect(btn.classList.contains('btn-warning')).toBe(false);
  });

  it('hides org-status after logout', () => {
    receivedCallbacks.response_logout({ status: true, message: 'Logout Successful' });

    expect(document.getElementById('org-status').style.display).toBe('none');
  });
});

// ── response_settings ──────────────────────────────────────────────────────
describe('response_settings handler', () => {
  beforeEach(() => {
    // Reset field values before each test.
    document.getElementById('settings-consumer-key').value = '';
    document.getElementById('settings-consumer-secret').value = '';
    document.getElementById('settings-login-url').value = '';
    document.getElementById('settings-callback-port').value = '';
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
        callbackPort: 8080,
      },
    });

    expect(document.getElementById('settings-consumer-key').value).toBe('myKey');
    expect(document.getElementById('settings-consumer-secret').value).toBe('mySecret');
    expect(document.getElementById('settings-login-url').value).toBe('https://test.salesforce.com');
    expect(document.getElementById('settings-callback-port').value).toBe('8080');
  });

  it('populates callbackPort with the value from the response', () => {
    receivedCallbacks.response_settings({
      status: true,
      message: '',
      response: {
        consumerKey: '', consumerSecret: '', loginUrl: '', callbackPort: 4000,
      },
    });

    expect(document.getElementById('settings-callback-port').value).toBe('4000');
  });

  it('defaults callbackPort to 3835 when the response value is absent', () => {
    receivedCallbacks.response_settings({
      status: true,
      message: '',
      response: { consumerKey: '', consumerSecret: '', loginUrl: '' },
    });

    expect(document.getElementById('settings-callback-port').value).toBe('3835');
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

  it('does not clear the consumerSecret field when consumerSecret is absent from the response', () => {
    document.getElementById('settings-consumer-secret').value = 'existing-secret';

    receivedCallbacks.response_settings({
      status: true,
      message: 'Settings Saved',
      response: { consumerKey: 'k', loginUrl: 'https://login.salesforce.com' },
    });

    expect(document.getElementById('settings-consumer-secret').value).toBe('existing-secret');
  });
});

// ── sf_save_settings ───────────────────────────────────────────────────────
describe('sf_save_settings send', () => {
  beforeEach(() => {
    mockSend.mockClear();
    document.getElementById('settings-consumer-key').value = '';
    document.getElementById('settings-consumer-secret').value = '';
    document.getElementById('settings-login-url').value = '';
    document.getElementById('settings-callback-port').value = '';
  });

  it('includes callbackPort in the payload when a valid port is entered', () => {
    document.getElementById('settings-consumer-key').value = 'testKey';
    document.getElementById('settings-consumer-secret').value = 'testSecret';
    document.getElementById('settings-login-url').value = 'https://login.salesforce.com';
    document.getElementById('settings-callback-port').value = '4000';

    document.getElementById('settings-save-trigger').click();

    expect(mockSend).toHaveBeenCalledWith('sf_save_settings', {
      consumerKey: 'testKey',
      consumerSecret: 'testSecret',
      loginUrl: 'https://login.salesforce.com',
      callbackPort: 4000,
    });
  });

  it('falls back to 3835 when callbackPort field is empty', () => {
    document.getElementById('settings-consumer-key').value = 'k';
    document.getElementById('settings-consumer-secret').value = 's';
    document.getElementById('settings-login-url').value = 'https://login.salesforce.com';
    document.getElementById('settings-callback-port').value = '';

    document.getElementById('settings-save-trigger').click();

    expect(mockSend).toHaveBeenCalledWith('sf_save_settings', expect.objectContaining({
      callbackPort: 3835,
    }));
  });

  it('sends the default port 3835 when the field value is already 3835', () => {
    document.getElementById('settings-consumer-key').value = 'k';
    document.getElementById('settings-consumer-secret').value = 's';
    document.getElementById('settings-login-url').value = 'https://login.salesforce.com';
    document.getElementById('settings-callback-port').value = '3835';

    document.getElementById('settings-save-trigger').click();

    expect(mockSend).toHaveBeenCalledWith('sf_save_settings', expect.objectContaining({
      callbackPort: 3835,
    }));
  });
});
