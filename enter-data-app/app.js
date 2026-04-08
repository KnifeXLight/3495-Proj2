const express = require("express");
const session = require("express-session");
const axios = require("axios");
const mysql = require("mysql2/promise");
const { MongoClient } = require("mongodb"); // NEW: MongoDB Driver

const app = express();
const PORT = 3000;

// Middleware
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    name: "enter_data_sid",
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
  }),
);

// DB Config
const dbHost = process.env.DB_HOST || "mysql-db";
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME || "analytics_db";

if (!dbUser || !dbPassword) {
  console.error("CRITICAL: MySQL credentials missing!");
  process.exit(1);
}

const pool = mysql.createPool({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName,
});

// NEW: MongoDB connection helper for real-time analytics
async function getMongoStats() {
  try {
    const host = process.env.MONGO_HOST || "mongo-db";
    const user = process.env.MONGO_USER;
    const pass = process.env.MONGO_PASSWORD;
    const uri = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:27017/admin?authSource=admin`;

    const client = new MongoClient(uri);
    await client.connect();
    const latest = await client
      .db("analytics_db")
      .collection("statistics")
      .find({})
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();
    await client.close();

    return latest.length > 0 ? latest[0] : null;
  } catch (err) {
    console.error("Mongo Fetch Error:", err);
    return null;
  }
}

// Middleware: Restrict to Admins only
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") return next();
  res
    .status(403)
    .send(
      "Access Denied: Only Teachers/Admins can enter grades. <br><a href='/'>Go Back</a>",
    );
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
    res.redirect("/data");
  } catch (error) {
    const errMsg = error.response
      ? error.response.data.error
      : "Auth Service Unavailable";
    res.render("login", { error: errMsg });
  }
});

// UPDATED GET ROUTE: Fetches Students, Grades, and MongoDB Stats
app.get("/data", isAdmin, async (req, res) => {
  try {
    const [students] = await pool.execute(
      "SELECT id, username FROM users WHERE role = 'student'",
    );
    const [grades] = await pool.execute(`
      SELECT g.id, u.username, g.student_id, g.score 
      FROM grades g 
      JOIN users u ON g.student_id = u.id 
      ORDER BY g.created_at DESC
    `);

    // FETCH STATS FROM MONGODB
    const classStats = await getMongoStats();

    res.render("data", {
      user: req.session.user,
      students,
      grades,
      classStats, // Pass stats to EJS
      message: req.query.msg || null, // Get message from the Redirect URL
    });
  } catch (error) {
    console.error("Dashboard Load Error:", error);
    res.render("data", {
      user: req.session.user,
      students: [],
      grades: [],
      classStats: null,
      message: "Error loading data.",
    });
  }
});

// UPDATED POST ROUTE: Implements PRG (Post-Redirect-Get)
app.post("/data", isAdmin, async (req, res) => {
  const studentId = parseInt(req.body.student_id);
  const score = parseFloat(req.body.score);

  try {
    if (!isNaN(score) && !isNaN(studentId)) {
      await pool.execute(
        "INSERT INTO grades (student_id, score) VALUES (?, ?)",
        [studentId, score],
      );
      // SUCCESS REDIRECT
      res.redirect("/data?msg=Grade%20Saved%20Successfully");
    } else {
      res.redirect("/data?msg=Invalid%20Input");
    }
  } catch (error) {
    console.error("Database error:", error);
    res.redirect("/data?msg=Database%20Error");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Enter Data App listening on port ${PORT}`);
});
