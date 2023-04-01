// eslint-disable-next-line import/no-extraneous-dependencies
const { utils: { fromBuildIdentifier
}
} = require('@electron-forge/core');

module.exports = {
  buildIdentifier: process.env.IS_BETA ? 'beta' : 'prod',
  packagerConfig: {
    appBundleId: fromBuildIdentifier({
      beta: 'com.beta.acrosman.ElectronForce', prod: 'com.ElectronForce'
    }),
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        exe: 'ElectronForce.exe',
        name: 'ElectronForce',
        authors: 'Aaron Crosman',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'
      ],
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        overwrite: true,
      },
    },
  ],
  plugins: [],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'acrosman',
          name: 'ElectronForce',
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
};
