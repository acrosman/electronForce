const jsforce = require('jsforce');

const sfConnections = {};
let mainWindow = null;

const setwindow = (window) => {
  mainWindow = window;
};

const handlers = {
  // Login to an org using password authentication.
  sf_login: (event, args) => {
    const conn = new jsforce.Connection({
      // you can change loginUrl to connect to sandbox or prerelease env.
      loginUrl: args.url,
    });

    let { password } = args;
    if (args.token !== '') {
      password = `${password}${args.token}`;
    }

    conn.login(args.username, password, (err, userInfo) => {
      // Since we send the args back to the interface, it's a good idea
      // to remove the security information.
      args.password = '';
      args.token = '';

      if (err) {
        mainWindow.webContents.send('log_message', {
          sender: event.sender.getTitle(),
          channel: 'Error',
          message: `Login Failed ${err}`,
        });

        mainWindow.webContents.send('sfShowOrgId', {
          status: false,
          message: 'Login Failed',
          response: err,
          limitInfo: conn.limitInfo,
          request: args,
        });
        return true;
      }
      // Now you can get the access token and instance URL information.
      // Save them to establish connection next time.
      mainWindow.webContents.send('log_message', {
        sender: event.sender.getTitle(),
        channel: 'Info',
        message: `New Connection to ${conn.instanceUrl} with Access Token ${conn.accessToken}`,
      });
      mainWindow.webContents.send('log_message', {
        sender: event.sender.getTitle(),
        channel: 'Info',
        message: `Connection Org ${userInfo.organizationId} for User ${userInfo.id}`,
      });

      // Save the next connection in the global storage.
      sfConnections[userInfo.organizationId] = {
        instanceUrl: conn.instanceUrl,
        accessToken: conn.accessToken,
      };

      mainWindow.webContents.send('response_login', {
        status: true,
        message: 'Login Successful',
        response: userInfo,
        limitInfo: conn.limitInfo,
        request: args,
      });
      return true;
    });
  },
  // Logout of a specific Salesforce org.
  sf_logout: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    conn.logout((err) => {
      if (err) {
        mainWindow.webContents.send('response_logout', {
          status: false,
          message: 'Logout Failed',
          response: `${err}`,
          limitInfo: conn.limitInfo,
          request: args,
        });
        mainWindow.webContents.send('log_message', {
          sender: event.sender.getTitle(),
          channel: 'Error',
          message: `Logout Failed ${err}`,
        });
        return true;
      }
      // now the session has been expired.
      mainWindow.webContents.send('response_logout', {
        status: true,
        message: 'Logout Successful',
        response: {},
        limitInfo: conn.limitInfo,
        request: args,
      });
      sfConnections[args.org] = null;
      return true;
    });
  },
  // Run a SOQL query against an org.
  sf_query: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    conn.query(args.rest_api_soql_text, (err, result) => {
      if (err) {
        mainWindow.webContents.send('response_generic', {
          status: false,
          message: 'Query Failed',
          response: `${err}`,
          limitInfo: conn.limitInfo,
          request: args,
        });
        mainWindow.webContents.send('log_message', {
          sender: event.sender.getTitle(),
          channel: 'Error',
          message: `Query Failed ${err}`,
        });
        return true;
      }
      // Send records back to the interface.
      mainWindow.webContents.send('response_query', {
        status: true,
        message: 'Query Successful',
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
      return true;
    });
  },
  // Search Salesforce with a SOSL query.
  sf_search: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    conn.search(args.rest_api_sosl_text, (err, result) => {
      if (err) {
        mainWindow.webContents.send('response_generic', {
          status: false,
          message: 'Search Failed',
          response: `${err}`,
          limitInfo: conn.limitInfo,
          request: args,
        });
        mainWindow.webContents.send('log_message', {
          sender: event.sender.getTitle(),
          channel: 'Error',
          message: `Search Failed ${err}`,
        });
        return true;
      }

      // Re-package results for easy display.
      const adjustedResult = {
        records: result.searchRecords,
        totalSize: 'n/a',
      };

      // Send records back to the interface.
      mainWindow.webContents.send('response_query', {
        status: true,
        message: 'Search Successful',
        response: adjustedResult,
        limitInfo: conn.limitInfo,
        request: args,
      });
      return true;
    });
  },
  // Describe a Salesforce object
  sf_describe: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    conn.sobject(args.rest_api_describe_text).describe((err, result) => {
      if (err) {
        mainWindow.webContents.send('response_generic', {
          status: false,
          message: 'Describe Failed',
          response: `${err}`,
          limitInfo: conn.limitInfo,
          request: args,
        });

        mainWindow.webContents.send('log_message', {
          sender: event.sender.getTitle(),
          channel: 'Error',
          message: `Describe Failed ${err}`,
        });
        return true;
      }

      // Send records back to the interface.
      mainWindow.webContents.send('response_describe', {
        status: true,
        message: `Describe ${args.rest_api_describe_text} Successful`,
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
      return true;
    });
  },
  // Run a Global Describe.
  sf_describeGlobal: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    conn.describeGlobal((err, result) => {
      if (err) {
        mainWindow.webContents.send('response_generic', {
          status: false,
          message: 'Describe Global Failed',
          response: `${err}`,
          limitInfo: conn.limitInfo,
          request: args,
        });

        mainWindow.webContents.send('log_message', {
          sender: event.sender.getTitle(),
          channel: 'Error',
          message: `Describe Global Failed ${err}`,
        });
        return true;
      }

      // Send records back to the interface.
      mainWindow.webContents.send('response_describe_global', {
        status: true,
        message: 'Describe Global Successful',
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
      return true;
    });
  },
  // Fetch the org object for specified org.
  sf_orgExplore: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);

    // Get the org object's list of fields.
    conn.sobject('Organization').describe((err, result) => {
      if (err) {
        mainWindow.webContents.send('response_generic', {
          status: false,
          message: 'Describe Org in fetch process failed',
          response: `${err}`,
          limitInfo: conn.limitInfo,
          request: args,
        });

        mainWindow.webContents.send('log_message', {
          sender: event.sender.getTitle(),
          channel: 'Error',
          message: `Describe Org in fetch process failed ${err}`,
        });
        return true;
      }

      // Iterate over the list of fields and write a useful query.
      let fields = '';
      for (let i = 0; i < result.fields.length; i += 1) {
        if (i === 0) {
          fields = result.fields[i].name;
        } else {
          fields = `${fields}, ${result.fields[i].name}`;
        }
      }

      const orgQuery = `SELECT ${fields} FROM Organization`;

      // Retreive all fields for this org's Organization object.
      conn.query(orgQuery, (qErr, qResult) => {
        if (qErr) {
          mainWindow.webContents.send('response_generic', {
            status: false,
            message: 'Org Fetch Failed',
            response: qErr,
            limitInfo: conn.limitInfo,
            request: args,
          });

          mainWindow.webContents.send('log_message', {
            sender: event.sender.getTitle(),
            channel: 'Error',
            message: `Org Fetch Failed ${qErr}`,
          });
          return true;
        }

        // Send records back to the interface.
        mainWindow.webContents.send('response_org_object_display', {
          status: true,
          message: 'Fetched Org Details',
          response: qResult.records[0],
          limitInfo: conn.limitInfo,
          request: args,
        });
        return true;
      });
      return true;
    });
  },
  // Send a logging message related to another render thread.
  eforce_send_log: (event, args) => {
    mainWindow.webContents.send('log_message', {
      sender: event.sender.getTitle(),
      channel: args.channel,
      message: args.message,
    });
    return true;
  },
  // Report on current org limits.
  sf_orgLimits: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    conn.limits((err, result) => {
      if (err) {
        mainWindow.webContents.send('response_generic', {
          status: false,
          message: 'Limits Check Failed',
          response: `${err}`,
          limitInfo: conn.limitInfo,
          request: args,
        });

        mainWindow.webContents.send('log_message', {
          sender: event.sender.getTitle(),
          channel: 'Error',
          message: `Limit Check Error: ${err}`,
        });
        return true;
      }

      // Send records back to the interface.
      mainWindow.webContents.send('reponnse_org_limits', {
        status: true,
        message: 'Org Limit Check Successful',
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
      return true;
    });
  },
  // Fetch list of org profiles
  sf_orgProfiles: (event, args) => {
    const profileQuery = 'SELECT Id, Name, Description FROM Profile';
    const conn = new jsforce.Connection(sfConnections[args.org]);
    conn.query(profileQuery, (err, result) => {
      if (err) {
        mainWindow.webContents.send('response_generic', {
          status: false,
          message: 'Profile Listing Failed',
          response: `${err}`,
          limitInfo: conn.limitInfo,
          request: args,
        });

        mainWindow.webContents.send('log_message', {
          sender: event.sender.getTitle(),
          channel: 'Error',
          message: `Profile Listing Error: ${err}`,
        });
        return true;
      }

      // Send records back to the interface.
      mainWindow.webContents.send('response_query', {
        status: true,
        message: 'Profile Listing Complete',
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
      return true;
    });
  },
  // Fetch org Permission Sets
  sf_orgPermSets: (event, args) => {
    const profileQuery = 'SELECT Id, Name, Label, Description, IsCustom, IsOwnedByProfile, Profile.Name FROM PermissionSet ORDER BY IsOwnedByProfile, IsCustom DESC';
    const conn = new jsforce.Connection(sfConnections[args.org]);
    conn.query(profileQuery, (err, result) => {
      if (err) {
        mainWindow.webContents.send('response_generic', {
          status: false,
          message: 'Profile Listing Failed',
          response: `${err}`,
          limitInfo: conn.limitInfo,
          request: args,
        });

        mainWindow.webContents.send('log_message', {
          sender: event.sender.getTitle(),
          channel: 'Error',
          message: `PermSet Listing Error: ${err}`,
        });
        return true;
      }

      // Send records back to the interface.
      mainWindow.webContents.send('response_permset_list', {
        status: true,
        message: 'Permission Set Listing Complete',
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
      return true;
    });
  },
  // Fetch org Permission Set Details
  sf_orgPermSetDetail: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);

    // Get the details of the Permission Sets for this org, then query the requested set.
    conn.sobject('PermissionSet').describe((err, result) => {
      if (err) {
        mainWindow.webContents.send('response_generic', {
          status: false,
          message: 'Profile Detail Lookup Failed: unable to describe permissions sets',
          response: `${err}`,
          limitInfo: conn.limitInfo,
          request: args,
        });

        mainWindow.webContents.send('log_message', {
          sender: event.sender.getTitle(),
          channel: 'Error',
          message: `Detail Lookup Failed on Describing Permission Sets: ${err}`,
        });
        return true;
      }

      // Built a unique list of field names to use in query in preferred order.
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

      conn.query(permSetQuery, (error, detail) => {
        if (error) {
          mainWindow.webContents.send('response_generic', {
            status: false,
            message: 'Permission Set Detail Lookup Failed',
            response: `${error}`,
            limitInfo: conn.limitInfo,
            request: args,
          });

          mainWindow.webContents.send('log_message', {
            sender: event.sender.getTitle(),
            channel: 'Error',
            message: `Permission Set Detail Lookup Error: ${error}`,
          });
          return true;
        }

        // Send records back to the interface.
        mainWindow.webContents.send('response_permset_detail', {
          status: true,
          message: 'Permission Set Details Complete',
          response: detail,
          limitInfo: conn.limitInfo,
          request: args,
        });
        return true;
      });
      return true;
    });
  },
};

exports.handlers = handlers;
exports.setwindow = setwindow;
