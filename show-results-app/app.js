const express = require("express");
const session = require("express-session");
const axios = require("axios");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = 4000; // pick 4000 so it doesn't clash with enter-data-app (3000)

// Middleware
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true })); // parse form data
app.use(
  session({
    name: "show_results_sid", // Custom cookie name to avoid clashes with enter-data-app
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
  }),
);

// Auth middleware (same idea as enter-data-app)
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/");
}

// MongoDB connection helper
async function getMongoCollection() {
  const host = process.env.MONGO_HOST || "mongo-db";
  const port = process.env.MONGO_PORT || "27017";
  const user = process.env.MONGO_USER;
  const pass = process.env.MONGO_PASSWORD;
  const dbName = process.env.MONGO_DB || "analytics_db";

  // Safety check to ensure variables were passed correctly
  if (!user || !pass) {
    throw new Error(
      "CRITICAL: MongoDB credentials missing from environment variables!",
    );
  }

  // If you created the Mongo user via MONGO_INITDB_ROOT_USERNAME/PASSWORD,
  // auth is against the "admin" database.
  const uri = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/admin?authSource=admin`;

  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db(dbName);
  const collection = db.collection("statistics");

  return { client, collection };
}

// Routes
app.get("/", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  try {
    const authResponse = await axios.post("http://auth-service:5000/login", {
      username: req.body.username,
      password: req.body.password,
    });

    req.session.user = authResponse.data.user;
    res.redirect("/results");
  } catch (error) {
    const errMsg = error.response
      ? error.response.data.error
      : "Auth Service Unavailable";
    res.render("login", { error: errMsg });
  }
});

app.get("/results", isAuthenticated, async (req, res) => {
  let client;

  try {
    const mongo = await getMongoCollection();
    client = mongo.client;

    // Get the most recent stats doc (latest run)
    const latest = await mongo.collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    // Optionally also show the last 10 runs (handy for debugging/demo)
    const recent = await mongo.collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    const latestStats = latest.length > 0 ? latest[0] : null;

    res.render("results", {
      user: req.session.user,
      latest: latestStats,
      recent: recent,
      message: latestStats
        ? null
        : "No statistics found yet. Wait for analytics-service to run.",
    });
  } catch (err) {
    console.error("MongoDB error:", err);
    res.render("results", {
      user: req.session.user,
      latest: null,
      recent: [],
      message: "Error retrieving results from MongoDB.",
    });
  } finally {
    if (client) await client.close();
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.listen(PORT, () => {
  console.log(`Show Results App listening on port ${PORT}`);
});
