// Preload script.
const { contextBridge, ipcRenderer, session } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  ['chrome', 'node', 'electron'].forEach((type) => {
    replaceText(`${type}-version`, process.versions[type]);
  });
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object.
// Big hattip:https://stackoverflow.com/a/59814127/24215.
contextBridge.exposeInMainWorld(
  'api', {
    send: (channel, data) => {
      // whitelist channels
      const validChannels = ['sfLogin', 'sfLogout'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      const validChannels = ['sfShowOrgId'];
      if (validChannels.includes(channel)) {
        console.log('yup');
      }
    },
  },
);
