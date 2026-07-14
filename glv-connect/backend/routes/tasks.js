"use strict";
const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireLevel, ROLE_LEVEL } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate);

const VALID_STATUSES   = new Set(["pending", "in_progress", "completed", "approved", "rejected"]);
const VALID_PRIORITIES = new Set(["low", "medium", "high", "critical"]);

// ─── GET /tasks ───────────────────────────────────────────────────────────────
router.get("/", (req, res) => {
  try {
    const { status, priority, assigned_to, operation_id } = req.query;
    let sql = `
      SELECT t.*,
             u.name AS assigned_name, u.username AS assigned_username,
             c.name AS creator_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN users c ON c.id = t.created_by
    `;
    const conditions = [];
    const params = [];

    // Users below COMPLIANCE level (65) only see tasks assigned to or created by them
    if ((ROLE_LEVEL[req.user.role] || 0) < 65) {
      conditions.push("(t.assigned_to = ? OR t.created_by = ?)");
      params.push(req.user.id, req.user.id);
    }

    if (status)       { conditions.push("t.status = ?");       params.push(status); }
    if (priority)     { conditions.push("t.priority = ?");     params.push(priority); }
    if (assigned_to)  { conditions.push("t.assigned_to = ?");  params.push(assigned_to); }
    if (operation_id) { conditions.push("t.operation_id = ?"); params.push(operation_id); }

    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY t.created_at DESC LIMIT 200";

    res.json(db.prepare(sql).all(...params));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /tasks ──────────────────────────────────────────────────────────────
router.post("/", requireLevel(40), (req, res) => {
  try {
    const { title, description, priority = "medium", assigned_to, deadline, operation_id, doc_id } = req.body;
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "El título es obligatorio." });
    }
    if (priority && !VALID_PRIORITIES.has(priority)) {
      return res.status(400).json({ error: `Prioridad inválida: ${priority}` });
    }

    const result = db.prepare(`
      INSERT INTO tasks (title, description, priority, assigned_to, deadline, operation_id, doc_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(), description || null, priority,
      assigned_to || null, deadline || null,
      operation_id || null, doc_id || null, req.user.id
    );

    res.status(201).json(db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─── PATCH /tasks/:id ─────────────────────────────────────────────────────────
router.patch("/:id", requireLevel(40), (req, res) => {
  try {
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
    if (!task) return res.status(404).json({ error: "Tarea no encontrada." });

    // Ownership: users below COMPLIANCE (65) can only modify tasks they own
    const userLevel = ROLE_LEVEL[req.user.role] || 0;
    if (userLevel < 65) {
      const isAssigned  = task.assigned_to === req.user.id;
      const isCreatedBy = task.created_by  === req.user.id;
      if (!isAssigned && !isCreatedBy) {
        return res.status(403).json({ error: "Acceso denegado — solo puedes modificar tus propias tareas" });
      }
    }

    const { status, priority, evidence, assigned_to, deadline } = req.body;

    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: `Estado inválido: ${status}` });
    }
    if (priority !== undefined && !VALID_PRIORITIES.has(priority)) {
      return res.status(400).json({ error: `Prioridad inválida: ${priority}` });
    }
    // Only COMPLIANCE+ can reassign tasks to another user
    if (assigned_to !== undefined && userLevel < 65 && assigned_to !== req.user.id) {
      return res.status(403).json({ error: "No tienes permiso para reasignar esta tarea" });
    }

    const updates = [];
    const vals = [];

    if (status !== undefined)      { updates.push("status = ?");      vals.push(status); }
    if (priority !== undefined)    { updates.push("priority = ?");    vals.push(priority); }
    if (evidence !== undefined)    { updates.push("evidence = ?");    vals.push(evidence); }
    if (assigned_to !== undefined) { updates.push("assigned_to = ?"); vals.push(assigned_to); }
    if (deadline !== undefined)    { updates.push("deadline = ?");    vals.push(deadline); }
    updates.push("updated_at = datetime('now')");

    if (status === "approved") {
      if (userLevel < 65) {
        return res.status(403).json({ error: "Solo COMPLIANCE+ puede aprobar tareas" });
      }
      updates.push("approved_by = ?");
      vals.push(req.user.id);
    }

    if (updates.length === 1) { // only updated_at — nothing to change
      return res.json(task);
    }

    db.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`).run(...vals, req.params.id);
    res.json(db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /tasks/:id ────────────────────────────────────────────────────────
router.delete("/:id", requireLevel(65), (req, res) => {
  try {
    const task = db.prepare("SELECT id, created_by FROM tasks WHERE id = ?").get(req.params.id);
    if (!task) return res.status(404).json({ error: "Tarea no encontrada." });
    db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
