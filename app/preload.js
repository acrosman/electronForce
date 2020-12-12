// Preload script.
const { contextBridge, ipcRenderer, remote } = require('electron');  // eslint-disable-line

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object.
// Big hat tip: https://stackoverflow.com/a/59814127/24215.
contextBridge.exposeInMainWorld(
  'api', {
    send: (channel, data) => {
      // List channels to allow.
      const validChannels = [
        'eforce_send_log',
        'sf_login',
        'sf_logout',
        'sf_query',
        'sf_search',
        'sf_describe',
        'sf_orgExplore',
        'sf_describeGlobal',
        'sf_orgLimits',
        'sf_orgProfiles',
        'sf_orgPermSets',
        'sf_owds',
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      const validChannels = [
        'response_login',
        'response_logout',
        'response_query',
        'response_describe',
        'response_describe_global',
        'response_org_object_display',
        'reponnse_org_limits',
        'response_permset_list',
        'response_generic',
      ];
      if (validChannels.includes(channel)) {
        // Remove the event to avoid information leaks.
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
  },
);
