const express = require("express");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const router = express.Router();

// Middleware to check JWT
async function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { data: user, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error("Invalid token");

    req.user = user;
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid token" });
  }
}

// Protect an API route
router.get("/protected", authenticateToken, (req, res) => {
  res.json({ message: `Hello, ${req.user.email}!` });
});

module.exports = router;
