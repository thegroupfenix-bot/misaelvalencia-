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
  // Auth
  login:          (username, password) => request("POST", "/auth/login", { username, password }),
  me:             () => request("GET", "/auth/me"),
  changePassword: (data) => request("POST", "/auth/change-password", data),

  // Documents
  getDocs:      (type) => request("GET", `/documents${type ? `?type=${type}` : ""}`),
  getDoc:       (id)   => request("GET", `/documents/${id}`),
  createDoc:    (data) => request("POST", "/documents", data),
  updateStatus: (id, status) => request("PATCH", `/documents/${id}/status`, { status }),

  // Audit
  getAudit: (limit = 200) => request("GET", `/audit?limit=${limit}`),

  // Users (legacy list)
  getUsers: () => request("GET", "/users"),

  // Profile
  getProfile:    () => request("GET", "/profile/me"),
  updateProfile: (data) => request("PUT", "/profile/me", data),

  // Images
  getImages:    () => request("GET", "/images"),
  updateImage:  (key, fileId) => request("PUT", `/images/${key}`, { fileId }),

  // Admin — user management (SUPER_ADMIN, CORPORATE_ADMIN)
  adminGetUsers:    ()          => request("GET",   "/admin/users"),
  adminCreateUser:  (data)      => request("POST",  "/admin/users", data),
  adminUpdateUser:  (id, data)  => request("PATCH", `/admin/users/${id}`, data),
  adminResetPwd:    (id, pwd)   => request("POST",  `/admin/users/${id}/reset-password`, { temporary_password: pwd }),
  adminGetRoles:    ()          => request("GET",   "/admin/roles"),
  adminDeleteUser:  (id)        => request("DELETE", `/admin/users/${id}`),

  // Clients
  getClients:   (type)   => request("GET",  `/clients${type ? `?type=${type}` : ""}`),
  getClient:    (id)     => request("GET",  `/clients/${id}`),
  createClient: (data)   => request("POST", "/clients", data),
  updateClient: (id, data) => request("PUT", `/clients/${id}`, data),

  // Operations
  getOperations:   (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/operations${q ? `?${q}` : ""}`);
  },
  getOperation:    (id)         => request("GET",   `/operations/${id}`),
  createOperation: (data)       => request("POST",  "/operations", data),
  updateOpStatus:  (id, status) => request("PATCH", `/operations/${id}/status`, { status }),

  // Finance (Phase 7)
  getFinanceSummary:   () => request("GET", "/finance/summary"),
  getFinanceInvoices:  () => request("GET", "/finance/invoices"),
  getFinanceByCountry: () => request("GET", "/finance/by-country"),

  // Tasks / Quality ISO (Phase 8)
  getTasks:   (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/tasks${q ? `?${q}` : ""}`);
  },
  createTask: (data)     => request("POST",   "/tasks", data),
  updateTask: (id, data) => request("PATCH",  `/tasks/${id}`, data),
  deleteTask: (id)       => request("DELETE", `/tasks/${id}`),

  // Price Center
  getPcCategories:       ()           => request("GET",    "/price-center/categories"),
  getPcProducts:         (params = {}) => { const q = new URLSearchParams(params).toString(); return request("GET", `/price-center/products${q ? `?${q}` : ""}`); },
  getPcProduct:          (id)          => request("GET",    `/price-center/products/${id}`),
  getPcBreeds:           (species)     => request("GET",    `/price-center/breeds${species ? `?species=${species}` : ""}`),
  adminCreatePcProduct:  (data)        => request("POST",   "/price-center/products", data),
  adminUpdatePcProduct:  (id, data)    => request("PATCH",  `/price-center/products/${id}`, data),
  adminDeletePcProduct:  (id)          => request("DELETE", `/price-center/products/${id}`),
  adminCreatePcCategory: (data)        => request("POST",   "/price-center/categories", data),
  adminUpdatePcCategory: (id, data)    => request("PATCH",  `/price-center/categories/${id}`, data),
  adminCreatePcBreed:    (data)        => request("POST",   "/price-center/breeds", data),

  // ─── Media Center ─────────────────────────────────────────────────────────────
  getMedia:            (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request("GET", `/media${qs ? "?" + qs : ""}`);
  },
  getMediaItem:        (id) => request("GET", `/media/${id}`),
  uploadMedia:         (formData) => {
    const token = localStorage.getItem("glv_token");
    return fetch(`${BASE}/media/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(r => r.json());
  },
  updateMedia:         (id, data) => request("PATCH", `/media/${id}`, data),
  deleteMedia:         (id) => request("DELETE", `/media/${id}`),
  getMediaMatch:       (category, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request("GET", `/media/match/${category}${qs ? "?" + qs : ""}`);
  },
  getMediaCategories:  () => request("GET", "/media/categories"),
  getR2Status:         () => request("GET", "/media/r2-status"),
  pingR2:              () => request("GET", "/media/r2-ping"),
};
