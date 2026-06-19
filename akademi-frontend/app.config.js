const appJson = require("./app.json");

const expoConfig = { ...appJson.expo };
const plugins = [...(expoConfig.plugins || [])];

if (process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
  plugins.push([
    "@sentry/react-native/expo",
    {
      organization: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      url: process.env.SENTRY_URL || "https://sentry.io/",
    },
  ]);
}

module.exports = {
  expo: {
    ...expoConfig,
    plugins,
  },
};
