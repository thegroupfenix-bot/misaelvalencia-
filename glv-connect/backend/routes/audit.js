const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate, requireRole("DIRECTIVO"));

router.get("/", (req, res) => {
  const { limit = 200 } = req.query;
  const rows = db
    .prepare(
      "SELECT * FROM audit_log ORDER BY ts DESC LIMIT ?"
    )
    .all(parseInt(limit, 10));
  res.json(rows);
});

module.exports = router;
