import type { RenderHelperSet, RepoControlMode } from "./contracts.js";

export type OnboardingActionId = "install-cli" | "choose-repo" | "init-repo";

export interface OnboardingPanelRuntimeInfo {
  appVersion: string;
  buildSource: "source-bundle" | "installed-bundle" | "fallback-launcher";
  runtimeMode: "installed-user" | "developer-source";
  cli: {
    bundledInstallerAvailable: boolean;
    bundledNodePath: string | null;
    installBinDir: string;
    installed: boolean;
    installedCommandPath: string | null;
  };
}

export interface OnboardingAction {
  id: OnboardingActionId;
  label: string;
  detail: string;
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
  targetRoot: string;
  repoMode: RepoControlMode;
}): OnboardingPanelModel | null {
  const { runtimeInfo, targetRoot, repoMode } = params;
  const shouldShow = !targetRoot
    || repoMode === "repo-not-initialized"
    || (runtimeInfo?.runtimeMode === "installed-user" && !runtimeInfo.cli.installed);

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

  if (targetRoot && runtimeInfo?.runtimeMode === "installed-user" && runtimeInfo.cli.bundledInstallerAvailable && !runtimeInfo.cli.installed) {
    actions.push({
      id: "install-cli",
      label: "Install kc (optional)",
      detail: `Add kc to ${runtimeInfo.cli.installBinDir} if you want the power-user terminal path too.`
    });
  }

  const desktopStatus = runtimeInfo
    ? `${describeRuntimeMode(runtimeInfo.runtimeMode)} · ${describeBuildSource(runtimeInfo.buildSource)} · v${runtimeInfo.appVersion}`
    : "Desktop shell is running, but runtime details are still loading.";
  const cliStatus = runtimeInfo?.cli.installed
    ? `Installed at ${runtimeInfo.cli.installedCommandPath ?? runtimeInfo.cli.installBinDir}`
    : runtimeInfo?.runtimeMode === "installed-user"
      ? "Optional. Kiwi can install kc from the app if you want terminal access."
      : "Source/developer mode detected. Desktop use still works without a separate installed kc.";
  const repoStatus = !targetRoot
    ? "No repo is open yet."
    : repoMode === "repo-not-initialized"
      ? `${targetRoot} needs repo-local initialization before normal work begins.`
      : `${targetRoot} is open in Kiwi Control.`;
  const nextAction = actions[0]?.detail ?? "Repo, CLI, and desktop setup are already aligned.";

  return {
    title: "Start in the app",
    intro: "Open Kiwi Control, choose a repo, initialize it if needed, and work. kc is optional and only needed if you also want the terminal path.",
    desktopStatus,
    cliStatus,
    repoStatus,
    nextAction,
    actions,
    note: runtimeInfo?.runtimeMode === "installed-user"
      ? "Desktop-first is the default path. Install kc only if you want the same repo flow from Terminal."
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
                    <button class="kc-secondary-button" type="button" data-onboarding-action="${escapeHtml(action.id)}" ${action.disabled ? "disabled" : ""}>${escapeHtml(action.label)}</button>
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
