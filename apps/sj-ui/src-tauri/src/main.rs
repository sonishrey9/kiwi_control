#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

const DESKTOP_LAUNCH_EVENT: &str = "desktop-launch-request";
const DESKTOP_WINDOW_LABEL: &str = "main";
const DESKTOP_APP_NAME: &str = "Kiwi Control";
const DESKTOP_APP_BUNDLE_ID: &str = "com.kiwicontrol.desktop";
const BRIDGE_UNAVAILABLE_NEXT_STEP: &str = "Confirm kiwi-control works in Terminal, then run kc ui again.";

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLaunchRequest {
    request_id: String,
    target_root: String,
    requested_at: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLaunchPayload {
    request_id: String,
    target_root: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLaunchStatus {
    request_id: String,
    target_root: String,
    state: String,
    detail: String,
    reported_at: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLaunchLogEntry {
    event: String,
    reported_at: String,
    request_id: Option<String>,
    target_root: Option<String>,
    detail: Option<String>,
}

#[derive(Default)]
struct LaunchBridgeState {
    pending_request: Mutex<Option<DesktopLaunchRequest>>,
    last_seen_request_id: Mutex<Option<String>>,
}

#[tauri::command]
fn load_repo_control_state(target_root: String) -> Result<serde_json::Value, String> {
    append_launch_log(&DesktopLaunchLogEntry {
        event: String::from("desktop-repo-state-requested"),
        reported_at: timestamp_now(),
        request_id: None,
        target_root: Some(target_root.clone()),
        detail: None,
    })
    .ok();

    let output = run_cli_command(&target_root).map_err(|error| {
        let detail = format!("failed to invoke Kiwi Control CLI: {error}");
        append_launch_log(&DesktopLaunchLogEntry {
            event: String::from("desktop-repo-state-failed"),
            reported_at: timestamp_now(),
            request_id: None,
            target_root: Some(target_root.clone()),
            detail: Some(detail.clone()),
        })
        .ok();
        detail
    })?;

    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        append_launch_log(&DesktopLaunchLogEntry {
            event: String::from("desktop-repo-state-failed"),
            reported_at: timestamp_now(),
            request_id: None,
            target_root: Some(target_root.clone()),
            detail: Some(detail.clone()),
        })
        .ok();
        return Err(detail);
    }

    let parsed = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("invalid CLI json payload: {error}"))?;

    append_launch_log(&DesktopLaunchLogEntry {
        event: String::from("desktop-repo-state-ready"),
        reported_at: timestamp_now(),
        request_id: None,
        target_root: Some(target_root),
        detail: None,
    })
    .ok();

    Ok(parsed)
}

#[tauri::command]
fn consume_initial_launch_request(state: State<LaunchBridgeState>) -> Result<Option<DesktopLaunchPayload>, String> {
    let mut pending_request = state
        .pending_request
        .lock()
        .map_err(|_| String::from("failed to lock pending desktop launch request"))?;

    Ok(pending_request.take().map(|request| DesktopLaunchPayload::from(&request)))
}

#[tauri::command]
fn ack_launch_request(
    app: AppHandle,
    state: State<LaunchBridgeState>,
    request_id: String,
    target_root: String,
    status: String,
    detail: Option<String>,
) -> Result<(), String> {
    let trimmed_status = status.trim();
    if trimmed_status != "ready" && trimmed_status != "error" {
        return Err(format!("unsupported desktop launch status: {trimmed_status}"));
    }

    let launch_status = DesktopLaunchStatus {
        request_id: request_id.clone(),
        target_root: target_root.clone(),
        state: trimmed_status.to_string(),
        detail: detail.unwrap_or_else(|| {
            if trimmed_status == "ready" {
                format!("Loaded repo-local state for {target_root}.")
            } else {
                BRIDGE_UNAVAILABLE_NEXT_STEP.to_string()
            }
        }),
        reported_at: timestamp_now(),
    };

    write_launch_status(&launch_status)?;
    append_launch_log(&DesktopLaunchLogEntry {
        event: if trimmed_status == "ready" {
            String::from("desktop-ready-acknowledged")
        } else {
            String::from("desktop-error-acknowledged")
        },
        reported_at: timestamp_now(),
        request_id: Some(request_id.clone()),
        target_root: Some(target_root.clone()),
        detail: Some(launch_status.detail.clone()),
    })?;

    clear_pending_request_if_matching(&state, &request_id)?;

    if trimmed_status == "ready" {
        let app_handle = app.clone();
        let ready_request_id = request_id.clone();
        let ready_target_root = target_root.clone();
        thread::spawn(move || {
            if let Err(error) = focus_main_window(&app_handle) {
                let _ = append_launch_log(&DesktopLaunchLogEntry {
                    event: String::from("desktop-ready-focus-failed"),
                    reported_at: timestamp_now(),
                    request_id: Some(ready_request_id),
                    target_root: Some(ready_target_root),
                    detail: Some(error),
                });
            } else {
                let _ = append_launch_log(&DesktopLaunchLogEntry {
                    event: String::from("desktop-ready-focus-complete"),
                    reported_at: timestamp_now(),
                    request_id: Some(ready_request_id),
                    target_root: Some(ready_target_root),
                    detail: None,
                });
            }
        });
    }

    Ok(())
}

#[allow(non_snake_case)]
#[tauri::command]
fn append_ui_launch_log(
    event: String,
    requestId: Option<String>,
    targetRoot: Option<String>,
    detail: Option<String>,
) -> Result<(), String> {
    append_launch_log(&DesktopLaunchLogEntry {
        event,
        reported_at: timestamp_now(),
        request_id: requestId,
        target_root: targetRoot,
        detail,
    })
}

fn main() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Ok(Some(request)) = read_launch_request() {
                let _ = handle_launch_request(app, request, "single-instance", true);
            }
        }));
    }

    builder
        .manage(LaunchBridgeState::default())
        .setup(|app| {
            if let Err(error) = ensure_main_window(app.handle()) {
                let _ = append_launch_log(&DesktopLaunchLogEntry {
                    event: String::from("desktop-window-ensure-failed"),
                    reported_at: timestamp_now(),
                    request_id: None,
                    target_root: None,
                    detail: Some(error.clone()),
                });
                return Err(error.into());
            }

            let _ = append_launch_log(&DesktopLaunchLogEntry {
                event: String::from("desktop-startup"),
                reported_at: timestamp_now(),
                request_id: None,
                target_root: None,
                detail: None,
            });

            match read_launch_request() {
                Ok(Some(request)) => {
                    if let Err(error) = handle_launch_request(app.handle(), request.clone(), "startup", false) {
                        let _ = append_launch_log(&DesktopLaunchLogEntry {
                            event: String::from("desktop-startup-request-failed"),
                            reported_at: timestamp_now(),
                            request_id: Some(request.request_id),
                            target_root: Some(request.target_root),
                            detail: Some(error),
                        });
                    }
                }
                Ok(None) => {
                    let _ = append_launch_log(&DesktopLaunchLogEntry {
                        event: String::from("desktop-startup-no-request"),
                        reported_at: timestamp_now(),
                        request_id: None,
                        target_root: None,
                        detail: None,
                    });
                }
                Err(error) => {
                    let _ = append_launch_log(&DesktopLaunchLogEntry {
                        event: String::from("desktop-startup-read-failed"),
                        reported_at: timestamp_now(),
                        request_id: None,
                        target_root: None,
                        detail: Some(error),
                    });
                }
            }

            start_launch_request_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            consume_initial_launch_request,
            load_repo_control_state,
            ack_launch_request,
            append_ui_launch_log
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Kiwi Control desktop");
}

fn handle_launch_request(
    app: &AppHandle,
    request: DesktopLaunchRequest,
    origin: &str,
    emit_event: bool,
) -> Result<(), String> {
    let launch_payload = DesktopLaunchPayload::from(&request);
    store_pending_request(app, request.clone())?;
    if emit_event {
        if let Err(error) = focus_main_window(app) {
            let _ = append_launch_log(&DesktopLaunchLogEntry {
                event: String::from("desktop-focus-failed"),
                reported_at: timestamp_now(),
                request_id: Some(request.request_id.clone()),
                target_root: Some(request.target_root.clone()),
                detail: Some(error.clone()),
            });

            return Err(error);
        }
    }
    append_launch_log(&DesktopLaunchLogEntry {
        event: String::from("desktop-request-observed"),
        reported_at: timestamp_now(),
        request_id: Some(request.request_id.clone()),
        target_root: Some(request.target_root.clone()),
        detail: Some(format!("origin={origin}")),
    })?;

    if emit_event {
        let window = app
            .get_webview_window(DESKTOP_WINDOW_LABEL)
            .ok_or_else(|| String::from("failed to find the Kiwi Control desktop window for retargeting"))?;

        window.emit(DESKTOP_LAUNCH_EVENT, launch_payload).map_err(|error| {
            let _ = append_launch_log(&DesktopLaunchLogEntry {
                event: String::from("desktop-event-emit-failed"),
                reported_at: timestamp_now(),
                request_id: Some(request.request_id.clone()),
                target_root: Some(request.target_root.clone()),
                detail: Some(error.to_string()),
            });
            error
        })
        .map_err(|error| format!("failed to emit desktop launch event: {error}"))?;
    }

    Ok(())
}

fn store_pending_request(app: &AppHandle, request: DesktopLaunchRequest) -> Result<(), String> {
    {
        let state = app.state::<LaunchBridgeState>();
        let mut pending_request = state
            .pending_request
            .lock()
            .map_err(|_| String::from("failed to lock pending desktop launch request"))?;
        *pending_request = Some(request.clone());
    }

    mark_request_seen(app, &request.request_id)
}

fn clear_pending_request_if_matching(state: &State<LaunchBridgeState>, request_id: &str) -> Result<(), String> {
    let mut pending_request = state
        .pending_request
        .lock()
        .map_err(|_| String::from("failed to lock pending desktop launch request"))?;

    if pending_request
        .as_ref()
        .map(|request| request.request_id.as_str() == request_id)
        .unwrap_or(false)
    {
        *pending_request = None;
    }

    Ok(())
}

fn mark_request_seen(app: &AppHandle, request_id: &str) -> Result<(), String> {
    let state = app.state::<LaunchBridgeState>();
    let mut last_seen_request_id = state
        .last_seen_request_id
        .lock()
        .map_err(|_| String::from("failed to lock desktop launch watcher state"))?;
    *last_seen_request_id = Some(request_id.to_string());
    Ok(())
}

fn start_launch_request_watcher(app: AppHandle) {
    thread::spawn(move || loop {
        if let Ok(Some(request)) = read_launch_request() {
            let should_emit = match app.state::<LaunchBridgeState>().last_seen_request_id.lock() {
                Ok(last_seen_request_id) => last_seen_request_id
                    .as_ref()
                    .map(|seen_request_id| seen_request_id != &request.request_id)
                    .unwrap_or(true),
                Err(_) => false,
            };

            if should_emit {
                let _ = handle_launch_request(&app, request, "watcher", true);
            }
        }

        thread::sleep(Duration::from_millis(200));
    });
}

fn focus_main_window(app: &AppHandle) -> Result<(), String> {
    ensure_main_window(app)?;

    let window = app
        .get_webview_window(DESKTOP_WINDOW_LABEL)
        .ok_or_else(|| String::from("failed to find the Kiwi Control desktop window"))?;

    window
        .show()
        .map_err(|error| format!("failed to show the Kiwi Control desktop window: {error}"))?;

    if window
        .is_minimized()
        .map_err(|error| format!("failed to inspect desktop window state: {error}"))?
    {
        window
            .unminimize()
            .map_err(|error| format!("failed to restore the Kiwi Control desktop window: {error}"))?;
    }

    window
        .set_focus()
        .map_err(|error| format!("failed to focus the Kiwi Control desktop window: {error}"))?;

    activate_app_on_macos()?;
    Ok(())
}

fn ensure_main_window(app: &AppHandle) -> Result<(), String> {
    if app.get_webview_window(DESKTOP_WINDOW_LABEL).is_some() {
        return Ok(());
    }

    WebviewWindowBuilder::new(app, DESKTOP_WINDOW_LABEL, WebviewUrl::App("index.html".into()))
        .title(DESKTOP_APP_NAME)
        .inner_size(1320.0, 920.0)
        .resizable(true)
        .build()
        .map(|_| ())
        .map_err(|error| format!("failed to create the Kiwi Control desktop window: {error}"))
}

#[cfg(target_os = "macos")]
fn activate_app_on_macos() -> Result<(), String> {
    let by_bundle_id = Command::new("osascript")
        .arg("-e")
        .arg(format!(r#"tell application id "{DESKTOP_APP_BUNDLE_ID}" to activate"#))
        .status();

    match by_bundle_id {
        Ok(status) if status.success() => Ok(()),
        _ => {
            let fallback = Command::new("osascript")
                .arg("-e")
                .arg(format!(r#"tell application "{DESKTOP_APP_NAME}" to activate"#))
                .status()
                .map_err(|error| format!("failed to activate Kiwi Control on macOS: {error}"))?;

            if fallback.success() {
                Ok(())
            } else {
                Err(String::from("failed to activate Kiwi Control on macOS"))
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn activate_app_on_macos() -> Result<(), String> {
    Ok(())
}

fn run_cli_command(target_root: &str) -> Result<std::process::Output, std::io::Error> {
    for cli_env in ["KIWI_CONTROL_CLI", "SHREY_JUNIOR_CLI"] {
        if let Ok(value) = std::env::var(cli_env) {
            if value.trim().is_empty() {
                continue;
            }
            return build_cli_process(&value, target_root).output();
        }
    }

    if let Some(script_path) = resolve_source_cli_script() {
        if let Some(node_binary) = resolve_node_binary() {
            return Command::new(node_binary)
                .arg(script_path)
                .arg("ui")
                .arg("--target")
                .arg(target_root)
                .arg("--json")
                .output();
        }
    }

    for cli_path in resolve_installed_cli_paths() {
        if !cli_path.exists() {
            continue;
        }

        match Command::new(&cli_path)
            .arg("ui")
            .arg("--target")
            .arg(target_root)
            .arg("--json")
            .output()
        {
            Ok(output) => return Ok(output),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => return Err(error),
        }
    }

    for binary_name in ["kiwi-control", "kc", "shrey-junior", "sj"] {
        match Command::new(binary_name)
            .arg("ui")
            .arg("--target")
            .arg(target_root)
            .arg("--json")
            .output()
        {
            Ok(output) => return Ok(output),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => return Err(error),
        }
    }

    Command::new("kiwi-control")
        .arg("ui")
        .arg("--target")
        .arg(target_root)
        .arg("--json")
        .output()
}

fn build_cli_process(cli_value: &str, target_root: &str) -> Command {
    if cli_value.ends_with(".js")
        || PathBuf::from(cli_value)
            .extension()
            .map(|extension| extension == "js")
            .unwrap_or(false)
    {
        let node_binary = resolve_node_binary().unwrap_or_else(|| PathBuf::from("node"));
        let mut command = Command::new(node_binary);
        command
            .arg(cli_value)
            .arg("ui")
            .arg("--target")
            .arg(target_root)
            .arg("--json");
        return command;
    }

    let mut command = Command::new(cli_value);
    command
        .arg("ui")
        .arg("--target")
        .arg(target_root)
        .arg("--json");
    command
}

fn resolve_installed_cli_paths() -> Vec<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    for cli_env in ["KIWI_CONTROL_BIN", "SHREY_JUNIOR_BIN"] {
        if let Ok(value) = std::env::var(cli_env) {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                continue;
            }
            candidates.push(PathBuf::from(trimmed));
        }
    }

    let global_home = resolve_global_home_root();
    let path_bin = resolve_path_bin_root();

    candidates.extend(command_path_variants(&path_bin, "kiwi-control"));
    candidates.extend(command_path_variants(&global_home.join("bin"), "kiwi-control"));
    candidates.extend(command_path_variants(&path_bin, "kc"));
    candidates.extend(command_path_variants(&global_home.join("bin"), "kc"));

    let mut unique_candidates = Vec::new();
    for candidate in candidates {
        if !unique_candidates.contains(&candidate) {
            unique_candidates.push(candidate);
        }
    }

    unique_candidates
}

fn resolve_global_home_root() -> PathBuf {
    if let Ok(value) = std::env::var("KIWI_CONTROL_HOME") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    if let Ok(value) = std::env::var("SHREY_JUNIOR_HOME") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    let home_dir = std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    let kiwi_control_home = home_dir.join(".kiwi-control");
    let legacy_home = home_dir.join(".shrey-junior");
    if kiwi_control_home.exists() || !legacy_home.exists() {
        return kiwi_control_home;
    }

    legacy_home
}

fn resolve_path_bin_root() -> PathBuf {
    if let Ok(value) = std::env::var("KIWI_CONTROL_PATH_BIN") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    if let Ok(value) = std::env::var("SHREY_JUNIOR_PATH_BIN") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    let home_dir = std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    home_dir.join(".local").join("bin")
}

fn command_path_variants(root: &PathBuf, command: &str) -> Vec<PathBuf> {
    let candidates = vec![root.join(command)];

    #[cfg(target_os = "windows")]
    {
        candidates.push(root.join(format!("{command}.cmd")));
        candidates.push(root.join(format!("{command}.exe")));
    }

    candidates
}

fn resolve_node_binary() -> Option<PathBuf> {
    for env_name in ["KIWI_CONTROL_NODE", "SHREY_JUNIOR_NODE"] {
        if let Ok(value) = std::env::var(env_name) {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                continue;
            }

            let candidate = PathBuf::from(trimmed);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    if let Some(paths) = std::env::var_os("PATH") {
        for search_path in std::env::split_paths(&paths) {
            let candidate = search_path.join("node");
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    for candidate in ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"] {
        let candidate_path = PathBuf::from(candidate);
        if candidate_path.exists() {
            return Some(candidate_path);
        }
    }

    None
}

fn resolve_source_cli_script() -> Option<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidate = manifest_dir
        .join("..")
        .join("..")
        .join("..")
        .join("packages")
        .join("sj-cli")
        .join("dist")
        .join("cli.js");

    candidate.exists().then_some(candidate)
}

fn read_launch_request() -> Result<Option<DesktopLaunchRequest>, String> {
    let request_path = resolve_launch_request_path();
    if !request_path.exists() {
        return Ok(None);
    }

    let payload = fs::read_to_string(&request_path)
        .map_err(|error| format!("failed to read desktop launch request: {error}"))?;
    let request: DesktopLaunchRequest = serde_json::from_str(&payload)
        .map_err(|error| format!("failed to parse desktop launch request: {error}"))?;

    if request.target_root.trim().is_empty() || request.request_id.trim().is_empty() {
        return Ok(None);
    }

    Ok(Some(request))
}

fn write_launch_status(status: &DesktopLaunchStatus) -> Result<(), String> {
    let status_path = resolve_launch_status_path();
    if let Some(parent) = status_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to prepare desktop launch status directory: {error}"))?;
    }

    let payload = serde_json::to_string_pretty(status)
        .map_err(|error| format!("failed to serialize desktop launch status: {error}"))?;
    fs::write(&status_path, payload)
        .map_err(|error| format!("failed to write desktop launch status: {error}"))?;
    Ok(())
}

fn append_launch_log(entry: &DesktopLaunchLogEntry) -> Result<(), String> {
    let log_path = resolve_launch_log_path();
    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to prepare desktop launch log directory: {error}"))?;
    }

    let entry = DesktopLaunchLogEntry {
        event: entry.event.clone(),
        reported_at: entry.reported_at.clone(),
        request_id: entry.request_id.clone(),
        target_root: entry.target_root.clone(),
        detail: entry.detail.clone(),
    };

    let payload =
        serde_json::to_string(&entry).map_err(|error| format!("failed to serialize desktop launch log: {error}"))?;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .map_err(|error| format!("failed to open desktop launch log: {error}"))?;
    writeln!(file, "{payload}").map_err(|error| format!("failed to write desktop launch log: {error}"))?;
    Ok(())
}

fn resolve_launch_request_path() -> PathBuf {
    resolve_launch_bridge_dir().join("desktop-launch-request.json")
}

fn resolve_launch_status_path() -> PathBuf {
    resolve_launch_bridge_dir().join("desktop-launch-status.json")
}

fn resolve_launch_log_path() -> PathBuf {
    resolve_launch_bridge_dir().join("desktop-launch-log.json")
}

fn resolve_launch_bridge_dir() -> PathBuf {
    match std::env::var("KIWI_CONTROL_DESKTOP_BRIDGE_DIR") {
        Ok(path) if !path.trim().is_empty() => PathBuf::from(path),
        _ => std::env::temp_dir().join("kiwi-control"),
    }
}

fn timestamp_now() -> String {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis().to_string(),
        Err(_) => String::from("0"),
    }
}

impl From<&DesktopLaunchRequest> for DesktopLaunchPayload {
    fn from(request: &DesktopLaunchRequest) -> Self {
        Self {
            request_id: request.request_id.clone(),
            target_root: request.target_root.clone(),
        }
    }
}
