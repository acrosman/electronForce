const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');
const jsforce = require('jsforce');
// eslint-disable-next-line import/no-extraneous-dependencies
const { shell } = require('electron');
const settings = require('./settings');

const sfConnections = {};
const logMessages = [];
let mainWindow = null;
let oauthCallbackServer = null;

const setWindow = (window) => {
  mainWindow = window;
};

const logMessage = (channel, message, data) => {
  const ts = Date.now();
  const newMessage = {
    timestamp: ts,
    channel,
    message,
    data,
  };

  logMessages.unshift(newMessage);
};

const createConnection = (org) => {
  if (!sfConnections[org]) {
    throw new Error(`Not connected to org: ${org}`);
  }
  const conn = new jsforce.Connection(sfConnections[org]);
  conn.on('refresh', (newAccessToken) => {
    sfConnections[org].accessToken = newAccessToken;
    logMessage('Info', `Access token refreshed for org ${org}`);
  });
  return conn;
};

const handlers = {
  // Send a list of log messages to the main window.
  get_log_messages: (event, args) => {
    const { offset, count } = args;
    mainWindow.webContents.send('log_messages', {
      messages: logMessages.slice(offset, offset + count),
      totalCount: logMessages.length,
    });
  },
  // Start an OAuth login flow using a Connected App.
  sf_oauth_start: async (event, args) => {
    try {
      const {
        consumerKey,
        consumerSecret,
        loginUrl,
        callbackPort,
      } = settings.getSettings();

      if (!consumerKey || !consumerSecret) {
        logMessage('Warn', 'OAuth start attempted without Connected App credentials configured');
        mainWindow.webContents.send('response_generic', {
          status: false,
          message: 'No Connected App credentials configured. Please open Settings and enter your Consumer Key and Consumer Secret.',
          response: '',
          limitInfo: {},
          request: args,
        });
        return;
      }

      const port = callbackPort || 3835;

      // Close any previously open callback server before starting a new one.
      if (oauthCallbackServer) {
        oauthCallbackServer.close();
        oauthCallbackServer = null;
      }

      // useVerifier enables PKCE: jsforce generates a code_verifier, includes
      // the code_challenge in the auth URL, and sends the verifier at token exchange.
      const oauth2 = new jsforce.OAuth2({
        clientId: consumerKey,
        clientSecret: consumerSecret,
        redirectUri: `http://localhost:${port}/callback`,
        loginUrl,
        useVerifier: true,
      });

      const state = crypto.randomBytes(16).toString('hex');
      const authUrl = oauth2.getAuthorizationUrl({ scope: 'api refresh_token', state });

      // Notify the renderer so it can show a status message.
      mainWindow.webContents.send('response_oauth_url', { url: authUrl });

      // Open the user's default browser directly from the main process.
      shell.openExternal(authUrl);

      // One-time HTTP server to receive the OAuth callback.
      const server = http.createServer(async (req, res) => {
        const reqUrl = new URL(req.url, `http://127.0.0.1:${port}`);

        if (reqUrl.pathname !== '/callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const returnedState = reqUrl.searchParams.get('state');
        if (!returnedState || returnedState !== state) {
          res.writeHead(400);
          res.end('Invalid state parameter');
          server.close();
          logMessage('Error', 'OAuth callback state mismatch – possible CSRF attempt');
          mainWindow.webContents.send('response_generic', {
            status: false,
            message: 'OAuth Failed',
            response: 'Invalid state parameter',
            limitInfo: {},
            request: args,
          });
          return;
        }

        const code = reqUrl.searchParams.get('code');
        const oauthError = reqUrl.searchParams.get('error');

        if (oauthError || !code) {
          res.writeHead(400);
          res.end(`OAuth error: ${oauthError || 'No code returned'}`);
          server.close();
          logMessage('Error', `OAuth callback error: ${oauthError}`);
          mainWindow.webContents.send('response_generic', {
            status: false,
            message: 'OAuth Failed',
            response: String(oauthError || 'No code returned'),
            limitInfo: {},
            request: args,
          });
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Authentication successful! You may close this tab.</h1></body></html>');
        server.close();

        try {
          const conn = new jsforce.Connection({ oauth2, loginUrl });
          const userInfo = await conn.authorize(code);
          const identity = await conn.identity();

          sfConnections[userInfo.organizationId] = {
            instanceUrl: conn.instanceUrl,
            accessToken: conn.accessToken,
            refreshToken: conn.refreshToken,
            version: '63.0',
            oauth2: {
              clientId: consumerKey,
              clientSecret: consumerSecret,
              loginUrl,
              redirectUri: `http://localhost:${port}/callback`,
            },
          };

          conn.on('refresh', (newAccessToken) => {
            sfConnections[userInfo.organizationId].accessToken = newAccessToken;
            logMessage('Info', `Access token refreshed for org ${userInfo.organizationId}`);
          });

          logMessage('Info', `OAuth Connection Org ${userInfo.organizationId} for User ${identity.username}`);

          mainWindow.webContents.send('response_login', {
            status: true,
            message: 'Login Successful',
            response: userInfo,
            limitInfo: conn.limitInfo,
            request: { username: identity.username },
          });
        } catch (authErr) {
          logMessage('Error', `OAuth token exchange failed: ${authErr}`);
          mainWindow.webContents.send('response_generic', {
            status: false,
            message: 'OAuth Token Exchange Failed',
            response: String(authErr),
            limitInfo: {},
            request: args,
          });
        }
      });

      oauthCallbackServer = server;
      server.listen(port, '127.0.0.1');

      server.on('error', (serverErr) => {
        logMessage('Error', `OAuth callback server error: ${serverErr}`);
        mainWindow.webContents.send('response_generic', {
          status: false,
          message: 'OAuth Callback Server Error',
          response: String(serverErr),
          limitInfo: {},
          request: args,
        });
      });

      // Close the server automatically after 5 minutes.
      const timeout = setTimeout(() => {
        server.close();
        logMessage('Info', 'OAuth callback server closed after 5-minute timeout');
      }, 5 * 60 * 1000);

      server.on('close', () => {
        clearTimeout(timeout);
        oauthCallbackServer = null;
      });
    } catch (err) {
      logMessage('Error', `OAuth Start Failed: ${err}`);
      mainWindow.webContents.send('response_generic', {
        status: false,
        message: 'OAuth Start Failed',
        response: String(err),
        limitInfo: {},
        request: args,
      });
    }
  },

  // Load settings and send them to the renderer.
  sf_get_settings: async (event, args) => {
    try {
      const settingsData = settings.getSettings();
      logMessage('Info', 'Settings Loaded');
      mainWindow.webContents.send('response_settings', {
        status: true,
        message: 'Settings Loaded',
        response: settingsData,
        limitInfo: {},
        request: args,
      });
    } catch (err) {
      logMessage('Error', `Get Settings Failed: ${err}`);
      mainWindow.webContents.send('response_generic', {
        status: false,
        message: 'Get Settings Failed',
        response: String(err),
        limitInfo: {},
        request: args,
      });
    }
  },

  // Save settings received from the renderer.
  sf_save_settings: async (event, args) => {
    try {
      const {
        consumerKey,
        consumerSecret,
        loginUrl,
        callbackPort,
      } = args;
      const saved = settings.saveSettings({
        consumerKey,
        consumerSecret,
        loginUrl,
        callbackPort,
      });
      if (!saved) {
        throw new Error('saveSettings returned false');
      }
      logMessage('Info', 'Settings Saved');
      mainWindow.webContents.send('response_settings', {
        status: true,
        message: 'Settings Saved',
        response: {
          consumerKey,
          loginUrl,
          callbackPort,
        },
        limitInfo: {},
        request: args,
      });
    } catch (err) {
      logMessage('Error', `Save Settings Failed: ${err}`);
      mainWindow.webContents.send('response_generic', {
        status: false,
        message: 'Save Settings Failed',
        response: String(err),
        limitInfo: {},
        request: args,
      });
    }
  },

  // Logout of Salesforce.
  sf_logout: async (event, args) => {
    let conn;
    try {
      conn = createConnection(args.org);
      await conn.logout();

      logMessage('Info', `Logged out of ${args.org}`);
      mainWindow.webContents.send('response_logout', {
        status: true,
        message: 'Logout Successful',
        response: {},
        limitInfo: conn.limitInfo,
        request: args,
      });
      delete sfConnections[args.org];
    } catch (err) {
      logMessage('Error', `Logout Failed ${err}`);
      mainWindow.webContents.send('response_logout', {
        status: false,
        message: 'Logout Failed',
        response: `${err}`,
        limitInfo: conn ? conn.limitInfo : {},
        request: args,
      });
    }
  },

  // Run a SOQL Query against your org.
  sf_query: async (event, args) => {
    let conn;
    try {
      conn = createConnection(args.org);
      const result = await conn.query(args.rest_api_soql_text);

      logMessage('Info', `Ran Query: ${args.rest_api_soql_text}`);

      mainWindow.webContents.send('response_query', {
        status: true,
        message: 'Query Successful',
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
    } catch (err) {
      logMessage('Error', `Query Failed ${err}`);
      mainWindow.webContents.send('response_generic', {
        status: false,
        message: 'Query Failed',
        response: `${err}`,
        limitInfo: conn ? conn.limitInfo : {},
        request: args,
      });
    }
  },

  // Run SOSL search.
  sf_search: async (event, args) => {
    let conn;
    try {
      conn = createConnection(args.org);
      const result = await conn.search(args.rest_api_sosl_text);

      logMessage('Info', `Ran Search: ${args.rest_api_sosl_text}`);

      const adjustedResult = {
        records: result.searchRecords,
        totalSize: 'n/a',
      };

      mainWindow.webContents.send('response_query', {
        status: true,
        message: 'Search Successful',
        response: adjustedResult,
        limitInfo: conn.limitInfo,
        request: args,
      });
    } catch (err) {
      logMessage('Error', `Search Failed ${err}`);
      mainWindow.webContents.send('response_generic', {
        status: false,
        message: 'Search Failed',
        response: `${err}`,
        limitInfo: conn ? conn.limitInfo : {},
        request: args,
      });
    }
  },

  // Run an object describe.
  sf_describe: async (event, args) => {
    let conn;
    try {
      conn = createConnection(args.org);
      const result = await conn.sobject(args.rest_api_describe_text).describe();

      logMessage('Info', `Describe of ${args.rest_api_describe_text} Successful`);

      mainWindow.webContents.send('response_describe', {
        status: true,
        message: `Describe ${args.rest_api_describe_text} Successful`,
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
    } catch (err) {
      logMessage('Error', `Describe Failed ${err}`);
      mainWindow.webContents.send('response_generic', {
        status: false,
        message: 'Describe Failed',
        response: `${err}`,
        limitInfo: conn ? conn.limitInfo : {},
        request: args,
      });
    }
  },

  // Run a Global Describe
  sf_describeGlobal: async (event, args) => {
    let conn;
    try {
      conn = createConnection(args.org);
      const result = await conn.describeGlobal();

      logMessage('Info', 'Global Describe Successful');

      mainWindow.webContents.send('response_describe_global', {
        status: true,
        message: 'Describe Global Successful',
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
    } catch (err) {
      logMessage('Error', `Global Describe Failed ${err}`);
      mainWindow.webContents.send('response_generic', {
        status: false,
        message: 'Describe Global Failed',
        response: `${err}`,
        limitInfo: conn ? conn.limitInfo : {},
        request: args,
      });
    }
  },

  // Fetch the Organization object from the active org.
  sf_orgExplore: async (event, args) => {
    let conn;
    try {
      conn = createConnection(args.org);
      const result = await conn.sobject('Organization').describe();

      const fields = result.fields.map((field) => field.name).join(', ');
      const orgQuery = `SELECT ${fields} FROM Organization`;

      const qResult = await conn.query(orgQuery);

      logMessage('Info', `Fetched Org Details with ${orgQuery}`);

      mainWindow.webContents.send('response_org_object_display', {
        status: true,
        message: 'Fetched Org Details',
        response: qResult.records[0],
        limitInfo: conn.limitInfo,
        request: args,
      });
    } catch (err) {
      logMessage('Error', `Org Fetch Failed ${err}`);
      mainWindow.webContents.send('response_generic', {
        status: false,
        message: 'Org Fetch Failed',
        response: err,
        limitInfo: conn ? conn.limitInfo : {},
        request: args,
      });
    }
  },

  // Report current org limits
  sf_orgLimits: async (event, args) => {
    let conn;
    try {
      conn = createConnection(args.org);
      const result = await conn.limits();

      logMessage('Info', 'Fetched Org limits');

      mainWindow.webContents.send('response_org_limits', {
        status: true,
        message: 'Org Limit Check Successful',
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
    } catch (err) {
      logMessage('Error', `Limit Check Error: ${err}`);
      mainWindow.webContents.send('response_generic', {
        status: false,
        message: 'Limits Check Failed',
        response: `${err}`,
        limitInfo: conn ? conn.limitInfo : {},
        request: args,
      });
    }
  },

  // List all profiles.
  sf_orgProfiles: async (event, args) => {
    let conn;
    try {
      conn = createConnection(args.org);
      const profileQuery = 'SELECT Id, Name, Description FROM Profile';
      const result = await conn.query(profileQuery);

      logMessage('Info', `Fetched Profile listing with: ${profileQuery}`);

      mainWindow.webContents.send('response_query', {
        status: true,
        message: 'Profile Listing Complete',
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
    } catch (err) {
      logMessage('Error', `Profile Listing Error: ${err}`);
      mainWindow.webContents.send('response_generic', {
        status: false,
        message: 'Profile Listing Failed',
        response: `${err}`,
        limitInfo: conn ? conn.limitInfo : {},
        request: args,
      });
    }
  },

  // List all PermSets.
  sf_orgPermSets: async (event, args) => {
    let conn;
    try {
      conn = createConnection(args.org);
      const psQuery = 'SELECT Id, Name, Label, Description, IsCustom, IsOwnedByProfile, Profile.Name FROM PermissionSet ORDER BY IsOwnedByProfile, IsCustom DESC';
      const result = await conn.query(psQuery);

      logMessage('Info', `Fetched Permissions with: ${psQuery}`);

      mainWindow.webContents.send('response_permset_list', {
        status: true,
        message: 'Permission Set Listing Complete',
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
    } catch (err) {
      logMessage('Error', `PermSet Listing Error: ${err}`);
      mainWindow.webContents.send('response_generic', {
        status: false,
        message: 'PermSet Listing Failed',
        response: `${err}`,
        limitInfo: conn ? conn.limitInfo : {},
        request: args,
      });
    }
  },

  // Fetch details about a permission set.
  sf_orgPermSetDetail: async (event, args) => {
    let conn;
    try {
      conn = createConnection(args.org);
      const result = await conn.sobject('PermissionSet').describe();

      logMessage('Info', 'Fetched Permission Set Describe');

      const fieldNames = [
        'Id',
        'Name',
        'Label',
        'IsCustom',
        'IsOwnedByProfile',
        'Profile.Name',
        'Description',
      ];
      for (let i = 0; i < result.fields.length; i += 1) {
        if (!fieldNames.includes(result.fields[i].name)) {
          fieldNames.push(result.fields[i].name);
        }
      }

      const permSetQuery = `SELECT ${fieldNames.join(', ')} FROM PermissionSet WHERE Name = '${args.org_permset_detail_name}' ORDER BY IsOwnedByProfile, IsCustom DESC`;

      const detail = await conn.query(permSetQuery);

      logMessage('Info', `Fetched Permission Set details with: ${permSetQuery}`);

      mainWindow.webContents.send('response_permset_detail', {
        status: true,
        message: 'Permission Set Details Complete',
        response: detail,
        limitInfo: conn.limitInfo,
        request: args,
      });
    } catch (err) {
      logMessage('Error', `Permission Set Detail Lookup Error: ${err}`);
      mainWindow.webContents.send('response_generic', {
        status: false,
        message: 'Permission Set Detail Lookup Failed',
        response: `${err}`,
        limitInfo: conn ? conn.limitInfo : {},
        request: args,
      });
    }
  },
};

exports.handlers = handlers;
exports.setWindow = setWindow;
exports.createConnection = createConnection;
