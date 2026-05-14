const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contraseña requeridos" });
  }

  const user = db
    .prepare("SELECT * FROM users WHERE username = ? AND active = 1")
    .get(username.toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    email: user.email,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });

  db.prepare(
    "INSERT INTO audit_log (username, action, ip) VALUES (?, ?, ?)"
  ).run(user.username, "login", req.ip);

  res.json({ token, user: payload });
});

router.get("/me", authenticate, (req, res) => {
  res.json(req.user);
});

module.exports = router;
