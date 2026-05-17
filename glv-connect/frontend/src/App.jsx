import { useState, useEffect, useRef, createContext, useContext } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { api } from "./api.js";
import { downloadPDF } from "./components/GlvPDF.jsx";
import { ProfileModal } from "./components/ProfileModal.jsx";
import { PaymentSelector } from "./components/PaymentSelector.jsx";
import { ChangePasswordModal } from "./components/ChangePasswordModal.jsx";
import { AdminUsers } from "./components/AdminUsers.jsx";
import { CommercialEngine } from "./components/CommercialEngine.jsx";
import { FinanceView } from "./components/FinanceView.jsx";
import { TasksView } from "./components/TasksView.jsx";
import { DRIVE_IMAGES, driveUrl } from "./config/driveImages.js";
import { validateDocForm } from "./utils/validateDoc.js";
import { LANGUAGES, t } from "./i18n.js";

const ADMINS    = new Set(["SUPER_ADMIN","CORPORATE_ADMIN"]);
const DIRECTORS = new Set(["SUPER_ADMIN","CORPORATE_ADMIN","DIRECTOR","DIRECTIVO","CFO","COMMERCIAL_DIRECTOR"]);

// ─── Auth context ────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agentProfile, setAgentProfile] = useState(null);
  const [lang, setLang] = useState("es");

  useEffect(() => {
    const token = localStorage.getItem("glv_token");
    if (!token) { setLoading(false); return; }
    const PROFILE_ROLES = new Set(["AGENTE", "LOGISTICS", "CLIENT", "SUPPLIER"]);
    api.me()
      .then(async (u) => {
        setUser(u);
        if (u?.preferred_lang) setLang(u.preferred_lang);
        if (PROFILE_ROLES.has(u?.role)) {
          try { setAgentProfile(await api.getProfile()); } catch {}
        }
      })
      .catch(() => localStorage.removeItem("glv_token"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user?.preferred_lang) setLang(user.preferred_lang);
  }, [user?.preferred_lang]);

  const login = async (username, password) => {
    const { token, user: u } = await api.login(username, password);
    localStorage.setItem("glv_token", token);
    setUser(u);
    if (u?.preferred_lang) setLang(u.preferred_lang);
    return u;
  };

  const logout = () => {
    localStorage.removeItem("glv_token");
    setUser(null);
    setAgentProfile(null);
  };

  const handleProfileComplete = async () => {
    try {
      const updated = await api.me();
      setUser(updated);
      const p = await api.getProfile();
      setAgentProfile(p);
    } catch {}
  };

  const refreshProfile = async () => {
    try {
      const p = await api.getProfile();
      setAgentProfile(p);
    } catch {}
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1b2a" }}>
        <p style={{ color: "#fff", fontSize: 14 }}>Cargando...</p>
      </div>
    );
  }

  const AGENT_ROLES = new Set(["AGENTE", "LOGISTICS", "CLIENT", "SUPPLIER"]);
  const needsPasswordChange = user?.first_login === 1;
  const needsProfileSetup = user && !needsPasswordChange && !user.profile_completed && AGENT_ROLES.has(user.role);

  return (
    <AuthContext.Provider value={{ user, login, logout, agentProfile, refreshProfile, lang, setLang }}>
      {/* PASO 2: Cambio de contraseña obligatorio en primer acceso */}
      {needsPasswordChange && (
        <ChangePasswordModal isFirstLogin onComplete={async () => {
          const updated = await api.me();
          setUser(updated);
        }} />
      )}
      {/* PASO 3: Completar perfil (solo si contraseña ya cambiada y perfil incompleto) */}
      {needsProfileSetup && (
        <ProfileModal user={user} onComplete={handleProfileComplete} />
      )}
      {children}
    </AuthContext.Provider>
  );
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

// ─── Static data ─────────────────────────────────────────────────────────────
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
  "Otro",
];

const CUSTOM_UNITS = ["kg", "TM", "litros", "unidades", "cajas", "otra"];

const ORIGINS = {
  "Brazil":    "GLV Global Foods Brasil Ltda. / MAPA",
  "Uruguay":   "GLV Global Group / INAC Associates",
  "Chile":     "GLV Global Group / SAG Associates",
  "Argentina": "GLV Global Group / SENASA Associates",
  "Colombia":  "GLV Services SAS",
};

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

// ─── Root App ─────────────────────────────────────────────────────────────────
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

// ─── Portal shell ─────────────────────────────────────────────────────────────
function Portal() {
  const { user, logout, lang, setLang, agentProfile } = useAuth();
  const [view, setView] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotif = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const isDirector = DIRECTORS.has(user?.role);
  const isAdmin    = ADMINS.has(user?.role);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-background-tertiary)", fontFamily: "var(--font-sans)" }}>
      <Sidebar user={user} view={view} setView={setView} onLogout={logout} lang={lang} setLang={setLang} />
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
        {notification && <Notification msg={notification.msg} type={notification.type} />}
        {view === "dashboard"    && <Dashboard user={user} setView={setView} setModal={setModal} />}
        {view === "sco"          && <DocList type="SCO" user={user} setModal={setModal} setView={setView} showNotif={showNotif} />}
        {view === "fco"          && <DocList type="FCO" user={user} setModal={setModal} setView={setView} showNotif={showNotif} />}
        {view === "spa"          && isDirector && <DocList type="SPA" user={user} setModal={setModal} setView={setView} showNotif={showNotif} />}
        {view === "operations"         && <OperationsView user={user} setView={setView} showNotif={showNotif} />}
        {view?.startsWith?.("op-detail:") && <OperationDetail opId={view.split(":")[1]} user={user} setView={setView} showNotif={showNotif} />}
        {view === "clients"      && <ClientsView user={user} showNotif={showNotif} />}
        {view === "finance"      && isDirector && <FinanceView showNotif={showNotif} />}
        {view === "tasks"        && <TasksView user={user} showNotif={showNotif} />}
        {view === "audit"        && isDirector && <AuditLog />}
        {view === "usuarios"     && isDirector && <UsersPanel />}
        {view === "admin-users"  && isAdmin    && <AdminUsers showNotif={showNotif} />}
        {view === "admin-images" && isAdmin    && <ImageAdmin showNotif={showNotif} />}
        {view === "new-sco"      && <NewDocForm type="SCO" user={user} setView={setView} showNotif={showNotif} />}
        {view === "new-fco"      && <NewDocForm type="FCO" user={user} setView={setView} showNotif={showNotif} />}
        {view === "new-spa"      && isDirector && <NewDocForm type="SPA" user={user} setView={setView} showNotif={showNotif} />}
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
function Sidebar({ user, view, setView, onLogout, lang, setLang }) {
  const isDirector = DIRECTORS.has(user?.role);
  const isAdmin    = ADMINS.has(user?.role);

  const navItems = [
    { id: "dashboard",    icon: "ti-dashboard",        label: "Dashboard" },
    { id: "operations",   icon: "ti-briefcase",        label: "Operaciones" },
    { id: "clients",      icon: "ti-building",         label: "Clientes" },
    { id: "sco",          icon: "ti-file-description", label: "SCO" },
    { id: "fco",          icon: "ti-file-check",       label: "FCO" },
    { id: "tasks",        icon: "ti-checklist",        label: "Tareas & Calidad" },
    ...(isDirector ? [
      { id: "spa",         icon: "ti-file-certificate", label: "SPA / Contratos" },
      { id: "finance",     icon: "ti-currency-dollar",  label: "Finanzas" },
      { id: "audit",       icon: "ti-shield",           label: "Auditoría" },
      { id: "usuarios",    icon: "ti-users",            label: "Usuarios" },
    ] : []),
    ...(isAdmin ? [
      { id: "admin-users",  icon: "ti-user-cog",   label: "Gestión Usuarios" },
      { id: "admin-images", icon: "ti-photo",       label: "Imágenes Drive" },
    ] : []),
  ];

  const ROLE_COLORS = {
    SUPER_ADMIN: "#dc2626", CORPORATE_ADMIN: "#7c3aed", CFO: "#0369a1",
    DIRECTOR: "#1B2A4A", DIRECTIVO: "#1B2A4A", COMMERCIAL_DIRECTOR: "#0891b2",
    COMPLIANCE: "#7c3aed", ACCOUNTING: "#059669", TREASURY: "#059669",
    AUDIT: "#d97706", TAX_REVIEWER: "#d97706", COUNTRY_ACCOUNTANT: "#d97706",
    LOGISTICS: "#6b7280", AGENTE: "#2563eb", CLIENT: "#374151", SUPPLIER: "#374151",
  };
  const roleColor = ROLE_COLORS[user?.role] || "#6b7280";

  return (
    <aside style={{ width: 230, background: "#1B2A4A", display: "flex", flexDirection: "column", padding: "1.5rem 0", minHeight: "100vh" }}>
      <div style={{ padding: "0 1.25rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#1B2A4A", fontSize: 18, fontWeight: 700 }}>G</span>
          </div>
          <div>
            <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: 0 }}>GLV-Connect</p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, margin: 0 }}>Corporate SAT v3.0</p>
          </div>
        </div>
        {/* Language selector */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)} title={l.name}
              style={{ padding: "2px 6px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 14,
                background: lang === l.code ? "rgba(255,255,255,0.25)" : "transparent",
                opacity: lang === l.code ? 1 : 0.55 }}>
              {l.flag}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: "0.75rem 0.75rem", flex: 1, overflowY: "auto" }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => setView(item.id)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none",
              background: view === item.id ? "rgba(255,255,255,0.15)" : "transparent",
              color: view === item.id ? "#fff" : "rgba(255,255,255,0.65)",
              cursor: "pointer", fontSize: 13, fontWeight: view === item.id ? 500 : 400, marginBottom: 2, textAlign: "left" }}>
            <i className={`ti ${item.icon}`} style={{ fontSize: 17, minWidth: 17 }} />
            {item.label}
          </button>
        ))}
      </div>
      <div style={{ padding: "0.75rem 0.75rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ padding: "8px 12px", marginBottom: 6 }}>
          <p style={{ color: "#fff", fontSize: 13, fontWeight: 500, margin: "0 0 4px" }}>{user.name.split(" ")[0]}</p>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: roleColor + "33", color: "#fff", border: `1px solid ${roleColor}55` }}>{user.role}</span>
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
  const [docs, setDocs]         = useState([]);
  const [operations, setOps]    = useState([]);
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.getDocs(),
      api.getOperations(),
      api.getTasks({ status: "pending" }),
    ]).then(([d, o, t]) => {
      setDocs(d); setOps(o); setTasks(t);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const scos       = docs.filter(d => d.type === "SCO").length;
  const fcos       = docs.filter(d => d.type === "FCO").length;
  const spas       = docs.filter(d => d.type === "SPA").length;
  const totalValue = docs.filter(d => d.type === "SPA" || d.type === "FCO").reduce((s, d) => s + (d.totalValue || 0), 0);
  const activeOps  = operations.filter(o => o.status === "ACTIVE" || o.status === "NEGOTIATING").length;
  const overdue    = tasks.filter(t => t.deadline && new Date(t.deadline) < new Date()).length;

  const kpis = [
    { label: "Operaciones activas", value: activeOps,      icon: "ti-briefcase",       color: "#0891b2", view: "operations" },
    { label: "SCO emitidos",        value: scos,           icon: "ti-file-description", color: "#2563eb", view: "sco" },
    { label: "FCO / SPA",           value: fcos + spas,    icon: "ti-file-check",       color: "#7c3aed", view: "fco" },
    { label: "Valor negociado",     value: fmt(totalValue), icon: "ti-currency-dollar", color: "#d97706", view: null },
  ];

  return (
    <div>
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px" }}>Dashboard</h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: 14, margin: 0 }}>
          Bienvenido, {user.name} — {new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Alerta tareas vencidas */}
      {overdue > 0 && (
        <div onClick={() => setView("tasks")} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 16px", marginBottom: 20, cursor: "pointer" }}>
          <i className="ti ti-alert-circle" style={{ fontSize: 18, color: "#dc2626" }} />
          <p style={{ fontSize: 13, color: "#991b1b", margin: 0, fontWeight: 500 }}>
            Tienes <strong>{overdue}</strong> tarea{overdue > 1 ? "s" : ""} vencida{overdue > 1 ? "s" : ""}. Haz clic para revisar.
          </p>
        </div>
      )}

      {loading ? <LoadingSpinner /> : (
        <>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: "1.5rem" }}>
            {kpis.map((stat, i) => (
              <div key={i} onClick={() => stat.view && setView(stat.view)}
                style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem", cursor: stat.view ? "pointer" : "default",
                  transition: "box-shadow 0.15s", boxShadow: "none" }}
                onMouseEnter={e => { if (stat.view) e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 500 }}>{stat.label}</span>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: stat.color + "1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className={`ti ${stat.icon}`} style={{ fontSize: 17, color: stat.color }} />
                  </div>
                </div>
                <p style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* Operaciones recientes */}
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>Operaciones recientes</h3>
                <button onClick={() => setView("operations")} style={{ fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>Ver todas →</button>
              </div>
              {operations.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", textAlign: "center", padding: "1rem 0" }}>Sin operaciones aún</p>
              ) : operations.slice(0, 5).map(op => {
                const cd = op.commercial_data ? (typeof op.commercial_data === "string" ? JSON.parse(op.commercial_data) : op.commercial_data) : {};
                return (
                  <div key={op.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: "#1B2A4A", fontFamily: "monospace" }}>{op.operation_id || op.id}</p>
                      <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>{op.counterpart_name || cd?.product || "—"}</p>
                    </div>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20,
                      background: op.status === "ACTIVE" || op.status === "NEGOTIATING" ? "#dbeafe" : "#f3f4f6",
                      color:      op.status === "ACTIVE" || op.status === "NEGOTIATING" ? "#1e40af" : "#374151" }}>
                      {op.status}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Documentos recientes */}
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>Documentos recientes</h3>
                <button onClick={() => setView("sco")} style={{ fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>Ver todos →</button>
              </div>
              {docs.slice(0, 5).map(doc => (
                <div key={doc.id} onClick={() => setModal(doc)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <DocTypeBadge type={doc.type} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>{doc.id}</p>
                      <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>{doc.client}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>{doc.date}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Acciones rápidas + Tareas pendientes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--color-text-primary)" }}>Acciones rápidas</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <QuickAction icon="ti-briefcase"        label="Nueva Operación"   sub="Operación comercial"     color="#0891b2" onClick={() => setView("operations")} />
                <QuickAction icon="ti-file-description" label="Nueva SCO"          sub="Cotización comercial"   color="#2563eb" onClick={() => setView("new-sco")} />
                <QuickAction icon="ti-file-check"       label="Nueva FCO"          sub="Oferta formal completa" color="#7c3aed" onClick={() => setView("new-fco")} />
                {DIRECTORS.has(user.role) && (
                  <QuickAction icon="ti-file-certificate" label="Nuevo SPA"        sub="Contrato — solo directivos" color="#059669" onClick={() => setView("new-spa")} />
                )}
              </div>
              <div style={{ marginTop: 14, padding: "10px 12px", background: "#fffbeb", borderRadius: 8, border: "1px solid #fde68a" }}>
                <p style={{ fontSize: 11, color: "#92400e", margin: 0, fontWeight: 500 }}>
                  <i className="ti ti-alert-triangle" style={{ fontSize: 13, marginRight: 5, verticalAlign: -2 }} />
                  Destino CHINA → activa GLV Services SAS (Colombia) + GACC No. YA11000PDY110K805
                </p>
              </div>
            </div>

            {/* Tareas pendientes */}
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>Tareas pendientes</h3>
                <button onClick={() => setView("tasks")} style={{ fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>Ver todas →</button>
              </div>
              {tasks.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", textAlign: "center", padding: "1rem 0" }}>
                  <i className="ti ti-circle-check" style={{ fontSize: 22, display: "block", marginBottom: 6, color: "#059669" }} />
                  Sin tareas pendientes
                </p>
              ) : tasks.slice(0, 4).map(task => {
                const isOv = task.deadline && new Date(task.deadline) < new Date();
                const pc = { low: "#059669", medium: "#d97706", high: "#dc2626", critical: "#9d174d" };
                return (
                  <div key={task.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: pc[task.priority] || "#d97706", marginTop: 5, minWidth: 8 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, margin: 0, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</p>
                      {task.deadline && <p style={{ fontSize: 11, color: isOv ? "#dc2626" : "var(--color-text-secondary)", margin: 0, fontWeight: isOv ? 600 : 400 }}>{isOv ? "⚠ Vencida: " : ""}{task.deadline}</p>}
                    </div>
                  </div>
                );
              })}
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
  const { agentProfile } = useAuth();
  const [allDocs, setAllDocs] = useState([]);
  const [commercialData, setCommercialData] = useState({});
  const [form, setFormState] = useState({
    client: "", clientCountry: "", clientRepresentative: "", clientEmail: "", clientPhone: "",
    product: "", destination: "", origin: "Brazil", headcount: "", avgWeight: 45,
    paymentMethod: "SBLC", programDuration: "5 años", validityDays: "30", observations: "", parentId: "",
    customProductName: "", customProductDesc: "", customUnit: "kg", customPaymentType: "TT",
    paymentOption: "", docTrigger: "", hasGuarantee: false, guaranteeType: null, guaranteeBank: "",
    fcoConfirmed: false, clientIdDocB64: null,
  });
  const chinaAlert = (commercialData?.destination || form.destination || "").toLowerCase().includes("china");
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const clientIdRef = useRef();

  useEffect(() => {
    api.getDocs().then(setAllDocs).catch(() => {});
  }, []);

  const setField = (k, v) => {
    setFormState(prev => {
      const next = { ...prev, [k]: v };
      // If FCO selects parent SCO, preload data
      if (k === "parentId" && type === "FCO" && v) {
        const sco = allDocs.find(d => d.id === v);
        if (sco) {
          return {
            ...next,
            client: sco.client || next.client,
            clientCountry: sco.clientCountry || next.clientCountry,
            clientRepresentative: sco.clientRepresentative || next.clientRepresentative,
            clientEmail: sco.clientEmail || next.clientEmail,
            clientPhone: sco.clientPhone || next.clientPhone,
            product: sco.product || next.product,
            destination: sco.destination || next.destination,
            origin: sco.origin || next.origin,
            headcount: sco.headcount || next.headcount,
            avgWeight: sco.avgWeight || next.avgWeight,
          };
        }
      }
      return next;
    });
  };

  const handlePaymentChange = (paymentData) => {
    setFormState(prev => ({
      ...prev,
      paymentOption: paymentData.option || "",
      docTrigger: paymentData.docTrigger || "",
      hasGuarantee: paymentData.hasGuarantee || false,
      guaranteeType: paymentData.guaranteeType || null,
      guaranteeBank: paymentData.bankName || "",
    }));
  };

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const effectiveDestination = commercialData?.destination || form.destination || "";
  const effectiveProduct = commercialData?.rows?.[0]?.category || commercialData?.category || form.product || "";
  const destInfo = PRICE_TABLE[effectiveDestination] || {};
  const pricePerKg = destInfo.price || 0;
  const totalKg = (parseFloat(form.headcount) || 0) * (parseFloat(form.avgWeight) || 0);
  const totalValue = commercialData?.summary?.contractValue || (totalKg * pricePerKg) || null;
  const isAnimalProduct = effectiveProduct === "LIVE_ANIMALS" || (form.product && (form.product.includes("Animales") || form.product.includes("Ovina") || form.product.includes("Bovina")));
  const isCustomProduct = form.product === "Outro" || form.product === "Otro";

  const exporter = chinaAlert ? "GLV Services SAS (Colombia)" : "GLV Global Food Services LLC (Miami, FL)";
  const domain   = chinaAlert ? "glvservicesexp.com" : "glvglobalfoodservices.com";
  const gaccNote = chinaAlert ? "GACC No. YA11000PDY110K805" : null;

  const signedFCOs   = allDocs.filter(d => d.type === "FCO" && d.status === "Firmado");
  const availableSCOs = allDocs.filter(d => d.type === "SCO");

  const handleSubmit = async () => {
    setValidationErrors([]);
    // Build form data for validation
    const fData = {
      client: form.client,
      clientRepresentative: form.clientRepresentative,
      clientEmail: form.clientEmail,
      product: effectiveProduct || form.product,
      pricePerKg,
      totalValue,
      headcount: form.headcount,
      destination: effectiveDestination,
      payment_option: form.paymentOption,
      validityDays: form.validityDays,
      doc_trigger: form.docTrigger,
      custom_product_name: form.customProductName,
      custom_product_desc: form.customProductDesc,
      fco_confirmed: form.fcoConfirmed ? 1 : 0,
      client_id_doc_b64: form.clientIdDocB64,
      commercialData,
    };

    const errors = validateDocForm(fData, agentProfile, type);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type,
        client: form.client,
        clientCountry: form.clientCountry,
        clientRepresentative: form.clientRepresentative,
        clientEmail: form.clientEmail,
        clientPhone: form.clientPhone,
        product: effectiveProduct || form.product,
        destination: effectiveDestination,
        origin: chinaAlert ? "Colombia" : (commercialData?.origin || form.origin || "Brazil"),
        headcount: form.headcount,
        avgWeight: form.avgWeight,
        paymentMethod: form.paymentMethod,
        observations: form.observations,
        parentId: form.parentId,
        payment_option: form.paymentOption,
        doc_trigger: form.docTrigger,
        has_guarantee: form.hasGuarantee ? 1 : 0,
        guarantee_type: form.guaranteeType,
        guarantee_bank: form.guaranteeBank,
        validity_days: parseInt(form.validityDays) || 15,
        custom_product_name: isCustomProduct ? form.customProductName : null,
        custom_product_desc: isCustomProduct ? form.customProductDesc : null,
        custom_unit: isCustomProduct ? form.customUnit : null,
        fco_confirmed: form.fcoConfirmed ? 1 : 0,
        commercial_data: Object.keys(commercialData).length > 0 ? commercialData : null,
        client_id_doc_b64: form.clientIdDocB64,
      };

      const doc = await api.createDoc(payload);
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

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#991b1b", margin: "0 0 8px" }}>
            <i className="ti ti-alert-circle" style={{ marginRight: 6, verticalAlign: -2 }} />
            Por favor corrija los siguientes errores antes de continuar:
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {validationErrors.map((err, i) => (
              <li key={i} style={{ fontSize: 13, color: "#991b1b", marginBottom: 4 }}>{err}</li>
            ))}
          </ul>
        </div>
      )}

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
          <FormField label="Representante *" value={form.clientRepresentative} onChange={v => setField("clientRepresentative", v)} placeholder="Nombre del representante" />
          <FormField label="Email institucional *" value={form.clientEmail} onChange={v => setField("clientEmail", v)} placeholder="correo@empresa.com" />
          <FormField label="Teléfono / WhatsApp" value={form.clientPhone} onChange={v => setField("clientPhone", v)} placeholder="+1 000 000 0000" />
        </FormSection>

        <div style={{ gridColumn: "1 / -1" }}>
          <FormSection title="Programa Comercial de Exportación">
            <CommercialEngine value={commercialData} onChange={setCommercialData} />
          </FormSection>
        </div>

        {/* Custom product fields — MODULE 3 */}
        {isCustomProduct && (
          <FormSection title="Producto personalizado">
            <FormField label="Nombre del producto *" value={form.customProductName} onChange={v => setField("customProductName", v)} placeholder="Nombre del producto" />
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Descripción breve *</label>
              <textarea value={form.customProductDesc} onChange={e => setField("customProductDesc", e.target.value)} rows={3}
                placeholder="Descripción del producto, especificaciones, características..."
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)", resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <SelectField label="Unidad de medida" value={form.customUnit} onChange={v => setField("customUnit", v)}>
              {CUSTOM_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </SelectField>
            <SelectField label="Sistema de pago aplicable" value={form.customPaymentType} onChange={v => setField("customPaymentType", v)}>
              <option value="TT">Transferencia Bancaria (TT)</option>
              <option value="LC/SBLC">LC / SBLC</option>
              <option value="Otro">Otro</option>
            </SelectField>
          </FormSection>
        )}

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

        {/* Payment selector — MODULE 2 */}
        {(effectiveProduct || form.product) && (
          <FormSection title="Sistema de pago *">
            <PaymentSelector productCategory={effectiveProduct || form.product} onChange={handlePaymentChange} />
          </FormSection>
        )}

        <FormSection title="Términos financieros">
          <FormField label="Validez del documento (días) *" value={form.validityDays} onChange={v => setField("validityDays", v)} type="number" />
          <FormField label="Duración del programa" value={form.programDuration} onChange={v => setField("programDuration", v)} placeholder="5 años" />
        </FormSection>

        {type === "FCO" && (
          <FormSection title="Referencia SCO (opcional)">
            <SelectField label="SCO de origen" value={form.parentId} onChange={v => setField("parentId", v)}>
              <option value="">Nueva FCO sin SCO de referencia</option>
              {availableSCOs.map(s => <option key={s.id} value={s.id}>{s.id} — {s.client}</option>)}
            </SelectField>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>Al seleccionar una SCO, sus datos se cargan automáticamente.</p>
          </FormSection>
        )}

        {/* FCO specific fields — MODULE 4 */}
        {type === "FCO" && (
          <FormSection title="Verificación FCO (obligatorio)">
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 16 }}>
              <input type="checkbox" checked={form.fcoConfirmed} onChange={e => setField("fcoConfirmed", e.target.checked)}
                style={{ width: 16, height: 16, marginTop: 2, cursor: "pointer" }} />
              <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>
                <strong>*</strong> Confirmo que los precios y condiciones han sido verificados y aprobados internamente antes de emitir esta FCO.
              </span>
            </label>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
                Documento de identidad del representante del cliente * <span style={{ fontSize: 11, color: "#6b7280" }}>(PDF/JPG)</span>
              </label>
              <input type="file" ref={clientIdRef} accept="image/*,.pdf"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => setField("clientIdDocB64", ev.target.result);
                  reader.readAsDataURL(file);
                }}
                style={{ display: "none" }} />
              <button type="button" onClick={() => clientIdRef.current.click()}
                style={{ padding: "9px 16px", borderRadius: 8, border: "1px dashed #d1d5db", background: form.clientIdDocB64 ? "#f0fdf4" : "#f9fafb", cursor: "pointer", fontSize: 13, color: form.clientIdDocB64 ? "#166534" : "#6b7280", width: "100%" }}>
                {form.clientIdDocB64 ? "✓ Documento cargado — click para cambiar" : "Click para subir documento de identidad"}
              </button>
            </div>
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

// ─── Operations View ─────────────────────────────────────────────────────────
function OperationsView({ user, setView, showNotif }) {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState("table"); // "table" | "kanban"

  const load = () => {
    setLoading(true);
    api.getOperations().then(setOperations).catch(e => showNotif(e.message, "error")).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const STATUSES = ["DRAFT", "NEGOTIATING", "ACTIVE", "PENDING_DOCS", "SIGNED", "SHIPPED", "COMPLETED", "CANCELLED"];

  const STATUS_COLORS = {
    DRAFT: { bg: "#f3f4f6", text: "#374151" },
    ACTIVE: { bg: "#dcfce7", text: "#166534" },
    NEGOTIATING: { bg: "#dbeafe", text: "#1e40af" },
    PENDING_DOCS: { bg: "#fef3c7", text: "#92400e" },
    SIGNED: { bg: "#ede9fe", text: "#4c1d95" },
    SHIPPED: { bg: "#f0fdf4", text: "#059669" },
    COMPLETED: { bg: "#dcfce7", text: "#166534" },
    CANCELLED: { bg: "#fee2e2", text: "#991b1b" },
  };

  const KanbanBoard = () => (
    <div style={{ display: "flex", flexDirection: "row", overflowX: "auto", gap: 12, paddingBottom: 16, alignItems: "flex-start" }}>
      {STATUSES.map(status => {
        const sc = STATUS_COLORS[status] || { bg: "#f3f4f6", text: "#374151" };
        const colOps = operations.filter(op => op.status === status);
        return (
          <div key={status} style={{ minWidth: 200, maxWidth: 220, flex: "0 0 200px" }}>
            <div style={{ background: sc.bg, borderRadius: "8px 8px 0 0", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `2px solid ${sc.text}33` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: sc.text, letterSpacing: "0.04em" }}>{status}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: sc.text, background: "rgba(255,255,255,0.6)", borderRadius: 20, padding: "1px 7px" }}>{colOps.length}</span>
            </div>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: "0 0 8px 8px", minHeight: 80, padding: 8, display: "flex", flexDirection: "column", gap: 8, border: "0.5px solid var(--color-border-tertiary)", borderTop: "none" }}>
              {colOps.length === 0 && (
                <div style={{ textAlign: "center", padding: "16px 0", color: "var(--color-text-secondary)", fontSize: 11 }}>Sin operaciones</div>
              )}
              {colOps.map(op => {
                const commercial = op.commercial_data ? (typeof op.commercial_data === "string" ? JSON.parse(op.commercial_data) : op.commercial_data) : {};
                const contractValue = commercial?.summary?.contractValue;
                return (
                  <div key={op.id} onClick={() => setView(`op-detail:${op.id}`)}
                    style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, padding: "10px 12px", cursor: "pointer", boxShadow: "none" }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(27,42,74,0.13)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                    <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#1B2A4A", fontWeight: 700, marginBottom: 4 }}>{op.operation_id || op.id}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-primary)", fontWeight: 500, marginBottom: 4, lineHeight: 1.3 }}>{op.counterpart_name || "—"}</div>
                    {contractValue && (
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: commercial.currency || "USD", maximumFractionDigits: 0 }).format(contractValue)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px" }}>Operaciones Comerciales</h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>{operations.length} operaciones registradas</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setViewMode(viewMode === "table" ? "kanban" : "table")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "var(--color-background-primary)", color: "var(--color-text-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            <i className={`ti ${viewMode === "table" ? "ti-layout-columns" : "ti-table"}`} style={{ fontSize: 15 }} />
            {viewMode === "table" ? "Vista Kanban" : "Vista Tabla"}
          </button>
          <button onClick={() => setShowCreate(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
            <i className="ti ti-plus" style={{ fontSize: 16 }} />Nueva Operación
          </button>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : operations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--color-text-secondary)" }}>
          <i className="ti ti-briefcase-off" style={{ fontSize: 48, display: "block", marginBottom: 12, opacity: 0.4 }} />
          <p>No hay operaciones registradas aún.</p>
          <button onClick={() => setShowCreate(true)}
            style={{ marginTop: 12, padding: "9px 20px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>
            Crear primera operación
          </button>
        </div>
      ) : viewMode === "kanban" ? (
        <KanbanBoard />
      ) : (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["ID Operación", "Producto / Categoría", "Contraparte", "Valor Contrato", "Estado", "Agente", "Fecha"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operations.map(op => {
                const sc = STATUS_COLORS[op.status] || STATUS_COLORS.DRAFT;
                const commercial = op.commercial_data ? (typeof op.commercial_data === "string" ? JSON.parse(op.commercial_data) : op.commercial_data) : {};
                return (
                  <tr key={op.id} onClick={() => setView(`op-detail:${op.id}`)} style={{ borderTop: "0.5px solid var(--color-border-tertiary)", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}>
                    <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "#1B2A4A", fontWeight: 600 }}>{op.operation_id || op.id}</td>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-primary)" }}>
                      <span style={{ fontSize: 12 }}>{op.product_name || commercial?.product || "—"}</span>
                      {commercial?.category && <span style={{ display: "block", fontSize: 11, color: "var(--color-text-secondary)" }}>{commercial.category}</span>}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-primary)" }}>{op.counterpart_name || "—"}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                      {commercial?.summary?.contractValue
                        ? new Intl.NumberFormat("en-US", { style: "currency", currency: commercial.currency || "USD", maximumFractionDigits: 0 }).format(commercial.summary.contractValue)
                        : "—"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: sc.bg, color: sc.text, fontWeight: 500 }}>{op.status}</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", fontSize: 12 }}>{op.agent_username || op.created_by}</td>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", fontSize: 12 }}>{op.created_at?.split("T")[0] || op.date || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateOperationModal onClose={() => setShowCreate(false)} onCreated={() => { showNotif("Operación creada"); load(); }} showNotif={showNotif} />}
    </div>
  );
}

function CreateOperationModal({ onClose, onCreated, showNotif }) {
  const [counterpartName, setCounterpartName] = useState("");
  const [counterpartCountry, setCounterpartCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [commercial, setCommercial] = useState({});
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!counterpartName) { showNotif("El nombre de la contraparte es obligatorio.", "error"); return; }
    if (!commercial?.category) { showNotif("Seleccione una categoría de producto.", "error"); return; }
    setSaving(true);
    try {
      await api.createOperation({
        counterpart_name: counterpartName,
        counterpart_country: counterpartCountry,
        notes,
        commercial_data: commercial,
        product_name: commercial?.product || commercial?.category || "",
        origin: counterpartCountry,
        destination: "",
      });
      onCreated();
      onClose();
    } catch (e) {
      showNotif(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "1rem" }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 16, width: "100%", maxWidth: 820, maxHeight: "92vh", overflowY: "auto", padding: "2rem", boxShadow: "0 8px 48px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>Nueva Operación Comercial</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "var(--color-text-secondary)" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Contraparte / Cliente *</label>
            <input value={counterpartName} onChange={e => setCounterpartName(e.target.value)} placeholder="Nombre de empresa o cliente"
              style={{ width: "100%", padding: "8px 11px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>País de destino</label>
            <input value={counterpartCountry} onChange={e => setCounterpartCountry(e.target.value)} placeholder="País"
              style={{ width: "100%", padding: "8px 11px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" }} />
          </div>
        </div>

        <CommercialEngine value={commercial} onChange={setCommercial} />

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Notas internas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notas, instrucciones especiales..."
            style={{ width: "100%", padding: "8px 11px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", resize: "vertical", boxSizing: "border-box" }} />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-primary)" }}>Cancelar</button>
          <button onClick={handleCreate} disabled={saving}
            style={{ padding: "9px 24px", background: saving ? "#6b7280" : "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Creando..." : "Crear Operación"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Operation Detail ─────────────────────────────────────────────────────────
function OperationDetail({ opId, user, setView, showNotif }) {
  const [op, setOp]         = useState(null);
  const [docs, setDocs]     = useState([]);
  const [tasks, setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [modal, setModal]   = useState(null);

  const STATUSES = ["DRAFT","NEGOTIATING","ACTIVE","PENDING_DOCS","SIGNED","SHIPPED","COMPLETED","CANCELLED"];
  const STATUS_COLORS = {
    DRAFT: { bg: "#f3f4f6", text: "#374151" }, ACTIVE: { bg: "#dcfce7", text: "#166534" },
    NEGOTIATING: { bg: "#dbeafe", text: "#1e40af" }, PENDING_DOCS: { bg: "#fef3c7", text: "#92400e" },
    SIGNED: { bg: "#ede9fe", text: "#4c1d95" }, SHIPPED: { bg: "#f0fdf4", text: "#059669" },
    COMPLETED: { bg: "#dcfce7", text: "#166534" }, CANCELLED: { bg: "#fee2e2", text: "#991b1b" },
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getOperation(opId),
      api.getDocs().catch(() => []),
      api.getTasks({ operation_id: opId }).catch(() => []),
    ]).then(([o, allDocs, t]) => {
      setOp(o);
      setDocs(allDocs.filter(d => d.operation_id === opId || d.operation_id === o?.operation_id));
      setTasks(t);
    }).catch(e => showNotif(e.message, "error")).finally(() => setLoading(false));
  }, [opId]);

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      await api.updateOpStatus(opId, newStatus);
      setOp(prev => ({ ...prev, status: newStatus }));
      showNotif(`Estado actualizado: ${newStatus}`);
    } catch (e) { showNotif(e.message, "error"); }
    finally { setUpdatingStatus(false); }
  };

  if (loading) return <LoadingSpinner />;
  if (!op) return <div style={{ color: "var(--color-text-secondary)", padding: "2rem" }}>Operación no encontrada.</div>;

  const commercial = op.commercial_data ? (typeof op.commercial_data === "string" ? JSON.parse(op.commercial_data) : op.commercial_data) : {};
  const sc = STATUS_COLORS[op.status] || STATUS_COLORS.DRAFT;
  const fmtVal = (v, c = "USD") => v ? new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v) : "—";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
        <button onClick={() => setView("operations")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 22 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", margin: 0, fontFamily: "monospace" }}>{op.operation_id || op.id}</h1>
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: sc.bg, color: sc.text, fontWeight: 600 }}>{op.status}</span>
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>
            {op.counterpart_name || "—"} · {commercial?.category || "—"} · Creada {op.created_at?.split("T")[0]}
          </p>
        </div>
        {/* Cambio de estado */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Estado:</label>
          <select value={op.status} onChange={e => handleStatusChange(e.target.value)} disabled={updatingStatus}
            style={{ padding: "6px 10px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", cursor: "pointer" }}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Resumen comercial */}
        <div style={{ background: "linear-gradient(135deg,#1B2A4A 0%,#2d4070 100%)", borderRadius: 12, padding: "1.25rem", color: "#fff" }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, opacity: 0.7, margin: "0 0 12px", textTransform: "uppercase" }}>Resumen Comercial</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Valor Embarque",  value: fmtVal(commercial?.summary?.shipmentValue, commercial?.currency) },
              { label: "Valor Mensual",   value: fmtVal(commercial?.summary?.monthlyValue,  commercial?.currency) },
              { label: "Valor Contrato",  value: fmtVal(commercial?.summary?.contractValue, commercial?.currency), big: true },
              { label: "Duración",        value: commercial?.summary?.durationMonths ? `${commercial.summary.durationMonths} meses` : "—" },
              { label: "Embarques/año",   value: commercial?.summary?.shipmentsPerYear ?? "—" },
              { label: "Incoterm",        value: commercial?.incoterm || "—" },
            ].map(item => (
              <div key={item.label} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px" }}>
                <p style={{ fontSize: 10, opacity: 0.65, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: 0.5 }}>{item.label}</p>
                <p style={{ fontSize: item.big ? 16 : 13, fontWeight: item.big ? 700 : 500, margin: 0 }}>{String(item.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Datos generales */}
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.5 }}>Datos de Operación</p>
          {[
            ["Contraparte",   op.counterpart_name || "—"],
            ["País destino",  op.destination_country || commercial?.destination || "—"],
            ["Categoría",     commercial?.category || "—"],
            ["Producto",      commercial?.product || op.product_name || "—"],
            ["Moneda",        commercial?.currency || "USD"],
            ["Creado por",    op.agent_username || op.created_by || "—"],
            ["Notas",         op.notes || "—"],
          ].map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", maxWidth: 200, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Documentos vinculados */}
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
            <i className="ti ti-files" style={{ fontSize: 16, marginRight: 6, verticalAlign: -2 }} />Documentos vinculados ({docs.length})
          </h3>
          <button onClick={() => setView("new-sco")} style={{ fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>+ Nueva SCO →</button>
        </div>
        {docs.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0, padding: "0.5rem 0" }}>Sin documentos vinculados aún.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["Número", "Tipo", "Cliente", "Valor Ref.", "Estado", "Fecha", ""].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={doc.id} style={{ borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600, fontFamily: "monospace", fontSize: 12, color: "#1B2A4A" }}>{doc.id}</td>
                  <td style={{ padding: "8px 12px" }}><DocTypeBadge type={doc.type} /></td>
                  <td style={{ padding: "8px 12px", color: "var(--color-text-primary)", fontSize: 12 }}>{doc.client}</td>
                  <td style={{ padding: "8px 12px", fontWeight: 500, fontSize: 12, color: "var(--color-text-primary)" }}>{doc.totalValue ? fmt(doc.totalValue) : "—"}</td>
                  <td style={{ padding: "8px 12px" }}><StatusBadge status={doc.status} /></td>
                  <td style={{ padding: "8px 12px", color: "var(--color-text-secondary)", fontSize: 12 }}>{doc.date}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <button onClick={() => setModal(doc)} style={{ background: "none", border: "0.5px solid var(--color-border-secondary)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "var(--color-text-primary)" }}>Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Tareas vinculadas */}
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
            <i className="ti ti-checklist" style={{ fontSize: 16, marginRight: 6, verticalAlign: -2 }} />Tareas vinculadas ({tasks.length})
          </h3>
          <button onClick={() => setView("tasks")} style={{ fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>Ver todas →</button>
        </div>
        {tasks.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0, padding: "0.5rem 0" }}>Sin tareas vinculadas a esta operación.</p>
        ) : tasks.map(task => {
          const PCOL = { low: "#059669", medium: "#d97706", high: "#dc2626", critical: "#9d174d" };
          const SCOL = { pending: "#92400e", in_progress: "#1e40af", review: "#4c1d95", approved: "#166534" };
          return (
            <div key={task.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: PCOL[task.priority] || "#d97706", minWidth: 8 }} />
                <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{task.title}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {task.deadline && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{task.deadline}</span>}
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: SCOL[task.status] || "#374151" }}>{task.status}</span>
              </div>
            </div>
          );
        })}
      </div>

      {modal && <DocPreviewModal doc={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

// ─── Client Detail Modal ──────────────────────────────────────────────────────
function ClientDetailModal({ client, onClose, onSaved, showNotif }) {
  const [form, setForm] = useState({
    name: client.name || "",
    type: client.type || "CLIENT",
    country: client.country || "",
    representative: client.representative || "",
    email: client.email || "",
    phone: client.phone || "",
    tax_id: client.tax_id || "",
    notes: client.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inputSt = { width: "100%", padding: "8px 11px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" };

  const handleSave = async () => {
    if (!form.name) { setError("El nombre es obligatorio."); return; }
    setError(""); setSaving(true);
    try {
      await api.updateClient(client.id, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const TYPE_COLORS = { CLIENT: { bg: "#dbeafe", text: "#1e40af" }, SUPPLIER: { bg: "#dcfce7", text: "#166534" }, PARTNER: { bg: "#ede9fe", text: "#4c1d95" } };
  const tc = TYPE_COLORS[form.type] || { bg: "#f3f4f6", text: "#374151" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "1rem" }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 16, width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto", padding: "2rem", boxShadow: "0 8px 48px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 4px" }}>Detalle / Editar Contraparte</h2>
            <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: tc.bg, color: tc.text, fontWeight: 500 }}>{form.type}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "var(--color-text-secondary)" }}>×</button>
        </div>

        {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>{error}</div>}
        {saved && <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#166534" }}>Cambios guardados correctamente.</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Nombre / Razón social *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Empresa o persona" style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Tipo</label>
            <select value={form.type} onChange={e => set("type", e.target.value)} style={inputSt}>
              <option value="CLIENT">Cliente</option>
              <option value="SUPPLIER">Proveedor</option>
              <option value="PARTNER">Socio Comercial</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>País</label>
            <input value={form.country} onChange={e => set("country", e.target.value)} placeholder="País" style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Representante</label>
            <input value={form.representative} onChange={e => set("representative", e.target.value)} placeholder="Nombre del contacto" style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Email</label>
            <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="correo@empresa.com" style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Teléfono</label>
            <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+1 000 000 0000" style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>NIT / Tax ID</label>
            <input value={form.tax_id} onChange={e => set("tax_id", e.target.value)} placeholder="Identificación fiscal" style={inputSt} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Notas</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} placeholder="Notas adicionales..."
              style={{ ...inputSt, resize: "vertical" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-primary)" }}>Cerrar</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "9px 24px", background: saving ? "#6b7280" : "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clients View ─────────────────────────────────────────────────────────────
function ClientsView({ user, showNotif }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  const load = () => {
    setLoading(true);
    api.getClients().then(setClients).catch(e => showNotif(e.message, "error")).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = clients.filter(c => {
    const matchesText = !filter || c.name?.toLowerCase().includes(filter.toLowerCase()) || c.country?.toLowerCase().includes(filter.toLowerCase()) || c.type?.toLowerCase().includes(filter.toLowerCase());
    const matchesType = !typeFilter || c.type === typeFilter;
    return matchesText && matchesType;
  });

  const TYPE_COLORS = { CLIENT: { bg: "#dbeafe", text: "#1e40af" }, SUPPLIER: { bg: "#dcfce7", text: "#166534" }, PARTNER: { bg: "#ede9fe", text: "#4c1d95" } };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px" }}>Clientes & Contrapartes</h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>{clients.length} contrapartes registradas</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          <i className="ti ti-building-plus" style={{ fontSize: 16 }} />Nueva Contraparte
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar por nombre, país o tipo..."
          style={{ padding: "9px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, width: 300, boxSizing: "border-box", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: "9px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)", cursor: "pointer" }}>
          <option value="">Todos los tipos</option>
          <option value="CLIENT">Cliente</option>
          <option value="SUPPLIER">Proveedor</option>
          <option value="PARTNER">Socio Comercial</option>
        </select>
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--color-text-secondary)" }}>
          <i className="ti ti-building-off" style={{ fontSize: 48, display: "block", marginBottom: 12, opacity: 0.4 }} />
          <p>{filter || typeFilter ? "Sin resultados para la búsqueda." : "No hay contrapartes registradas aún."}</p>
        </div>
      ) : (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["Empresa", "Representante", "País", "Tipo", "Email", "Teléfono", "Estado"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const tc = TYPE_COLORS[c.type] || { bg: "#f3f4f6", text: "#374151" };
                return (
                  <tr key={c.id} onClick={() => setSelectedClient(c)}
                    style={{ borderTop: "0.5px solid var(--color-border-tertiary)", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--color-text-primary)" }}>{c.name}</td>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{c.representative || "—"}</td>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{c.country || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: tc.bg, color: tc.text, fontWeight: 500 }}>{c.type || "CLIENT"}</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", fontSize: 12 }}>{c.email || "—"}</td>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", fontSize: 12 }}>{c.phone || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: c.active !== false ? "#dcfce7" : "#fee2e2", color: c.active !== false ? "#166534" : "#991b1b" }}>
                        {c.active !== false ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} onCreated={() => { showNotif("Contraparte registrada"); load(); }} />}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onSaved={() => load()}
          showNotif={showNotif}
        />
      )}
    </div>
  );
}

function CreateClientModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", type: "CLIENT", country: "", representative: "", email: "", phone: "", tax_id: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inputSt = { width: "100%", padding: "8px 11px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" };

  const handleCreate = async () => {
    if (!form.name) { setError("El nombre es obligatorio."); return; }
    setError(""); setSaving(true);
    try {
      await api.createClient(form);
      onCreated();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "1rem" }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 16, width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", padding: "2rem", boxShadow: "0 8px 48px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>Nueva Contraparte</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "var(--color-text-secondary)" }}>×</button>
        </div>

        {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Nombre / Razón social *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Empresa o persona" style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Tipo</label>
            <select value={form.type} onChange={e => set("type", e.target.value)} style={inputSt}>
              <option value="CLIENT">Cliente</option>
              <option value="SUPPLIER">Proveedor</option>
              <option value="PARTNER">Socio Comercial</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>País</label>
            <input value={form.country} onChange={e => set("country", e.target.value)} placeholder="País" style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Representante</label>
            <input value={form.representative} onChange={e => set("representative", e.target.value)} placeholder="Nombre del contacto" style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Email</label>
            <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="correo@empresa.com" style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Teléfono</label>
            <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+1 000 000 0000" style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>NIT / Tax ID</label>
            <input value={form.tax_id} onChange={e => set("tax_id", e.target.value)} placeholder="Identificación fiscal" style={inputSt} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Notas</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Notas adicionales..."
              style={{ ...inputSt, resize: "vertical" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-primary)" }}>Cancelar</button>
          <button onClick={handleCreate} disabled={saving}
            style={{ padding: "9px 24px", background: saving ? "#6b7280" : "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Guardando..." : "Registrar Contraparte"}
          </button>
        </div>
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

// ─── Image Admin — MODULE 5 ───────────────────────────────────────────────────
function ImageAdmin({ showNotif }) {
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState({});

  useEffect(() => {
    api.getImages()
      .then(rows => {
        const map = {};
        rows.forEach(r => { map[r.key] = r.file_id; });
        setImages(map);
        setEdits(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key) => {
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await api.updateImage(key, edits[key] || "");
      setImages(prev => ({ ...prev, [key]: edits[key] || "" }));
      showNotif(`Imagen "${key}" actualizada.`, "success");
    } catch (e) {
      showNotif(e.message, "error");
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>Administración de Imágenes — Google Drive</h1>
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 16px", marginBottom: "1.5rem", fontSize: 13, color: "#1e40af" }}>
        <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Instrucciones para subir imágenes:</p>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Suba la imagen a Google Drive y configúrela como "Cualquier persona con el enlace puede ver".</li>
          <li>Copie el ID del archivo desde la URL: drive.google.com/file/d/<strong>[ESTE_ID]</strong>/view</li>
          <li>Pegue el ID en el campo correspondiente y haga clic en "Guardar".</li>
        </ol>
      </div>
      {loading ? <LoadingSpinner /> : (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["Preview", "Clave", "Descripción", "File ID de Google Drive", ""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(DRIVE_IMAGES).map(([key, meta]) => {
                const fileId = images[key] || "";
                const editVal = edits[key] !== undefined ? edits[key] : fileId;
                const previewUrl = fileId ? driveUrl(fileId) : null;
                return (
                  <tr key={key} style={{ borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                    <td style={{ padding: "10px 16px", width: 90 }}>
                      {previewUrl ? (
                        <img src={previewUrl} alt={meta.label} style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 6 }} />
                      ) : (
                        <div style={{ width: 80, height: 60, background: "#1B2A4A", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, textAlign: "center", padding: 4 }}>Sin imagen</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>{key}</td>
                    <td style={{ padding: "10px 16px", color: "var(--color-text-secondary)" }}>{meta.label}</td>
                    <td style={{ padding: "10px 16px", minWidth: 240 }}>
                      <input
                        value={editVal}
                        onChange={e => setEdits(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder="Pegar File ID de Google Drive"
                        style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" }}
                      />
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <button onClick={() => handleSave(key)} disabled={saving[key]}
                        style={{ padding: "6px 14px", background: saving[key] ? "#6b7280" : "#1B2A4A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: saving[key] ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                        {saving[key] ? "..." : "Guardar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Doc Preview Modal ────────────────────────────────────────────────────────
function DocPreviewModal({ doc, onClose }) {
  const { agentProfile } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const isChina = doc.destination === "China";

  const handleDownload = async () => {
    setDownloading(true);
    try { await downloadPDF(doc, agentProfile); } catch (e) { console.error(e); }
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
          <InfoBlock label="Sistema de pago" value={doc.paymentOption || doc.payment_option || doc.paymentMethod || "SBLC"} />
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

        {/* Agent signature preview */}
        {agentProfile?.signature_b64 && (
          <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 6px", fontWeight: 600 }}>FIRMA DEL AGENTE</p>
            <img src={agentProfile.signature_b64} alt="Firma" style={{ maxHeight: 50, maxWidth: 160, objectFit: "contain" }} />
            <p style={{ fontSize: 12, fontWeight: 600, color: "#1B2A4A", margin: "4px 0 0" }}>{agentProfile.name}</p>
            {agentProfile.cargo && <p style={{ fontSize: 11, color: "#374151", margin: 0 }}>{agentProfile.cargo} — GLV Global Food Services LLC</p>}
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
