const express = require("express");
const session = require("express-session");
const axios = require("axios");
const mysql = require("mysql2/promise");

const app = express();
const PORT = 3000;

// Middleware
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true })); // To parse form data
app.use(
  session({
    name: "enter_data_sid", // Custom cookie name to avoid clashes
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
  }),
);


// Read directly from environment variables injected by Docker
const dbHost = process.env.DB_HOST || "mysql-db";
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME || "analytics_db";

// Safety check to ensure variables were passed correctly
if (!dbUser || !dbPassword) {
  console.error(
    "CRITICAL: MySQL credentials missing from environment variables!",
  );
  process.exit(1); // Crash the app loudly so we know there is a config issue
}

// MySQL Connection Pool
const pool = mysql.createPool({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName,
});

// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/");
}

// Routes
app.get("/", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  try {
    // Send credentials to the Authentication Service
    const authResponse = await axios.post("http://auth-service:5000/login", {
      username: req.body.username,
      password: req.body.password,
    });

    // If successful, save user in session and redirect
    req.session.user = authResponse.data.user;
    res.redirect("/data");
  } catch (error) {
    const errMsg = error.response
      ? error.response.data.error
      : "Auth Service Unavailable";
    res.render("login", { error: errMsg });
  }
});

app.get("/data", isAuthenticated, (req, res) => {
  res.render("data", { user: req.session.user, message: null });
});

app.post("/data", isAuthenticated, async (req, res) => {
  const dataValue = parseFloat(req.body.data_value);

  if (isNaN(dataValue)) {
    return res.render("data", {
      user: req.session.user,
      message: "Please enter a valid number!",
    });
  }

  try {
    // Write the entered data to MySQL
    await pool.execute(
      "INSERT INTO raw_data (user_id, data_value) VALUES (?, ?)",
      [req.session.user.id, dataValue],
    );
    res.render("data", {
      user: req.session.user,
      message: `Successfully saved value: ${dataValue}`,
    });
  } catch (error) {
    console.error("Database error:", error);
    res.render("data", {
      user: req.session.user,
      message: "Error saving data to database.",
    });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Enter Data App listening on port ${PORT}`);
});
