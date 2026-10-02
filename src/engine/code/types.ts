/** Formas de los resultados de los runners (compartidas por el navegador, el servidor y las pruebas). */

export interface ProcResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly truncated: boolean;
}

export interface CRunResponse {
  readonly compile: { readonly ok: boolean; readonly output: string };
  readonly runs: readonly ProcResult[];
}

/** Lo que regresa el arnés de Python (`__cortex_run`), ya decodificado. */
export interface HarnessResult {
  readonly ok: boolean;
  readonly error: string | null;
  readonly stdout: string;
  readonly results: readonly ({ readonly ok: true; readonly value: string } | { readonly ok: false; readonly error: string })[];
}
