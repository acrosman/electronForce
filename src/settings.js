const fs = require('fs');
const path = require('path');
// eslint-disable-next-line import/no-extraneous-dependencies
const { app } = require('electron');

const DEFAULT_SETTINGS = {
  consumerKey: '',
  consumerSecret: '',
  loginUrl: 'https://login.salesforce.com',
  callbackPort: 3835,
};

const getSettingsFilePath = () => path.join(app.getPath('userData'), 'settings.json');

/**
 * Reads all settings from the settings file on disk.
 * If the file does not exist (e.g., first run) or cannot be parsed,
 * returns a copy of the default settings.
 *
 * @returns {Object} The persisted settings merged with any missing defaults.
 */
const getSettings = () => {
  const filePath = getSettingsFilePath();

  if (!fs.existsSync(filePath)) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    return { ...DEFAULT_SETTINGS };
  }
};

/**
 * Persists the provided settings object to the settings file on disk.
 *
 * @param {Object} data - A plain object containing the settings to save.
 * @returns {boolean} `true` if the file was written successfully, `false` otherwise.
 */
const saveSettings = (data) => {
  const filePath = getSettingsFilePath();

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Retrieves the value of a single setting by key.
 * Falls back to `defaultValue` when the key is not present in the persisted
 * settings or in the built-in defaults.
 *
 * @param {string} key - The name of the setting to retrieve.
 * @param {*} [defaultValue] - Value to return when the key is not found.
 * @returns {*} The setting value, or `defaultValue` if not found.
 */
const getSetting = (key, defaultValue = undefined) => {
  const settings = getSettings();

  if (Object.prototype.hasOwnProperty.call(settings, key)) {
    return settings[key];
  }
  return defaultValue;
};

module.exports = {
  getSettings,
  saveSettings,
  getSetting,
};
