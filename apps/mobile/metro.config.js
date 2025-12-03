const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project root (monorepo root)
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Add extra node modules for the packages directory
config.resolver.extraNodeModules = {
  '@chaski/shared-types': path.resolve(workspaceRoot, 'packages/shared-types'),
  '@chaski/shared-utils': path.resolve(workspaceRoot, 'packages/shared-utils'),
  '@chaski/shared-i18n': path.resolve(workspaceRoot, 'packages/shared-i18n'),
  '@chaski/api-client': path.resolve(workspaceRoot, 'packages/api-client'),
};

module.exports = config;
