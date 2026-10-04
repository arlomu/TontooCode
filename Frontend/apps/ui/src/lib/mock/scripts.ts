import type { ToolName } from '@/types';

/**
 * A canned agent answer, expressed as an ordered list of stream steps.
 *
 * The mock transport compiles these steps into real Vercel-AI-protocol
 * chunks (reasoning deltas, tool-input deltas, tool outputs, text deltas),
 * so the UI exercises exactly the same code paths as with a live backend.
 */
export type MockStep =
  | { kind: 'reasoning'; text: string }
    | {
      kind: 'tool';
      name: ToolName;
      input: unknown;
      output?: string;
      error?: string;
      /** simulated execution time window [minMs, maxMs] */
      runMs?: [number, number];
    }
  | { kind: 'text'; markdown: string };

export interface MockScenario {
  id: string;
  match: (userText: string) => boolean;
  steps: MockStep[];
}

const has = (re: RegExp) => (t: string) => re.test(t);

export const SCENARIOS: MockScenario[] = [
  {
    id: 'error-case',
    match: has(/fehlerfall|scheitern|error-demo|kaputtmachen/i),
    steps: [
      {
        kind: 'reasoning',
        text: 'Der Nutzer will einen Fehlerfall sehen. Ich versuche, eine Datei zu lesen, die nicht existiert — das Tool meldet ENOENT zurück.',
      },
      {
        kind: 'tool',
        name: 'read_file',
        input: { path: 'apps/ui/src/nowhere.ts' },
        error: 'ENOENT: apps/ui/src/nowhere.ts — file is outside the workspace root',
        runMs: [500, 900],
      },
      {
        kind: 'text',
        markdown:
          'Der Leseversuch ist **fehlgeschlagen** — die Datei liegt außerhalb der Workspace-Root, deshalb verweigert das Tool den Zugriff.\n\nSo sieht ein Tool-Fehler in der Timeline aus: roter Marker, einklappbare Fehlermeldung, und ich mache trotzdem mit einer Antwort weiter statt abzubrechen.',
      },
    ],
  },
  {
    id: 'delegate',
    match: has(/deleg|subagent|recherch|research|parallel|zusammenfass/i),
    steps: [
      {
        kind: 'reasoning',
        text: 'Das ist eine Aufgabe für zwei Spezialisten. Der Researcher liest sich ein, der Coder baut den Patch — beide laufen in eigenen Runs mit eigenem Verlauf, ich bekomme nur ihre Ergebnisse zurück.',
      },
      {
        kind: 'tool',
        name: 'delegate_task',
        input: {
          agent: 'researcher',
          task: 'Recherchiere, wie SQLite-Checkpoints in LangGraph serialisiert werden. Liefere 3 Kernfakten mit Quellen.',
        },
        output:
          '1. Checkpoints werden als serialisierte State-Snapshots pro Thread abgelegt (MsgPack/JSON + Blobs).\n2. Jeder Super-Step schreibt einen neuen Checkpoint; Pending-Writes erlauben Resume ohne Re-Run.\n3. Retention-Policies sind Pflicht — sonst wächst der Store pro Konversation unbegrenzt.',
        runMs: [1400, 2200],
      },
      {
        kind: 'tool',
        name: 'delegate_task',
        input: {
          agent: 'coder',
          task: 'Baue einen Retention-Job, der Checkpoints älter als 30 Tage löscht. Python, mit Dry-Run-Flag.',
        },
        output:
          'Patch bereit (2 Hunks): `jobs/prune_checkpoints.py` + CLI-Flag `--dry-run`. Trockenlauf über 1.204 Rows: 312 Kandidaten, 0 gelöscht.',
        runMs: [1200, 2000],
      },
      {
        kind: 'text',
        markdown:
          'Beide Delegationen sind zurück:\n\n- **researcher** → 3 Kernfakten zur Checkpoint-Serialisierung (eigene History, sehe ich nicht im Detail)\n- **coder** → `prune_checkpoints.py` mit Dry-Run, 312 Lösch-Kandidaten gefunden\n\nJede Karte oben ist ein Subagent mit eigenem Run. In der Timeline erkennst du sie am `delegate`-Badge.',
      },
    ],
  },
  {
    id: 'terminal',
    match: has(/terminal|test|pytest|npm|build|command|laufen lass/i),
    steps: [
      {
        kind: 'reasoning',
        text: 'Testlauf im Frontend-Workspace. Ich nehme den kurzen Quiet-Modus, damit die Ausgabe lesbar bleibt.',
      },
      {
        kind: 'tool',
        name: 'run_terminal',
        input: { command: 'pnpm --filter @tontoocode/ui typecheck', cwd: '~/tontoocode/Frontend' },
        output:
          '$ pnpm --filter @tontoocode/ui typecheck\n> tsc -b --noEmit\n\n✓ 0 errors, 0 warnings — 41 files checked in 1.9s',
        runMs: [1500, 2400],
      },
      {
        kind: 'text',
        markdown:
          'Typecheck ist **grün**: 41 Dateien, keine Fehler. Der Befehl lief in der Sandbox mit Workspace-Root als CWD — alles außerhalb wäre blockiert worden.',
      },
    ],
  },
  {
    id: 'code-fix',
    match: has(/code|fix|bug|datei|file|fehler|refactor|login/i),
    steps: [
      {
        kind: 'reasoning',
        text: 'Login-Bug. Bevor ich etwas anfasse, lese ich die Session-Implementation und suche alle Stellen, die den Refresh-Token anfassen. Erst verstehen, dann patchen.',
      },
      {
        kind: 'tool',
        name: 'read_file',
        input: { path: 'src/auth/session.py', limit: 60 },
        output:
          '1  from datetime import datetime, timedelta, timezone\n2  import jwt\n3\n4  def issue_tokens(user_id: str) -> tuple[str, str]:\n5      now = datetime.now(timezone.utc)\n6      access = jwt.encode({"sub": user_id, "exp": now + timedelta(minutes=15)}, SECRET)\n7      refresh = jwt.encode({"sub": user_id, "exp": now + timedelta(days=30)}, SECRET)\n8      return access, refresh\n9\n10 def refresh_session(refresh: str) -> str:\n11     payload = jwt.decode(refresh, SECRET, algorithms=["HS256"])\n12     if payload["exp"] < datetime.now(timezone.utc).timestamp():\n13         raise SessionExpired("refresh token expired")\n14     return issue_tokens(payload["sub"])[0]',
        runMs: [600, 1100],
      },
      {
        kind: 'tool',
        name: 'grep',
        input: { pattern: 'refresh_session', path: 'src/auth' },
        output:
          'src/auth/session.py:10:  def refresh_session(refresh: str) -> str:\nsrc/auth/routes.py:42:   token = refresh_session(body.refresh_token)\nsrc/api/middleware.py:87:  # TODO: refresh_session wirft SessionExpired ohne Retry',
        runMs: [400, 800],
      },
      {
        kind: 'text',
        markdown:
          'Gefunden. Zwei Stellen arbeiten zusammen:\n\n1. **`session.py:12`** vergleicht `payload["exp"]` (Sekunden) mit `datetime.now(timezone.utc).timestamp()` — das ist korrekt, aber…\n2. **`middleware.py:87`** fängt `SessionExpired` nirgends ab — der Request stirbt mit 500 statt 401.\n\n```python\n# middleware.py — Fix: 401 statt 500\ntry:\n    token = refresh_session(body.refresh_token)\nexcept SessionExpired:\n    raise HTTPException(status_code=401, detail="session expired")\n```\n\nSoll ich den Patch anwenden? Das wäre ein `delegate_task` an den **coder**.',
      },
    ],
  },
  {
    id: 'default',
    match: () => true,
    steps: [
      {
        kind: 'reasoning',
        text: 'Keine Spezial-Tools nötig. Kurze Antwort, ehrlich zum Mock-Status — der Nutzer soll wissen, dass hier noch kein echtes Backend antwortet.',
      },
      {
        kind: 'text',
        markdown:
          'Verstanden! Ich antworte gerade aus dem **Mock-Modus** — es ist noch kein Python-Backend verbunden, deshalb siehst du hier eine Beispiel-Antwort.\n\nProbier mal eine dieser Demo-Routen, um die Timeline zu sehen:\n\n- `Fix den Login-Bug` → Datei lesen, suchen, Code-Antwort\n- `Lass die Tests laufen` → Terminal-Tool mit Ausgabe\n- `Recherchiere Checkpoints und fasse zusammen` → zwei Subagenten\n- `Zeig mir einen Fehlerfall` → roter Tool-Fehler mit Recovery',
      },
    ],
  },
];

export function pickScenario(userText: string): MockScenario {
  return SCENARIOS.find((s) => s.match(userText)) ?? SCENARIOS[SCENARIOS.length - 1]!;
}
