const os = require('os');
const path = require('path');
const fs = require('fs');

// Matches the path returned by __mocks__/electron.js.
const TEST_USER_DATA = path.join(os.tmpdir(), 'electronforce-test');
const SETTINGS_FILE = path.join(TEST_USER_DATA, 'settings.json');

// Use the shared manual mock in __mocks__/electron.js.
jest.mock('electron');

// Required AFTER the mock is registered.
const { getSettings, saveSettings, getSetting } = require('../src/settings');

describe('settings', () => {
  beforeAll(() => {
    if (!fs.existsSync(TEST_USER_DATA)) {
      fs.mkdirSync(TEST_USER_DATA, { recursive: true });
    }
  });

  beforeEach(() => {
    if (fs.existsSync(SETTINGS_FILE)) {
      fs.unlinkSync(SETTINGS_FILE);
    }
  });

  afterAll(() => {
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true });
    }
  });

  describe('getSettings()', () => {
    it('returns all defaults on first run (no settings file)', () => {
      const settings = getSettings();

      expect(settings).toEqual({
        consumerKey: '',
        consumerSecret: '',
        loginUrl: 'https://login.salesforce.com',
        callbackPort: 3835,
      });
    });

    it('returns saved values merged with defaults when file exists', () => {
      const partial = { consumerKey: 'mykey', loginUrl: 'https://test.salesforce.com' };
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(partial), 'utf8');

      const settings = getSettings();

      expect(settings.consumerKey).toBe('mykey');
      expect(settings.loginUrl).toBe('https://test.salesforce.com');
      // Defaults for keys not present in the file are still returned.
      expect(settings.consumerSecret).toBe('');
      expect(settings.callbackPort).toBe(3835);
    });

    it('returns defaults when settings file contains invalid JSON', () => {
      fs.writeFileSync(SETTINGS_FILE, 'not valid json', 'utf8');

      const settings = getSettings();

      expect(settings).toEqual({
        consumerKey: '',
        consumerSecret: '',
        loginUrl: 'https://login.salesforce.com',
        callbackPort: 3835,
      });
    });
  });

  describe('saveSettings()', () => {
    it('creates the settings file and returns true', () => {
      const data = {
        consumerKey: 'abc',
        consumerSecret: 'xyz',
        loginUrl: 'https://login.salesforce.com',
        callbackPort: 3835,
      };

      const result = saveSettings(data);

      expect(result).toBe(true);
      expect(fs.existsSync(SETTINGS_FILE)).toBe(true);
    });

    it('round-trips all fields correctly', () => {
      const original = {
        consumerKey: 'roundtrip-key',
        consumerSecret: 'roundtrip-secret',
        loginUrl: 'https://custom.salesforce.com',
        callbackPort: 4000,
      };

      saveSettings(original);
      const loaded = getSettings();

      expect(loaded.consumerKey).toBe(original.consumerKey);
      expect(loaded.consumerSecret).toBe(original.consumerSecret);
      expect(loaded.loginUrl).toBe(original.loginUrl);
      expect(loaded.callbackPort).toBe(original.callbackPort);
    });

    it('overwrites previously saved settings', () => {
      saveSettings({ consumerKey: 'first' });
      saveSettings({ consumerKey: 'second' });

      const settings = getSettings();

      expect(settings.consumerKey).toBe('second');
    });
  });

  describe('getSetting()', () => {
    it('returns the default loginUrl when no file exists', () => {
      expect(getSetting('loginUrl')).toBe('https://login.salesforce.com');
    });

    it('returns the default callbackPort when no file exists', () => {
      expect(getSetting('callbackPort')).toBe(3835);
    });

    it('returns a saved value for an existing key', () => {
      saveSettings({ ...getSettings(), consumerKey: 'my-consumer-key' });

      expect(getSetting('consumerKey')).toBe('my-consumer-key');
    });

    it('returns the provided default for a key not in the settings', () => {
      expect(getSetting('nonExistentKey', 'fallback')).toBe('fallback');
    });

    it('returns undefined for a missing key when no default is provided', () => {
      expect(getSetting('nonExistentKey')).toBeUndefined();
    });
  });
});
