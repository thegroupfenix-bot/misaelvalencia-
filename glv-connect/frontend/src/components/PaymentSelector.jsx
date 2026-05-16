import { useState, useEffect } from "react";

const isLivestock = (cat) =>
  cat && ["ovino", "bovino", "animal", "vivo"].some(k => cat.toLowerCase().includes(k));

const DOC_A_ITEMS = ["Bill of Lading", "Factura comercial", "Packing list", "Certificado de origen"];
const DOC_B_ITEMS = ["Booking confirmado del buque", "Certificado SGS", "Contenedores confirmados", "Certificado sanitario de exportación"];

export function PaymentSelector({ productCategory, onChange }) {
  const livestock = isLivestock(productCategory);

  const [ttOption, setTtOption] = useState("TT 30/70");
  const [docTrigger, setDocTrigger] = useState("DOC-A");
  const [hasGuarantee, setHasGuarantee] = useState(false);
  const [guaranteeType, setGuaranteeType] = useState("LC");
  const [bankName, setBankName] = useState("");
  const [avOption, setAvOption] = useState("PAGO-AV-1");

  useEffect(() => {
    if (livestock) {
      onChange({
        type: "livestock",
        option: avOption,
        docTrigger: null,
        hasGuarantee: false,
        guaranteeType: null,
        bankName: null,
      });
    } else {
      onChange({
        type: "tt",
        option: ttOption,
        docTrigger,
        hasGuarantee,
        guaranteeType: hasGuarantee ? guaranteeType : null,
        bankName: (hasGuarantee && guaranteeType === "SBLC") ? bankName : null,
      });
    }
  }, [livestock, ttOption, docTrigger, hasGuarantee, guaranteeType, bankName, avOption]);

  if (livestock) {
    return <LivestockBlock avOption={avOption} setAvOption={setAvOption} />;
  }

  return (
    <div>
      <BlockA ttOption={ttOption} setTtOption={setTtOption} docTrigger={docTrigger} setDocTrigger={setDocTrigger} />
      <BlockB
        hasGuarantee={hasGuarantee} setHasGuarantee={setHasGuarantee}
        guaranteeType={guaranteeType} setGuaranteeType={setGuaranteeType}
        bankName={bankName} setBankName={setBankName}
      />
    </div>
  );
}

function BlockA({ ttOption, setTtOption, docTrigger, setDocTrigger }) {
  const options = ["TT 30/70", "TT 40/60", "TT 50/50", "TT 70/30"];
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#1B2A4A", marginBottom: 8 }}>
        BLOQUE A — Transferencia Bancaria (TT)
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => setTtOption(opt)}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer",
              border: ttOption === opt ? "2px solid #1B2A4A" : "1px solid #d1d5db",
              background: ttOption === opt ? "#1B2A4A" : "#fff",
              color: ttOption === opt ? "#fff" : "#374151",
              fontWeight: ttOption === opt ? 600 : 400,
            }}>
            {opt}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Documentos de desembolso del saldo:</p>
      <div style={{ display: "flex", gap: 8 }}>
        {[["DOC-A", DOC_A_ITEMS], ["DOC-B", DOC_B_ITEMS]].map(([key, items]) => (
          <button key={key} type="button" onClick={() => setDocTrigger(key)}
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
  );
}

function BlockB({ hasGuarantee, setHasGuarantee, guaranteeType, setGuaranteeType, bankName, setBankName }) {
  return (
    <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14, marginTop: 4 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 12 }}>
        <input type="checkbox" checked={hasGuarantee} onChange={e => setHasGuarantee(e.target.checked)}
          style={{ width: 16, height: 16, cursor: "pointer" }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
          BLOQUE B — ¿Incluir garantía bancaria para el saldo? (LC / SBLC)
        </span>
      </label>
      {hasGuarantee && (
        <div style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 14px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {["LC", "SBLC"].map(gt => (
              <button key={gt} type="button" onClick={() => setGuaranteeType(gt)}
                style={{
                  padding: "7px 20px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                  border: guaranteeType === gt ? "2px solid #7c3aed" : "1px solid #d1d5db",
                  background: guaranteeType === gt ? "#7c3aed" : "#fff",
                  color: guaranteeType === gt ? "#fff" : "#374151",
                  fontWeight: guaranteeType === gt ? 600 : 400,
                }}>
                {gt}
              </button>
            ))}
          </div>
          {guaranteeType === "SBLC" && (
            <>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                  Banco emisor propuesto
                </label>
                <input value={bankName} onChange={e => setBankName(e.target.value)}
                  placeholder="Nombre del banco emisor"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ background: "#ede9fe", borderRadius: 6, padding: "8px 10px", fontSize: 11, color: "#4c1d95" }}>
                Beneficiario: <strong>Active Value International General Trading L.L.C — Dubai, UAE</strong>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LivestockBlock({ avOption, setAvOption }) {
  const options = [
    {
      id: "PAGO-AV-1",
      badge: { text: "PRIORITARIA", bg: "#dcfce7", color: "#166534" },
      title: "70% Anticipo + 30% SBLC 90 días",
      desc: "70% antes de cuarentena + 30% SBLC irrevocable 90 días contra booking, SGS y cert. zoosanitario.",
    },
    {
      id: "PAGO-AV-2",
      badge: null,
      title: "SBLC 90 días — Pago total al embarque",
      desc: "100% cubierto por SBLC irrevocable banco a banco (MT199), pagadero contra SGS, Halal, cert. zoosanitario y booking confirmado.",
    },
    {
      id: "PAGO-AV-3",
      badge: null,
      title: "50/50 con soporte SBLC",
      desc: "50% anticipo contra firma de contrato + 50% SBLC con los mismos hitos de la opción prioritaria.",
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
