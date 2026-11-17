"use strict";
const express=require("express");
const db=require("../db/database");
const {authenticate}=require("../middleware/auth");
const {requireLevel,ROLE_LEVEL}=require("../middleware/rbac");
const router=express.Router();
router.use(authenticate);

const CASE_STATUSES=new Set(["draft","in_progress","submitted","inspection","cleared","blocked","closed"]);
const REQUIREMENT_STATUSES=new Set(["pending","in_progress","submitted","approved","rejected","expired"]);

db.exec(`CREATE TABLE IF NOT EXISTS customs_cases (
 id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, operation_id TEXT REFERENCES operations(id),
 direction TEXT NOT NULL CHECK(direction IN ('import','export','transit')), origin_country TEXT, destination_country TEXT,
 hs_code TEXT, customs_regime TEXT, customs_agency TEXT, declaration_number TEXT, status TEXT NOT NULL DEFAULT 'draft',
 duties_amount REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'USD', expected_clearance_date TEXT,
 cleared_at TEXT, created_by INTEGER NOT NULL REFERENCES users(id), assigned_to INTEGER REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
 CREATE TABLE IF NOT EXISTS customs_requirements (
 id INTEGER PRIMARY KEY AUTOINCREMENT, customs_case_id INTEGER NOT NULL REFERENCES customs_cases(id) ON DELETE CASCADE,
 title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'document', status TEXT NOT NULL DEFAULT 'pending',
 due_date TEXT, evidence_ref TEXT, responsible_id INTEGER REFERENCES users(id), supervisor_id INTEGER REFERENCES users(id),
 completed_at TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
 CREATE INDEX IF NOT EXISTS idx_customs_case_status ON customs_cases(status,expected_clearance_date);
 CREATE INDEX IF NOT EXISTS idx_customs_requirement_due ON customs_requirements(status,due_date);`);
function makeCode(){return "ADU-"+new Date().toISOString().slice(0,10).replace(/-/g,"")+"-"+Math.random().toString(36).slice(2,7).toUpperCase();}
function audit(type,id,action,user,details={}){try{db.prepare("INSERT INTO entity_events (entity_type,entity_id,action,actor_id,details_json) VALUES (?,?,?,?,?)").run(type,String(id),action,user,JSON.stringify(details));}catch(_){}}
function access(req,res,next){if((ROLE_LEVEL[req.user.role]||0)<45)return res.status(403).json({error:"Permisos insuficientes para expediente aduanero."});next();}

router.get("/cases",access,(_req,res)=>{
 res.json(db.prepare(`SELECT c.*,creator.name created_name,assignee.name assigned_name,
 (SELECT COUNT(*) FROM customs_requirements r WHERE r.customs_case_id=c.id AND r.status NOT IN ('approved')) open_requirements
 FROM customs_cases c JOIN users creator ON creator.id=c.created_by LEFT JOIN users assignee ON assignee.id=c.assigned_to
 ORDER BY c.created_at DESC LIMIT 200`).all());
});
router.post("/cases",access,(req,res)=>{
 const {operation_id=null,direction,origin_country=null,destination_country=null,hs_code=null,customs_regime=null,customs_agency=null,expected_clearance_date=null,assigned_to=null}=req.body||{};
 if(!["import","export","transit"].includes(direction))return res.status(400).json({error:"La dirección aduanera es obligatoria."});
 const result=db.prepare(`INSERT INTO customs_cases (code,operation_id,direction,origin_country,destination_country,hs_code,customs_regime,customs_agency,expected_clearance_date,created_by,assigned_to)
 VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(makeCode(),operation_id,direction,origin_country,destination_country,hs_code,customs_regime,customs_agency,expected_clearance_date,req.user.id,assigned_to);
 audit("customs_case",result.lastInsertRowid,"created",req.user.id,{direction,operation_id});
 res.status(201).json(db.prepare("SELECT * FROM customs_cases WHERE id=?").get(result.lastInsertRowid));
});
router.patch("/cases/:id",access,(req,res)=>{
 const current=db.prepare("SELECT * FROM customs_cases WHERE id=?").get(req.params.id);if(!current)return res.status(404).json({error:"Expediente no encontrado."});
 const allowed=["operation_id","origin_country","destination_country","hs_code","customs_regime","customs_agency","declaration_number","duties_amount","currency","expected_clearance_date","assigned_to","status"];
 const updates=[],values=[];for(const key of allowed){if(req.body?.[key]!==undefined){if(key==="status"&&!CASE_STATUSES.has(req.body[key]))return res.status(400).json({error:"Estado inválido."});updates.push(key+"=?");values.push(req.body[key]);}}
 if(!updates.length)return res.json(current);if(req.body.status==="cleared")updates.push("cleared_at=datetime('now')");updates.push("updated_at=datetime('now')");values.push(current.id);
 db.prepare("UPDATE customs_cases SET "+updates.join(",")+" WHERE id=?").run(...values);audit("customs_case",current.id,"updated",req.user.id,{fields:allowed.filter(k=>req.body?.[k]!==undefined)});
 res.json(db.prepare("SELECT * FROM customs_cases WHERE id=?").get(current.id));
});
router.get("/cases/:id/requirements",access,(req,res)=>res.json(db.prepare(`SELECT r.*,u.name responsible_name,s.name supervisor_name FROM customs_requirements r LEFT JOIN users u ON u.id=r.responsible_id LEFT JOIN users s ON s.id=r.supervisor_id WHERE r.customs_case_id=? ORDER BY r.due_date,r.id`).all(req.params.id)));
router.post("/cases/:id/requirements",access,(req,res)=>{
 const c=db.prepare("SELECT id FROM customs_cases WHERE id=?").get(req.params.id);if(!c)return res.status(404).json({error:"Expediente no encontrado."});
 const {title,category="document",due_date=null,responsible_id=null,supervisor_id=null,notes=null}=req.body||{};if(!title)return res.status(400).json({error:"El requisito requiere un título."});
 const result=db.prepare("INSERT INTO customs_requirements (customs_case_id,title,category,due_date,responsible_id,supervisor_id,notes) VALUES (?,?,?,?,?,?,?)").run(c.id,title.trim(),category,due_date,responsible_id,supervisor_id,notes);
 audit("customs_requirement",result.lastInsertRowid,"created",req.user.id,{customs_case_id:c.id});res.status(201).json(db.prepare("SELECT * FROM customs_requirements WHERE id=?").get(result.lastInsertRowid));
});
router.patch("/requirements/:id",access,(req,res)=>{
 const r=db.prepare("SELECT * FROM customs_requirements WHERE id=?").get(req.params.id);if(!r)return res.status(404).json({error:"Requisito no encontrado."});
 if(req.body?.status==="approved"){
  const level=ROLE_LEVEL[req.user.role]||0;
  if(level<65)return res.status(403).json({error:"La aprobación requiere autorización de supervisión."});
  if(Number(r.responsible_id)===req.user.id)return res.status(403).json({error:"La persona responsable no puede aprobar su propio requisito."});
  if(r.supervisor_id&&Number(r.supervisor_id)!==req.user.id&&level<80)return res.status(403).json({error:"La aprobación corresponde al supervisor asignado."});
 }
 const allowed=["status","evidence_ref","due_date","responsible_id","supervisor_id","notes"];const updates=[],values=[];
 for(const key of allowed){if(req.body?.[key]!==undefined){if(key==="status"&&!REQUIREMENT_STATUSES.has(req.body[key]))return res.status(400).json({error:"Estado inválido."});updates.push(key+"=?");values.push(req.body[key]);}}
 if(!updates.length)return res.json(r);if(req.body.status==="approved")updates.push("completed_at=datetime('now')");updates.push("updated_at=datetime('now')");values.push(r.id);
 db.prepare("UPDATE customs_requirements SET "+updates.join(",")+" WHERE id=?").run(...values);audit("customs_requirement",r.id,"updated",req.user.id,{status:req.body.status});res.json(db.prepare("SELECT * FROM customs_requirements WHERE id=?").get(r.id));
});
router.get("/overview",access,(_req,res)=>{
 const cases=db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM customs_requirements r WHERE r.customs_case_id=c.id AND r.status NOT IN ('approved')) open_requirements FROM customs_cases c WHERE c.status NOT IN ('cleared','closed') ORDER BY c.expected_clearance_date,c.created_at LIMIT 100`).all();
 const overdue=db.prepare(`SELECT r.*,c.code case_code FROM customs_requirements r JOIN customs_cases c ON c.id=r.customs_case_id WHERE r.due_date IS NOT NULL AND date(r.due_date)<date('now') AND r.status NOT IN ('approved','rejected') ORDER BY r.due_date LIMIT 100`).all();
 res.json({cases,overdue,generated_at:new Date().toISOString()});
});
module.exports=router;
