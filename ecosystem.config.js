module.exports = {
    apps: [{
      name: "spero-navette",
      script: "server.js",
      env: {
        NODE_ENV: "production",
      },
      instances: "max",
      exec_mode: "cluster"
    }]
  };