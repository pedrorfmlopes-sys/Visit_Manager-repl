import assert from "node:assert/strict";
import test from "node:test";
import {
  getEmpresaLicensedModules,
  isEmpresaLicenseActive,
  resolveEmpresaModules,
} from "../../shared/modules";

test("enterprise license exposes configured modules", () => {
  const company = {
    licensePlan: "enterprise",
    licenseStatus: "active",
    licenseExpiresAt: null,
    crmLeadsEnabled: true,
    odooCrmEnabled: true,
    odooContactsFeatureEnabled: true,
    odooContactsAdminEnabled: true,
    odooContactsAgentsEnabled: false,
    crmVisitsOdooSyncEnabled: true,
    uiSettings: { ia: { aiEnabled: true } },
  };

  assert.equal(isEmpresaLicenseActive(company), true);
  assert.deepEqual(resolveEmpresaModules(company, "admin"), {
    core_crm: true,
    leads: true,
    odoo: true,
    odoo_contacts: true,
    odoo_visits_sync: true,
    ai: true,
  });
});

test("plan is a ceiling even when company flags are enabled", () => {
  const company = {
    licensePlan: "base",
    licenseStatus: "active",
    odooCrmEnabled: true,
    crmLeadsEnabled: true,
    uiSettings: { ia: { aiEnabled: true } },
  };

  assert.deepEqual([...getEmpresaLicensedModules(company)], ["core_crm"]);
  assert.deepEqual(resolveEmpresaModules(company, "admin"), {
    core_crm: true,
    leads: false,
    odoo: false,
    odoo_contacts: false,
    odoo_visits_sync: false,
    ai: false,
  });
});

test("expired or suspended licenses disable every module", () => {
  for (const company of [
    {
      licensePlan: "enterprise",
      licenseStatus: "suspended",
    },
    {
      licensePlan: "enterprise",
      licenseStatus: "active",
      licenseExpiresAt: new Date(Date.now() - 1_000),
    },
  ]) {
    assert.equal(isEmpresaLicenseActive(company), false);
    assert.equal(resolveEmpresaModules(company, "admin").core_crm, false);
  }
});
