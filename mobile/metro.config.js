const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Surveiller les packages du monorepo
config.watchFolders = [
  monorepoRoot,
  path.resolve(monorepoRoot, 'packages'),
];

// 2. Résoudre les modules dans node_modules du projet et du monorepo
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Mapper explicitement les packages internes du workspace vers leurs sources
config.resolver.extraNodeModules = {
  '@afridev/api-client': path.resolve(monorepoRoot, 'packages/api-client/src'),
  '@afridev/i18n': path.resolve(monorepoRoot, 'packages/i18n/src'),
  '@afridev/validation': path.resolve(monorepoRoot, 'packages/validation/src'),
  '@afridev/sync-schema': path.resolve(monorepoRoot, 'packages/sync-schema/src'),
};

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;
