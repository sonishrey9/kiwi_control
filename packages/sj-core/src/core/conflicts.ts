export interface InstructionSource {
  path: string;
  content: string;
}

export interface InstructionConflict {
  severity: "warn" | "error";
  topic: "machine-local-state" | "generated-outputs" | "sync-policy" | "global-config";
  message: string;
  paths: string[];
}

interface SignalSet {
  path: string;
  machineLocalState?: "reference-only" | "allowed";
  generatedOutputs?: "derived" | "authoritative";
  syncPolicy?: "additive" | "replace";
  globalConfig?: "forbidden" | "allowed";
}

export function detectInstructionConflicts(sources: InstructionSource[]): InstructionConflict[] {
  const signals = sources.map(extractSignals);
  const conflicts: InstructionConflict[] = [];

  pushConflict(
    conflicts,
    "machine-local-state",
    "instruction surfaces disagree about whether machine-local state is portable authority",
    signals,
    (signal) => signal.machineLocalState
  );
  pushConflict(
    conflicts,
    "generated-outputs",
    "instruction surfaces disagree about whether generated outputs are derived or authoritative",
    signals,
    (signal) => signal.generatedOutputs
  );
  pushConflict(
    conflicts,
    "sync-policy",
    "instruction surfaces disagree about additive sync versus destructive replacement",
    signals,
    (signal) => signal.syncPolicy
  );
  pushConflict(
    conflicts,
    "global-config",
    "instruction surfaces disagree about whether global tool config can be modified",
    signals,
    (signal) => signal.globalConfig
  );

  return conflicts;
}

function extractSignals(source: InstructionSource): SignalSet {
  const content = source.content.toLowerCase();
  const machineLocalState = inferMachineLocalState(content);
  const generatedOutputs = inferGeneratedOutputs(content);
  const syncPolicy = inferSyncPolicy(content);
  const globalConfig = inferGlobalConfig(content);
  return {
    path: source.path,
    ...(machineLocalState ? { machineLocalState } : {}),
    ...(generatedOutputs ? { generatedOutputs } : {}),
    ...(syncPolicy ? { syncPolicy } : {}),
    ...(globalConfig ? { globalConfig } : {})
  };
}

function inferMachineLocalState(content: string): SignalSet["machineLocalState"] {
  if (
    /machine_local_state_is_reference_only:\s*true/.test(content) ||
    /machine-local.*reference[- ]only/.test(content) ||
    /do not rely on machine-local/.test(content)
  ) {
    return "reference-only";
  }

  if (
    /machine_local_state_is_reference_only:\s*false/.test(content) ||
    /machine-local.*source of truth/.test(content)
  ) {
    return "allowed";
  }

  return undefined;
}

function inferGeneratedOutputs(content: string): SignalSet["generatedOutputs"] {
  if (
    /generated_outputs_are_derived:\s*true/.test(content) ||
    /generated outputs.*derived/.test(content)
  ) {
    return "derived";
  }

  if (
    /generated_outputs_are_derived:\s*false/.test(content) ||
    /generated outputs.*authorit/.test(content)
  ) {
    return "authoritative";
  }

  return undefined;
}

function inferSyncPolicy(content: string): SignalSet["syncPolicy"] {
  if (
    /additive_sync_only:\s*true/.test(content) ||
    /prefer additive changes/.test(content) ||
    /append a managed block/.test(content)
  ) {
    return "additive";
  }

  if (
    /additive_sync_only:\s*false/.test(content) ||
    /overwrite existing guidance/.test(content) ||
    /replace the file/.test(content)
  ) {
    return "replace";
  }

  return undefined;
}

function inferGlobalConfig(content: string): SignalSet["globalConfig"] {
  if (
    /global_config_changes_allowed:\s*false/.test(content) ||
    /do not change global tool settings/.test(content) ||
    /do not edit ~\/\.claude/.test(content) ||
    /do not edit ~\/\.codex/.test(content)
  ) {
    return "forbidden";
  }

  if (
    /global_config_changes_allowed:\s*true/.test(content) ||
    /modify global tool settings/.test(content)
  ) {
    return "allowed";
  }

  return undefined;
}

function pushConflict(
  conflicts: InstructionConflict[],
  topic: InstructionConflict["topic"],
  message: string,
  signals: SignalSet[],
  selector: (signal: SignalSet) => string | undefined
): void {
  const observed = signals
    .map((signal) => ({ path: signal.path, value: selector(signal) }))
    .filter((entry): entry is { path: string; value: string } => Boolean(entry.value));
  const distinctValues = [...new Set(observed.map((entry) => entry.value))];
  if (distinctValues.length <= 1) {
    return;
  }

  conflicts.push({
    severity: "warn",
    topic,
    message,
    paths: observed.map((entry) => entry.path)
  });
}
