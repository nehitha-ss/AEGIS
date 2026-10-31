// A public website address, never a connection key or owner credential.
export const financeOrigin = (process.env.NEXT_PUBLIC_NORTHSTAR_URL || "http://localhost:8000").replace(/\/$/, "");
export const financeDemoLink = `${financeOrigin}/demo/open`;
