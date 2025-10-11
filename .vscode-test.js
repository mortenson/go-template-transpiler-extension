const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig({
  files: 'out/test/suite/**/*.test.js',
  mocha: {
    ui: 'tdd',
    timeout: 20000
  }
});
