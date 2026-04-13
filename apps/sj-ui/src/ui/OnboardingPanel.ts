import type { RenderHelperSet, RepoControlMode } from "./contracts.js";

export type OnboardingActionId = "install-cli" | "choose-repo" | "init-repo" | "setup-machine";

export interface OnboardingPanelRuntimeInfo {
  appVersion: string;
  buildSource: "source-bundle" | "installed-bundle" | "fallback-launcher";
  runtimeMode: "installed-user" | "developer-source";
  cli: {
    bundledInstallerAvailable: boolean;
    bundledNodePath: string | null;
    installBinDir: string;
    installRoot: string;
    installScope: "machine" | "user" | "unknown";
    installed: boolean;
    installedCommandPath: string | null;
    verificationStatus: "passed" | "failed" | "not-run" | "blocked";
    verificationDetail: string;
    verificationCommandPath: string | null;
    requiresNewTerminal: boolean;
  };
}

export interface OnboardingAction {
  id: OnboardingActionId;
  label: string;
  detail: string;
  commandArgs?: string[];
  disabled?: boolean;
}

export interface OnboardingPanelModel {
  title: string;
  intro: string;
  desktopStatus: string;
  cliStatus: string;
  repoStatus: string;
  nextAction: string;
  actions: OnboardingAction[];
  note: string;
}

export function buildOnboardingPanelModel(params: {
  runtimeInfo: OnboardingPanelRuntimeInfo | null;
  platform: "macos" | "windows" | "linux";
  targetRoot: string;
  repoMode: RepoControlMode;
  machineSetup?: {
    needsAttention: boolean;
    recommendedProfile: "desktop-only" | "desktop-plus-cli";
    detail: string;
  } | null;
}): OnboardingPanelModel | null {
  const { runtimeInfo, platform, targetRoot, repoMode, machineSetup } = params;
  const shouldShow = !targetRoot
    || repoMode === "repo-not-initialized"
    || (runtimeInfo?.runtimeMode === "installed-user" && !runtimeInfo.cli.installed && (platform === "windows" || runtimeInfo.cli.verificationStatus !== "not-run"))
    || Boolean(machineSetup?.needsAttention && targetRoot);

  if (!shouldShow) {
    return null;
  }

  const actions: OnboardingAction[] = [];
  if (!targetRoot) {
    actions.push({
      id: "choose-repo",
      label: "Choose Repo",
      detail: "Pick the folder you want Kiwi Control to open and inspect."
    });
  }

  if (targetRoot && repoMode === "repo-not-initialized") {
    actions.push({
      id: "init-repo",
      label: "Initialize this repo",
      detail: "Create the repo-local Kiwi files for this folder, then start working from the app."
    });
  }

  if (targetRoot && machineSetup?.needsAttention) {
    actions.push({
      id: "setup-machine",
      label: "Set up this machine",
      detail: machineSetup.detail,
      commandArgs: ["--profile", machineSetup.recommendedProfile]
    });
  }

  if (
    runtimeInfo?.runtimeMode === "installed-user"
    && runtimeInfo.cli.bundledInstallerAvailable
    && !runtimeInfo.cli.installed
    && (platform === "windows" || runtimeInfo.cli.verificationStatus !== "not-run")
  ) {
    actions.push({
      id: "install-cli",
      label: platform === "windows" ? "Enable terminal commands now" : "Retry terminal command setup",
      detail: platform === "windows"
        ? "Windows setup should normally finish terminal command setup during install. Run the built-in repair step now if a fresh terminal still cannot find kc."
        : `Kiwi could not finish the default ${runtimeInfo.cli.installScope === "machine" ? "system-wide" : "user"} terminal command setup. Retry kc install via ${runtimeInfo.cli.installBinDir}.`
    });
  }

  const desktopStatus = runtimeInfo
    ? `${describeRuntimeMode(runtimeInfo.runtimeMode)} · ${describeBuildSource(runtimeInfo.buildSource)} · v${runtimeInfo.appVersion}`
    : "Desktop shell is running, but runtime details are still loading.";
  const cliStatus = runtimeInfo?.cli.installed
    ? runtimeInfo.cli.verificationStatus === "passed"
      ? platform === "windows"
        ? `${runtimeInfo.cli.installScope === "machine" ? "Enabled during Windows setup" : "Enabled for this user during Windows setup"} · ${runtimeInfo.cli.requiresNewTerminal ? "open a new terminal" : "verified"}`
        : `${runtimeInfo.cli.installScope === "machine" ? "Enabled after desktop setup" : "Enabled for this user after desktop setup"} · ${runtimeInfo.cli.requiresNewTerminal ? "open a new terminal" : "verified"}`
      : `Installed at ${runtimeInfo.cli.installedCommandPath ?? runtimeInfo.cli.installBinDir} · ${runtimeInfo.cli.verificationDetail}`
    : runtimeInfo?.runtimeMode === "installed-user"
      ? platform === "windows"
        ? "Windows setup should normally finish terminal command setup before the first app launch. If a fresh terminal still cannot find kc, use the built-in repair step."
        : runtimeInfo.cli.verificationStatus === "not-run"
          ? "Kiwi auto-attempts terminal command setup on first launch for installed macOS desktop builds and records whether fresh-shell verification succeeds."
          : `Default terminal command setup did not complete. ${runtimeInfo.cli.verificationDetail}`
      : "Source/developer mode detected. Desktop use still works without a separate installed kc.";
  const repoStatus = !targetRoot
    ? "No repo is open yet."
    : repoMode === "repo-not-initialized"
      ? `${targetRoot} needs repo-local initialization before normal work begins.`
      : `${targetRoot} is open in Kiwi Control.`;
  const nextAction = actions[0]?.detail ?? "Repo, CLI, and desktop setup are already aligned.";

  return {
    title: "Start in the app",
    intro: platform === "windows"
      ? "Open Kiwi Control, choose a repo, initialize it if needed, and work. Windows installs are prepared to make kc available in a fresh terminal after setup, but real Windows-host proof is still pending. If blocked, the app can repair terminal command setup."
      : "Open Kiwi Control, choose a repo, initialize it if needed, and work. Installed macOS desktop builds auto-attempt terminal command setup on first launch, and that default CLI path is already proven for current wording.",
    desktopStatus,
    cliStatus,
    repoStatus,
    nextAction,
    actions,
    note: runtimeInfo?.runtimeMode === "installed-user"
      ? platform === "windows"
        ? "Desktop-first is still the default path. Windows setup EXE remains the primary path, and Kiwi keeps a one-click repair step visible until real Windows-host proof is complete."
        : "Desktop-first is still the default path. Kiwi auto-attempts kc setup on first launch for installed macOS builds, and the app still shows exact retry/remediation steps if that path is blocked."
      : "Developer/source mode keeps the source checkout in control of desktop launching."
  };
}

export function renderOnboardingPanelView(
  model: OnboardingPanelModel,
  helpers: Pick<RenderHelperSet, "escapeHtml" | "renderPanelHeader" | "renderNoteRow">
): string {
  const { escapeHtml, renderPanelHeader, renderNoteRow } = helpers;

  return `
    <section class="kc-panel kc-panel-primary" data-render-section="onboarding">
      ${renderPanelHeader(model.title, model.intro)}
      <div class="kc-two-column">
        <section class="kc-subpanel">
          <div class="kc-stack-list">
            ${renderNoteRow("Desktop", "Status", model.desktopStatus)}
            ${renderNoteRow("CLI", "Status", model.cliStatus)}
            ${renderNoteRow("Repo", "Status", model.repoStatus)}
            ${renderNoteRow("Next", "Action", model.nextAction)}
          </div>
        </section>
        <section class="kc-subpanel">
          <div class="kc-stack-list">
            ${model.actions.length > 0
              ? model.actions.map((action) => `
                  <div class="kc-note-row">
                    <div>
                      <strong>${escapeHtml(action.label)}</strong>
                      <span>${escapeHtml(action.detail)}</span>
                    </div>
                    <button class="kc-secondary-button" type="button" data-onboarding-action="${escapeHtml(action.id)}" ${action.commandArgs ? `data-onboarding-command-args="${escapeHtml(JSON.stringify(action.commandArgs))}"` : ""} ${action.disabled ? "disabled" : ""}>${escapeHtml(action.label)}</button>
                  </div>
                `).join("")
              : renderNoteRow("Ready", "No setup steps left", model.note)}
          </div>
        </section>
      </div>
      <p class="kc-section-note">${escapeHtml(model.note)}</p>
    </section>
  `;
}

function describeRuntimeMode(mode: OnboardingPanelRuntimeInfo["runtimeMode"]): string {
  return mode === "installed-user" ? "Installed user mode" : "Developer source mode";
}

function describeBuildSource(source: OnboardingPanelRuntimeInfo["buildSource"]): string {
  switch (source) {
    case "installed-bundle":
      return "installed app";
    case "source-bundle":
      return "source bundle";
    default:
      return "fallback launcher";
  }
}
