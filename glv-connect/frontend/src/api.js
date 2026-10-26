const BASE = import.meta.env.VITE_API_URL || "https://misaelvalencia-production.up.railway.app";

// Authentication is exclusively via httpOnly cookie set by the server.
// No token is stored in localStorage or sent in headers from the browser.
async function request(method, path, body, signal) {
  const headers = { "Content-Type": "application/json" };

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new Error("Error de red");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Error de red");
  }
  return res.json();
}

export const api = {
  // Auth
  login:          (username, password) => request("POST", "/auth/login", { username, password }),
  logout:         () => request("POST", "/auth/logout"),
  me:             () => request("GET", "/auth/me"),
  changePassword: (data) => request("POST", "/auth/change-password", data),
  forgotPassword: (email) => request("POST", "/auth/forgot-password", { email }),
  resetPassword:  (token, newPassword) => request("POST", "/auth/reset-password", { token, newPassword }),

  // Documents
  getDocs:      (type) => request("GET", `/documents${type ? `?type=${type}` : ""}`),
  getDoc:       (id)   => request("GET", `/documents/${id}`),
  createDoc:    (data) => request("POST", "/documents", data),
  updateStatus: (id, status) => request("PATCH", `/documents/${id}/status`, { status }),
  deleteDoc:    (id) => request("DELETE", `/documents/${id}`),

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

  // GOS Leads (KYC pipeline — Sprint 1.5)
  getLeads:            (params = {}) => { const q = new URLSearchParams(params).toString(); return request("GET", `/clients/leads${q ? `?${q}` : ""}`); },
  getClientKycData:    (id)          => request("GET",   `/clients/${id}/kyc-data`),
  updateKycStatus:     (id, data)    => request("PATCH", `/clients/${id}/kyc-status`, data),
  archiveClient:       (id)          => request("PATCH", `/clients/${id}/archive`),
  deleteLead:          (id)          => request("DELETE", `/clients/${id}`),
  updateLifecycle:     (id, data)    => request("PATCH", `/clients/${id}/lifecycle`, data),
  getLifecycleHistory: (id)          => request("GET",   `/clients/${id}/lifecycle-history`),

  // Client Documents (GOS-04)
  getClientDocuments:   (id)         => request("GET",    `/clients/${id}/documents`),
  deleteClientDocument: (id, docId)  => request("DELETE", `/clients/${id}/documents/${docId}`),
  getClientDocumentUrl: (id, docId)  => request("GET",    `/clients/${id}/documents/${docId}/url`),
  uploadClientDocument: (id, formData) => {
    return fetch(`${BASE}/clients/${id}/documents/upload`, {
      method: "POST",
      credentials: "include",
      body: formData,
    }).then(async r => {
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || r.statusText);
      return json;
    });
  },

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
  adminCreatePcProduct:    (data)       => request("POST",   "/price-center/products", data),
  adminUpdatePcProduct:    (id, data)   => request("PATCH",  `/price-center/products/${id}`, data),
  adminArchivePcProduct:   (id)         => request("DELETE", `/price-center/products/${id}`),
  adminRestorePcProduct:   (id)         => request("POST",   `/price-center/products/${id}/restore`),
  adminDuplicatePcProduct: (id)         => request("POST",   `/price-center/products/${id}/duplicate`),
  adminBulkPcProducts:     (data)       => request("POST",   "/price-center/products/bulk", data),
  getPcPriceHistory:       (id)         => request("GET",    `/price-center/products/${id}/price-history`),
  adminCreatePcCategory:   (data)       => request("POST",   "/price-center/categories", data),
  adminUpdatePcCategory:   (id, data)   => request("PATCH",  `/price-center/categories/${id}`, data),
  adminCreatePcBreed:      (data)       => request("POST",   "/price-center/breeds", data),

  // ─── Media Center ─────────────────────────────────────────────────────────────
  getMedia:            (params = {}, signal) => {
    const qs = new URLSearchParams(params).toString();
    return request("GET", `/media${qs ? "?" + qs : ""}`, undefined, signal);
  },
  getMediaItem:        (id) => request("GET", `/media/${id}`),
  uploadMedia:         (formData) => {
    return fetch(`${BASE}/media/upload`, {
      method: "POST",
      credentials: "include",
      body: formData,
    }).then(r => r.json());
  },
  updateMedia:         (id, data) => request("PATCH",  `/media/${id}`, data),
  deleteMedia:         (id)       => request("DELETE", `/media/${id}`),
  restoreMedia:        (id)       => request("POST",   `/media/${id}/restore`),
  archiveMedia:        (id)       => request("POST",   `/media/${id}/archive`),
  purgeMedia:          (id)       => request("DELETE", `/media/${id}/purge`),
  getMediaMatch:       (category, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request("GET", `/media/match/${category}${qs ? "?" + qs : ""}`);
  },
  getMediaCategories:   () => request("GET",  "/media/categories"),
  getR2Status:          () => request("GET",  "/media/r2-status"),
  pingR2:               () => request("GET",  "/media/r2-ping"),
  reconcileMedia:       () => request("POST", "/media/reconcile"),
  reconcileMediaStatus: () => request("GET",  "/media/reconcile/status"),
  bindMedia:            (params) => request("POST", "/media/bind", params),

  // ─── GOS-06J Catalogs ────────────────────────────────────────────────────────
  getCatalogCountries:       ()           => request("GET",  "/clients/catalog/countries"),
  getCatalogEntityTypes:     ()           => request("GET",  "/clients/catalog/entity-types"),
  getCatalogProducts:        ()           => request("GET",  "/clients/catalog/products"),
  getCatalogDocCategories:   ()           => request("GET",  "/clients/catalog/document-categories"),
  getCatalogDocTypes:        (params={})  => { const q = new URLSearchParams(params).toString(); return request("GET", `/clients/catalog/document-types${q?"?"+q:""}`); },
  createCatalogDocType:      (data)       => request("POST", "/clients/catalog/document-types", data),

  // ─── GOS-06J Country Intelligence ────────────────────────────────────────────
  getClientCountries:    (id)       => request("GET",    `/clients/${id}/countries`),
  addClientCountry:      (id, data) => request("POST",   `/clients/${id}/countries`, data),
  removeClientCountry:   (id, relId)=> request("DELETE", `/clients/${id}/countries/${relId}`),

  // ─── GOS-06J Entity Types ─────────────────────────────────────────────────────
  getClientEntityTypes:  (id)       => request("GET",    `/clients/${id}/entity-types`),
  addClientEntityType:   (id, data) => request("POST",   `/clients/${id}/entity-types`, data),
  removeClientEntityType:(id, relId)=> request("DELETE", `/clients/${id}/entity-types/${relId}`),

  // ─── GOS-06J Product Intelligence ────────────────────────────────────────────
  getClientProducts:     (id)       => request("GET",    `/clients/${id}/products`),
  addClientProduct:      (id, data) => request("POST",   `/clients/${id}/products`, data),
  removeClientProduct:   (id, relId)=> request("DELETE", `/clients/${id}/products/${relId}`),

  // ─── GOS-06J Timeline ────────────────────────────────────────────────────────
  getClientTimeline:     (id, params={}) => { const q = new URLSearchParams(params).toString(); return request("GET", `/clients/${id}/timeline${q?"?"+q:""}`); },
  addClientTimelineEvent:(id, data)      => request("POST", `/clients/${id}/timeline`, data),

  // ─── GOS-06J Relationships ────────────────────────────────────────────────────
  getClientRelationships:   (id)        => request("GET",    `/clients/${id}/relationships`),
  addClientRelationship:    (id, data)  => request("POST",   `/clients/${id}/relationships`, data),
  removeClientRelationship: (id, relId) => request("DELETE", `/clients/${id}/relationships/${relId}`),

  // ─── GOS-06J Notes ───────────────────────────────────────────────────────────
  getClientNotes:    (id)            => request("GET",    `/clients/${id}/notes`),
  addClientNote:     (id, data)      => request("POST",   `/clients/${id}/notes`, data),
  updateClientNote:  (id, nId, data) => request("PATCH",  `/clients/${id}/notes/${nId}`, data),
  deleteClientNote:  (id, nId)       => request("DELETE", `/clients/${id}/notes/${nId}`),

  // ─── Commercial Workspace ─────────────────────────────────────────────────────
  getCommercialMatrix:      (params={}) => { const q=new URLSearchParams(params).toString(); return request("GET", `/commercial/price-matrix${q?"?"+q:""}`); },
  createCommercialMatrix:   (data)      => request("POST",  "/commercial/price-matrix", data),
  updateCommercialMatrix:   (id, data)  => request("PATCH", `/commercial/price-matrix/${id}`, data),
  getCommercialRules:       (params={}) => { const q=new URLSearchParams(params).toString(); return request("GET", `/commercial/rules${q?"?"+q:""}`); },
  createCommercialRule:     (data)      => request("POST",  "/commercial/rules", data),
  updateCommercialRule:     (id, data)  => request("PATCH", `/commercial/rules/${id}`, data),
  getCommercialQuotes:      (params={}) => { const q=new URLSearchParams(params).toString(); return request("GET", `/commercial/quotes${q?"?"+q:""}`); },
  getCommercialQuote:       (id)        => request("GET",   `/commercial/quotes/${id}`),
  createCommercialQuote:    (data)      => request("POST",  "/commercial/quotes", data),
  calculateCommercialQuote: (id)        => request("POST",  `/commercial/quotes/${id}/calculate`),
  submitCommercialQuote:    (id)        => request("POST",  `/commercial/quotes/${id}/submit`),
  approveCommercialQuote:   (id, data)  => request("POST",  `/commercial/quotes/${id}/approve`, data),
  rejectCommercialQuote:    (id, data)  => request("POST",  `/commercial/quotes/${id}/reject`, data),
  linkCommercialDocument:   (id, data)  => request("POST",  `/commercial/quotes/${id}/link-document`, data),

  // ─── Operations & Logistics ───────────────────────────────────────────────────
  getLogisticsProviders:    (params={}) => { const q=new URLSearchParams(params).toString(); return request("GET", `/operations-logistics/providers${q?"?"+q:""}`); },
  createLogisticsProvider:  (data)      => request("POST",  "/operations-logistics/providers", data),
  updateLogisticsProvider:  (id, data)  => request("PATCH", `/operations-logistics/providers/${id}`, data),
  getOpPorts:               ()          => request("GET",   "/operations-logistics/ports"),
  getLogisticsOps:          (params={}) => { const q=new URLSearchParams(params).toString(); return request("GET", `/operations-logistics${q?"?"+q:""}`); },
  getLogisticsOp:           (id)        => request("GET",   `/operations-logistics/${id}`),
  createLogisticsOp:        (data)      => request("POST",  "/operations-logistics", data),
  updateLogisticsOp:        (id, data)  => request("PATCH", `/operations-logistics/${id}`, data),
  changeLogisticsOpStatus:  (id, data)  => request("PATCH", `/operations-logistics/${id}/status`, data),
  upsertLogisticsVoyage:    (id, data)  => request("POST",  `/operations-logistics/${id}/voyage`, data),
  addLogisticsContainer:    (id, data)  => request("POST",  `/operations-logistics/${id}/containers`, data),
  updateLogisticsContainer: (id,cid,d)  => request("PATCH", `/operations-logistics/${id}/containers/${cid}`, d),
  addLogisticsMilestone:    (id, data)  => request("POST",  `/operations-logistics/${id}/milestones`, data),
  updateLogisticsMilestone: (id,mid,d)  => request("PATCH", `/operations-logistics/${id}/milestones/${mid}`, d),
  reportLogisticsIncident:  (id, data)  => request("POST",  `/operations-logistics/${id}/incidents`, data),
  updateLogisticsIncident:  (id,iid,d)  => request("PATCH", `/operations-logistics/${id}/incidents/${iid}`, d),
  assignLogisticsProvider:  (id, data)  => request("POST",  `/operations-logistics/${id}/assignments`, data),
  getLogisticsDashboard:    ()          => request("GET",   "/operations-logistics/dashboard/summary"),

  // ─── Cargo Intelligence ───────────────────────────────────────────────────────
  getCargoEquipmentProfiles: ()               => request("GET",  "/cargo-intelligence/equipment-profiles"),
  getCargoTypes:             ()               => request("GET",  "/cargo-intelligence/cargo-types"),
  getCargoCalculations:      (p={})           => { const q=new URLSearchParams(p).toString(); return request("GET",`/cargo-intelligence/calculations${q?"?"+q:""}`); },
  getCargoCalculation:       (id)             => request("GET",  `/cargo-intelligence/calculations/${id}`),
  createCargoCalculation:    (data)           => request("POST", "/cargo-intelligence/calculations", data),
  updateCargoCalculation:    (id, data)       => request("PUT",  `/cargo-intelligence/calculations/${id}`, data),
  computeCargoCalculation:   (id)             => request("POST", `/cargo-intelligence/calculations/${id}/compute`),
  confirmCargoCalculation:   (id)             => request("POST", `/cargo-intelligence/calculations/${id}/confirm`),
  newCargoVersion:           (id)             => request("POST", `/cargo-intelligence/calculations/${id}/new-version`),
  getCargoCalculationPlacements: (id)         => request("GET",  `/cargo-intelligence/calculations/${id}/placements`),
};
