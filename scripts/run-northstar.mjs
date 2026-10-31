import { spawn } from "node:child_process";
process.loadEnvFile(".env.northstar.local");
const python =
  process.env.NORTHSTAR_PYTHON ||
  (process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python");
const child = spawn(
  python,
  [
    "-m",
    "uvicorn",
    "northstar.app:app",
    "--app-dir",
    "python",
    "--host",
    "127.0.0.1",
    "--port",
    "8000",
  ],
  { stdio: "inherit", env: process.env },
);
child.on("error", () => {
  console.error(
    "Python launch failed. Create .venv and install python/requirements.txt and python/connector.",
  );
  process.exitCode = 1;
});
child.on("exit", (code) => (process.exitCode = code ?? 1));
process.on("SIGINT", () => child.kill("SIGINT"));
