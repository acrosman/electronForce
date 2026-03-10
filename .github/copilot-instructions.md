# GitHub Copilot Instructions for ElectronForce

## Project Purpose

ElectronForce is an [Electron](https://www.electronjs.org/)-based desktop application that wraps the [JSForce](https://jsforce.github.io/) library to provide a graphical interface for exploring Salesforce org data and metadata via the Salesforce APIs. It supports SOQL queries, SOSL searches, object describes, global describes, org limits reporting, and permission set inspection. See `ReadMe.md` for full feature descriptions and screenshots.

## Repository Layout

```
electronForce/
├── main.js              # Electron main process: window creation, app lifecycle, IPC handler registration
├── src/
│   ├── electronForce.js # Core backend logic: JSForce connection management and IPC handler definitions
│   └── settings.js      # Read/write persistent user settings via app.getPath('userData')/settings.json
├── __mocks__/
│   └── electron.js      # Jest manual mock for the electron module (shared across all test files)
├── app/
│   ├── index.html       # Application UI markup
│   ├── render.js        # Renderer process logic: UI interaction and IPC send/receive calls
│   ├── preload.js       # Context bridge: exposes a safe `window.api` to the renderer
│   └── dashboard.css    # Application styles
├── documentation/
│   └── images/          # Screenshots used in ReadMe.md
├── .github/
│   ├── workflows/       # CI workflows: lint.yml and codeql-analysis.yml
│   └── ISSUE_TEMPLATE/  # Bug report and feature request templates
├── tests/
│   ├── electronForce.test.js  # Tests for src/electronForce.js IPC handlers
│   ├── handlers.test.js       # Tests for individual handler logic
│   ├── render.test.js         # Tests for app/render.js renderer logic
│   └── settings.test.js       # Tests for src/settings.js read/write logic
├── .husky/
│   └── pre-commit       # Runs lint and tests before every commit
├── .eslintrc.js         # ESLint configuration (airbnb-base)
├── jest.config.json     # Jest test configuration
├── forge.config.js      # Electron Forge packaging configuration
└── package.json         # Dependencies, scripts, and project metadata
```

## Architecture

ElectronForce follows the standard Electron two-process model with strict security settings:

- **Main process** (`main.js`, `src/electronForce.js`): Runs in Node.js. Owns all JSForce connections and Salesforce API calls. Registers IPC listeners for each supported operation.
- **Renderer process** (`app/render.js`, `app/index.html`): Runs in a sandboxed browser context with `nodeIntegration: false` and `contextIsolation: true`.
- **Preload script** (`app/preload.js`): The only bridge between the two processes. Uses `contextBridge.exposeInMainWorld` to expose a narrow `window.api` object (`send` and `receive`) limited to explicitly allow-listed IPC channel names.

### IPC Channel Convention

- Channels sent **from the renderer to the main process** use the prefix `sf_` (e.g., `sf_oauth_start`, `sf_query`) or `get_` (e.g., `get_log_messages`). Note: `sf_oauth_start` is the current authentication entry point; `sf_login` is no longer used.
- Settings persistence uses `sf_get_settings` and `sf_save_settings`; the main process responds on `response_settings`.
- Channels sent **from the main process back to the renderer** use the prefix `response_` (e.g., `response_query`, `response_generic`, `response_settings`).
- Every new handler added to `src/electronForce.js` must also be added to the `validChannels` allow-list in `app/preload.js`.

### Authentication

Authentication uses Salesforce OAuth 2.0 via a Salesforce External Client App. The main process opens the authorization URL in the system browser via `shell.openExternal`. A one-time local HTTP server (default port 3835, configurable in settings) receives the callback, exchanges the auth code for tokens using `jsforce.OAuth2`, and stores the resulting connection in `sfConnections`. The local server closes after a successful exchange or a 5-minute timeout.

### Response Payload Shape

All IPC responses follow a consistent structure:

```js
{
  status: true | false,
  message: 'Human-readable status string',
  response: { /* JSForce result or error */ },
  limitInfo: conn.limitInfo,
  request: args,
}
```

## Code Standards

This project follows the guidelines described in `contributing.md`. Key points:

- **Linting**: ESLint is configured with `eslint-config-airbnb-base`. All code must pass linting. The Husky pre-commit hook enforces this automatically.
- **Style**: Follow the airbnb JavaScript style guide. Avoid debating the standard; consistency matters more than personal preference.
- **Error handling**: Every async handler must include a `try/catch`. On failure, send a `response_generic` message with `status: false` and a string-coerced error.
- **Security**: Never enable `nodeIntegration`, `enableRemoteModule`, or disable `contextIsolation` in `BrowserWindow` settings. Keep the preload channel allow-lists up to date.
- **No unused variables**: The ESLint rule `no-unused-vars` is set to `warn`. Treat warnings as errors before opening a pull request.
- **Parameter reassignment**: Direct property mutations on function parameters are allowed (`"props": false`), but avoid reassigning the parameter binding itself.
- **Settings mock**: Any test file that imports or indirectly loads `src/electronForce.js` must include `jest.mock('../src/settings')` to prevent real file-system reads/writes during testing.

## Testing

Tests are written with [Jest](https://jestjs.io/) and live alongside the source files they cover. The test configuration is in `jest.config.json`.

- After any session that modifies code beyond comments, ensure the full test suite passes and linting is clean before considering the work done.
- When adding new IPC handlers or utility functions, add corresponding Jest tests.
- Tests for the main-process logic in `src/electronForce.js` should mock `jsforce` and the `mainWindow` object to avoid requiring a live Electron or Salesforce environment.
- Any test file that needs Electron APIs (e.g., `app.getPath`) should call `jest.mock('electron')` (no factory). Jest will automatically use the shared manual mock at `__mocks__/electron.js`, which returns a temp-directory path for `app.getPath('userData')` and exposes `shell.openExternal` as a `jest.fn()` so tests can assert on it without triggering real browser calls. Do not duplicate the mock factory inline in individual test files.
- The `--passWithNoTests` flag is used for the pre-commit hook so that new files without tests don't block commits, but coverage is expected for substantive logic.

## Contribution Expectations

- Open an issue before starting significant work so the approach can be discussed.
- Reference the related issue number in your pull request description.
- Pull requests should pass linting and all tests.
- Expect review feedback rather than direct fixes; address reviewer comments and push updated commits.

See `contributing.md` for the full contribution guidelines.
