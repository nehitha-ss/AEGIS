# AEGIS local MCP server

This is the narrow tool surface used to connect a local Codex session to the AEGIS demo. It does not contain database credentials, and it cannot reach a company system directly. AEGIS owns any optional server-only connection to the fictional Supabase Postgres source.

Start the AEGIS dashboard first with `npm run dev`. The MCP server then forwards each tool call to the local AEGIS gateway at `http://[::1]:5173` by default.

The server exposes only three tools:

- `read_finance_reconciliation_summary` — AEGIS returns aggregate-only finance data.
- `search_employee_identity` — AEGIS applies PRISM privacy-budget controls.
- `attempt_payroll_database_deletion` — AEGIS denies the attempt before any system call is released.

To register it with Codex on this computer:

```powershell
codex mcp add aegis-demo --env "AEGIS_GATEWAY_URL=http://[::1]:5173" -- node "C:\\Users\\6EIN\\aegis-agent-security\\mcp\\aegis-server.mjs"
```

Confirm the connection with:

```powershell
codex mcp list
```

Restart Codex or create a new Codex task after registering the server so the tool list refreshes. See `../supabase/README.md` only when you are ready to replace the local protected fixture with a fictional Supabase Postgres source. This is a fictional local demonstration environment only.
