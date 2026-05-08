/**
 * Babel config for Expo SDK 54 + Reanimated 4 + Worklets.
 *
 * `babel-preset-expo` ships JSX + TS + RN transforms.
 * `react-native-worklets/plugin` MUST be last per Reanimated 4 docs — it
 * walks the AST to annotate worklet functions for the native side.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
