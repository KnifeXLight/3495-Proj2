const express = require("express");
const session = require("express-session");
const axios = require("axios");
const { MongoClient } = require("mongodb");
const mysql = require("mysql2/promise"); // NEW: Added MySQL dependency

const app = express();
const PORT = 4000;

// Middleware
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    name: "show_results_sid",
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
  }),
);

// --- Database Connections ---

// NEW: MySQL Connection Pool for fetching personal grades
const mysqlPool = mysql.createPool({
  host: process.env.DB_HOST || "mysql-db",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "analytics_db",
});

// MongoDB Connection for fetching class statistics
async function getMongoCollection() {
  const host = process.env.MONGO_HOST || "mongo-db";
  const port = process.env.MONGO_PORT || "27017";
  const user = process.env.MONGO_USER;
  const pass = process.env.MONGO_PASSWORD;
  const dbName = process.env.MONGO_DB || "analytics_db";

  if (!user || !pass) {
    throw new Error(
      "CRITICAL: MongoDB credentials missing from environment variables!",
    );
  }

  const uri = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/admin?authSource=admin`;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection("statistics");

  return { client, collection };
}

// --- Routes ---

function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/");
}

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
  let mongoClient;

  try {
    // 1. Fetch Class Stats from MongoDB
    const mongo = await getMongoCollection();
    mongoClient = mongo.client;

    const latest = await mongo.collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    const classStats = latest.length > 0 ? latest[0] : null;

    // 2. Fetch Personal Grades from MySQL (ONLY if the user is a Student)
    let myGrades = [];
    if (req.session.user.role === "student") {
      const [rows] = await mysqlPool.execute(
        "SELECT score, created_at FROM grades WHERE student_id = ? ORDER BY created_at DESC",
        [req.session.user.id],
      );
      myGrades = rows;
    }

    // 3. Render the Dashboard
    res.render("results", {
      user: req.session.user,
      classStats: classStats,
      myGrades: myGrades,
      message: classStats
        ? null
        : "No class statistics found yet. Wait for analytics-service to run.",
    });
  } catch (err) {
    console.error("Database error:", err);
    res.render("results", {
      user: req.session.user,
      classStats: null,
      myGrades: [],
      message: "Error retrieving data from the databases.",
    });
  } finally {
    if (mongoClient) await mongoClient.close();
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.listen(PORT, () => {
  console.log(`Show Results App listening on port ${PORT}`);
});
