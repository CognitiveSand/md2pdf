/**
 * Minimal W3C WebDriver HTTP client.
 *
 * Covers only the endpoints needed for headless PDF rendering:
 * session management, navigation, script execution, and the Print command.
 * Uses Node 20 built-in fetch — no external dependency.
 */

const FETCH_TIMEOUT_MS = 10_000;
const PRINT_TIMEOUT_MS = 60_000;

function base(port: number): string {
  return `http://127.0.0.1:${port}`;
}

async function wd(
  port: number,
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<unknown> {
  const res = await fetch(`${base(port)}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const json = (await res.json()) as { value: unknown };

  if (!res.ok) {
    const msg =
      typeof json.value === 'object' && json.value !== null && 'message' in json.value
        ? String((json.value as { message: unknown }).message)
        : `HTTP ${res.status}`;
    throw new Error(`WebDriver ${method} ${path}: ${msg}`);
  }

  return json.value;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function newSession(
  port: number,
  capabilities: unknown,
): Promise<string> {
  const value = (await wd(port, 'POST', '/session', { capabilities })) as {
    sessionId: string;
  };
  return value.sessionId;
}

export async function deleteSession(port: number, sessionId: string): Promise<void> {
  await wd(port, 'DELETE', `/session/${sessionId}`);
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export async function navigateTo(
  port: number,
  sessionId: string,
  url: string,
): Promise<void> {
  await wd(port, 'POST', `/session/${sessionId}/url`, { url });
}

// ---------------------------------------------------------------------------
// Script execution
// ---------------------------------------------------------------------------

export async function executeScript<T>(
  port: number,
  sessionId: string,
  script: string,
  args: unknown[] = [],
): Promise<T> {
  return (await wd(port, 'POST', `/session/${sessionId}/execute/sync`, {
    script,
    args,
  })) as T;
}

// ---------------------------------------------------------------------------
// Print (PDF)
// ---------------------------------------------------------------------------

export interface PrintOptions {
  /** Page dimensions in cm. Defaults to A4. */
  page?: { width: number; height: number };
  /** Margins in cm. */
  margin?: { top: number; bottom: number; left: number; right: number };
  /** Include CSS backgrounds. */
  background?: boolean;
  shrinkToFit?: boolean;
}

const A4 = { width: 21.0, height: 29.7 };
const DEFAULT_MARGIN = { top: 2.0, bottom: 2.0, left: 2.5, right: 2.5 };

export async function printPage(
  port: number,
  sessionId: string,
  options: PrintOptions = {},
): Promise<Buffer> {
  const params = {
    page: options.page ?? A4,
    margin: options.margin ?? DEFAULT_MARGIN,
    background: options.background ?? true,
    shrinkToFit: options.shrinkToFit ?? true,
  };

  const b64 = (await wd(
    port,
    'POST',
    `/session/${sessionId}/print`,
    params,
    PRINT_TIMEOUT_MS,
  )) as string;

  return Buffer.from(b64, 'base64');
}

// ---------------------------------------------------------------------------
// Driver readiness probe
// ---------------------------------------------------------------------------

export async function waitForDriverReady(
  port: number,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base(port)}/status`, {
        signal: AbortSignal.timeout(500),
      });
      if (res.ok) return;
    } catch {
      // not ready yet — keep polling
    }
    await new Promise<void>(r => setTimeout(r, 50));
  }
  throw new Error(`WebDriver on port ${port} did not become ready within ${timeoutMs} ms`);
}
