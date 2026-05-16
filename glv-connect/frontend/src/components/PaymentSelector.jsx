import { useState, useEffect } from "react";

const PAYMENT_OPTIONS = [
  "TT 100% Advance",
  "30/70 TT",
  "40/60 TT",
  "50/50 TT",
  "70/30 TT",
  "30/70 SBLC",
  "70/30 SBLC",
  "30/70 LC",
  "70/30 LC",
  "100% SBLC",
  "100% LC",
];

const DOC_A_ITEMS = ["Bill of Lading", "Factura comercial", "Packing list", "Certificado de origen"];
const DOC_B_ITEMS = ["Booking confirmado del buque", "Certificado SGS", "Contenedores confirmados", "Certificado sanitario de exportación"];

const st = {
  section: { marginBottom: 20 },
  badge: (active) => ({
    display: "inline-block", fontSize: 10, padding: "2px 8px", borderRadius: 20,
    fontWeight: 700, marginLeft: 8,
    background: active ? "#dcfce7" : "#f3f4f6",
    color: active ? "#166534" : "#6b7280",
  }),
  select: {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1px solid #d1d5db", fontSize: 13, background: "#fff",
    color: "#111", boxSizing: "border-box",
  },
  label: { fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 5 },
  input: {
    width: "100%", padding: "8px 11px", borderRadius: 7,
    border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box",
  },
};

function PaymentBlock({ id, title, required, value, onChange, docTrigger, onDocTrigger }) {
  const [enabled, setEnabled] = useState(required || !!value?.option);
  const [option, setOption] = useState(value?.option || "");
  const [notes, setNotes] = useState(value?.notes || "");

  useEffect(() => {
    if (!enabled && !required) {
      onChange(null);
    } else {
      onChange({ option, notes, docTrigger });
    }
  }, [enabled, option, notes, docTrigger]);

  return (
    <div style={{
      border: `1px solid ${enabled ? "#c7d2fe" : "#e5e7eb"}`,
      borderRadius: 10, padding: "14px 16px", marginBottom: 12,
      background: enabled ? "#f8f9ff" : "#fafafa",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: enabled ? 14 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1B2A4A" }}>{title}</span>
          {required && <span style={st.badge(true)}>OBLIGATORIO</span>}
          {!required && <span style={st.badge(enabled)}>OPCIONAL</span>}
        </div>
        {!required && (
          <button type="button" onClick={() => setEnabled(v => !v)}
            style={{
              padding: "4px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
              border: "1px solid #d1d5db",
              background: enabled ? "#fee2e2" : "#f0fdf4",
              color: enabled ? "#991b1b" : "#166534",
            }}>
            {enabled ? "Quitar" : "+ Agregar"}
          </button>
        )}
      </div>

      {enabled && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <label style={st.label}>Condición de pago</label>
            <select value={option} onChange={e => setOption(e.target.value)} style={st.select}>
              <option value="">Seleccionar condición...</option>
              {PAYMENT_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {id === "block1" && option && (
            <div style={{ marginBottom: 12 }}>
              <label style={st.label}>Documentos de desembolso del saldo</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["DOC-A", DOC_A_ITEMS], ["DOC-B", DOC_B_ITEMS]].map(([key, items]) => (
                  <button key={key} type="button" onClick={() => onDocTrigger(key)}
                    style={{
                      flex: 1, padding: "10px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                      border: docTrigger === key ? "2px solid #2563eb" : "1px solid #d1d5db",
                      background: docTrigger === key ? "#eff6ff" : "#f9fafb",
                    }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: docTrigger === key ? "#1e40af" : "#374151", margin: "0 0 6px" }}>{key}</p>
                    <ul style={{ margin: 0, paddingLeft: 14 }}>
                      {items.map(i => (
                        <li key={i} style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>{i}</li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={st.label}>Notas adicionales (opcional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Condiciones especiales, plazos adicionales..."
              style={st.input}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Livestock Block (special regime for live animals) ─────────────────────
function LivestockBlock({ avOption, setAvOption }) {
  const options = [
    {
      id: "PAGO-AV-1",
      badge: { text: "RECOMENDADA", bg: "#dcfce7", color: "#166534" },
      title: "70% Anticipo + 30% SBLC 90 días",
      desc: "70% antes de cuarentena + 30% SBLC irrevocable 90 días contra booking, SGS y cert. zoosanitario.",
    },
    {
      id: "PAGO-AV-2",
      badge: null,
      title: "100% SBLC 90 días — Pago total al embarque",
      desc: "100% cubierto por SBLC irrevocable banco a banco (MT199), pagadero contra SGS, Halal, cert. zoosanitario y booking confirmado.",
    },
    {
      id: "PAGO-AV-3",
      badge: null,
      title: "50/50 con soporte SBLC",
      desc: "50% anticipo contra firma de contrato + 50% SBLC con los mismos hitos de la opción recomendada.",
    },
  ];

  return (
    <div>
      <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400e" }}>
        <strong>Régimen Animales Vivos</strong> — Este producto requiere estructura de pago especial.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map(opt => (
          <button key={opt.id} type="button" onClick={() => setAvOption(opt.id)}
            style={{
              padding: "12px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
              border: avOption === opt.id ? "2px solid #1B2A4A" : "1px solid #d1d5db",
              background: avOption === opt.id ? "#f0f4ff" : "#f9fafb",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: avOption === opt.id ? "#1B2A4A" : "#6b7280" }}>{opt.id}</span>
              {opt.badge && (
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700, background: opt.badge.bg, color: opt.badge.color }}>
                  {opt.badge.text}
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#1B2A4A", margin: "0 0 4px" }}>{opt.title}</p>
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

const isLivestock = (cat) =>
  cat && ["LIVE_ANIMALS", "ovino", "bovino", "animal", "vivo"].some(k => cat.toLowerCase().includes(k.toLowerCase()));

// ─── Main PaymentSelector ────────────────────────────────────────────────────
export function PaymentSelector({ productCategory, onChange }) {
  const livestock = isLivestock(productCategory);

  const [avOption, setAvOption] = useState("PAGO-AV-1");
  const [block1, setBlock1] = useState({ option: "", notes: "", docTrigger: "DOC-A" });
  const [block2, setBlock2] = useState(null);
  const [block3, setBlock3] = useState(null);
  const [docTrigger, setDocTrigger] = useState("DOC-A");

  useEffect(() => {
    if (livestock) {
      onChange({
        type: "livestock",
        option: avOption,
        docTrigger: null,
        hasGuarantee: false,
        guaranteeType: null,
        bankName: null,
        blocks: null,
      });
    } else {
      onChange({
        type: "multi",
        option: block1?.option || "",
        docTrigger,
        hasGuarantee: false,
        guaranteeType: null,
        bankName: null,
        blocks: [block1, block2, block3].filter(Boolean),
      });
    }
  }, [livestock, avOption, block1, block2, block3, docTrigger]);

  if (livestock) {
    return <LivestockBlock avOption={avOption} setAvOption={setAvOption} />;
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 14px" }}>
        El Bloque 1 es obligatorio. Los Bloques 2 y 3 son opcionales — el agente puede combinar múltiples condiciones de pago.
      </p>
      <PaymentBlock
        id="block1"
        title="Bloque 1"
        required
        value={block1}
        onChange={v => setBlock1(v || { option: "", notes: "", docTrigger })}
        docTrigger={docTrigger}
        onDocTrigger={setDocTrigger}
      />
      <PaymentBlock
        id="block2"
        title="Bloque 2"
        required={false}
        value={block2}
        onChange={setBlock2}
        docTrigger={docTrigger}
        onDocTrigger={() => {}}
      />
      <PaymentBlock
        id="block3"
        title="Bloque 3"
        required={false}
        value={block3}
        onChange={setBlock3}
        docTrigger={docTrigger}
        onDocTrigger={() => {}}
      />
    </div>
  );
}
