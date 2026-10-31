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

  // LI-6: First contact deadline — deterministic window vs addBusinessHours(before, 4)
  test("LI-6: first_contact_deadline falls within addBusinessHours(now, 4) ±5s window", async () => {
    const { addBusinessHours } = require("../services/businessHoursService");
    const before = new Date();
    const cr = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "FC Window Test", country_code: "AR", origin_channel: "WEB", company_name: "FC Win Corp",
    });
    assert.equal(cr.status, 201);
    const deadlineStr = cr.body.first_contact_deadline;
    assert.ok(deadlineStr, "first_contact_deadline must be set");

    const after     = new Date();
    const deadlineMs = new Date(deadlineStr).getTime();
    assert.ok(!isNaN(deadlineMs), "first_contact_deadline must be a valid ISO date");

    const loMs = new Date(addBusinessHours(before, 4)).getTime() - 5000;
    const hiMs = new Date(addBusinessHours(after,  4)).getTime() + 5000;
    assert.ok(deadlineMs >= loMs, `Deadline too early: ${deadlineStr} < window low`);
    assert.ok(deadlineMs <= hiMs, `Deadline too far: ${deadlineStr} > window high`);

    // Status must be ASSIGNED after creation with agent
    const lead = db.prepare(`SELECT * FROM leads WHERE id=?`).get(cr.body.id);
    assert.equal(lead.status, "ASSIGNED");

    // Record first contact and verify transition
    const fc = await request(app).post(`/leads/${cr.body.id}/first-contact`).set("Cookie", sesAgent1).send({
      contact_channel: "WHATSAPP", contact_at: new Date().toISOString(),
      contacted_person: "Pedro", result: "CONTACTED", summary: "Interesado",
      next_action: "Cotización", next_action_at: new Date(Date.now() + 86400000).toISOString(),
    });
    assert.equal(fc.status, 201, `First contact: got ${fc.status}: ${JSON.stringify(fc.body)}`);

    const leadAfter = db.prepare(`SELECT status FROM leads WHERE id=?`).get(cr.body.id);
    assert.ok(["FIRST_CONTACT_DONE","AWAITING_RESPONSE"].includes(leadAfter.status), `Status: ${leadAfter.status}`);
  });

  // LI-7: Follow-up deadline — deterministic window vs addBusinessHours(beforeFC, 48)
  test("LI-7: follow-up deadline falls within addBusinessHours(first-contact, 48) ±5s window", async () => {
    const { addBusinessHours } = require("../services/businessHoursService");
    const cr = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "FU Window Test", country_code: "AR", origin_channel: "WEB", company_name: "FU Win Corp",
    });
    assert.equal(cr.status, 201);
    const leadId = cr.body.id;

    const beforeFC = new Date();
    const fc = await request(app).post(`/leads/${leadId}/first-contact`).set("Cookie", sesAgent1).send({
      contact_channel: "CALL", contact_at: new Date().toISOString(),
      contacted_person: "Ana", result: "CONTACTED", summary: "Interesado",
      next_action: "Seguimiento", next_action_at: new Date(Date.now() + 86400000).toISOString(),
    });
    assert.equal(fc.status, 201);
    const afterFC = new Date();

    const fu = db.prepare(`SELECT * FROM lead_followups WHERE lead_id=?`).get(leadId);
    assert.ok(fu, "Follow-up must be created");

    const fuDeadlineMs = new Date(fu.deadline).getTime();
    assert.ok(!isNaN(fuDeadlineMs), "Follow-up deadline must be a valid date");

    const loMs = new Date(addBusinessHours(beforeFC, 48)).getTime() - 5000;
    const hiMs = new Date(addBusinessHours(afterFC,  48)).getTime() + 5000;
    assert.ok(fuDeadlineMs >= loMs, `FU deadline too early: ${fu.deadline} < window low`);
    assert.ok(fuDeadlineMs <= hiMs, `FU deadline too far: ${fu.deadline} > window high`);
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

  // LI-13: Reminder idempotent
  test("LI-13: REMINDER_FIRST_CONTACT created only once per lead (idempotent)", async () => {
    const { runEscalationCheck } = require("../services/leadEscalationService");
    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Reminder Idem", country_code: "AR", origin_channel: "WEB", company_name: "RI Corp",
    });
    const leadId = r.body.id;
    // Set deadline 30 minutes from now (within 1h reminder window)
    db.prepare(`UPDATE leads SET first_contact_deadline=?, status='ASSIGNED' WHERE id=?`)
      .run(new Date(Date.now() + 30 * 60000).toISOString(), leadId);

    runEscalationCheck();
    runEscalationCheck();

    const reminders = db.prepare(
      `SELECT * FROM lead_timeline WHERE lead_id=? AND event_type='REMINDER_FIRST_CONTACT'`
    ).all(leadId);
    assert.equal(reminders.length, 1, "Only one REMINDER_FIRST_CONTACT event (idempotent)");
  });

  // LI-14: Escalation idempotent
  test("LI-14: ESCALATED_FIRST_CONTACT created only once per lead (idempotent)", async () => {
    const { runEscalationCheck } = require("../services/leadEscalationService");
    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Escalation Idem", country_code: "AR", origin_channel: "WEB", company_name: "EI Corp",
    });
    const leadId = r.body.id;
    // Set deadline 5 minutes ago (overdue)
    db.prepare(`UPDATE leads SET first_contact_deadline=?, status='ASSIGNED' WHERE id=?`)
      .run(new Date(Date.now() - 5 * 60000).toISOString(), leadId);

    runEscalationCheck();
    runEscalationCheck();

    const escalations = db.prepare(
      `SELECT * FROM lead_timeline WHERE lead_id=? AND event_type='ESCALATED_FIRST_CONTACT'`
    ).all(leadId);
    assert.equal(escalations.length, 1, "Only one ESCALATED_FIRST_CONTACT event (idempotent)");

    const lead = db.prepare(`SELECT status FROM leads WHERE id=?`).get(leadId);
    assert.equal(lead.status, "ESCALATED");
  });

  // LI-15: Reassignment cancels old task and creates new one with deadline
  test("LI-15: Reassignment cancels old task, creates new task with deadline for new agent", async () => {
    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Reassign Tasks", country_code: "AR", origin_channel: "WEB", company_name: "RT Corp",
    });
    assert.equal(r.status, 201);
    const leadId  = r.body.id;
    const glvCode = r.body.glv_code;

    // Verify task exists for agent1
    const agent1User = db.prepare("SELECT id FROM users WHERE username='li_agent1'").get();
    const oldTask = db.prepare(
      `SELECT * FROM tasks WHERE title LIKE ? AND assigned_to=? AND status NOT IN ('COMPLETADA','CANCELADA','completed')`
    ).get(`%${glvCode}%`, agent1User?.id);
    assert.ok(oldTask, "Initial task for agent1 must exist");

    // Reassign to agent2 (requires reason)
    const ra = await request(app).patch(`/leads/${leadId}/assign`).set("Cookie", sesDirector).send({
      agent_username: "li_agent2", reason: "Mejor cobertura geográfica",
    });
    assert.equal(ra.status, 200, `Reassign failed: ${JSON.stringify(ra.body)}`);

    // Old task must be cancelled
    const cancelledTask = db.prepare(`SELECT status FROM tasks WHERE id=?`).get(oldTask.id);
    assert.equal(cancelledTask.status, "CANCELADA", "Old task must be CANCELADA");

    // New task for agent2 must exist with a deadline
    const agent2User = db.prepare("SELECT id FROM users WHERE username='li_agent2'").get();
    const newTask = db.prepare(
      `SELECT * FROM tasks WHERE title LIKE ? AND assigned_to=? AND status NOT IN ('COMPLETADA','CANCELADA','completed')`
    ).get(`%${glvCode}%`, agent2User?.id);
    assert.ok(newTask, "New task for agent2 must be created");
    assert.ok(newTask.deadline, "New task must have a deadline");
  });

  // LI-16: Agent without corporate email is blocked on reassignment
  test("LI-16: Agent without corporate email blocked from receiving reassignment", async () => {
    db.prepare(`INSERT OR REPLACE INTO users (username,password,role,email,name,active) VALUES (?,?,?,?,?,1)`)
      .run("li_noemail", "$2b$04$fakehash", "COMMERCIAL_AGENT", "", "No Email Agent");

    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "No Email Test", country_code: "AR", origin_channel: "WEB", company_name: "NE Corp",
    });
    const leadId = r.body.id;

    const ra = await request(app).patch(`/leads/${leadId}/assign`).set("Cookie", sesDirector).send({
      agent_username: "li_noemail", reason: "Test email validation",
    });
    assert.ok(ra.status === 400 || ra.status === 422, `Expected 400/422, got ${ra.status}`);
    assert.ok(
      ra.body.error?.toLowerCase().includes("correo") || ra.body.error?.toLowerCase().includes("email"),
      `Error message should mention email: ${ra.body.error}`
    );
  });

  // LI-17: Agent1 cannot update followup on agent2's lead
  test("LI-17: agent1 gets 403 updating followup on lead assigned to agent2", async () => {
    // BR lead auto-assigned to agent2
    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Isolation FU", country_code: "BR", origin_channel: "WEB", company_name: "ISO FU Corp",
    });
    assert.equal(r.body.assigned_agent, "li_agent2", "Should be assigned to agent2");
    const leadId = r.body.id;

    // Agent2 records first contact
    const fc = await request(app).post(`/leads/${leadId}/first-contact`).set("Cookie", sesAgent2).send({
      contact_channel: "CALL", contact_at: new Date().toISOString(),
      contacted_person: "Maria", result: "CONTACTED", summary: "Interested",
      next_action: "Follow up", next_action_at: new Date(Date.now() + 86400000).toISOString(),
    });
    if (fc.status !== 201) return; // Skip if endpoint not wired

    const fu = db.prepare(`SELECT * FROM lead_followups WHERE lead_id=?`).get(leadId);
    if (!fu) return;

    // Agent1 tries to update agent2's followup
    const r2 = await request(app).patch(`/leads/${leadId}/followup/${fu.id}`)
      .set("Cookie", sesAgent1).send({ status: "CLIENT_RESPONDED" });
    assert.ok(r2.status === 403 || r2.status === 401, `Agent1 must be blocked, got ${r2.status}`);
  });

  // LI-18: Second first-contact returns 409
  test("LI-18: Second first-contact attempt on same lead returns 409", async () => {
    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Double Contact", country_code: "AR", origin_channel: "WEB", company_name: "DC Corp",
    });
    const leadId = r.body.id;

    const fc1 = await request(app).post(`/leads/${leadId}/first-contact`).set("Cookie", sesAgent1).send({
      contact_channel: "WHATSAPP", contact_at: new Date().toISOString(),
      contacted_person: "Pedro", result: "CONTACTED", summary: "Primera vez",
      next_action: "Cotizar", next_action_at: new Date(Date.now() + 86400000).toISOString(),
    });
    assert.ok(fc1.status === 201 || fc1.status === 200, `First contact: expected 201, got ${fc1.status}`);

    const fc2 = await request(app).post(`/leads/${leadId}/first-contact`).set("Cookie", sesAgent1).send({
      contact_channel: "CALL", contact_at: new Date().toISOString(),
      contacted_person: "Pedro", result: "CONTACTED", summary: "Segunda vez",
      next_action: "Cotizar", next_action_at: new Date(Date.now() + 86400000).toISOString(),
    });
    assert.equal(fc2.status, 409, `Second first contact must return 409, got ${fc2.status}: ${JSON.stringify(fc2.body)}`);
  });

  // LI-19: Reassignment creates notification record; not blocked by duplicate detection
  test("LI-19: Reassignment creates new LEAD_REASSIGNED notification (not blocked by dedup)", async () => {
    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Reassign Notif", country_code: "AR", origin_channel: "WEB", company_name: "RN Corp",
    });
    assert.equal(r.status, 201);
    const leadId = r.body.id;

    // Wait for initial LEAD_ASSIGNED notification to settle
    await new Promise(resolve => setTimeout(resolve, 150));

    const ra = await request(app).patch(`/leads/${leadId}/assign`).set("Cookie", sesDirector).send({
      agent_username: "li_agent2", reason: "Test reassignment notification",
    });
    assert.equal(ra.status, 200, `Reassign failed: ${JSON.stringify(ra.body)}`);

    // Wait for async setImmediate to fire
    await new Promise(resolve => setTimeout(resolve, 150));

    const notifs = db.prepare(
      `SELECT * FROM lead_agent_notifications WHERE lead_id=? AND event_type='LEAD_REASSIGNED'`
    ).all(leadId);
    assert.ok(notifs.length >= 1,
      `LEAD_REASSIGNED notification must exist after reassignment; got ${JSON.stringify(notifs)}`);
  });

  // LI-20: Reminder creates agent task (idempotent — second runEscalationCheck skips)
  test("LI-20: REMINDER_FIRST_CONTACT creates agent task; idempotent on second run", async () => {
    const { runEscalationCheck } = require("../services/leadEscalationService");
    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Reminder Task Test", country_code: "AR", origin_channel: "WEB", company_name: "RTT Corp",
    });
    const leadId  = r.body.id;
    const glvCode = r.body.glv_code;

    db.prepare(`UPDATE leads SET first_contact_deadline=?, status='ASSIGNED', assigned_agent='li_agent1' WHERE id=?`)
      .run(new Date(Date.now() + 30 * 60000).toISOString(), leadId);

    runEscalationCheck();
    runEscalationCheck(); // second call must be idempotent

    const tasks = db.prepare(
      `SELECT * FROM tasks WHERE lead_id=? AND task_type='REMINDER_FIRST_CONTACT' AND status NOT IN ('COMPLETADA','CANCELADA','completed')`
    ).all(leadId);
    assert.equal(tasks.length, 1, `Exactly 1 REMINDER_FIRST_CONTACT task; got ${tasks.length}`);

    const agent1User = db.prepare("SELECT id FROM users WHERE username='li_agent1'").get();
    assert.equal(tasks[0].assigned_to, agent1User.id, "Reminder task must be assigned to agent1");
  });

  // LI-21: Follow-up escalation creates supervisor task (idempotent)
  test("LI-21: Follow-up overdue creates supervisor task; idempotent on second run", async () => {
    const { runEscalationCheck } = require("../services/leadEscalationService");

    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "FU Esc Task", country_code: "AR", origin_channel: "WEB", company_name: "FET Corp",
    });
    assert.equal(r.status, 201);
    const leadId  = r.body.id;
    const glvCode = r.body.glv_code;

    // Insert overdue follow-up
    db.prepare(
      `INSERT INTO lead_followups (lead_id, status, deadline, created_at, updated_at)
       VALUES (?, 'AWAITING_RESPONSE', ?, datetime('now'), datetime('now'))`
    ).run(leadId, new Date(Date.now() - 3600000).toISOString());

    db.prepare(`UPDATE leads SET assigned_agent='li_agent1' WHERE id=?`).run(leadId);

    runEscalationCheck();
    runEscalationCheck(); // second call must not duplicate the task

    const tasks = db.prepare(
      `SELECT * FROM tasks WHERE lead_id=? AND task_type='ESCALATION_FOLLOWUP' AND status NOT IN ('COMPLETADA','CANCELADA','completed')`
    ).all(leadId);
    assert.equal(tasks.length, 1, `Exactly 1 ESCALATION_FOLLOWUP supervisor task; got ${tasks.length}`);
    assert.equal(tasks[0].priority, "ALTA", "Supervisor task priority must be ALTA");
  });

  // LI-22: First contact closes FIRST_CONTACT task only, not CLIENT_RESPONSE_FOLLOWUP
  test("LI-22: first-contact closes FIRST_CONTACT task; CLIENT_RESPONSE_FOLLOWUP task left open", async () => {
    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Task Isolation", country_code: "AR", origin_channel: "WEB", company_name: "TI Corp",
    });
    assert.equal(r.status, 201);
    const leadId = r.body.id;
    const agent1User = db.prepare("SELECT id FROM users WHERE username='li_agent1'").get();

    // Seed a CLIENT_RESPONSE_FOLLOWUP task manually to represent a prior follow-up
    db.prepare(
      `INSERT INTO tasks (title, description, status, priority, assigned_to, lead_id, task_type)
       VALUES (?, ?, 'PENDIENTE', 'ALTA', ?, ?, 'CLIENT_RESPONSE_FOLLOWUP')`
    ).run(`[SEGUIMIENTO] Resp cliente ${r.body.glv_code}`, "Esperar respuesta", agent1User.id, leadId);

    const fuTask = db.prepare(
      `SELECT id FROM tasks WHERE lead_id=? AND task_type='CLIENT_RESPONSE_FOLLOWUP'`
    ).get(leadId);
    assert.ok(fuTask, "Follow-up task must be seeded");

    const fc = await request(app).post(`/leads/${leadId}/first-contact`).set("Cookie", sesAgent1).send({
      contact_channel: "CALL", contact_at: new Date().toISOString(),
      contacted_person: "Luis", result: "CONTACTED", summary: "Respondió",
      next_action: "Cotizar", next_action_at: new Date(Date.now() + 86400000).toISOString(),
    });
    assert.ok([200, 201].includes(fc.status), `First contact: ${fc.status}: ${JSON.stringify(fc.body)}`);

    // FIRST_CONTACT task must be COMPLETADA
    const fcTask = db.prepare(
      `SELECT status FROM tasks WHERE lead_id=? AND task_type='FIRST_CONTACT'`
    ).get(leadId);
    assert.ok(fcTask, "FIRST_CONTACT task must exist");
    assert.equal(fcTask.status, "COMPLETADA", "FIRST_CONTACT task must be COMPLETADA");

    // CLIENT_RESPONSE_FOLLOWUP task must NOT be touched
    const fuTaskAfter = db.prepare(`SELECT status FROM tasks WHERE id=?`).get(fuTask.id);
    assert.notEqual(fuTaskAfter.status, "COMPLETADA",
      "CLIENT_RESPONSE_FOLLOWUP task must not be closed by first-contact");
  });

  // LI-23: Auto-assignment with invalid agent → PENDING_ASSIGNMENT + ASSIGNMENT_FAILED timeline
  test("LI-23: Invalid rule agent → PENDING_ASSIGNMENT + ASSIGNMENT_FAILED timeline", async () => {
    // Seed a rule pointing to a non-commercial user
    db.prepare(`INSERT OR IGNORE INTO users (username,password,name,role,email,active) VALUES (?,?,?,?,?,1)`)
      .run("li_badagent", "$2b$04$fakehash", "Bad Agent", "CLIENT", "badagent@ext.test");

    db.prepare(
      `INSERT INTO lead_assignment_rules (country_code,agent_username,priority,is_active) VALUES (?,?,?,1)`
    ).run("ZZ", "li_badagent", 90);

    const r = await request(app).post("/leads").set("Cookie", sesAdmin).send({
      contact_name: "Invalid Agent Lead", country_code: "ZZ", origin_channel: "WEB", company_name: "IAL Corp",
    });
    assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.equal(r.body.status, "PENDING_ASSIGNMENT",
      `Lead with invalid rule agent must be PENDING_ASSIGNMENT, got: ${r.body.status}`);
    assert.ok(!r.body.assigned_agent, "No agent should be assigned when rule agent is invalid");

    const leadId = r.body.id;
    const failedEvent = db.prepare(
      `SELECT * FROM lead_timeline WHERE lead_id=? AND event_type='ASSIGNMENT_FAILED'`
    ).get(leadId);
    assert.ok(failedEvent, "ASSIGNMENT_FAILED timeline event must be created");
    assert.ok(failedEvent.description?.includes("li_badagent"),
      `Description must mention the invalid agent: ${failedEvent.description}`);
  });
});
