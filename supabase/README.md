# Connect a fictional Supabase database to AEGIS

This optional setup changes the protected-read demo from a local fixture to a real Supabase Postgres function. It is intentionally fictional Northstar Logistics data only.

## What AEGIS receives

The AEGIS server receives one server-only connection string for the restricted `aegis_gateway` database role. That role has no table privileges. It can execute only these narrowed functions:

- `aegis_api.payroll_reconciliation_summary(period)` returns an aggregate payroll total.
- `aegis_api.tokenized_employee_lookup(hint)` returns a token, never a legal name, tax ID, or bank account.

Codex, the MCP server, the browser, and Git never receive this connection string.

## Setup

1. Create a new Supabase project for this fictional demo. Do not use a company or production project.
2. In Supabase **SQL Editor**, run `migrations/202609250001_aegis_protected_demo.sql`.
3. In a second SQL Editor query, set a long unique password that you keep private:

   ```sql
   alter role aegis_gateway password 'your-new-random-password';
   ```

4. Copy `.env.example` to `.env.local`. Replace the example value with a direct Postgres connection URL for the `aegis_gateway` role. Use the host and SSL settings shown in the project’s **Connect** panel.
5. Restart `npm run dev`, then run **Run protected read**. The dashboard changes from **LOCAL AEGIS GATEWAY** to **RESTRICTED SUPABASE POSTGRES** after a successful read.

If the database is unavailable or misconfigured, AEGIS returns no result and exposes no connection or SQL error to the agent.

## Security boundary

The protected tables contain intentionally fictional raw fields to prove that the gateway does not retrieve them. RLS and revoked table grants are defense in depth. AEGIS still evaluates its own policy before it calls either function, and it masks or denies the result before returning it to an agent.
