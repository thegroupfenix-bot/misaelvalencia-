import { useState, useEffect, createContext, useContext } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { api } from "./api.js";
import { downloadPDF } from "./components/GlvPDF.jsx";

// ─── Auth context ────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("glv_token");
    if (!token) { setLoading(false); return; }
    api.me()
      .then((u) => setUser(u))
      .catch(() => localStorage.removeItem("glv_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const { token, user: u } = await api.login(username, password);
    localStorage.setItem("glv_token", token);
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem("glv_token");
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1b2a" }}>
        <p style={{ color: "#fff", fontSize: 14 }}>Cargando...</p>
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireRole({ role, children }) {
  const { user } = useAuth();
  if (user?.role !== role) return <Navigate to="/" replace />;
  return children;
}

// ─── Static data (unchanged from GLV-Connect.jsx) ────────────────────────────
const PRICE_TABLE = {
  "UAE":                 { port: "Jebel Ali / Port Rashid, Dubai",   price: 5.70, transit: "25–28" },
  "Saudi Arabia (East)": { port: "Port of Dammam",                   price: 5.80, transit: "27–30" },
  "Saudi Arabia (West)": { port: "Port of Jeddah",                   price: 5.85, transit: "29–32" },
  "Türkiye (South)":     { port: "Port of Mersin",                   price: 5.95, transit: "20–24" },
  "Türkiye (Northwest)": { port: "Port of Derince / Istanbul",       price: 6.00, transit: "22–26" },
  "China":               { port: "Port of Shanghai / Tianjin",       price: 5.65, transit: "32–38" },
};

const PRODUCTS = [
  "Ovinos (Animales Vivos)", "Bovinos (Animales Vivos)", "Aguacate Hass",
  "Banano Cavendish", "Pulpa de Fruta IQF", "Granos (Soya / Maíz)",
  "Aceites Vegetales", "Carne Ovina (Congelada)", "Carne Bovina (Congelada)",
];

const ORIGINS = {
  "Brazil":    "GLV Global Foods Brasil Ltda. / MAPA",
  "Uruguay":   "GLV Global Group / INAC Associates",
  "Chile":     "GLV Global Group / SAG Associates",
  "Argentina": "GLV Global Group / SENASA Associates",
  "Colombia":  "GLV Services SAS",
};

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

// ─── Root App ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/*" element={
          <RequireAuth>
            <Portal />
          </RequireAuth>
        } />
      </Routes>
    </AuthProvider>
  );
}

// ─── Portal shell (sidebar + main) ───────────────────────────────────────────
function Portal() {
  const { user, logout } = useAuth();
  const [view, setView] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [notification, setNotification] = useState(null);
  const [firstLogin, setFirstLogin] = useState(user?.role === "AGENTE");

  const showNotif = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  if (firstLogin) {
    return <OnboardingScreen user={user} onContinue={() => setFirstLogin(false)} />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-background-tertiary)", fontFamily: "var(--font-sans)" }}>
      <Sidebar user={user} view={view} setView={setView} onLogout={logout} />
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
        {notification && <Notification msg={notification.msg} type={notification.type} />}
        {view === "dashboard"  && <Dashboard user={user} setView={setView} setModal={setModal} />}
        {view === "sco"        && <DocList type="SCO" user={user} setModal={setModal} setView={setView} showNotif={showNotif} />}
        {view === "fco"        && <DocList type="FCO" user={user} setModal={setModal} setView={setView} showNotif={showNotif} />}
        {view === "spa"        && user.role === "DIRECTIVO" && <DocList type="SPA" user={user} setModal={setModal} setView={setView} showNotif={showNotif} />}
        {view === "audit"      && user.role === "DIRECTIVO" && <AuditLog />}
        {view === "usuarios"   && user.role === "DIRECTIVO" && <UsersPanel />}
        {view === "new-sco"    && <NewDocForm type="SCO" user={user} setView={setView} showNotif={showNotif} />}
        {view === "new-fco"    && <NewDocForm type="FCO" user={user} setView={setView} showNotif={showNotif} />}
        {view === "new-spa"    && user.role === "DIRECTIVO" && <NewDocForm type="SPA" user={user} setView={setView} showNotif={showNotif} />}
      </main>
      {modal && <DocPreviewModal doc={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate("/", { replace: true }); }, [user]);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e.message || "Credenciales incorrectas. Verifique usuario y contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1b2a" }}>
      <div style={{ width: 420, background: "#fff", borderRadius: 16, padding: "2.5rem", boxShadow: "0 4px 32px rgba(0,0,0,0.18)" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#1B2A4A", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <span style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>G</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1B2A4A", margin: "0 0 4px" }}>GLV-Connect</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Portal de Agentes — GLV Holding Group</p>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Usuario</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario.apellido"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
            onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Contraseña</label>
          <div style={{ position: "relative" }}>
            <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              style={{ width: "100%", padding: "10px 40px 10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
            <button type="button" onClick={() => setShowPass(p => !p)}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 16, padding: 0 }}>
              <i className={`ti ${showPass ? "ti-eye-off" : "ti-eye"}`} />
            </button>
          </div>
        </div>
        {error && <p style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", padding: "8px 12px", borderRadius: 8, marginBottom: 16 }}>{error}</p>}
        <button onClick={handleLogin} disabled={loading}
          style={{ width: "100%", padding: "11px", background: loading ? "#6b7280" : "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Verificando..." : "Ingresar al Portal"}
        </button>
        <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 16 }}>Acceso restringido — GLV Holding Group © 2026</p>
      </div>
    </div>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────────
function OnboardingScreen({ user, onContinue }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1b2a" }}>
      <div style={{ width: 560, background: "#fff", borderRadius: 16, padding: "2.5rem", boxShadow: "0 4px 32px rgba(0,0,0,0.18)" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ width: 56, height: 56, borderRadius: 50, background: "#1B2A4A", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <i className="ti ti-shield-check" style={{ fontSize: 26, color: "#fff" }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1B2A4A", margin: "0 0 4px" }}>Bienvenido al Portal de Agentes GLV-Connect</h2>
          <p style={{ fontSize: 14, color: "#6b7280" }}>Hola, {user.name}. Su acceso ha sido autorizado.</p>
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: "1.25rem 1.5rem", border: "1px solid #e2e8f0", marginBottom: "1.5rem" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#1B2A4A", marginBottom: 12 }}>Usted ha sido autorizado para representar a GLV Global Food Services LLC en los mercados internacionales.</p>
          <p style={{ fontSize: 13, color: "#374151", marginBottom: 12, fontWeight: 600 }}>Reglas de Oro:</p>
          {[
            "Toda SCO emitida es enviada automáticamente a la dirección financiera para auditoría.",
            "Asegúrese de seleccionar el origen correcto (Brasil, Uruguay, Colombia) para que los protocolos sanitarios coincidan.",
            "Los contratos finales (SPA) son gestionados exclusivamente por el departamento jurídico tras la firma de la FCO.",
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
              <span style={{ width: 20, height: 20, minWidth: 20, background: "#1B2A4A", color: "#fff", borderRadius: 50, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
              <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>{r}</p>
            </div>
          ))}
        </div>
        <button onClick={onContinue} style={{ width: "100%", padding: "11px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          Entendido — Acceder al Portal
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ user, view, setView, onLogout }) {
  const navItems = [
    { id: "dashboard", icon: "ti-dashboard",        label: "Dashboard" },
    { id: "sco",       icon: "ti-file-description", label: "SCO" },
    { id: "fco",       icon: "ti-file-check",       label: "FCO" },
    ...(user.role === "DIRECTIVO" ? [
      { id: "spa",      icon: "ti-file-certificate", label: "SPA / Contratos" },
      { id: "audit",    icon: "ti-shield",           label: "Auditoría" },
      { id: "usuarios", icon: "ti-users",            label: "Usuarios" },
    ] : []),
  ];

  return (
    <aside style={{ width: 220, background: "#1B2A4A", display: "flex", flexDirection: "column", padding: "1.5rem 0" }}>
      <div style={{ padding: "0 1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#1B2A4A", fontSize: 18, fontWeight: 700 }}>G</span>
          </div>
          <div>
            <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: 0 }}>GLV-Connect</p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, margin: 0 }}>v2.0.1</p>
          </div>
        </div>
      </div>
      <div style={{ padding: "1rem 0.75rem", flex: 1 }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => setView(item.id)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none",
              background: view === item.id ? "rgba(255,255,255,0.15)" : "transparent",
              color: view === item.id ? "#fff" : "rgba(255,255,255,0.65)",
              cursor: "pointer", fontSize: 14, fontWeight: view === item.id ? 500 : 400, marginBottom: 2 }}>
            <i className={`ti ${item.icon}`} style={{ fontSize: 18 }} />
            {item.label}
          </button>
        ))}
      </div>
      <div style={{ padding: "1rem 0.75rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ padding: "8px 12px", marginBottom: 8 }}>
          <p style={{ color: "#fff", fontSize: 13, fontWeight: 500, margin: "0 0 2px" }}>{user.name.split(" ")[0]}</p>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: user.role === "DIRECTIVO" ? "#2563eb" : "#059669", color: "#fff" }}>{user.role}</span>
        </div>
        <button onClick={onLogout}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13 }}>
          <i className="ti ti-logout" style={{ fontSize: 16 }} />Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ user, setView, setModal }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDocs().then(setDocs).catch(console.error).finally(() => setLoading(false));
  }, []);

  const scos = docs.filter(d => d.type === "SCO").length;
  const fcos = docs.filter(d => d.type === "FCO").length;
  const spas = docs.filter(d => d.type === "SPA").length;
  const totalValue = docs.filter(d => d.type === "SPA" || d.type === "FCO").reduce((s, d) => s + (d.totalValue || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px" }}>Dashboard</h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: 14, margin: 0 }}>
          Bienvenido, {user.name} — {new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: "2rem" }}>
            {[
              { label: "SCO emitidos",    value: scos,           icon: "ti-file-description", color: "#2563eb" },
              { label: "FCO emitidos",    value: fcos,           icon: "ti-file-check",        color: "#7c3aed" },
              { label: "SPA activos",     value: spas,           icon: "ti-file-certificate",  color: "#059669" },
              { label: "Valor negociado", value: fmt(totalValue),icon: "ti-currency-dollar",   color: "#d97706" },
            ].map((stat, i) => (
              <div key={i} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>{stat.label}</span>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: stat.color + "1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className={`ti ${stat.icon}`} style={{ fontSize: 18, color: stat.color }} />
                  </div>
                </div>
                <p style={{ fontSize: 24, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>{stat.value}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>Documentos recientes</h3>
                <button onClick={() => setView("sco")} style={{ fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>Ver todos →</button>
              </div>
              {docs.slice(0, 5).map(doc => (
                <div key={doc.id} onClick={() => setModal(doc)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <DocTypeBadge type={doc.type} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>{doc.id}</p>
                      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>{doc.client}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>{doc.date}</p>
                </div>
              ))}
            </div>
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "var(--color-text-primary)" }}>Acciones rápidas</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <QuickAction icon="ti-file-description" label="Nueva SCO" sub="Cotización comercial inicial" color="#2563eb" onClick={() => setView("new-sco")} />
                <QuickAction icon="ti-file-check"       label="Nueva FCO" sub="Oferta formal completa"     color="#7c3aed" onClick={() => setView("new-fco")} />
                {user.role === "DIRECTIVO" && (
                  <QuickAction icon="ti-file-certificate" label="Nuevo SPA / Contrato" sub="Solo para directivos" color="#059669" onClick={() => setView("new-spa")} />
                )}
              </div>
              <div style={{ marginTop: 20, padding: "12px", background: "#fffbeb", borderRadius: 8, border: "1px solid #fde68a" }}>
                <p style={{ fontSize: 12, color: "#92400e", margin: 0, fontWeight: 500 }}>
                  <i className="ti ti-alert-triangle" style={{ fontSize: 14, marginRight: 6, verticalAlign: -2 }} />
                  Destino CHINA activa automáticamente GLV Services SAS (Colombia) + GACC No. YA11000PDY110K805
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function QuickAction({ icon, label, sub, color, onClick }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, background: "var(--color-background-secondary)", cursor: "pointer", textAlign: "left" }}>
      <div style={{ width: 38, height: 38, borderRadius: 8, background: color + "1a", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 38 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 20, color }} />
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>{label}</p>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>{sub}</p>
      </div>
    </button>
  );
}

// ─── DocList ──────────────────────────────────────────────────────────────────
function DocList({ type, user, setModal, setView, showNotif }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const newViewMap = { SCO: "new-sco", FCO: "new-fco", SPA: "new-spa" };

  useEffect(() => {
    api.getDocs(type).then(setDocs).catch(e => showNotif(e.message, "error")).finally(() => setLoading(false));
  }, [type]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px" }}>
            {type === "SCO" ? "Soft Corporate Offers" : type === "FCO" ? "Full Corporate Offers" : "SPA — Contratos"}
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: 14, margin: 0 }}>{docs.length} documento{docs.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setView(newViewMap[type])}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          <i className="ti ti-plus" style={{ fontSize: 16 }} />Nuevo {type}
        </button>
      </div>
      {loading ? <LoadingSpinner /> : docs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--color-text-secondary)" }}>
          <i className="ti ti-file-off" style={{ fontSize: 48, display: "block", marginBottom: 12, opacity: 0.4 }} />
          <p>No hay documentos {type} aún.</p>
        </div>
      ) : (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["Número", "Cliente", "Producto", "Destino", "Valor Ref.", "Fecha", "Estado", ""].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={doc.id} style={{ borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>
                    <DocTypeBadge type={type} /> {doc.id}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--color-text-primary)" }}>{doc.client}</td>
                  <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.product}</td>
                  <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{doc.destination}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--color-text-primary)" }}>{doc.totalValue ? fmt(doc.totalValue) : "—"}</td>
                  <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{doc.date}</td>
                  <td style={{ padding: "12px 16px" }}><StatusBadge status={doc.status} /></td>
                  <td style={{ padding: "12px 16px" }}>
                    <button onClick={() => setModal(doc)}
                      style={{ background: "none", border: "0.5px solid var(--color-border-secondary)", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "var(--color-text-primary)" }}>Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── New Document Form ────────────────────────────────────────────────────────
function NewDocForm({ type, user, setView, showNotif }) {
  const [allDocs, setAllDocs] = useState([]);
  const [form, setFormState] = useState({
    client: "", clientCountry: "", clientRepresentative: "", clientEmail: "", clientPhone: "",
    product: "", destination: "", origin: "Brazil", headcount: "", avgWeight: 45,
    paymentMethod: "SBLC", programDuration: "5 años", validityDays: "30", observations: "", parentId: "",
  });
  const [chinaAlert, setChinaAlert] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getDocs().then(setAllDocs).catch(() => {});
  }, []);

  const setField = (k, v) => {
    setFormState(prev => {
      const next = { ...prev, [k]: v };
      if (k === "destination" && v === "China") {
        setChinaAlert(true);
        next.origin = "Colombia";
      } else if (k === "destination") {
        setChinaAlert(false);
      }
      return next;
    });
  };

  const destInfo = PRICE_TABLE[form.destination] || {};
  const pricePerKg = destInfo.price || 0;
  const totalKg = (parseFloat(form.headcount) || 0) * (parseFloat(form.avgWeight) || 0);
  const totalValue = totalKg * pricePerKg;
  const isAnimalProduct = form.product.includes("Animales") || form.product.includes("Ovina") || form.product.includes("Bovina");
  const isAnimalOrLong = isAnimalProduct || form.programDuration.includes("5") || form.programDuration.includes("año");

  const exporter = chinaAlert ? "GLV Services SAS (Colombia)" : "GLV Global Food Services LLC (Miami, FL)";
  const domain   = chinaAlert ? "glvservicesexp.com" : "glvglobalfoodservices.com";
  const gaccNote = chinaAlert ? "GACC No. YA11000PDY110K805" : null;

  const signedFCOs   = allDocs.filter(d => d.type === "FCO" && d.status === "Firmado");
  const availableSCOs = allDocs.filter(d => d.type === "SCO");

  const handleSubmit = async () => {
    if (!form.client || !form.product || !form.destination) {
      showNotif("Por favor complete los campos obligatorios.", "error"); return;
    }
    setSubmitting(true);
    try {
      const doc = await api.createDoc({ type, ...form });
      showNotif(`${type} ${doc.id} generado. Copia enviada a contabilidad@glvservicesexp.com`, "success");
      setView(type.toLowerCase());
    } catch (e) {
      showNotif(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "2rem" }}>
        <button onClick={() => setView(type.toLowerCase())} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 22 }}>←</button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px" }}>Nuevo {type}</h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: 14, margin: 0 }}>Complete los campos para generar el documento</p>
        </div>
      </div>

      {chinaAlert && (
        <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 10 }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 20, color: "#d97706", marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#92400e", margin: "0 0 4px" }}>Filtro CHINA activado</p>
            <p style={{ fontSize: 13, color: "#78350f", margin: 0 }}>Entidad exportadora bloqueada a <strong>GLV Services SAS (Colombia)</strong>. GACC No. YA11000PDY110K805 insertado automáticamente.</p>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <FormSection title="Datos del cliente">
          <FormField label="Nombre / Empresa *" value={form.client} onChange={v => setField("client", v)} placeholder="Nombre completo o razón social" />
          <FormField label="País del cliente" value={form.clientCountry} onChange={v => setField("clientCountry", v)} placeholder="País" />
          <FormField label="Representante" value={form.clientRepresentative} onChange={v => setField("clientRepresentative", v)} placeholder="Nombre del representante" />
          <FormField label="Email institucional" value={form.clientEmail} onChange={v => setField("clientEmail", v)} placeholder="correo@empresa.com" />
          <FormField label="Teléfono / WhatsApp" value={form.clientPhone} onChange={v => setField("clientPhone", v)} placeholder="+1 000 000 0000" />
        </FormSection>

        <FormSection title="Datos comerciales">
          <SelectField label="Producto *" value={form.product} onChange={v => setField("product", v)}>
            <option value="">Seleccionar producto</option>
            {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
          </SelectField>
          <SelectField label="Destino *" value={form.destination} onChange={v => setField("destination", v)}>
            <option value="">Seleccionar destino</option>
            {Object.keys(PRICE_TABLE).map(d => <option key={d} value={d}>{d} — {PRICE_TABLE[d].port}</option>)}
          </SelectField>
          <SelectField label="Origen" value={form.origin} onChange={v => setField("origin", v)} disabled={chinaAlert}>
            {Object.keys(ORIGINS).map(o => <option key={o} value={o}>{o} — {ORIGINS[o].split("/")[0].trim()}</option>)}
          </SelectField>
        </FormSection>

        {isAnimalProduct && (
          <FormSection title="Especificaciones del lote">
            <FormField label="Número de cabezas" value={form.headcount} onChange={v => setField("headcount", v)} placeholder="70000" type="number" />
            <FormField label="Peso promedio ref. (kg)" value={form.avgWeight} onChange={v => setField("avgWeight", v)} placeholder="45" type="number" />
            {form.destination && (
              <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "12px", border: "0.5px solid var(--color-border-tertiary)" }}>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 6px" }}>Precio CFR ({form.destination})</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 4px" }}>USD {pricePerKg.toFixed(2)}/kg</p>
                {totalValue > 0 && <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Valor referencial: <strong>{fmt(totalValue)}</strong></p>}
              </div>
            )}
          </FormSection>
        )}

        <FormSection title="Términos financieros">
          <SelectField label="Método de pago" value={form.paymentMethod} onChange={v => setField("paymentMethod", v)}>
            <option value="SBLC">SBLC — Stand-By Letter of Credit (90 días)</option>
            <option value="TT 50/50">TT 50/50 — Transferencia (60 días)</option>
            <option value="TT 70/30">TT 70/30 — Urgente</option>
            <option value="LC">LC — Letter of Credit</option>
          </SelectField>
          {isAnimalOrLong && form.paymentMethod !== "SBLC" && (
            <p style={{ fontSize: 12, color: "#d97706", marginBottom: 12 }}>⚠ Para animales vivos / contratos ≥90 días se sugiere SBLC.</p>
          )}
          <FormField label="Validez del documento (días)" value={form.validityDays} onChange={v => setField("validityDays", v)} type="number" />
          <FormField label="Duración del programa" value={form.programDuration} onChange={v => setField("programDuration", v)} placeholder="5 años" />
        </FormSection>

        {type === "FCO" && (
          <FormSection title="Referencia SCO (opcional)">
            <SelectField label="SCO de origen" value={form.parentId} onChange={v => setField("parentId", v)}>
              <option value="">Nueva FCO sin SCO de referencia</option>
              {availableSCOs.map(s => <option key={s.id} value={s.id}>{s.id} — {s.client}</option>)}
            </SelectField>
          </FormSection>
        )}

        {type === "SPA" && (
          <FormSection title="FCO de referencia (obligatorio)">
            <SelectField label="FCO firmada *" value={form.parentId} onChange={v => setField("parentId", v)}>
              <option value="">Seleccionar FCO firmada</option>
              {signedFCOs.map(f => <option key={f.id} value={f.id}>{f.id} — {f.client}</option>)}
            </SelectField>
            <div style={{ background: "#ede9fe", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#4c1d95" }}>
              <i className="ti ti-lock" style={{ fontSize: 14, marginRight: 6, verticalAlign: -2 }} />
              El SPA activa 43 cláusulas legales del modelo SPA2026-03-01.
            </div>
          </FormSection>
        )}
      </div>

      <FormSection title="Entidad exportadora (auto-generado)">
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "14px 16px", border: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>Exportador</p><p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>{exporter}</p></div>
            <div><p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>Dominio</p><p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>{domain}</p></div>
            {gaccNote && <div><p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>GACC</p><p style={{ fontSize: 13, fontWeight: 600, color: "#d97706", margin: 0 }}>{gaccNote}</p></div>}
            <div><p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>Entidad SBLC</p><p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>Active Value International General Trading L.L.C</p></div>
          </div>
        </div>
      </FormSection>

      <div style={{ marginTop: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Observaciones adicionales</label>
        <textarea value={form.observations} onChange={e => setField("observations", e.target.value)} rows={3}
          placeholder="Instrucciones especiales, notas del cliente..."
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)", resize: "vertical", boxSizing: "border-box" }} />
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
        <button onClick={() => setView(type.toLowerCase())}
          style={{ padding: "10px 20px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "none", cursor: "pointer", fontSize: 14, color: "var(--color-text-primary)" }}>Cancelar</button>
        <button onClick={handleSubmit} disabled={submitting}
          style={{ padding: "10px 24px", background: submitting ? "#6b7280" : "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}>
          <i className="ti ti-file-plus" style={{ fontSize: 16, marginRight: 6, verticalAlign: -2 }} />
          {submitting ? "Generando..." : `Generar ${type} y enviar a auditoría`}
        </button>
      </div>
    </div>
  );
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAudit().then(setLogs).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "1.5rem" }}>Registro de Auditoría</h1>
      {loading ? <LoadingSpinner /> : (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["Timestamp", "Usuario", "Acción", "Documento", "IP"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={i} style={{ borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                  <td style={{ padding: "10px 16px", color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{log.ts}</td>
                  <td style={{ padding: "10px 16px", fontWeight: 500, color: "var(--color-text-primary)" }}>{log.username}</td>
                  <td style={{ padding: "10px 16px", color: "var(--color-text-primary)" }}>{log.action}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: 12, color: "#2563eb" }}>{log.doc_id || "—"}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-secondary)" }}>{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Users Panel ──────────────────────────────────────────────────────────────
function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "1.5rem" }}>Gestión de Usuarios</h1>
      {loading ? <LoadingSpinner /> : (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["Usuario", "Nombre", "Rol", "Email", "Estado"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                  <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--color-text-primary)" }}>{u.username}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--color-text-primary)" }}>{u.name}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: u.role === "DIRECTIVO" ? "#dbeafe" : "#dcfce7", color: u.role === "DIRECTIVO" ? "#1e40af" : "#166534" }}>{u.role}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)", fontSize: 13 }}>{u.email}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: u.active ? "#dcfce7" : "#fee2e2", color: u.active ? "#166534" : "#991b1b" }}>{u.active ? "Activo" : "Inactivo"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Doc Preview Modal ────────────────────────────────────────────────────────
function DocPreviewModal({ doc, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const isChina = doc.destination === "China";

  const handleDownload = async () => {
    setDownloading(true);
    try { await downloadPDF(doc); } catch (e) { console.error(e); }
    finally { setDownloading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "var(--color-background-primary)", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", padding: "2rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <DocTypeBadge type={doc.type} />
              <StatusBadge status={doc.status} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 2px" }}>{doc.id}</h2>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0 }}>Emitido: {doc.date}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "var(--color-text-secondary)" }}>×</button>
        </div>

        <div style={{ borderTop: "2px solid #1B2A4A", paddingTop: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 2px", fontWeight: 600, letterSpacing: 1 }}>VENDEDOR</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#1B2A4A", margin: "0 0 2px" }}>{doc.exporter || "GLV Global Food Services LLC"}</p>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>19790 W Dixie Hwy, Unit 1115, Miami, FL 33180 | {doc.domain || "glvglobalfoodservices.com"}</p>
              {isChina && <p style={{ fontSize: 12, fontWeight: 700, color: "#d97706", margin: "4px 0 0" }}>GACC No. YA11000PDY110K805</p>}
            </div>
            <div style={{ width: 52, height: 52, borderRadius: 10, background: "#1B2A4A", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 26, fontWeight: 700 }}>G</span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <InfoBlock label="Cliente / Comprador" value={doc.client} />
          <InfoBlock label="Producto" value={doc.product} />
          <InfoBlock label="Destino" value={doc.destination} />
          <InfoBlock label="Puerto CFR" value={PRICE_TABLE[doc.destination]?.port || "—"} />
          <InfoBlock label="Origen" value={doc.origin} />
          <InfoBlock label="Método de pago" value={doc.paymentMethod || "SBLC"} />
          {doc.headcount && <InfoBlock label="Número de cabezas" value={new Intl.NumberFormat().format(doc.headcount)} />}
          {doc.avgWeight  && <InfoBlock label="Peso prom. referencia" value={`${doc.avgWeight} kg`} />}
          {doc.pricePerKg && <InfoBlock label="Precio CFR" value={`USD ${Number(doc.pricePerKg).toFixed(2)}/kg`} />}
          {doc.totalValue && <InfoBlock label="Valor total referencial" value={fmt(doc.totalValue)} highlight />}
        </div>

        {doc.type === "SPA" && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#166534", margin: "0 0 6px" }}>Estructura del Contrato — Modelo SPA2026-03-01</p>
            <p style={{ fontSize: 12, color: "#14532d", margin: 0 }}>43 cláusulas legales activas: Objeto, Entidades, Domicilios, Documentos constitutivos, Producto, Lote, Composición sexual, Volumen, Base de facturación, Precio CFR, Moneda, Destinos, Pago/SBLC, Inspección SGS, Halal, Cuarentena, Transporte marítimo, Documentos de lote, Responsabilidades, Seguros, Fuerza mayor, Incumplimiento, Penalidades, Arbitraje (CCI Paris), Ley aplicable.</p>
          </div>
        )}

        {doc.gaccNote && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "#92400e", margin: 0 }}><strong>Código GACC China:</strong> {doc.gaccNote}</p>
          </div>
        )}

        <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 14 }}>
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
              Agente: {doc.agent} | Copia automática a: contabilidad@glvservicesexp.com • info@glvglobalfoodservices.com
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleDownload} disabled={downloading}
                style={{ padding: "8px 16px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: downloading ? "not-allowed" : "pointer", fontSize: 13, color: "var(--color-text-primary)" }}>
                <i className="ti ti-download" style={{ fontSize: 15, marginRight: 5, verticalAlign: -2 }} />
                {downloading ? "Generando..." : "PDF"}
              </button>
              <button onClick={onClose} style={{ padding: "8px 16px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────
function DocTypeBadge({ type }) {
  const map = { SCO: { bg: "#dbeafe", text: "#1e40af" }, FCO: { bg: "#ede9fe", text: "#4c1d95" }, SPA: { bg: "#dcfce7", text: "#166534" } };
  const c = map[type] || { bg: "#f3f4f6", text: "#374151" };
  return <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, fontWeight: 600, background: c.bg, color: c.text }}>{type}</span>;
}

function StatusBadge({ status }) {
  const map = { "Emitido": { bg: "#dbeafe", text: "#1e40af" }, "Firmado": { bg: "#ede9fe", text: "#4c1d95" }, "Activo": { bg: "#dcfce7", text: "#166534" }, "Expirado": { bg: "#fee2e2", text: "#991b1b" }, "Pendiente": { bg: "#fef3c7", text: "#92400e" } };
  const s = map[status] || { bg: "#f3f4f6", text: "#374151" };
  return <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 500, background: s.bg, color: s.text }}>{status}</span>;
}

function FormSection({ title, children }) {
  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 16px", paddingBottom: 10, borderBottom: "0.5px solid var(--color-border-tertiary)" }}>{title}</h3>
      {children}
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" }} />
    </div>
  );
}

function SelectField({ label, value, onChange, disabled, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", fontSize: 14, background: disabled ? "var(--color-background-secondary)" : "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
        {children}
      </select>
    </div>
  );
}

function InfoBlock({ label, value, highlight }) {
  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 3px", fontWeight: 600, letterSpacing: 0.5 }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: 14, fontWeight: highlight ? 700 : 500, color: highlight ? "#059669" : "var(--color-text-primary)", margin: 0 }}>{value}</p>
    </div>
  );
}

function Notification({ msg, type }) {
  return (
    <div style={{ position: "fixed", top: 20, right: 20, background: type === "error" ? "#fef2f2" : "#f0fdf4", border: `1px solid ${type === "error" ? "#fca5a5" : "#86efac"}`, borderRadius: 10, padding: "12px 18px", zIndex: 9999, display: "flex", alignItems: "center", gap: 10, maxWidth: 420, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
      <i className={`ti ${type === "error" ? "ti-alert-circle" : "ti-circle-check"}`} style={{ fontSize: 20, color: type === "error" ? "#dc2626" : "#16a34a" }} />
      <p style={{ fontSize: 13, color: type === "error" ? "#991b1b" : "#14532d", margin: 0 }}>{msg}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div style={{ textAlign: "center", padding: "4rem", color: "var(--color-text-secondary)" }}>
      <i className="ti ti-loader-2" style={{ fontSize: 36, display: "block", marginBottom: 12, opacity: 0.5 }} />
      <p style={{ fontSize: 14 }}>Cargando...</p>
    </div>
  );
}
