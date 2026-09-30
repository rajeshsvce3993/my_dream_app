const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { resolve } = require('metro-resolver');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Watch app + hoisted deps only (not entire monorepo — faster rebuilds & fewer stuck loads).
config.watchFolders = [
  projectRoot,
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'packages'),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const appReact = path.resolve(projectRoot, 'node_modules/react');
const rootReact = path.resolve(workspaceRoot, 'node_modules/react');
const rootReactNative = path.resolve(workspaceRoot, 'node_modules/react-native');

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: appReact,
  'react-native': rootReactNative,
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const siblingAppBlock = ['backend', 'delivery', 'vendor', 'admin-web', 'customer-web'].map(
  (name) => new RegExp(`${escapeRegExp(path.resolve(workspaceRoot, 'apps', name))}[\\\\/].*`),
);
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  new RegExp(`${escapeRegExp(rootReact)}[\\\\/].*`),
  new RegExp(`${escapeRegExp(path.resolve(workspaceRoot, 'data'))}[\\\\/].*`),
  ...siblingAppBlock,
];

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: { experimentalImportSupport: false, inlineRequires: true },
  }),
};

// Delivery app adds react-dom / react-native-web at the repo root; never load them on native.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform !== 'web' &&
    (moduleName === 'react-dom' ||
      moduleName.startsWith('react-dom/') ||
      moduleName === 'react-native-web' ||
      moduleName.startsWith('react-native-web/'))
  ) {
    return { type: 'empty' };
  }

  return resolve(context, moduleName, platform);
};

module.exports = config;
