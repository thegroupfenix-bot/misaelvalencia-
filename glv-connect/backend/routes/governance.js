"use strict";
const express=require("express");
const db=require("../db/database");
const {authenticate}=require("../middleware/auth");
const {requireLevel}=require("../middleware/rbac");
const router=express.Router();
router.use(authenticate);
const OWNERSHIP=[
["commercial","Comercial","COMMERCIAL_DIRECTOR","DIRECTOR","CORPORATE_ADMIN"],
["operations","Operaciones","LOGISTICS","DIRECTOR","CORPORATE_ADMIN"],
["logistics","Logística","LOGISTICS","DIRECTOR","CORPORATE_ADMIN"],
["customs","Logística y Cumplimiento","LOGISTICS","COMPLIANCE","DIRECTOR"],
["vessel_charter","Logística","LOGISTICS","DIRECTOR","CORPORATE_ADMIN"],
["cargo_intelligence","Logística","LOGISTICS","DIRECTOR","CORPORATE_ADMIN"],
["finance","Finanzas","CFO","DIRECTOR","CORPORATE_ADMIN"],
["compliance","Jurídica y Cumplimiento","COMPLIANCE","DIRECTOR","CORPORATE_ADMIN"],
["audit","Auditoría","AUDIT","DIRECTOR","CORPORATE_ADMIN"],
["media","Media","MEDIA_MANAGER","DIRECTOR","CORPORATE_ADMIN"]
];
db.exec(`CREATE TABLE IF NOT EXISTS module_ownership (
module TEXT PRIMARY KEY, department TEXT NOT NULL, owner_role TEXT NOT NULL,
supervisor_role TEXT NOT NULL, escalation_role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS operational_alerts (
id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL REFERENCES tasks(id),
module TEXT NOT NULL DEFAULT 'operations', department TEXT, alert_type TEXT NOT NULL,
escalation_level INTEGER NOT NULL DEFAULT 1, recipient_role TEXT NOT NULL, message TEXT NOT NULL,
status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT (datetime('now')),
resolved_at TEXT, UNIQUE(task_id, escalation_level, alert_type));
CREATE TABLE IF NOT EXISTS integration_connectors (
id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, provider_name TEXT NOT NULL,
category TEXT NOT NULL CHECK(category IN ('carrier','customs','freight_forwarder','port','tracking')),
base_url TEXT, auth_mode TEXT NOT NULL DEFAULT 'api_key_reference',
status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','sandbox','active','paused')),
config_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')),
updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_operational_alerts_task ON operational_alerts(task_id,status);`);
for(const row of OWNERSHIP) db.prepare(`INSERT INTO module_ownership
(module,department,owner_role,supervisor_role,escalation_role) VALUES (?,?,?,?,?)
ON CONFLICT(module) DO UPDATE SET department=excluded.department,owner_role=excluded.owner_role,
supervisor_role=excluded.supervisor_role,escalation_role=excluded.escalation_role,updated_at=datetime('now')`).run(...row);
for(const sql of ["ALTER TABLE tasks ADD COLUMN module TEXT NOT NULL DEFAULT 'operations'",
"ALTER TABLE tasks ADD COLUMN department TEXT","ALTER TABLE tasks ADD COLUMN supervisor_id INTEGER REFERENCES users(id)"]){try{db.exec(sql)}catch(_){}}
function sweepOverdueTasks(){
 const rows=db.prepare(`SELECT t.id,t.title,t.deadline,t.module,t.department,
 CAST(julianday('now')-julianday(t.deadline) AS INTEGER) late_days FROM tasks t
 WHERE t.deadline IS NOT NULL AND datetime(t.deadline)<datetime('now')
 AND t.status NOT IN ('completed','approved','rejected')`).all();
 const insert=db.prepare(`INSERT OR IGNORE INTO operational_alerts
 (task_id,module,department,alert_type,escalation_level,recipient_role,message)
 VALUES (?, ?, ?, 'overdue_task', ?, ?, ?)`);
 for(const task of rows){
  const owner=db.prepare("SELECT * FROM module_ownership WHERE module=?").get(task.module||"operations") ||
   db.prepare("SELECT * FROM module_ownership WHERE module='operations'").get();
  const level=task.late_days>=3?2:1, role=level===2?owner.escalation_role:owner.supervisor_role;
  insert.run(task.id,task.module||"operations",task.department||owner.department,level,role,
   `Tarea vencida: ${task.title}. Venció el ${task.deadline}. Escalamiento ${level}.`);
 }
 return rows.length;
}
router.get("/module-ownership",requireLevel(45),(_req,res)=>res.json(db.prepare("SELECT * FROM module_ownership WHERE active=1 ORDER BY department,module").all()));
router.get("/oversight",requireLevel(55),(_req,res)=>{
 const tasks=db.prepare(`SELECT t.*,u.name assigned_name,s.name supervisor_name FROM tasks t
 LEFT JOIN users u ON u.id=t.assigned_to LEFT JOIN users s ON s.id=t.supervisor_id
 WHERE t.status NOT IN ('completed','approved','rejected') ORDER BY
 CASE WHEN t.deadline IS NOT NULL AND datetime(t.deadline)<datetime('now') THEN 0 ELSE 1 END,t.deadline,t.created_at DESC LIMIT 200`).all();
 const alerts=db.prepare(`SELECT a.*,t.title task_title FROM operational_alerts a JOIN tasks t ON t.id=a.task_id
 WHERE a.status='open' ORDER BY a.escalation_level DESC,a.created_at DESC LIMIT 200`).all();
 res.json({tasks,alerts,generated_at:new Date().toISOString()});
});
router.post("/sweep",requireLevel(65),(_req,res)=>res.json({ok:true,reviewed:sweepOverdueTasks()}));
router.get("/integrations",requireLevel(45),(_req,res)=>res.json(db.prepare("SELECT id,code,provider_name,category,base_url,auth_mode,status,created_at,updated_at FROM integration_connectors ORDER BY category,provider_name").all()));
router.post("/integrations",requireLevel(75),(req,res)=>{
 const {code,provider_name,category,base_url=null,auth_mode="api_key_reference",status="planned"}=req.body||{};
 if(!code||!provider_name||!["carrier","customs","freight_forwarder","port","tracking"].includes(category))return res.status(400).json({error:"code, provider_name y category válida son obligatorios."});
 if(base_url&&!/^https:\/\//i.test(base_url))return res.status(400).json({error:"base_url debe usar HTTPS."});
 try{const result=db.prepare("INSERT INTO integration_connectors (code,provider_name,category,base_url,auth_mode,status) VALUES (?,?,?,?,?,?)").run(code.trim().toLowerCase(),provider_name.trim(),category,base_url,auth_mode,status);
 res.status(201).json(db.prepare("SELECT id,code,provider_name,category,base_url,auth_mode,status,created_at FROM integration_connectors WHERE id=?").get(result.lastInsertRowid));}
 catch(_){res.status(409).json({error:"El conector ya existe o contiene datos inválidos."});}
});
router.sweepOverdueTasks=sweepOverdueTasks;
module.exports=router;
