const { Pool } =
  require("pg");

const pool =
  new Pool({
    connectionString:
      "postgresql://pacsuser:d9c0Vs6tLAQPAMkBp23vKUykSmnLcBgH@dpg-d8cmkki8qa3s73blg9gg-a.oregon-postgres.render.com/pacs_4o4h",
    ssl: {
      rejectUnauthorized:
        false,
    },
  });

module.exports = pool;