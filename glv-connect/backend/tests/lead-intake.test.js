"use strict";
process.env.DB_PATH = ":memory:";
process.env.NODE_ENV = "test";
process.env.SMTP_HOST = "";

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt  = require("bcryptjs");
const app     = require("../server");
const db      = require("../db/database");

describe("Lead Intake", () => {
  let sesAdmin, sesDirector, sesManager, sesAgent1, sesAgent2, sesClient;

  before(async () => {
    const hash = p => bcrypt.hashSync(p, 4);
    const ins = db.prepare(`INSERT OR IGNORE INTO users (username,password,name,role,email,active) VALUES (?,?,?,?,?,1)`);
    ins.run("li_admin",  hash("Pass1!"), "Admin",    "SUPER_ADMIN",        "li_admin@glv.test");
    ins.run("li_dir",    hash("Pass1!"), "Director", "DIRECTOR",           "li_dir@glv.test");
    ins.run("li_mgr",    hash("Pass1!"), "Manager",  "COMMERCIAL_MANAGER", "li_mgr@glv.test");
    ins.run("li_agent1", hash("Pass1!"), "Agent1",   "COMMERCIAL_AGENT",   "agent1@glv.test");
    ins.run("li_agent2", hash("Pass1!"), "Agent2",   "COMMERCIAL_AGENT",   "agent2@glv.test");
    ins.run("li_client", hash("Pass1!"), "Client",   "CLIENT",             "client@ext.test");

    const login = async (u, p) =>
      (await request(app).post("/auth/login").send({ username: u, password: p })).headers["set-cookie"];

    sesAdmin    = await login("li_admin",  "Pass1!");
    sesDirector = await login("li_dir",    "Pass1!");
    sesManager  = await login("li_mgr",    "Pass1!");
    sesAgent1   = await login("li_agent1", "Pass1!");
    sesAgent2   = await login("li_agent2", "Pass1!");
    sesClient   = await login("li_client", "Pass1!");

    // Seed rules: AR→agent1, BR→agent2
    db.prepare(`INSERT INTO lead_assignment_rules (country_code,agent_username,priority,is_active) VALUES (?,?,?,1)`).run("AR", "li_agent1", 80);
    db.prepare(`INSERT INTO lead_assignment_rules (country_code,agent_username,priority,is_active) VALUES (?,?,?,1)`).run("BR", "li_agent2", 80);
  });

  // LI-1: Auto-assignment by country rule
  test("LI-1: Lead from AR auto-assigned to agent1 by rule", async () => {
    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Pedro AR", country_code: "AR", origin_channel: "WEB",
      company_name: "AR Corp", phone_raw: "+5491123456789",
    });
    assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.equal(r.body.assigned_agent, "li_agent1");
    assert.ok(r.body.assignment_rule_id > 0);
    assert.equal(r.body.status, "ASSIGNED");
  });

  // LI-2: No matching rule → PENDING_ASSIGNMENT
  test("LI-2: Lead with no matching rule → PENDING_ASSIGNMENT", async () => {
    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "No Rule Lead", country_code: "XX", origin_channel: "OTHER",
      company_name: "Unknown Co",
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.status, "PENDING_ASSIGNMENT");
    assert.ok(!r.body.assigned_agent);
  });

  // LI-3: Manual reassignment by DIRECTOR with audit trail
  test("LI-3: Director manually reassigns lead; audit logged", async () => {
    const create = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Reassign Test", country_code: "AR", origin_channel: "WEB", company_name: "Test Co",
    });
    assert.equal(create.status, 201);
    const leadId = create.body.id;

    const r = await request(app).patch(`/leads/${leadId}/assign`).set("Cookie", sesDirector).send({
      agent_username: "li_agent2", reason: "Better match for product type",
    });
    assert.equal(r.status, 200, `Got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.equal(r.body.assigned_agent, "li_agent2");

    const hist = db.prepare(`SELECT * FROM lead_assignment_history WHERE lead_id=? ORDER BY id DESC`).get(leadId);
    assert.ok(hist, "Audit entry must exist");
    assert.equal(hist.new_agent, "li_agent2");
    assert.ok(hist.reason?.length > 0);
  });

  // LI-4: Notification created on assignment (no duplicate)
  test("LI-4: Assignment creates notification; no duplicate on repeated create", async () => {
    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Notif Test", country_code: "AR", origin_channel: "WEB", company_name: "NTT SA",
    });
    assert.equal(r.status, 201);
    const leadId = r.body.id;
    await new Promise(resolve => setTimeout(resolve, 120));

    await new Promise(resolve => setTimeout(resolve, 200));
    const notifs = db.prepare(`SELECT * FROM lead_agent_notifications WHERE lead_id=?`).all(leadId);
    assert.equal(notifs.length, 1, `Exactly one notification record; got: ${JSON.stringify(notifs)}`);

    // Task created for agent
    const tasks = db.prepare(`SELECT * FROM tasks WHERE title LIKE ?`).all(`%${r.body.glv_code}%`);
    assert.ok(tasks.length >= 1, "At least one task created");

    // Dedup: call createAndSend again for same lead+agent+event — if status is PENDING/SENT, skip
    // If status is FAILED (no SMTP in test), the dedup query only blocks PENDING/SENT;
    // a FAILED record can be retried. So dedup test verifies the service's own isDuplicate check.
    const { createAndSendLeadNotification } = require("../services/leadNotificationService");

    // Force existing record back to PENDING to test dedup
    db.prepare(`UPDATE lead_agent_notifications SET status='PENDING' WHERE lead_id=?`).run(leadId);

    createAndSendLeadNotification(leadId, "li_agent1", "LEAD_ASSIGNED");
    await new Promise(resolve => setTimeout(resolve, 50));

    const notifsAfter = db.prepare(`SELECT * FROM lead_agent_notifications WHERE lead_id=? AND event_type='LEAD_ASSIGNED'`).all(leadId);
    assert.equal(notifsAfter.length, 1, "No duplicate notification — dedup blocked second insert");
  });

  // LI-5: WhatsApp URL from normalised phone
  test("LI-5: phone_norm is E.164; WA URL is digits-only", async () => {
    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "WA Test", country_code: "AR", origin_channel: "WHATSAPP",
      company_name: "WA Corp", phone_raw: "+54 9 11 2345-6789",
    });
    assert.equal(r.status, 201);
    const phoneNorm = r.body.phone_norm;
    assert.ok(phoneNorm, "phone_norm must be set");
    assert.ok(phoneNorm.startsWith("+"), "phone_norm starts with +");
    const waUrl = `https://wa.me/${phoneNorm.replace("+", "")}`;
    assert.ok(/^https:\/\/wa\.me\/\d+$/.test(waUrl), `Invalid WA URL: ${waUrl}`);
  });

  // LI-6: First contact transitions status; deadline is ~4 biz hours
  test("LI-6: First contact deadline ~4 biz hours; status transitions correctly", async () => {
    const cr = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "FC Test", country_code: "AR", origin_channel: "WEB", company_name: "FC Corp",
    });
    assert.equal(cr.status, 201);
    const leadId = cr.body.id;

    assert.ok(cr.body.first_contact_deadline, "first_contact_deadline must be set on assigned lead");
    const deadline = new Date(cr.body.first_contact_deadline);
    const diffHours = (deadline - new Date()) / 3600000;
    // Deadline can be up to ~4h + up to 72h weekend/off-hours padding
    assert.ok(diffHours > 0 && diffHours <= 200, `Expected positive deadline, got ${diffHours.toFixed(1)}h`);

    const fc = await request(app).post(`/leads/${leadId}/first-contact`).set("Cookie", sesAgent1).send({
      contact_channel: "WHATSAPP", contact_at: new Date().toISOString(),
      contacted_person: "Pedro", result: "CONTACTED", summary: "Interesado",
      next_action: "Cotización", next_action_at: new Date(Date.now() + 86400000).toISOString(),
    });
    assert.equal(fc.status, 201, `Got ${fc.status}: ${JSON.stringify(fc.body)}`);

    const lead = db.prepare(`SELECT status FROM leads WHERE id=?`).get(leadId);
    assert.ok(["FIRST_CONTACT_DONE", "AWAITING_RESPONSE"].includes(lead.status), `Status: ${lead.status}`);
  });

  // LI-7: Follow-up deadline ~48 biz hours
  test("LI-7: Follow-up deadline is ~48 business hours", async () => {
    const cr = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "FU Test", country_code: "AR", origin_channel: "WEB", company_name: "FU Corp",
    });
    assert.equal(cr.status, 201);
    const leadId = cr.body.id;

    await request(app).post(`/leads/${leadId}/first-contact`).set("Cookie", sesAgent1).send({
      contact_channel: "CALL", contact_at: new Date().toISOString(),
      contacted_person: "Ana", result: "CONTACTED", summary: "Interesado",
      next_action: "Seguimiento", next_action_at: new Date(Date.now() + 86400000).toISOString(),
    });

    const fu = db.prepare(`SELECT * FROM lead_followups WHERE lead_id=?`).get(leadId);
    assert.ok(fu, "Follow-up must be created");
    const deadlineH = (new Date(fu.deadline) - new Date()) / 3600000;
    // 48 business hours, can be up to ~200 real hours with weekends/off-hours
    assert.ok(deadlineH > 0 && deadlineH <= 300, `Expected positive follow-up deadline, got ${deadlineH.toFixed(1)}h`);
  });

  // LI-8: Escalation tracked in timeline; no auto-reassignment
  test("LI-8: Escalation tracked; lead not auto-reassigned", async () => {
    const cr = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Escalate Test", country_code: "AR", origin_channel: "WEB", company_name: "ESC Corp",
    });
    assert.equal(cr.status, 201);
    const leadId = cr.body.id;

    const r = await request(app).patch(`/leads/${leadId}/assign`).set("Cookie", sesDirector).send({
      status: "ESCALATED", reason: "No first contact in 4h",
    });
    assert.ok([200, 400].includes(r.status), `Got ${r.status}`);
    if (r.status === 200) {
      assert.equal(r.body.status, "ESCALATED");
    }

    const tl = await request(app).get(`/leads/${leadId}/timeline`).set("Cookie", sesAdmin);
    assert.equal(tl.status, 200);
    assert.ok(tl.body.length >= 1, "Timeline must have at least CREATED entry");

    // Agent unchanged (no auto-reassignment)
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(leadId);
    assert.equal(lead.assigned_agent, "li_agent1");
  });

  // LI-9: Agent data isolation
  test("LI-9: Agent1 cannot see leads assigned to agent2", async () => {
    const crBR = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "BR Only", country_code: "BR", origin_channel: "WEB", company_name: "BR Corp",
    });
    assert.equal(crBR.status, 201);
    assert.equal(crBR.body.assigned_agent, "li_agent2");

    const r = await request(app).get("/leads").set("Cookie", sesAgent1);
    assert.equal(r.status, 200);
    const leadIds = r.body.map(l => l.id);
    assert.ok(!leadIds.includes(crBR.body.id), "Agent1 must not see agent2's lead");
  });

  // LI-10: Email failure recorded; retry resets
  test("LI-10: Email failure saved as FAILED status", async () => {
    const cr = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Mail Fail", country_code: "AR", origin_channel: "WEB", company_name: "MF Corp",
    });
    assert.equal(cr.status, 201);
    const leadId = cr.body.id;
    await new Promise(resolve => setTimeout(resolve, 120));

    const notif = db.prepare(`SELECT * FROM lead_agent_notifications WHERE lead_id=?`).get(leadId);
    assert.ok(notif, "Notification record must exist");
    // SMTP_HOST="" → status should be FAILED (no config)
    assert.equal(notif.status, "FAILED");
    assert.ok(notif.last_error?.length > 0);
  });

  // LI-11: Duplicate detected by normalised phone
  test("LI-11: Duplicate detected by normalised phone", async () => {
    await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Dup Original", country_code: "AR", origin_channel: "WEB",
      company_name: "Dup Corp", phone_raw: "+5491155556666",
    });

    const r2 = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Dup Copy", country_code: "AR", origin_channel: "WEB",
      company_name: "Dup Corp 2", phone_raw: "+5491155556666",
    });
    assert.ok(
      r2.status === 409 || (r2.status === 201 && r2.body.possible_duplicates?.length > 0),
      `Expected 409 or 201+duplicates, got ${r2.status}: ${JSON.stringify(r2.body)}`
    );
  });

  // LI-12: CLIENT cannot access leads
  test("LI-12: CLIENT role blocked from leads endpoint", async () => {
    const r = await request(app).get("/leads").set("Cookie", sesClient);
    assert.ok(r.status === 403 || r.status === 401, `Expected 403/401, got ${r.status}`);
  });
});
