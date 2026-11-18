"use strict";
const express=require("express");
const db=require("../db/database");
const {authenticate}=require("../middleware/auth");
const {requireLevel}=require("../middleware/rbac");
const router=express.Router();
router.use(authenticate);

router.get("/executive",requireLevel(65),(_req,res)=>{
  const scalar=(sql,...args)=>db.prepare(sql).get(...args)?.value || 0;
  const openAlerts=scalar("SELECT COUNT(*) value FROM operational_alerts WHERE status='open'");
  const pendingRequests=scalar("SELECT COUNT(*) value FROM purchase_requests WHERE status IN ('draft','submitted')");
  const pendingOrders=scalar("SELECT COUNT(*) value FROM purchase_orders WHERE status IN ('issued','partially_received')");
  const lowStock=scalar(`SELECT COUNT(*) value FROM (
    SELECT i.id,w.id,COALESCE(SUM(CASE WHEN m.movement_type IN ('receipt','transfer_in','adjustment_in') THEN m.quantity WHEN m.movement_type IN ('issue','transfer_out','adjustment_out') THEN -m.quantity ELSE 0 END),0) physical
    FROM inventory_items i CROSS JOIN warehouses w LEFT JOIN inventory_movements m ON m.item_id=i.id AND m.warehouse_id=w.id
    WHERE i.active=1 AND w.active=1 GROUP BY i.id,w.id HAVING physical < i.minimum_stock
  )`);
  const inventoryValue=scalar(`SELECT COALESCE(SUM(CASE WHEN movement_type IN ('receipt','transfer_in','adjustment_in') THEN quantity*unit_cost WHEN movement_type IN ('issue','transfer_out','adjustment_out') THEN -quantity*unit_cost ELSE 0 END),0) value FROM inventory_movements`);
  const overdueOrders=db.prepare(`SELECT o.id,o.code,o.supplier_name,o.expected_date,o.status,
    CAST(julianday('now')-julianday(o.expected_date) AS INTEGER) late_days
    FROM purchase_orders o WHERE o.expected_date IS NOT NULL AND date(o.expected_date)<date('now')
    AND o.status IN ('issued','partially_received') ORDER BY o.expected_date LIMIT 50`).all();
  const inventoryByWarehouse=db.prepare(`SELECT w.id,w.code,w.name,
    COALESCE(SUM(CASE WHEN m.movement_type IN ('receipt','transfer_in','adjustment_in') THEN m.quantity*m.unit_cost WHEN m.movement_type IN ('issue','transfer_out','adjustment_out') THEN -m.quantity*m.unit_cost ELSE 0 END),0) value
    FROM warehouses w LEFT JOIN inventory_movements m ON m.warehouse_id=w.id WHERE w.active=1 GROUP BY w.id ORDER BY value DESC`).all();
  const openTasks=db.prepare(`SELECT t.id,t.title,t.module,t.department,t.deadline,t.priority,u.name assigned_name
    FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to
    WHERE t.status NOT IN ('completed','approved','rejected') ORDER BY CASE WHEN t.deadline<datetime('now') THEN 0 ELSE 1 END,t.deadline LIMIT 25`).all();
  res.json({generated_at:new Date().toISOString(),kpis:{open_alerts:openAlerts,pending_purchase_requests:pendingRequests,pending_purchase_orders:pendingOrders,low_stock_items:lowStock,inventory_value:inventoryValue},overdue_orders:overdueOrders,inventory_by_warehouse:inventoryByWarehouse,open_tasks:openTasks});
});
module.exports=router;
