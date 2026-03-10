const fs = require('fs');
const path = require('path');
// eslint-disable-next-line import/no-extraneous-dependencies
const { app, safeStorage } = require('electron');

const DEFAULT_SETTINGS = {
  consumerKey: '',
  consumerSecret: '',
  loginUrl: 'https://login.salesforce.com',
  callbackPort: 3835,
};

/**
 * Fields whose values are encrypted at rest using electron.safeStorage.
 * Encrypted values are stored as the prefix "enc:" followed by a base64
 * representation of the encrypted buffer returned by safeStorage.encryptString.
 */
const SENSITIVE_FIELDS = ['consumerKey', 'consumerSecret'];

/** Sentinel prefix that distinguishes an encrypted value from plain text. */
const ENC_PREFIX = 'enc:';

const getSettingsFilePath = () => path.join(app.getPath('userData'), 'settings.json');

/**
 * Encrypts a string using safeStorage when encryption is available.
 * Returns the original value unchanged when encryption is unavailable or the
 * value is empty, so callers are never handed an unusable result.
 *
 * @param {string} value - The plain-text value to encrypt.
 * @returns {string} An "enc:<base64>" string, or `value` as-is.
 */
const encryptField = (value) => {
  if (!value || !safeStorage.isEncryptionAvailable()) {
    return value;
  }
  const encrypted = safeStorage.encryptString(value);
  return `${ENC_PREFIX}${encrypted.toString('base64')}`;
};

/**
 * Decrypts a value that was previously encrypted by encryptField.
 * Values without the "enc:" prefix are returned as-is, which preserves
 * backward compatibility with settings files written before encryption was
 * introduced.
 *
 * @param {string} value - The stored (possibly encrypted) value.
 * @returns {string} The plain-text value.
 */
const decryptField = (value) => {
  if (!value || typeof value !== 'string' || !value.startsWith(ENC_PREFIX)) {
    return value;
  }
  const buf = Buffer.from(value.slice(ENC_PREFIX.length), 'base64');
  return safeStorage.decryptString(buf);
};

/**
 * Reads all settings from the settings file on disk.
 * If the file does not exist (e.g., first run) or cannot be parsed,
 * returns a copy of the default settings.
 * Sensitive fields are transparently decrypted before being returned.
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
    const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };

    SENSITIVE_FIELDS.forEach((field) => {
      if (parsed[field]) {
        parsed[field] = decryptField(parsed[field]);
      }
    });

    return parsed;
  } catch (err) {
    return { ...DEFAULT_SETTINGS };
  }
};

/**
 * Persists the provided settings object to the settings file on disk.
 * Sensitive fields are encrypted before writing.
 *
 * @param {Object} data - A plain object containing the settings to save.
 * @returns {boolean} `true` if the file was written successfully, `false` otherwise.
 */
const saveSettings = (data) => {
  const filePath = getSettingsFilePath();

  try {
    const toSave = { ...data };

    SENSITIVE_FIELDS.forEach((field) => {
      if (toSave[field]) {
        toSave[field] = encryptField(toSave[field]);
      }
    });

    fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2), 'utf8');
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
