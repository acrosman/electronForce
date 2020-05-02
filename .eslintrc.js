module.exports = {
    "env": {
        "browser": true,
        "es6": true
    },
    "extends": "airbnb-base",
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 2018
    },
    "ignorePatterns": [
        "temp.js",
        "node_modules/",
        ".vscode/",
        ".sfdx/",
    ],
    "rules": {
        "no-unused-vars": 1,
    }
};
