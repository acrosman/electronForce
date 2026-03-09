// Use the shared manual mock for app.getPath and shell.openExternal.
jest.mock('electron');
jest.mock('../src/settings');
jest.mock('jsforce');
jest.mock('http');

const http = require('http');
const { shell } = require('electron');
const jsforce = require('jsforce');
const settings = require('../src/settings');

// ── Shared mock objects ────────────────────────────────────────────────────
const mockServer = {
  listen: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
};

const mockSend = jest.fn();
const mockWindow = { webContents: { send: mockSend } };

// Small helpers to build minimal request / response objects.
const makeReq = (url) => ({ url });
const makeRes = () => ({ writeHead: jest.fn(), end: jest.fn() });

// ── Module under test ──────────────────────────────────────────────────────
// Loaded once; setWindow is called in beforeAll so mainWindow is always set.
const { handlers, setWindow, createConnection } = require('../src/electronForce');

// ── sf_oauth_start ─────────────────────────────────────────────────────────
describe('sf_oauth_start', () => {
  let mockGetAuthorizationUrl;
  let mockOAuth2Instance;
  let mockAuthorize;
  let mockIdentity;
  let mockConnInstance;

  beforeAll(() => {
    jest.useFakeTimers();
    setWindow(mockWindow);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Always return a mock server from createServer.
    http.createServer.mockReturnValue(mockServer);

    // Default settings.
    settings.getSettings.mockReturnValue({
      consumerKey: 'test-client-id',
      consumerSecret: 'test-client-secret',
      loginUrl: 'https://login.salesforce.com',
      callbackPort: 3835,
    });

    // jsforce.OAuth2 mock.
    mockGetAuthorizationUrl = jest.fn(
      () => 'https://login.salesforce.com/authorize?client_id=test',
    );
    mockOAuth2Instance = { getAuthorizationUrl: mockGetAuthorizationUrl };
    jsforce.OAuth2 = jest.fn(() => mockOAuth2Instance);

    // jsforce.Connection mock (used during the callback token exchange).
    mockAuthorize = jest.fn().mockResolvedValue({
      id: 'https://login.salesforce.com/id/00D000000000001/005000000000001',
      organizationId: '00D000000000001',
    });
    mockIdentity = jest.fn().mockResolvedValue({ username: 'user@example.com' });
    mockConnInstance = {
      authorize: mockAuthorize,
      identity: mockIdentity,
      instanceUrl: 'https://myorg.salesforce.com',
      accessToken: 'ACCESS_TOKEN',
      refreshToken: 'REFRESH_TOKEN',
      limitInfo: {},
      on: jest.fn(),
    };
    jsforce.Connection = jest.fn(() => mockConnInstance);
  });

  it('reads settings to configure OAuth2', async () => {
    await handlers.sf_oauth_start({}, {});
    expect(settings.getSettings).toHaveBeenCalled();
  });

  it('constructs OAuth2 with values from settings', async () => {
    await handlers.sf_oauth_start({}, {});
    expect(jsforce.OAuth2).toHaveBeenCalledWith({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3835/callback',
      loginUrl: 'https://login.salesforce.com',
    });
  });

  it('sends response_oauth_url with the authorization URL', async () => {
    await handlers.sf_oauth_start({}, {});
    expect(mockSend).toHaveBeenCalledWith('response_oauth_url', {
      url: 'https://login.salesforce.com/authorize?client_id=test',
    });
  });

  it('calls shell.openExternal with the authorization URL', async () => {
    await handlers.sf_oauth_start({}, {});
    expect(shell.openExternal).toHaveBeenCalledWith(
      'https://login.salesforce.com/authorize?client_id=test',
    );
  });

  it('starts the HTTP server on the configured callback port', async () => {
    await handlers.sf_oauth_start({}, {});
    expect(mockServer.listen).toHaveBeenCalledWith(3835);
  });

  it('registers a close handler on the server to clear the timeout', async () => {
    await handlers.sf_oauth_start({}, {});
    expect(mockServer.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('sends response_generic when getSettings throws', async () => {
    settings.getSettings.mockImplementation(() => {
      throw new Error('read error');
    });

    await handlers.sf_oauth_start({}, {});

    expect(mockSend).toHaveBeenCalledWith(
      'response_generic',
      expect.objectContaining({ status: false, message: 'OAuth Start Failed' }),
    );
  });

  it('closes the server after the 5-minute timeout', async () => {
    await handlers.sf_oauth_start({}, {});
    mockServer.close.mockClear();
    jest.advanceTimersByTime(5 * 60 * 1000);
    expect(mockServer.close).toHaveBeenCalled();
  });

  // ── Callback server request handler ──────────────────────────────────────
  describe('HTTP callback request handler', () => {
    let requestListener;

    beforeEach(async () => {
      await handlers.sf_oauth_start({}, {});
      // The listener is the first argument passed to http.createServer().
      [[requestListener]] = http.createServer.mock.calls;
    });

    it('responds 404 for non-/callback paths', async () => {
      const req = makeReq('/other');
      const res = makeRes();
      await requestListener(req, res);
      expect(res.writeHead).toHaveBeenCalledWith(404);
    });

    it('sends response_login with the correct shape on a successful code exchange', async () => {
      const req = makeReq('/callback?code=AUTH_CODE');
      const res = makeRes();
      await requestListener(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(mockSend).toHaveBeenCalledWith('response_login', {
        status: true,
        message: 'Login Successful',
        response: expect.objectContaining({ organizationId: '00D000000000001' }),
        limitInfo: {},
        request: { username: 'user@example.com' },
      });
    });

    it('passes the auth code directly to conn.authorize', async () => {
      const req = makeReq('/callback?code=MY_AUTH_CODE');
      const res = makeRes();
      await requestListener(req, res);
      expect(mockAuthorize).toHaveBeenCalledWith('MY_AUTH_CODE');
    });

    it('closes the server after a successful code exchange', async () => {
      const req = makeReq('/callback?code=AUTH_CODE');
      const res = makeRes();
      mockServer.close.mockClear();
      await requestListener(req, res);
      expect(mockServer.close).toHaveBeenCalled();
    });

    it('sends response_generic and closes the server when OAuth returns an error parameter', async () => {
      const req = makeReq('/callback?error=access_denied');
      const res = makeRes();
      mockServer.close.mockClear();
      await requestListener(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(400);
      expect(mockServer.close).toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith(
        'response_generic',
        expect.objectContaining({ status: false, message: 'OAuth Failed' }),
      );
    });

    it('sends response_generic when no code parameter is present', async () => {
      const req = makeReq('/callback');
      const res = makeRes();
      await requestListener(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(400);
      expect(mockSend).toHaveBeenCalledWith(
        'response_generic',
        expect.objectContaining({ status: false, message: 'OAuth Failed' }),
      );
    });

    it('sends response_generic when token exchange rejects', async () => {
      mockAuthorize.mockRejectedValue(new Error('token error'));

      const req = makeReq('/callback?code=BAD_CODE');
      const res = makeRes();
      await requestListener(req, res);

      expect(mockSend).toHaveBeenCalledWith(
        'response_generic',
        expect.objectContaining({
          status: false,
          message: 'OAuth Token Exchange Failed',
          response: 'Error: token error',
        }),
      );
    });

    it('stores the refreshToken in the connection entry', async () => {
      const req = makeReq('/callback?code=AUTH_CODE');
      const res = makeRes();
      await requestListener(req, res);

      jsforce.Connection.mockClear();
      await handlers.sf_query({}, { org: '00D000000000001', rest_api_soql_text: 'SELECT Id FROM Account' });

      expect(jsforce.Connection).toHaveBeenCalledWith(
        expect.objectContaining({ refreshToken: 'REFRESH_TOKEN' }),
      );
    });

    it('stores the oauth2 config in the connection entry', async () => {
      const req = makeReq('/callback?code=AUTH_CODE');
      const res = makeRes();
      await requestListener(req, res);

      jsforce.Connection.mockClear();
      await handlers.sf_query({}, { org: '00D000000000001', rest_api_soql_text: 'SELECT Id FROM Account' });

      expect(jsforce.Connection).toHaveBeenCalledWith(
        expect.objectContaining({
          oauth2: expect.objectContaining({ clientId: 'test-client-id' }),
        }),
      );
    });

    it('attaches a refresh listener to the connection after successful code exchange', async () => {
      const req = makeReq('/callback?code=AUTH_CODE');
      const res = makeRes();
      await requestListener(req, res);

      expect(mockConnInstance.on).toHaveBeenCalledWith('refresh', expect.any(Function));
    });

    it('refresh listener updates the stored access token', async () => {
      const req = makeReq('/callback?code=AUTH_CODE');
      const res = makeRes();
      await requestListener(req, res);

      const [[, refreshListener]] = mockConnInstance.on.mock.calls.filter(
        ([event]) => event === 'refresh',
      );

      refreshListener('NEW_ACCESS_TOKEN');

      jsforce.Connection.mockClear();
      await handlers.sf_query({}, { org: '00D000000000001', rest_api_soql_text: 'SELECT Id FROM Account' });

      expect(jsforce.Connection).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: 'NEW_ACCESS_TOKEN' }),
      );
    });
  });
});

// ── sf_get_settings ──────────────────────────────────────────────────────────────────────────
describe('sf_get_settings', () => {
  beforeAll(() => {
    setWindow(mockWindow);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends response_settings with status true and the settings object on success', async () => {
    const mockSettingsData = {
      consumerKey: 'key',
      consumerSecret: 'secret',
      loginUrl: 'https://login.salesforce.com',
      callbackPort: 3835,
    };
    settings.getSettings.mockReturnValue(mockSettingsData);

    await handlers.sf_get_settings({}, {});

    expect(mockSend).toHaveBeenCalledWith('response_settings', {
      status: true,
      message: 'Settings Loaded',
      response: mockSettingsData,
      limitInfo: {},
      request: {},
    });
  });

  it('sends response_generic with status false when getSettings throws', async () => {
    settings.getSettings.mockImplementation(() => {
      throw new Error('disk read error');
    });

    await handlers.sf_get_settings({}, {});

    expect(mockSend).toHaveBeenCalledWith(
      'response_generic',
      expect.objectContaining({ status: false, message: 'Get Settings Failed' }),
    );
  });
});

// ── sf_save_settings ─────────────────────────────────────────────────────────────────────
describe('sf_save_settings', () => {
  const settingsArgs = {
    consumerKey: 'new-key',
    consumerSecret: 'new-secret',
    loginUrl: 'https://test.salesforce.com',
    callbackPort: 4000,
  };

  beforeAll(() => {
    setWindow(mockWindow);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends response_settings with status true when saveSettings returns true', async () => {
    settings.saveSettings.mockReturnValue(true);

    await handlers.sf_save_settings({}, settingsArgs);

    expect(mockSend).toHaveBeenCalledWith(
      'response_settings',
      expect.objectContaining({ status: true, message: 'Settings Saved' }),
    );
  });

  it('sends response_generic with status false when saveSettings returns false', async () => {
    settings.saveSettings.mockReturnValue(false);

    await handlers.sf_save_settings({}, settingsArgs);

    expect(mockSend).toHaveBeenCalledWith(
      'response_generic',
      expect.objectContaining({ status: false, message: 'Save Settings Failed' }),
    );
  });

  it('sends response_generic with status false when saveSettings throws', async () => {
    settings.saveSettings.mockImplementation(() => {
      throw new Error('write error');
    });

    await handlers.sf_save_settings({}, settingsArgs);

    expect(mockSend).toHaveBeenCalledWith(
      'response_generic',
      expect.objectContaining({ status: false, message: 'Save Settings Failed' }),
    );
  });
});

// ── createConnection ──────────────────────────────────────────────────────
describe('createConnection', () => {
  let mockConnInstance;

  beforeAll(() => {
    setWindow(mockWindow);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockConnInstance = { limitInfo: {}, on: jest.fn() };
    jsforce.Connection = jest.fn(() => mockConnInstance);
  });

  it('returns the jsforce.Connection instance', () => {
    expect(createConnection('any-org')).toBe(mockConnInstance);
  });

  it('calls jsforce.Connection exactly once', () => {
    createConnection('any-org');
    expect(jsforce.Connection).toHaveBeenCalledTimes(1);
  });

  it('attaches a refresh event listener to the connection', () => {
    createConnection('any-org');
    expect(mockConnInstance.on).toHaveBeenCalledWith('refresh', expect.any(Function));
  });

  it('refresh listener updates sfConnections[org].accessToken', () => {
    // '00D000000000001' was seeded into sfConnections by the oauth callback
    // suite above (module state is shared across describe blocks).
    const ORG = '00D000000000001';
    let capturedListener;
    mockConnInstance.on = jest.fn((event, cb) => {
      if (event === 'refresh') capturedListener = cb;
    });

    createConnection(ORG);
    capturedListener('UPDATED_TOKEN');

    // Verify the updated token is passed through on the next createConnection call.
    jsforce.Connection = jest.fn(() => mockConnInstance);
    createConnection(ORG);
    expect(jsforce.Connection).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'UPDATED_TOKEN' }),
    );
  });
});
