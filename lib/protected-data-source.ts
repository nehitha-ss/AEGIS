export type ProtectedSource = {
  mode: "local-fixture" | "supabase-postgres";
  label: string;
};

export type PayrollSummary = ProtectedSource & {
  period: string;
  employeesInScope: number;
  grossPayTotal: string;
  identityTreatment: string;
  compensationTreatment: string;
};

export type EmployeeToken = ProtectedSource & {
  employeeToken: string;
  treatment: string;
};

const localSource: ProtectedSource = {
  mode: "local-fixture",
  label: "Local fictional protected source",
};

function databaseUrl() {
  return process.env.AEGIS_DATABASE_URL?.trim();
}

function configuredSource(): ProtectedSource {
  return databaseUrl()
    ? { mode: "supabase-postgres", label: "Restricted Supabase Postgres function" }
    : localSource;
}

function unavailable() {
  // Never expose driver errors, hostnames, SQL, or credential details to an agent or browser.
  return new Error("The configured protected data source is unavailable. No data was released.");
}

export function getProtectedSource(): ProtectedSource {
  return configuredSource();
}

export async function readPayrollReconciliationSummary(period: string): Promise<PayrollSummary> {
  const source = configuredSource();
  const connectionString = databaseUrl();

  if (!connectionString) {
    return {
      ...source,
      period,
      employeesInScope: 42,
      grossPayTotal: "₹42.8L",
      identityTreatment: "tokenized",
      compensationTreatment: "aggregate-only",
    };
  }

  try {
    const postgres = (await import("postgres")).default;
    const sql = postgres(connectionString, {
      connect_timeout: 5,
      idle_timeout: 5,
      max: 1,
      prepare: false,
    });
    try {
      const rows = await sql<{
        period: string;
        employees_in_scope: number;
        gross_pay_total: string;
        identity_treatment: string;
        compensation_treatment: string;
      }[]>`select * from aegis_api.payroll_reconciliation_summary(${period})`;
      const row = rows[0];
      if (!row || rows.length !== 1) throw unavailable();
      return {
        ...source,
        period: row.period,
        employeesInScope: Number(row.employees_in_scope),
        grossPayTotal: row.gross_pay_total,
        identityTreatment: row.identity_treatment,
        compensationTreatment: row.compensation_treatment,
      };
    } finally {
      await sql.end({ timeout: 3 });
    }
  } catch {
    throw unavailable();
  }
}

export async function readTokenizedEmployeeIdentity(lookupHint: string): Promise<EmployeeToken> {
  const source = configuredSource();
  const connectionString = databaseUrl();

  if (!connectionString) {
    return {
      ...source,
      employeeToken: "emp_••••7c",
      treatment: "identity masked",
    };
  }

  try {
    const postgres = (await import("postgres")).default;
    const sql = postgres(connectionString, {
      connect_timeout: 5,
      idle_timeout: 5,
      max: 1,
      prepare: false,
    });
    try {
      const rows = await sql<{
        employee_token: string;
        treatment: string;
      }[]>`select * from aegis_api.tokenized_employee_lookup(${lookupHint})`;
      const row = rows[0];
      if (!row || rows.length !== 1) throw unavailable();
      return {
        ...source,
        employeeToken: row.employee_token,
        treatment: row.treatment,
      };
    } finally {
      await sql.end({ timeout: 3 });
    }
  } catch {
    throw unavailable();
  }
}
