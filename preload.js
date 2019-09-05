// Preload script
const { webFrame } = require('electron');

// Set a variable in the page before it loads
webFrame.executeJavaScript('window.foo = "passed values";')

document.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  ['chrome', 'node', 'electron'].forEach((type) => {
    replaceText(`${type}-version`, process.versions[type]);
  });
})
