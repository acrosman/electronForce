const jsforce = require('jsforce');

const sfConnections = {};
const logMessages = [];
let mainWindow = null;

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

const handlers = {
  // Send a list of log messages to the main window.
  get_log_messages: (event, args) => {
    const { offset, count } = args;
    mainWindow.webContents.send('log_messages', {
      messages: logMessages.slice(offset, offset + count),
      totalCount: logMessages.length,
    });
  },
  // Login to an org using password authentication.
  sf_login: async (event, args) => {
    const conn = new jsforce.Connection({
      loginUrl: args.url,
    });

    try {
      let { password } = args;
      if (args.token !== '') {
        password = `${password}${args.token}`;
      }

      // Clear sensitive data
      args.password = '';
      args.token = '';

      const userInfo = await conn.login(args.username, password);

      sfConnections[userInfo.organizationId] = {
        instanceUrl: conn.instanceUrl,
        accessToken: conn.accessToken,
        version: '63.0',
      };

      logMessage('Info', `Connection Org ${userInfo.organizationId} for User ${userInfo.id}`);

      mainWindow.webContents.send('response_login', {
        status: true,
        message: 'Login Successful',
        response: userInfo,
        limitInfo: conn.limitInfo,
        request: args,
      });
    } catch (err) {
      logMessage('Error', `Login Failed ${err}`);
      mainWindow.webContents.send('response_generic', {
        status: false,
        message: 'Login Failed',
        response: err,
        limitInfo: conn.limitInfo,
        request: args,
      });
    }
  },

  // Logout of Salesforce.
  sf_logout: async (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    try {
      await conn.logout();

      logMessage('Info', `Logged out of ${args.org}`);
      mainWindow.webContents.send('response_logout', {
        status: true,
        message: 'Logout Successful',
        response: {},
        limitInfo: conn.limitInfo,
        request: args,
      });
      sfConnections[args.org] = null;
    } catch (err) {
      logMessage('Error', `Logout Failed ${err}`);
      mainWindow.webContents.send('response_logout', {
        status: false,
        message: 'Logout Failed',
        response: `${err}`,
        limitInfo: conn.limitInfo,
        request: args,
      });
    }
  },

  // Run a SOQL Query against your org.
  sf_query: async (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    try {
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
        limitInfo: conn.limitInfo,
        request: args,
      });
    }
  },

  // Run SOSL search.
  sf_search: async (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    try {
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
        limitInfo: conn.limitInfo,
        request: args,
      });
    }
  },

  // Run an object describe.
  sf_describe: async (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    try {
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
        limitInfo: conn.limitInfo,
        request: args,
      });
    }
  },

  // Run a Global Describe
  sf_describeGlobal: async (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    try {
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
        limitInfo: conn.limitInfo,
        request: args,
      });
    }
  },

  // Fetch the Organization object from the active org.
  sf_orgExplore: async (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    try {
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
        limitInfo: conn.limitInfo,
        request: args,
      });
    }
  },

  // Report current org limits
  sf_orgLimits: async (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    try {
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
        limitInfo: conn.limitInfo,
        request: args,
      });
    }
  },

  // List all profiles.
  sf_orgProfiles: async (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    try {
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
        limitInfo: conn.limitInfo,
        request: args,
      });
    }
  },

  // List all PermSets.
  sf_orgPermSets: async (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    try {
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
        limitInfo: conn.limitInfo,
        request: args,
      });
    }
  },

  // Fetch details about a permission set.
  sf_orgPermSetDetail: async (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    try {
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
        limitInfo: conn.limitInfo,
        request: args,
      });
    }
  },
};

exports.handlers = handlers;
exports.setWindow = setWindow;
