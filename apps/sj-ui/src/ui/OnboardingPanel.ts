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

  if (runtimeInfo?.runtimeMode === "installed-user" && runtimeInfo.cli.bundledInstallerAvailable && !runtimeInfo.cli.installed) {
    actions.push({
      id: "install-cli",
      label: "Install kc",
      detail: `Install ${runtimeInfo.cli.installBinDir} into your normal user flow so Terminal can run kc.`
    });
  }

  if (targetRoot && repoMode === "repo-not-initialized") {
    actions.push({
      id: "init-repo",
      label: "Initialize Repo",
      detail: "Create the repo-local Kiwi control files for this folder without leaving the app."
    });
  }

  const desktopStatus = runtimeInfo
    ? `${describeRuntimeMode(runtimeInfo.runtimeMode)} · ${describeBuildSource(runtimeInfo.buildSource)} · v${runtimeInfo.appVersion}`
    : "Desktop shell is running, but runtime details are still loading.";
  const cliStatus = runtimeInfo?.cli.installed
    ? `Installed at ${runtimeInfo.cli.installedCommandPath ?? runtimeInfo.cli.installBinDir}`
    : runtimeInfo?.runtimeMode === "installed-user"
      ? "Not installed yet. Kiwi can install kc from the app."
      : "Source/developer mode detected. Use the source CLI or install the beta CLI separately if needed.";
  const repoStatus = !targetRoot
    ? "No repo is open yet."
    : repoMode === "repo-not-initialized"
      ? `${targetRoot} needs repo-local initialization before normal work begins.`
      : `${targetRoot} is open in Kiwi Control.`;
  const nextAction = actions[0]?.detail ?? "Repo, CLI, and desktop setup are already aligned.";

  return {
    title: "Get Kiwi Ready",
    intro: "Kiwi stays repo-local. This first-run flow makes the installed desktop and kc CLI behave like one product without a manual terminal setup dance.",
    desktopStatus,
    cliStatus,
    repoStatus,
    nextAction,
    actions,
    note: runtimeInfo?.runtimeMode === "installed-user"
      ? "During beta, kc installed from the desktop depends on the Kiwi Control desktop app remaining installed."
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
