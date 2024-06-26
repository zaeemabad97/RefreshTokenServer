const express = require("express");
const axios = require("axios");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});
 
app.use(express.json());

async function refreshAccessToken(refreshToken) {
  try {
    const response = await axios.post(
      "https://api.hubapi.com/oauth/v1/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.HUBSPOT_CLIENT_ID,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error refreshing access token:", error);
    throw error;
  }
}

app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM tokens");

    for (const row of result.rows) {
      try {
        const { access_token, refresh_token } = await refreshAccessToken(
          row.hubspot_refresh_token
        );

        await pool.query(
          "UPDATE tokens SET hubspot_access_token = $1, hubspot_refresh_token = $2 WHERE portal_id = $3",
          [access_token, refresh_token, row.portal_id]
        );

        console.log(`Updated tokens for portal_id ${row.portal_id}`);
      } catch (error) {
        console.error(
          `Error refreshing token for portal_id ${row.portal_id}:`,
          error
        );
      }
    }

    res.send("Tokens refreshed successfully.");
  } catch (error) {
    console.error("Error querying tokens:", error);
    res.status(500).send("Error querying tokens.");
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running`);
});

module.exports = app;
