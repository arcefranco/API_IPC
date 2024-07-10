module.exports = {
  apps: [
    {
      name: "app1",
      script: "./index.js",
      ignore_watch: ["logs"],
      watch: true,
      node_args: "-r dotenv/config",
      env: {
        DOTENV_CONFIG_PATH: "./.env",
      },
    },
  ],
};
