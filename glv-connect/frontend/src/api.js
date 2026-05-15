const BASE = import.meta.env.VITE_API_URL || "https://misaelvalencia-production.up.railway.app";

function getToken() {
  return localStorage.getItem("glv_token");
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Error de red");
  }
  return res.json();
}

export const api = {
  login: (username, password) => request("POST", "/auth/login", { username, password }),
  me: () => request("GET", "/auth/me"),

  getDocs: (type) => request("GET", `/documents${type ? `?type=${type}` : ""}`),
  getDoc: (id) => request("GET", `/documents/${id}`),
  createDoc: (data) => request("POST", "/documents", data),
  updateStatus: (id, status) => request("PATCH", `/documents/${id}/status`, { status }),

  getAudit: (limit = 200) => request("GET", `/audit?limit=${limit}`),
  getUsers: () => request("GET", "/users"),
};
