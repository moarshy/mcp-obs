/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "mcp-obs",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
        },
      },
    };
  },
  async run() {
    // Database
    const database = new sst.aws.Postgres("Database", {
      scaling: {
        min: $app.stage === "production" ? "0.5" : "0",
        max: $app.stage === "production" ? "2" : "0.5",
      },
    });

    // Next.js Dashboard
    const dashboard = new sst.aws.Nextjs("Dashboard", {
      path: "./packages/dashboard",
      environment: {
        DATABASE_URL: database.connectionString,
      },
      domain:
        $app.stage === "production"
          ? "app.mcplatform.com"
          : `${$app.stage}.app.mcplatform.com`,
    });

    return {
      dashboard: dashboard.url,
      database: database.connectionString,
    };
  },
});