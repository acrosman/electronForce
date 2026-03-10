module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: 'airbnb-base',
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    'no-unused-vars': 1,
    'no-param-reassign': ['error', { props: false }],
  },
  overrides: [
    {
      files: ['tests/**/*.js', '__mocks__/**/*.js'],
      env: {
        jest: true,
      },
    },
  ],
};
