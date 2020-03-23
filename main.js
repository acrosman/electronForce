const electron = require('electron');
const jsforce = require('jsforce');

// Module to control application life.
const {
  app,
  BrowserWindow,
  ipcMain,
} = electron;
require('electron-debug')();
const path = require('path');
const url = require('url');

// Get rid of the deprecated default.
app.allowRendererProcessReuse = true;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

// A global collection of the various SF Org connections currently open in the
// app.
// @TODOL: find a better way to do this that isn't a global.
const sfConnections = {};

function createWindow() {
  const display = electron.screen.getPrimaryDisplay();
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: display.workArea.width,
    height: display.workArea.height,
    frame: true,
    webPreferences: {
      nodeIntegration: false, // Disable nodeIntegration for security.
      contextIsolation: true, // Enabling contextIsolation for security.
      preload: path.join(app.getAppPath(), 'app/preload.js'),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(app.getAppPath(), 'app/index.html'),
    protocol: 'file:',
    slashes: true,
  }));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// @TODO: Break out the definition of all these into a file and just bulk load.

// Handle Salesforce Login
ipcMain.on('sf_login', (event, args) => {
  const conn = new jsforce.Connection({
    // you can change loginUrl to connect to sandbox or prerelease env.
    loginUrl: args.url,
  });

  let { password } = args;
  if (args.token !== '') {
    password = `${password}${args.token}`;
  }

  conn.login(args.username, password, (err, userInfo) => {
    if (err) {
      console.error(err);
      mainWindow.webContents.send('sfShowOrgId', {
        status: false,
        message: 'Login Failed',
        response: err,
      });
      return;
    }
    // Now you can get the access token and instance URL information.
    // Save them to establish connection next time.
    console.log(conn.accessToken);
    console.log(conn.instanceUrl);
    // logged in user property
    console.log(`User ID: ${userInfo.id}`);
    console.log(`Org ID: ${userInfo.organizationId}`);

    // Save the next connection in the global storage.
    sfConnections[userInfo.organizationId] = conn;

    mainWindow.webContents.send('response_login', {
      status: true,
      message: 'Login Successful',
      response: userInfo,
    });
  });
});

/**
 * Logout of a Salesforce org.
 */
ipcMain.on('sf_logout', (event, args) => {
  const conn = sfConnections[args.org];
  conn.logout((err) => {
    if (err) {
      mainWindow.webContents.send('response_logout', {
        status: false,
        message: 'Logout Failed',
        response: err,
      });
      console.error(err);
      return false;
    }
    // now the session has been expired.
    mainWindow.webContents.send('response_logout', {
      status: true,
      message: 'Logout Successful',
      response: {},
    });
    return true;
  });
});

/**
 * Query Salesforce.
 */
ipcMain.on('sf_query', (event, args) => {
  const conn = sfConnections[args.org];
  conn.query(args['rest-api-soql-text'], (err, result) => {
    if (err) {
      mainWindow.webContents.send('response_logout', {
        status: false,
        message: 'Logout Failed',
        response: err,
      });
      return console.error(err);
    }
    console.log(`total : ${result.totalSize}`);
    console.log(`fetched : ${result.records.length}`);
    // now the session has been expired.
    mainWindow.webContents.send('response_generic', {
      status: true,
      message: 'Request',
      response: result,
    });
    return true;
  });
});
