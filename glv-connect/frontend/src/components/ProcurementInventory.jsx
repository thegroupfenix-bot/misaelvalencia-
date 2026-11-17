import React, { useEffect, useMemo, useState } from "react";

const api = async (path, options = {}) => {
  const response = await fetch(path, { credentials: "include", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "No fue posible completar la operación.");
  return body;
};
const card = { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" };
const input = { width: "100%", padding: "9px 10px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, boxSizing: "border-box", background: "var(--color-background-primary)", color: "var(--color-text-primary)" };
const button = { background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, padding: "9px 13px", cursor: "pointer", fontWeight: 600 };

function Field({ label, children }) {
  return <label style={{ display: "block", fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>{label}<div style={{ marginTop: 5 }}>{children}</div></label>;
}
function Table({ columns, rows, empty = "Sin registros" }) {
  if (!rows.length) return <p style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>{empty}</p>;
  return <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr>{columns.map(c => <th key={c.label} style={{ textAlign: "left", padding: "9px 8px", color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border-tertiary)", fontWeight: 600 }}>{c.label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id || i}>{columns.map(c => <td key={c.label} style={{ padding: "10px 8px", borderBottom: "1px solid var(--color-border-tertiary)" }}>{c.render ? c.render(row) : row[c.key]}</td>)}</tr>)}</tbody></table></div>;
}

export default function ProcurementInventory({ user, showNotif }) {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState({ requests: [], orders: [], items: [], warehouses: [], stock: [], report: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestItems, setRequestItems] = useState([{ description: "", quantity: 1, unit: "und", estimated_cost: "" }]);
  const [orderItems, setOrderItems] = useState([{ description: "", quantity: 1, unit: "und", unit_cost: "", item_id: "" }]);

  const load = async () => {
    setLoading(true);
    try {
      const [requests, orders, items, warehouses, stock, report] = await Promise.all([
        api("/procurement/requests"), api("/procurement/orders"), api("/procurement/items"), api("/procurement/warehouses"), api("/procurement/stock"), api("/reports/executive")
      ]);
      setData({ requests, orders, items, warehouses, stock, report });
      setError("");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const approvedRequests = useMemo(() => data.requests.filter(r => r.status === "approved"), [data.requests]);

  const submit = async (event, path, payload, message) => {
    event.preventDefault();
    try { await api(path, { method: "POST", body: JSON.stringify(payload) }); showNotif?.(message, "success"); await load(); }
    catch (e) { showNotif?.(e.message, "error"); }
  };
  const nav = [["overview","Resumen"],["catalog","Catálogo"],["requests","Solicitudes"],["orders","Órdenes"],["stock","Inventario"]];
  if (loading) return <div style={{ padding: "2rem" }}>Cargando compras e inventario...</div>;
  return <div style={{ maxWidth: 1400 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
      <div><h2 style={{ margin: 0, fontSize: 22 }}>Compras e Inventario</h2><p style={{ margin: "5px 0 0", color: "var(--color-text-secondary)", fontSize: 13 }}>Control de solicitud, orden, recepción, lote y existencias.</p></div>
      <button style={{ ...button, background: "#fff", color: "#1B2A4A", border: "1px solid #1B2A4A" }} onClick={load}>Actualizar</button>
    </div>
    {error && <div style={{ ...card, borderColor: "#fecaca", color: "#991b1b", marginBottom: 14 }}>{error}</div>}
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>{nav.map(([id,label]) => <button key={id} onClick={() => setTab(id)} style={{ ...button, background: tab === id ? "#1B2A4A" : "#fff", color: tab === id ? "#fff" : "#1B2A4A", border: "1px solid #1B2A4A" }}>{label}</button>)}</div>

    {tab === "overview" && <Overview report={data.report} />}
    {tab === "catalog" && <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 0.9fr) minmax(0, 1.5fr)", gap: 16 }}>
      <div style={card}><h3 style={{ marginTop: 0 }}>Nuevo artículo</h3><form onSubmit={e => submit(e, "/procurement/items", Object.fromEntries(new FormData(e.currentTarget)), "Artículo creado.")}>
        <Field label="SKU"><input required name="sku" style={input}/></Field><Field label="Nombre"><input required name="name" style={input}/></Field><Field label="Unidad"><input required name="unit" defaultValue="und" style={input}/></Field><Field label="Stock mínimo"><input name="minimum_stock" type="number" min="0" defaultValue="0" style={input}/></Field><Field label="Costo estándar"><input name="standard_cost" type="number" min="0" step="0.01" defaultValue="0" style={input}/></Field><Field label="Moneda"><input name="currency" defaultValue="USD" style={input}/></Field><button style={button}>Crear artículo</button></form>
        <hr style={{ border: 0, borderTop: "1px solid var(--color-border-tertiary)", margin: "18px 0" }}/><h3 style={{ marginTop: 0 }}>Nueva bodega</h3><form onSubmit={e => submit(e, "/procurement/warehouses", Object.fromEntries(new FormData(e.currentTarget)), "Bodega creada.")}>
        <Field label="Código"><input required name="code" style={input}/></Field><Field label="Nombre"><input required name="name" style={input}/></Field><Field label="País"><input name="country" style={input}/></Field><Field label="Dirección"><input name="address" style={input}/></Field><button style={button}>Crear bodega</button></form></div>
      <div style={card}><h3 style={{ marginTop: 0 }}>Artículos registrados</h3><Table rows={data.items} columns={[{label:"SKU",key:"sku"},{label:"Artículo",key:"name"},{label:"Unidad",key:"unit"},{label:"Mínimo",key:"minimum_stock"},{label:"Costo",render:r=>r.standard_cost+" "+r.currency}]}/><h3>Bodegas</h3><Table rows={data.warehouses} columns={[{label:"Código",key:"code"},{label:"Bodega",key:"name"},{label:"País",key:"country"}]}/></div>
    </div>}

    {tab === "requests" && <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(0, 1.4fr)", gap: 16 }}>
      <div style={card}><h3 style={{ marginTop: 0 }}>Nueva solicitud</h3><form onSubmit={e => { const form=new FormData(e.currentTarget); submit(e,"/procurement/requests",{title:form.get("title"),department:form.get("department"),cost_center:form.get("cost_center"),needed_by:form.get("needed_by"),items:requestItems.map(x=>({...x,quantity:Number(x.quantity),estimated_cost:x.estimated_cost?Number(x.estimated_cost):null}))},"Solicitud creada."); }}>
        <Field label="Título"><input required name="title" style={input}/></Field><Field label="Departamento"><input name="department" defaultValue={user?.department || ""} style={input}/></Field><Field label="Centro de costo"><input name="cost_center" style={input}/></Field><Field label="Fecha requerida"><input name="needed_by" type="date" style={input}/></Field><p style={{ fontWeight: 600, fontSize: 13 }}>Ítems</p>{requestItems.map((item,index)=><div key={index} style={{ display:"grid",gridTemplateColumns:"1.4fr .55fr .55fr .8fr",gap:5,marginBottom:6 }}><input required placeholder="Descripción" value={item.description} onChange={e=>setRequestItems(a=>a.map((x,i)=>i===index?{...x,description:e.target.value}:x))} style={input}/><input required type="number" min="0.001" placeholder="Cant." value={item.quantity} onChange={e=>setRequestItems(a=>a.map((x,i)=>i===index?{...x,quantity:e.target.value}:x))} style={input}/><input required placeholder="Unidad" value={item.unit} onChange={e=>setRequestItems(a=>a.map((x,i)=>i===index?{...x,unit:e.target.value}:x))} style={input}/><input type="number" min="0" placeholder="Estimado" value={item.estimated_cost} onChange={e=>setRequestItems(a=>a.map((x,i)=>i===index?{...x,estimated_cost:e.target.value}:x))} style={input}/></div>)}<button type="button" onClick={()=>setRequestItems(a=>[...a,{description:"",quantity:1,unit:"und",estimated_cost:""}])} style={{ ...button, background:"#fff",color:"#1B2A4A",border:"1px solid #1B2A4A",marginRight:8 }}>Agregar ítem</button><button style={button}>Crear solicitud</button></form></div>
      <div style={card}><h3 style={{ marginTop: 0 }}>Solicitudes</h3><Table rows={data.requests} columns={[{label:"Código",key:"code"},{label:"Título",key:"title"},{label:"Estado",key:"status"},{label:"Solicitante",key:"requested_name"},{label:"Ítems",key:"item_count"},{label:"Acción",render:r=><div style={{display:"flex",gap:5}}>{r.status==="draft"&&r.requested_by===user?.id&&<button style={{...button,padding:"5px 7px"}} onClick={()=>submit({preventDefault:()=>{}},`/procurement/requests/${r.id}/submit`,{},"Solicitud enviada.")}>Enviar</button>}{r.status==="submitted"&&["SUPER_ADMIN","CORPORATE_ADMIN","DIRECTOR","DIRECTIVO","CFO","COMPLIANCE"].includes(user?.role)&&<button style={{...button,padding:"5px 7px"}} onClick={()=>submit({preventDefault:()=>{}},`/procurement/requests/${r.id}/approve`,{decision:"approved"},"Solicitud aprobada.")}>Aprobar</button>}</div>}]}/></div>
    </div>}

    {tab === "orders" && <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(0, 1.4fr)", gap: 16 }}>
      <div style={card}><h3 style={{ marginTop: 0 }}>Nueva orden</h3><form onSubmit={e=>{const f=new FormData(e.currentTarget);submit(e,"/procurement/orders",{request_id:f.get("request_id")||null,supplier_name:f.get("supplier_name"),supplier_tax_id:f.get("supplier_tax_id"),currency:f.get("currency"),expected_date:f.get("expected_date")||null,items:orderItems.map(x=>({...x,item_id:x.item_id||null,quantity:Number(x.quantity),unit_cost:Number(x.unit_cost)}))},"Orden creada.");}}>
        <Field label="Solicitud aprobada"><select name="request_id" style={input}><option value="">Sin solicitud vinculada</option>{approvedRequests.map(r=><option key={r.id} value={r.id}>{r.code} · {r.title}</option>)}</select></Field><Field label="Proveedor"><input required name="supplier_name" style={input}/></Field><Field label="NIT o identificación"><input name="supplier_tax_id" style={input}/></Field><Field label="Moneda"><input name="currency" defaultValue="USD" style={input}/></Field><Field label="Fecha esperada"><input name="expected_date" type="date" style={input}/></Field><p style={{fontWeight:600,fontSize:13}}>Ítems</p>{orderItems.map((item,index)=><div key={index} style={{display:"grid",gridTemplateColumns:"1fr .45fr .45fr .6fr",gap:5,marginBottom:6}}><select value={item.item_id} onChange={e=>setOrderItems(a=>a.map((x,i)=>i===index?{...x,item_id:e.target.value,description:data.items.find(q=>q.id===Number(e.target.value))?.name||x.description,unit:data.items.find(q=>q.id===Number(e.target.value))?.unit||x.unit}:x))} style={input}><option value="">Artículo opcional</option>{data.items.map(x=><option key={x.id} value={x.id}>{x.sku}</option>)}</select><input required type="number" min="0.001" value={item.quantity} onChange={e=>setOrderItems(a=>a.map((x,i)=>i===index?{...x,quantity:e.target.value}:x))} style={input}/><input required placeholder="Unidad" value={item.unit} onChange={e=>setOrderItems(a=>a.map((x,i)=>i===index?{...x,unit:e.target.value}:x))} style={input}/><input required type="number" min="0" placeholder="Costo" value={item.unit_cost} onChange={e=>setOrderItems(a=>a.map((x,i)=>i===index?{...x,unit_cost:e.target.value}:x))} style={input}/><input required placeholder="Descripción" value={item.description} onChange={e=>setOrderItems(a=>a.map((x,i)=>i===index?{...x,description:e.target.value}:x))} style={{...input,gridColumn:"1 / -1"}}/></div>)}<button type="button" onClick={()=>setOrderItems(a=>[...a,{description:"",quantity:1,unit:"und",unit_cost:"",item_id:""}])} style={{...button,background:"#fff",color:"#1B2A4A",border:"1px solid #1B2A4A",marginRight:8}}>Agregar ítem</button><button style={button}>Crear orden</button></form></div>
      <div style={card}><h3 style={{marginTop:0}}>Órdenes de compra</h3><Table rows={data.orders} columns={[{label:"Código",key:"code"},{label:"Proveedor",key:"supplier_name"},{label:"Estado",key:"status"},{label:"Esperada",key:"expected_date"},{label:"Total",render:r=>Number(r.total||0).toLocaleString()+" "+r.currency},{label:"Acción",render:r=>r.status==="draft"&&["SUPER_ADMIN","CORPORATE_ADMIN","DIRECTOR","DIRECTIVO","CFO","COMPLIANCE"].includes(user?.role)&&<button style={{...button,padding:"5px 7px"}} onClick={()=>submit({preventDefault:()=>{}},`/procurement/orders/${r.id}/issue`,{},"Orden emitida.")}>Emitir</button>}]}/></div>
    </div>}

    {tab === "stock" && <div style={{display:"grid",gridTemplateColumns:"minmax(280px,.8fr) minmax(0,1.7fr)",gap:16}}><div style={card}><h3 style={{marginTop:0}}>Movimiento manual</h3><form onSubmit={e=>{const f=new FormData(e.currentTarget);submit(e,"/procurement/movements",{item_id:Number(f.get("item_id")),warehouse_id:Number(f.get("warehouse_id")),movement_type:f.get("movement_type"),quantity:Number(f.get("quantity")),unit_cost:Number(f.get("unit_cost")||0),notes:f.get("notes")||null},"Movimiento registrado.");}}><Field label="Artículo"><select required name="item_id" style={input}><option value="">Seleccionar</option>{data.items.map(x=><option key={x.id} value={x.id}>{x.sku} · {x.name}</option>)}</select></Field><Field label="Bodega"><select required name="warehouse_id" style={input}><option value="">Seleccionar</option>{data.warehouses.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field><Field label="Tipo"><select name="movement_type" style={input}><option value="issue">Salida</option><option value="adjustment_in">Ajuste entrada</option><option value="adjustment_out">Ajuste salida</option></select></Field><Field label="Cantidad"><input required name="quantity" type="number" min="0.001" step="0.001" style={input}/></Field><Field label="Costo unitario"><input name="unit_cost" type="number" min="0" step="0.01" defaultValue="0" style={input}/></Field><Field label="Nota"><input name="notes" style={input}/></Field><button style={button}>Registrar movimiento</button></form></div><div style={card}><h3 style={{marginTop:0}}>Existencias y valorización</h3><Table rows={data.stock} columns={[{label:"Artículo",render:r=>r.sku+" · "+r.name},{label:"Bodega",render:r=>r.warehouse_code+" · "+r.warehouse_name},{label:"Físico",key:"physical"},{label:"Reservado",key:"reserved"},{label:"Disponible",key:"available"},{label:"Mínimo",key:"minimum_stock"},{label:"Valor",render:r=>Number(r.inventory_value||0).toLocaleString()}]}/></div></div>}
  </div>;
}
function Overview({ report }) {
  if (!report) return null;
  const k=report.kpis||{};
  const tiles=[["Alertas abiertas",k.open_alerts,"#dc2626"],["Solicitudes pendientes",k.pending_purchase_requests,"#d97706"],["Órdenes activas",k.pending_purchase_orders,"#2563eb"],["Stock bajo mínimo",k.low_stock_items,"#7c3aed"],["Valor inventario",Number(k.inventory_value||0).toLocaleString()+" USD","#059669"]];
  return <><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:16}}>{tiles.map(([label,value,color])=><div key={label} style={card}><p style={{margin:"0 0 8px",color:"var(--color-text-secondary)",fontSize:12}}>{label}</p><p style={{margin:0,fontSize:23,fontWeight:700,color}}>{value}</p></div>)}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><div style={card}><h3 style={{marginTop:0}}>Órdenes vencidas</h3><Table rows={report.overdue_orders||[]} empty="No hay órdenes vencidas." columns={[{label:"Orden",key:"code"},{label:"Proveedor",key:"supplier_name"},{label:"Días",key:"late_days"},{label:"Estado",key:"status"}]}/></div><div style={card}><h3 style={{marginTop:0}}>Valor por bodega</h3><Table rows={report.inventory_by_warehouse||[]} columns={[{label:"Bodega",render:r=>r.code+" · "+r.name},{label:"Valor",render:r=>Number(r.value||0).toLocaleString()+" USD"}]}/></div></div></>;
}