import spawn from "cross-spawn";

export type RunResult = { code: number; stdout: string; stderr: string };
export type Runner = (cmd: string, args: string[], opts?: { cwd?: string }) => Promise<RunResult>;

export const run: Runner = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on("error", () => resolve({ code: 127, stdout, stderr: `comando não encontrado: ${cmd}` }));
  });
