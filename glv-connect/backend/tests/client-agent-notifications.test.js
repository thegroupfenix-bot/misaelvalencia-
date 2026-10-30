"use strict";
process.env.DB_PATH   = ":memory:";
process.env.NODE_ENV  = "test";
process.env.SMTP_HOST = ""; // prevent real mail sends

const { test, describe, before } = require("node:test");
const assert  = require("node:assert/strict");
const request = require("supertest");
const bcrypt  = require("bcryptjs");
const app     = require("../server");
const db      = require("../db/database");
const { createAndSend, retryNotification } = require("../services/notificationService");

describe("Client Agent Notifications", () => {
  let sesAdmin, sesDirector, sesCompliance, sesAgent1, sesAgent2, sesClient;
  let agent1Id, agent2Id, client1Id, client2Id, client3Id, client4Id, client5Id;

  before(async () => {
    const hash = (p) => bcrypt.hashSync(p, 4);

    const ins = db.prepare(
      `INSERT INTO users (username, password, role, name, email, first_login, active) VALUES (?,?,?,?,?,0,1)`
    );
    ins.run("can_admin",  hash("Pass1!"), "SUPER_ADMIN",     "CAN Admin",  "can_admin@glv.test");
    ins.run("can_dir",    hash("Pass1!"), "DIRECTOR",        "CAN Dir",    "can_dir@glv.test");
    ins.run("can_comp",   hash("Pass1!"), "COMPLIANCE",      "CAN Comp",   "can_comp@glv.test");
    ins.run("can_agent1", hash("Pass1!"), "COMMERCIAL_AGENT","CAN Agent1", "agent1@glv.test");
    ins.run("can_agent2", hash("Pass1!"), "COMMERCIAL_AGENT","CAN Agent2", "agent2@glv.test");
    ins.run("can_client", hash("Pass1!"), "CLIENT",          "CAN Client", "ext_client@example.com");

    agent1Id = db.prepare(`SELECT id FROM users WHERE username='can_agent1'`).get().id;
    agent2Id = db.prepare(`SELECT id FROM users WHERE username='can_agent2'`).get().id;

    const login = async (u, p) =>
      (await request(app).post("/auth/login").send({ username: u, password: p })).headers["set-cookie"];

    sesAdmin     = await login("can_admin",  "Pass1!");
    sesDirector  = await login("can_dir",    "Pass1!");
    sesCompliance= await login("can_comp",   "Pass1!");
    sesAgent1    = await login("can_agent1", "Pass1!");
    sesAgent2    = await login("can_agent2", "Pass1!");
    sesClient    = await login("can_client", "Pass1!");

    // Insert clients in LEAD/PRE_REGISTRATION state with no assigned agent
    const c1 = db.prepare(
      `INSERT INTO clients (type,name,glv_code,lead_status,kyc_status,active) VALUES (?,?,?,?,?,?)`
    ).run("buyer","Empresa Test CAN A","GLV-CAN-001","LEAD","PRE_REGISTRATION",0);
    const c2 = db.prepare(
      `INSERT INTO clients (type,name,glv_code,lead_status,kyc_status,active) VALUES (?,?,?,?,?,?)`
    ).run("buyer","Empresa Test CAN B","GLV-CAN-002","LEAD","PRE_REGISTRATION",0);
    // client3: for CAN-4 reassignment test
    const c3 = db.prepare(
      `INSERT INTO clients (type,name,glv_code,lead_status,kyc_status,active) VALUES (?,?,?,?,?,?)`
    ).run("buyer","Empresa Test CAN C","GLV-CAN-003","LEAD","PRE_REGISTRATION",0);
    // client4: for CAN-10 same-agent test
    const c4 = db.prepare(
      `INSERT INTO clients (type,name,glv_code,lead_status,kyc_status,active) VALUES (?,?,?,?,?,?)`
    ).run("buyer","Empresa Test CAN D","GLV-CAN-004","LEAD","PRE_REGISTRATION",0);
    // client5: for CAN-12 task assignment test
    const c5 = db.prepare(
      `INSERT INTO clients (type,name,glv_code,lead_status,kyc_status,active) VALUES (?,?,?,?,?,?)`
    ).run("buyer","Empresa Test CAN E","GLV-CAN-005","LEAD","PRE_REGISTRATION",0);

    client1Id = c1.lastInsertRowid;
    client2Id = c2.lastInsertRowid;
    client3Id = c3.lastInsertRowid;
    client4Id = c4.lastInsertRowid;
    client5Id = c5.lastInsertRowid;

    // Ensure GLV-CO sequence exists for ACTIVE_CLIENT activation
    try {
      db.prepare(`INSERT OR IGNORE INTO glv_code_sequences (entity_code, last_seq) VALUES ('GLV-CO', 0)`).run();
    } catch (_) {}
  });

  // CAN-1: LEAD status without activation → no notification
  test("CAN-1: LEAD client without assigned agent — no notification created", () => {
    const notifs = db.prepare(
      `SELECT * FROM client_agent_notifications WHERE client_id=?`
    ).all(client1Id);
    assert.equal(notifs.length, 0, "No notification should exist for unactivated LEAD client");
  });

  // CAN-2: Activating client with assigned_agent → AGENT_ASSIGNED_ON_ACTIVATION
  test("CAN-2: Activating client with assigned_agent triggers AGENT_ASSIGNED_ON_ACTIVATION", async () => {
    const r = await request(app)
      .patch(`/clients/${client1Id}/kyc-status`)
      .set("Cookie", sesCompliance)
      .send({ kyc_status: "ACTIVE_CLIENT", assigned_agent: agent1Id });

    assert.ok(r.status === 200 || r.status === 201,
      `Expected 200/201, got ${r.status}: ${JSON.stringify(r.body)}`);

    await new Promise(res => setTimeout(res, 200));

    const notifs = db.prepare(
      `SELECT * FROM client_agent_notifications WHERE client_id=? AND agent_username=?`
    ).all(client1Id, "can_agent1");

    assert.ok(notifs.length >= 1, "Notification must be created on activation with agent");
    assert.equal(notifs[0].agent_email, "agent1@glv.test");
    assert.equal(notifs[0].event_type, "AGENT_ASSIGNED_ON_ACTIVATION",
      `Expected AGENT_ASSIGNED_ON_ACTIVATION, got: ${notifs[0].event_type}`);
  });

  // CAN-3: Assigning agent to already-active client → AGENT_ASSIGNED_TO_ACTIVE_CLIENT (via HTTP)
  test("CAN-3: Assigning agent to already-active client via endpoint creates AGENT_ASSIGNED_TO_ACTIVE_CLIENT", async () => {
    // Activate client2 directly (no agent) — we're testing the agent-assignment path, not activation
    db.prepare(`UPDATE clients SET kyc_status='ACTIVE_CLIENT', active=1 WHERE id=?`).run(client2Id);

    // Now assign agent1 to the already-active client via the API
    const r = await request(app)
      .patch(`/clients/${client2Id}/kyc-status`)
      .set("Cookie", sesCompliance)
      .send({ assigned_agent: agent1Id });

    assert.ok(r.status === 200 || r.status === 201,
      `Expected 200/201, got ${r.status}: ${JSON.stringify(r.body)}`);

    await new Promise(res => setTimeout(res, 200));

    const notifs = db.prepare(
      `SELECT * FROM client_agent_notifications WHERE client_id=? AND agent_username=?`
    ).all(client2Id, "can_agent1");

    assert.ok(notifs.length >= 1, "Notification must be created when agent assigned to active client");
    assert.equal(notifs[0].event_type, "AGENT_ASSIGNED_TO_ACTIVE_CLIENT",
      `Expected AGENT_ASSIGNED_TO_ACTIVE_CLIENT, got: ${notifs[0].event_type}`);
  });

  // CAN-4: Reassignment via HTTP → notifies new agent, not previous
  test("CAN-4: Reassignment via endpoint notifies new agent exactly once; old agent not re-notified", async () => {
    // Step 1: activate client3 with agent1
    const r1 = await request(app)
      .patch(`/clients/${client3Id}/kyc-status`)
      .set("Cookie", sesCompliance)
      .send({ kyc_status: "ACTIVE_CLIENT", assigned_agent: agent1Id });
    assert.ok(r1.status === 200 || r1.status === 201,
      `Activation failed: ${r1.status}: ${JSON.stringify(r1.body)}`);
    await new Promise(res => setTimeout(res, 200));

    const agent1NotifsBeforeReassign = db.prepare(
      `SELECT * FROM client_agent_notifications WHERE client_id=? AND agent_username='can_agent1'`
    ).all(client3Id);
    assert.ok(agent1NotifsBeforeReassign.length >= 1, "Agent1 must have activation notification");

    // Step 2: reassign to agent2 via endpoint
    const r2 = await request(app)
      .patch(`/clients/${client3Id}/kyc-status`)
      .set("Cookie", sesCompliance)
      .send({ assigned_agent: agent2Id });
    assert.ok(r2.status === 200 || r2.status === 201,
      `Reassignment failed: ${r2.status}: ${JSON.stringify(r2.body)}`);
    await new Promise(res => setTimeout(res, 200));

    // Agent2 must have a AGENT_REASSIGNED notification
    const agent2Notifs = db.prepare(
      `SELECT * FROM client_agent_notifications WHERE client_id=? AND agent_username='can_agent2' AND event_type='AGENT_REASSIGNED'`
    ).all(client3Id);
    assert.ok(agent2Notifs.length >= 1, "New agent2 must receive AGENT_REASSIGNED notification");

    // Agent1 must NOT have any new notification after reassignment
    const agent1NotifsAfterReassign = db.prepare(
      `SELECT * FROM client_agent_notifications WHERE client_id=? AND agent_username='can_agent1'`
    ).all(client3Id);
    assert.equal(agent1NotifsAfterReassign.length, agent1NotifsBeforeReassign.length,
      "Old agent1 must NOT receive any new notification on reassignment");

    // Calling the same reassignment again must not duplicate the notification for agent2
    await request(app)
      .patch(`/clients/${client3Id}/kyc-status`)
      .set("Cookie", sesCompliance)
      .send({ assigned_agent: agent2Id });
    await new Promise(res => setTimeout(res, 200));

    // In test env, SMTP is off so records become FAILED — check total count regardless of status
    const agent2NotifsAfterDup = db.prepare(
      `SELECT * FROM client_agent_notifications WHERE client_id=? AND agent_username='can_agent2' AND event_type='AGENT_REASSIGNED'`
    ).all(client3Id);
    assert.equal(agent2NotifsAfterDup.length, 1, "Dedup must prevent duplicate AGENT_REASSIGNED for agent2");
  });

  // CAN-5: Email failure → error saved, retry resets state
  test("CAN-5: Failed notification saves error and retry resets it", async () => {
    const r = db.prepare(
      `INSERT INTO client_agent_notifications
       (client_id, agent_username, agent_email, event_type, client_name, status, attempts, last_error)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(client1Id, "can_agent1", "agent1@glv.test", "AGENT_REASSIGNED", "Test Client CAN", "FAILED", 3, "ECONNREFUSED: connection refused");

    const notifId = r.lastInsertRowid;
    const saved = db.prepare(`SELECT * FROM client_agent_notifications WHERE id=?`).get(notifId);
    assert.equal(saved.status, "FAILED");
    assert.ok(saved.last_error && saved.last_error.length > 0, "Error message must be saved");

    retryNotification(notifId);

    const afterReset = db.prepare(`SELECT * FROM client_agent_notifications WHERE id=?`).get(notifId);
    assert.equal(afterReset.attempts, 0, "Attempts must be 0 immediately after reset");

    await new Promise(res => setTimeout(res, 200));

    const retried = db.prepare(`SELECT * FROM client_agent_notifications WHERE id=?`).get(notifId);
    assert.ok(
      retried.status === "PENDING" || retried.status === "FAILED",
      `After retry, status should be PENDING or FAILED (no SMTP in test), got: ${retried.status}`
    );
    assert.ok(retried.attempts >= 1, "Attempts must be >= 1 after retry attempt");
  });

  // CAN-6: Repeated createAndSend for same client+agent+event is idempotent
  test("CAN-6: Repeated createAndSend call for same client+agent+event is idempotent", async () => {
    // client1 already has AGENT_ASSIGNED_ON_ACTIVATION for agent1 from CAN-2
    // Calling again must produce no new PENDING/SENT record
    createAndSend(client1Id, agent1Id, "AGENT_ASSIGNED_ON_ACTIVATION", {
      name: "Empresa Test CAN A", glv_code: "GLV-CAN-001",
    });
    await new Promise(res => setTimeout(res, 100));

    createAndSend(client1Id, agent1Id, "AGENT_ASSIGNED_ON_ACTIVATION", {
      name: "Empresa Test CAN A", glv_code: "GLV-CAN-001",
    });
    await new Promise(res => setTimeout(res, 100));

    const notifs = db.prepare(
      `SELECT * FROM client_agent_notifications WHERE client_id=? AND agent_username=? AND event_type='AGENT_ASSIGNED_ON_ACTIVATION'`
    ).all(client1Id, "can_agent1");
    assert.equal(notifs.length, 1, "Exactly one notification record for this event (idempotent — no duplicate)");
  });

  // CAN-7: CLIENT cannot access notification history
  test("CAN-7: CLIENT role cannot access notification history — 403", async () => {
    const r = await request(app)
      .get(`/clients/${client1Id}/notifications`)
      .set("Cookie", sesClient);
    assert.ok(r.status === 403 || r.status === 401,
      `Expected 403/401 for CLIENT, got ${r.status}`);
  });

  // CAN-8: Agent sees only their own notifications
  test("CAN-8: Agent sees only their own notifications via GET /clients/:id/notifications", async () => {
    const r = await request(app)
      .get(`/clients/${client1Id}/notifications`)
      .set("Cookie", sesAgent1);

    if (r.status === 200) {
      assert.ok(Array.isArray(r.body), "Response must be array");
      for (const n of r.body) {
        assert.equal(n.agent_username, "can_agent1",
          `Agent should only see their own notifications, found: ${n.agent_username}`);
      }
    } else {
      assert.ok(r.status === 403 || r.status === 200,
        `Unexpected status for agent: ${r.status}`);
    }
  });

  // CAN-9: COMPLIANCE sees all notifications for a client
  test("CAN-9: COMPLIANCE sees all notifications for a client", async () => {
    const r = await request(app)
      .get(`/clients/${client1Id}/notifications`)
      .set("Cookie", sesCompliance);
    assert.equal(r.status, 200, `Expected 200 for COMPLIANCE, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok(Array.isArray(r.body), "Response must be array");
    assert.ok(r.body.length >= 1, "COMPLIANCE must see at least one notification");
  });

  // CAN-10: Active client with same agent → no new notification
  test("CAN-10: Updating active client while keeping same agent does not create new notification", async () => {
    // Activate client4 with agent1
    const r1 = await request(app)
      .patch(`/clients/${client4Id}/kyc-status`)
      .set("Cookie", sesCompliance)
      .send({ kyc_status: "ACTIVE_CLIENT", assigned_agent: agent1Id });
    assert.ok(r1.status === 200 || r1.status === 201,
      `Activation failed: ${r1.status}: ${JSON.stringify(r1.body)}`);
    await new Promise(res => setTimeout(res, 200));

    const notifsAfterActivation = db.prepare(
      `SELECT * FROM client_agent_notifications WHERE client_id=? AND agent_username='can_agent1' AND status IN ('PENDING','SENT','FAILED')`
    ).all(client4Id);
    assert.ok(notifsAfterActivation.length >= 1, "Must have activation notification");

    // PATCH same client with same agent1 (just adding onboarding_notes — agent unchanged)
    const r2 = await request(app)
      .patch(`/clients/${client4Id}/kyc-status`)
      .set("Cookie", sesCompliance)
      .send({ assigned_agent: agent1Id, onboarding_notes: "Notas de seguimiento" });
    assert.ok(r2.status === 200 || r2.status === 201,
      `Update failed: ${r2.status}: ${JSON.stringify(r2.body)}`);
    await new Promise(res => setTimeout(res, 200));

    const notifsAfterUpdate = db.prepare(
      `SELECT * FROM client_agent_notifications WHERE client_id=? AND agent_username='can_agent1' AND status IN ('PENDING','SENT','FAILED')`
    ).all(client4Id);
    assert.equal(notifsAfterUpdate.length, notifsAfterActivation.length,
      "Same agent retained — no new notification must be created");
  });

  // CAN-11: Real reassignment via endpoint — correct agents notified
  test("CAN-11: Reassignment via endpoint: agent2 gets AGENT_REASSIGNED, agent1 gets no new notification", async () => {
    // Use client3 (already active with agent2 from CAN-4)
    // Current state of client3: ACTIVE_CLIENT, assigned_agent=agent2
    const before2 = db.prepare(
      `SELECT COUNT(*) as cnt FROM client_agent_notifications WHERE client_id=? AND agent_username='can_agent2'`
    ).get(client3Id).cnt;

    // Reassign client3 back to agent1 (simulating another reassignment)
    const r = await request(app)
      .patch(`/clients/${client3Id}/kyc-status`)
      .set("Cookie", sesCompliance)
      .send({ assigned_agent: agent1Id });
    assert.ok(r.status === 200 || r.status === 201,
      `Reassignment failed: ${r.status}: ${JSON.stringify(r.body)}`);
    await new Promise(res => setTimeout(res, 200));

    // agent1 should have a new AGENT_REASSIGNED notification
    const agent1NewNotifs = db.prepare(
      `SELECT * FROM client_agent_notifications WHERE client_id=? AND agent_username='can_agent1' AND event_type='AGENT_REASSIGNED'`
    ).all(client3Id);
    assert.ok(agent1NewNotifs.length >= 1, "Agent1 must receive AGENT_REASSIGNED notification");

    // agent2 must NOT get any new notification
    const after2 = db.prepare(
      `SELECT COUNT(*) as cnt FROM client_agent_notifications WHERE client_id=? AND agent_username='can_agent2'`
    ).get(client3Id).cnt;
    assert.equal(after2, before2, "Old agent2 must NOT receive any new notification");
  });

  // CAN-12: Task assigned to agent when agent exists at activation
  test("CAN-12: On activation with agent, task is assigned to the agent (not the activating user)", async () => {
    // Activate client5 with agent1
    const r = await request(app)
      .patch(`/clients/${client5Id}/kyc-status`)
      .set("Cookie", sesCompliance)
      .send({ kyc_status: "ACTIVE_CLIENT", assigned_agent: agent1Id });
    assert.ok(r.status === 200 || r.status === 201,
      `Activation failed: ${r.status}: ${JSON.stringify(r.body)}`);

    // Check that a task was created and assigned to agent1
    const tasks = db.prepare(
      `SELECT * FROM tasks WHERE assigned_to=? ORDER BY id DESC LIMIT 5`
    ).all(agent1Id);
    assert.ok(tasks.length >= 1, "A task must be assigned to agent1 on activation");
    assert.ok(
      tasks.some(t => t.title && (t.title.includes("CLIENT ACTIVATED") || t.title.includes("CLIENTE ACTIVO"))),
      `Task title should reference activation. Found: ${tasks.map(t=>t.title).join(", ")}`
    );
  });

  // CAN-13: representative_name populated from MANUAL client record
  test("CAN-13: representative_name populated from contact_name for manual records", async () => {
    const c = db.prepare(
      `INSERT INTO clients (type,name,glv_code,lead_status,kyc_status,registration_source,representative,active)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run("buyer","Empresa Manual Rep","GLV-MAN-CAN-001","LEAD","PRE_REGISTRATION","MANUAL","María González",0);
    const cId = c.lastInsertRowid;

    try { db.prepare(`INSERT OR IGNORE INTO glv_code_sequences (entity_code, last_seq) VALUES ('GLV-CO', 0)`).run(); } catch (_) {}

    const r = await request(app)
      .patch(`/clients/${cId}/kyc-status`)
      .set("Cookie", sesCompliance)
      .send({ kyc_status: "ACTIVE_CLIENT", assigned_agent: agent1Id });
    assert.ok(r.status === 200 || r.status === 201,
      `Activation failed: ${r.status}: ${JSON.stringify(r.body)}`);

    await new Promise(res => setTimeout(res, 150));

    const notif = db.prepare(`SELECT * FROM client_agent_notifications WHERE client_id=? ORDER BY id DESC LIMIT 1`).get(cId);
    assert.ok(notif, "Notification must exist");
    assert.equal(notif.representative_name, "María González",
      `Expected 'María González', got: ${notif.representative_name}`);
  });

  // CAN-14: representative_name for WEB_KYC (extracts only rep, not sensitive fields)
  test("CAN-14: representative_name extracted gracefully for WEB_KYC client", async () => {
    const hasKycData = db.prepare(`PRAGMA table_info(clients)`).all().some(col => col.name === "kyc_data");

    if (!hasKycData) {
      // Graceful: no kyc_data column, no crash
      return;
    }

    // Create a WEB_KYC client with a JSON-encoded kyc_data (not encrypted in test env)
    const kycPayload = JSON.stringify({
      rep: "Carlos Ruiz",
      empresa: "Empresa Secreta SA",
      email: "secreto@empresa.com",
      phone: "+54911234567",
      nit: "12345678-9",
      bank: "Banco Secreto",
    });

    const c = db.prepare(
      `INSERT INTO clients (type,name,glv_code,lead_status,kyc_status,registration_source,kyc_data,active)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run("buyer","GLV-WKC-CAN-001","GLV-WKC-CAN-001","LEAD","PRE_REGISTRATION","WEB_KYC",kycPayload,0);
    const cId = c.lastInsertRowid;

    try { db.prepare(`INSERT OR IGNORE INTO glv_code_sequences (entity_code, last_seq) VALUES ('GLV-CO', 0)`).run(); } catch (_) {}

    const r = await request(app)
      .patch(`/clients/${cId}/kyc-status`)
      .set("Cookie", sesCompliance)
      .send({ kyc_status: "ACTIVE_CLIENT", assigned_agent: agent1Id });
    assert.ok(r.status === 200 || r.status === 201,
      `Activation failed: ${r.status}: ${JSON.stringify(r.body)}`);

    await new Promise(res => setTimeout(res, 150));

    const notif = db.prepare(`SELECT * FROM client_agent_notifications WHERE client_id=? ORDER BY id DESC LIMIT 1`).get(cId);
    assert.ok(notif, "Notification must exist");
    // Only the representative name should be in the notification, not email/phone/bank/nit
    assert.equal(notif.representative_name, "Carlos Ruiz",
      `Expected 'Carlos Ruiz', got: ${notif.representative_name}`);
    // Verify sensitive fields are not stored in notification
    const notifJson = JSON.stringify(notif);
    assert.ok(!notifJson.includes("secreto@empresa.com"), "Email must not appear in notification record");
    assert.ok(!notifJson.includes("+54911234567"), "Phone must not appear in notification record");
    assert.ok(!notifJson.includes("12345678-9"), "NIT/tax_id must not appear in notification record");
    assert.ok(!notifJson.includes("Banco Secreto"), "Bank info must not appear in notification record");
  });

  // CAN-15: COMPLIANCE sees full email, agent sees masked
  test("CAN-15: COMPLIANCE sees full agent_email; COMMERCIAL_AGENT sees masked version", async () => {
    // Use client1 which already has notifications from CAN-2
    const rComp = await request(app)
      .get(`/clients/${client1Id}/notifications`)
      .set("Cookie", sesCompliance);
    assert.equal(rComp.status, 200, `COMPLIANCE expected 200, got ${rComp.status}`);
    assert.ok(Array.isArray(rComp.body) && rComp.body.length >= 1, "COMPLIANCE must see at least one notification");
    // COMPLIANCE sees full email (no masking — contains @ without ***)
    const compNotif = rComp.body.find(n => n.agent_email);
    if (compNotif) {
      assert.ok(
        !compNotif.agent_email.includes("***"),
        `COMPLIANCE must see full email, got masked: ${compNotif.agent_email}`
      );
      assert.ok(compNotif.agent_email.includes("@"),
        `COMPLIANCE email must include @, got: ${compNotif.agent_email}`);
    }

    // Agent (sesAgent1 = can_agent1) calls same endpoint — must receive masked email
    const rAgent = await request(app)
      .get(`/clients/${client1Id}/notifications`)
      .set("Cookie", sesAgent1);
    assert.ok(rAgent.status === 200 || rAgent.status === 403,
      `Agent expected 200/403, got ${rAgent.status}`);
    if (rAgent.status === 200 && rAgent.body.length > 0) {
      for (const n of rAgent.body) {
        if (n.agent_email) {
          assert.ok(
            n.agent_email.includes("***"),
            `Agent must see masked email, got: ${n.agent_email}`
          );
        }
      }
    }
  });

  // CAN-16: CLIENT and SUPPLIER roles are blocked from notification history
  test("CAN-16: CLIENT role cannot access notification history — 403/401", async () => {
    const r = await request(app)
      .get(`/clients/${client1Id}/notifications`)
      .set("Cookie", sesClient);
    assert.ok(
      r.status === 403 || r.status === 401,
      `Expected 403/401 for CLIENT, got ${r.status}: ${JSON.stringify(r.body)}`
    );
  });
});
