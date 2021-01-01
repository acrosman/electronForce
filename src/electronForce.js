const jsforce = require('jsforce');

const sfConnections = {};
let mainWindow = null;
let consoleWindow = null;

const setwindow = (windowName, window) => {
  switch (windowName) {
    case 'console':
      consoleWindow = window;
      break;
    case 'main':
    default:
      mainWindow = window;
      break;
  }
};

const handlers = {
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
        consoleWindow.webContents.send('log_message', {
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
      consoleWindow.webContents.send('log_message', {
        sender: event.sender.getTitle(),
        channel: 'Info',
        message: `New Connection to ${conn.instanceUrl} with Access Token ${conn.accessToken}`,
      });
      consoleWindow.webContents.send('log_message', {
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
};

exports.handlers = handlers;
exports.setwindow = setwindow;
