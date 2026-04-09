#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod state_watch;

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;
use state_watch::{
    ensure_runtime_daemon_ready,
    get_runtime_identity,
    runtime_metadata_file_path,
    set_active_repo_target as update_active_repo_target,
    start_repo_state_watcher,
    RepoStateWatchState,
    RuntimeIdentityPayload,
};

const DESKTOP_LAUNCH_EVENT: &str = "desktop-launch-request";
const DESKTOP_WINDOW_LABEL: &str = "main";
const DESKTOP_APP_NAME: &str = "Kiwi Control";
const DESKTOP_APP_BUNDLE_ID: &str = "com.kiwicontrol.desktop";
const BRIDGE_UNAVAILABLE_NEXT_STEP: &str = "Confirm kiwi-control works in Terminal, then run kc ui again.";
const MACHINE_ADVISORY_FAST_ENV: &str = "KIWI_MACHINE_ADVISORY_FAST";
const RENDER_PROBE_FILE_ENV: &str = "KIWI_CONTROL_RENDER_PROBE_FILE";
const RENDER_PROBE_VIEW_ENV: &str = "KIWI_CONTROL_RENDER_PROBE_VIEW";
const DESKTOP_INSTALL_RECEIPT_FILE: &str = "desktop-install.json";
const DESKTOP_CLI_RESOURCE_DIR: &str = "desktop/cli-bundle";
const DESKTOP_NODE_RESOURCE_DIR: &str = "desktop/node";
const DESKTOP_RUNTIME_MODE_INSTALLED: &str = "installed-user";
const DESKTOP_RUNTIME_MODE_SOURCE: &str = "developer-source";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CliCommandResult {
    ok: bool,
    exit_code: i32,
    stdout: String,
    stderr: String,
    json_payload: Option<serde_json::Value>,
    command_label: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLaunchRequest {
    request_id: String,
    target_root: String,
    requested_at: String,
    #[serde(default)]
    launch_source: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLaunchPayload {
    request_id: String,
    target_root: String,
    launch_source: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLaunchStatus {
    request_id: String,
    target_root: String,
    state: String,
    detail: String,
    reported_at: String,
    revision: u64,
    launch_source: Option<String>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLaunchLogEntry {
    event: String,
    reported_at: String,
    request_id: Option<String>,
    target_root: Option<String>,
    detail: Option<String>,
    launch_source: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopRuntimeInfo {
    app_version: String,
    bundle_id: String,
    executable_path: String,
    build_source: String,
    runtime_mode: String,
    receipt_path: String,
    cli: DesktopCliStatus,
    runtime_identity: Option<RuntimeIdentityPayload>,
    render_probe_view: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopCliStatus {
    bundled_installer_available: bool,
    bundled_node_path: Option<String>,
    install_bin_dir: String,
    installed: bool,
    installed_command_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CliInstallResult {
    detail: String,
    install_bin_dir: String,
    installed_command_path: Option<String>,
    used_bundled_node: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopInstallReceipt {
    app_version: String,
    bundle_id: String,
    executable_path: String,
    build_source: String,
    runtime_mode: String,
    updated_at: String,
}

#[derive(Default)]
struct LaunchBridgeState {
    pending_request: Mutex<Option<DesktopLaunchRequest>>,
    last_seen_request_id: Mutex<Option<String>>,
}

#[tauri::command]
fn load_repo_control_state(app: AppHandle, target_root: String, prefer_snapshot: Option<bool>) -> Result<serde_json::Value, String> {
    append_launch_log(&DesktopLaunchLogEntry {
        event: String::from("desktop-repo-state-requested"),
        reported_at: timestamp_now(),
        request_id: None,
        target_root: Some(target_root.clone()),
        detail: None,
        launch_source: None,
    })
    .ok();

    ensure_runtime_daemon_ready(&app).map_err(|error| format!("failed to ensure Kiwi runtime daemon: {error}"))?;
    let output = run_ui_bridge_repo_state(&app, &target_root, prefer_snapshot.unwrap_or(false)).map_err(|error| {
        let detail = format!("failed to invoke Kiwi Control runtime bridge: {error}");
        append_launch_log(&DesktopLaunchLogEntry {
            event: String::from("desktop-repo-state-failed"),
            reported_at: timestamp_now(),
            request_id: None,
            target_root: Some(target_root.clone()),
            detail: Some(detail.clone()),
            launch_source: None,
        })
        .ok();
        detail
    })?;

    if !output.status.success() {
        let stderr_detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout_detail = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr_detail.is_empty() {
            stderr_detail
        } else if !stdout_detail.is_empty() {
            stdout_detail
        } else {
            String::from("Kiwi Control CLI returned a non-zero exit status without error output.")
        };
        append_launch_log(&DesktopLaunchLogEntry {
            event: String::from("desktop-repo-state-failed"),
            reported_at: timestamp_now(),
            request_id: None,
            target_root: Some(target_root.clone()),
            detail: Some(detail.clone()),
            launch_source: None,
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
        launch_source: None,
    })
    .ok();

    Ok(parsed)
}

#[tauri::command]
fn load_machine_advisory_section(app: AppHandle, section: String, refresh: Option<bool>) -> Result<serde_json::Value, String> {
    let output = run_ui_bridge_machine_section(&app, &section, refresh.unwrap_or(false)).map_err(|error| {
        format!("failed to invoke Kiwi Control machine advisory bridge: {error}")
    })?;

    if !output.status.success() {
        let stderr_detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout_detail = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr_detail.is_empty() {
            stderr_detail
        } else if !stdout_detail.is_empty() {
            stdout_detail
        } else {
            String::from("Kiwi Control machine advisory bridge returned a non-zero exit status without error output.")
        };
        return Err(detail);
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("invalid machine advisory json payload: {error}"))
}

#[tauri::command]
fn get_desktop_runtime_info(app: AppHandle) -> Result<DesktopRuntimeInfo, String> {
    let build_source = infer_runtime_build_source();
    let installed_command_path = resolve_installed_cli_paths()
        .into_iter()
        .find(|path| path.exists())
        .map(|path| path.to_string_lossy().to_string());
    let bundled_node_path = resolve_bundled_node_binary(&app).map(|path| path.to_string_lossy().to_string());
    let runtime_identity = get_runtime_identity(&app).ok();
    Ok(DesktopRuntimeInfo {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        bundle_id: DESKTOP_APP_BUNDLE_ID.to_string(),
        executable_path: current_desktop_executable_path(),
        build_source: build_source.clone(),
        runtime_mode: infer_runtime_mode(&build_source),
        receipt_path: resolve_desktop_install_receipt_path().to_string_lossy().to_string(),
        cli: DesktopCliStatus {
            bundled_installer_available: resolve_bundled_cli_installer_path(&app).is_some(),
            bundled_node_path: bundled_node_path.clone(),
            install_bin_dir: resolve_path_bin_root().to_string_lossy().to_string(),
            installed: installed_command_path.is_some(),
            installed_command_path,
        },
        runtime_identity,
        render_probe_view: resolve_render_probe_view(),
    })
}

#[tauri::command]
fn write_render_probe(payload: serde_json::Value) -> Result<(), String> {
    let Some(probe_path) = resolve_render_probe_path() else {
        return Ok(());
    };

    if let Some(parent) = probe_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create render probe directory: {error}"))?;
    }

    let serialized = serde_json::to_vec_pretty(&payload)
        .map_err(|error| format!("failed to serialize render probe payload: {error}"))?;
    let temp_path = probe_path.with_extension("tmp");
    fs::write(&temp_path, serialized)
        .map_err(|error| format!("failed to write render probe file: {error}"))?;
    fs::rename(&temp_path, &probe_path)
        .map_err(|error| format!("failed to finalize render probe file: {error}"))?;
    Ok(())
}

#[tauri::command]
fn run_cli_command(
    app: AppHandle,
    command: String,
    args: Vec<String>,
    target_root: String,
    expect_json: Option<bool>,
) -> Result<CliCommandResult, String> {
    let trimmed_target_root = target_root.trim();
    if trimmed_target_root.is_empty() {
        return Err(String::from("targetRoot is required"));
    }

    let (command_label, cli_args) = build_allowlisted_cli_args(&command, &args, trimmed_target_root)?;
    let output = run_cli_process(&app, &cli_args, trimmed_target_root)
        .map_err(|error| format!("failed to run Kiwi Control CLI command: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let exit_code = output.status.code().unwrap_or_default();
    let json_payload = if expect_json.unwrap_or(false) && !stdout.is_empty() {
        Some(
            serde_json::from_str::<serde_json::Value>(&stdout)
                .map_err(|error| format!("failed to parse CLI json output for {command_label}: {error}"))?,
        )
    } else {
        None
    };

    Ok(CliCommandResult {
        ok: output.status.success(),
        exit_code,
        stdout,
        stderr,
        json_payload,
        command_label,
    })
}

#[tauri::command]
fn install_bundled_cli(app: AppHandle) -> Result<CliInstallResult, String> {
    let installer_path = resolve_bundled_cli_installer_path(&app)
        .ok_or_else(|| String::from("bundled Kiwi Control CLI installer is not available in this desktop build"))?;
    let bundled_node_path = resolve_bundled_node_binary(&app);
    let output = run_bundled_cli_installer(&installer_path, bundled_node_path.as_ref())
        .map_err(|error| format!("failed to run bundled CLI installer: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        return Err(if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            String::from("Kiwi Control CLI installer exited without success output.")
        });
    }

    let installed_command_path = resolve_installed_cli_paths()
        .into_iter()
        .find(|path| path.exists())
        .map(|path| path.to_string_lossy().to_string());

    Ok(CliInstallResult {
        detail: if !stdout.is_empty() { stdout } else { String::from("Kiwi Control CLI installed.") },
        install_bin_dir: resolve_path_bin_root().to_string_lossy().to_string(),
        installed_command_path,
        used_bundled_node: bundled_node_path.is_some(),
    })
}

#[tauri::command]
fn pick_repo_directory(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    app.dialog()
        .file()
        .set_title("Choose a repo to open in Kiwi Control")
        .pick_folder(move |selection| {
            let selected_path = selection
                .and_then(|selection| selection.into_path().ok())
                .map(|path| path.to_string_lossy().to_string());
            let _ = tx.send(selected_path);
        });

    rx.recv_timeout(Duration::from_secs(300))
        .map_err(|_| String::from("repo picker did not return a selection in time"))
}

#[tauri::command]
fn open_path(target_root: String, path: String) -> Result<(), String> {
    let root = fs::canonicalize(&target_root)
        .map_err(|error| format!("failed to resolve target root: {error}"))?;
    let requested = PathBuf::from(path.trim());
    let candidate = if requested.is_absolute() {
        requested
    } else {
        root.join(requested)
    };
    let resolved = fs::canonicalize(&candidate)
        .map_err(|error| format!("failed to resolve requested path: {error}"))?;

    if !resolved.starts_with(&root) {
        return Err(String::from("requested path is outside the active repo root"));
    }

    open_path_with_default_app(&resolved)
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
    revision: u64,
) -> Result<(), String> {
    let trimmed_status = status.trim();
    if trimmed_status != "ready" && trimmed_status != "error" && trimmed_status != "hydrating" {
        return Err(format!("unsupported desktop launch status: {trimmed_status}"));
    }

    let launch_status = DesktopLaunchStatus {
        request_id: request_id.clone(),
        target_root: target_root.clone(),
        state: trimmed_status.to_string(),
        detail: detail.unwrap_or_else(|| {
            if trimmed_status == "ready" {
                format!("Loaded repo-local state for {target_root}.")
            } else if trimmed_status == "hydrating" {
                format!("Loaded a warm repo snapshot for {target_root}. Fresh repo-local state is still hydrating.")
            } else {
                BRIDGE_UNAVAILABLE_NEXT_STEP.to_string()
            }
        }),
        reported_at: timestamp_now(),
        revision,
        launch_source: resolve_launch_source(&state, &request_id),
    };

    write_launch_status(&launch_status)?;
    append_launch_log(&DesktopLaunchLogEntry {
        event: if trimmed_status == "ready" {
            String::from("desktop-ready-acknowledged")
        } else if trimmed_status == "hydrating" {
            String::from("desktop-hydrating-acknowledged")
        } else {
            String::from("desktop-error-acknowledged")
        },
        reported_at: timestamp_now(),
        request_id: Some(request_id.clone()),
        target_root: Some(target_root.clone()),
        detail: Some(launch_status.detail.clone()),
        launch_source: launch_status.launch_source.clone(),
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
                    launch_source: None,
                });
            } else {
                let _ = append_launch_log(&DesktopLaunchLogEntry {
                    event: String::from("desktop-ready-focus-complete"),
                    reported_at: timestamp_now(),
                    request_id: Some(ready_request_id),
                    target_root: Some(ready_target_root),
                    detail: None,
                    launch_source: None,
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
        launch_source: None,
    })
}

#[tauri::command]
fn set_active_repo_target(
    app: AppHandle,
    state: State<RepoStateWatchState>,
    target_root: String,
    revision: u64,
) -> Result<(), String> {
    update_active_repo_target(&app, &state, target_root, revision)
}

fn main() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_dialog::init());
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Ok(Some(request)) = read_launch_request() {
                let _ = handle_launch_request(app, request, "single-instance", true);
            }
        }));
    }

    builder
        .manage(LaunchBridgeState::default())
        .manage(RepoStateWatchState::default())
        .setup(|app| {
            if let Err(error) = ensure_main_window(app.handle()) {
                let _ = append_launch_log(&DesktopLaunchLogEntry {
                    event: String::from("desktop-window-ensure-failed"),
                    reported_at: timestamp_now(),
                    request_id: None,
                    target_root: None,
                    detail: Some(error.clone()),
                    launch_source: None,
                });
                return Err(error.into());
            }

            if let Err(error) = write_desktop_install_receipt(app.handle()) {
                let _ = append_launch_log(&DesktopLaunchLogEntry {
                    event: String::from("desktop-install-receipt-failed"),
                    reported_at: timestamp_now(),
                    request_id: None,
                    target_root: None,
                    detail: Some(error),
                    launch_source: None,
                });
            }

            let _ = append_launch_log(&DesktopLaunchLogEntry {
                event: String::from("desktop-startup"),
                reported_at: timestamp_now(),
                request_id: None,
                target_root: None,
                detail: None,
                launch_source: None,
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
                            launch_source: request.launch_source.clone(),
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
                        launch_source: None,
                    });
                }
                Err(error) => {
                    let _ = append_launch_log(&DesktopLaunchLogEntry {
                        event: String::from("desktop-startup-read-failed"),
                        reported_at: timestamp_now(),
                        request_id: None,
                        target_root: None,
                        detail: Some(error),
                        launch_source: None,
                    });
                }
            }

            start_launch_request_watcher(app.handle().clone());
            start_repo_state_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            consume_initial_launch_request,
            load_repo_control_state,
            load_machine_advisory_section,
            get_desktop_runtime_info,
            write_render_probe,
            run_cli_command,
            install_bundled_cli,
            pick_repo_directory,
            open_path,
            ack_launch_request,
            set_active_repo_target,
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
                launch_source: request.launch_source.clone(),
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
        launch_source: request.launch_source.clone(),
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
                launch_source: request.launch_source.clone(),
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

fn run_ui_bridge_repo_state(app: &AppHandle, target_root: &str, prefer_snapshot: bool) -> Result<std::process::Output, std::io::Error> {
    let mut args = vec![
        "repo-state",
        "--target-root",
        target_root,
        "--machine-fast",
    ];
    if prefer_snapshot {
        args.push("--prefer-snapshot");
    }
    run_ui_bridge_command(app, &args, true)
}

fn run_ui_bridge_machine_section(app: &AppHandle, section: &str, refresh: bool) -> Result<std::process::Output, std::io::Error> {
    let mut args = vec!["machine-advisory-section", "--section", section];
    if refresh {
        args.push("--refresh");
    }
    run_ui_bridge_command(app, &args, false)
}

fn run_ui_bridge_command(app: &AppHandle, args: &[&str], fast_mode: bool) -> Result<std::process::Output, std::io::Error> {
    if let Some(script_path) = resolve_source_ui_bridge_script() {
        if let Some(node_binary) = resolve_node_binary(None) {
            let mut command = Command::new(node_binary);
            command.arg(script_path);
            for arg in args {
                command.arg(arg);
            }
            apply_runtime_bridge_env(&mut command);
            if fast_mode {
                command.env(MACHINE_ADVISORY_FAST_ENV, "1");
            }
            return command.output();
        }
    }

    if let Some(script_path) = resolve_bundled_ui_bridge_script(app) {
        if let Some(node_binary) = resolve_node_binary(resolve_bundled_node_binary(app)) {
            let mut command = Command::new(node_binary);
            command.arg(script_path);
            for arg in args {
                command.arg(arg);
            }
            apply_runtime_bridge_env(&mut command);
            if fast_mode {
                command.env(MACHINE_ADVISORY_FAST_ENV, "1");
            }
            return command.output();
        }
    }

    Err(std::io::Error::new(
        std::io::ErrorKind::NotFound,
        "Kiwi Control runtime bridge script was not found",
    ))
}

fn apply_runtime_bridge_env(command: &mut Command) {
    command.env(
        "KIWI_CONTROL_RUNTIME_METADATA_FILE",
        runtime_metadata_file_path().to_string_lossy().to_string(),
    );
    command.env(
        "KIWI_CONTROL_RUNTIME_CALLER_SURFACE",
        desktop_runtime_caller_surface(),
    );
    command.env(
        "KIWI_CONTROL_RUNTIME_PACKAGING_SOURCE_CATEGORY",
        desktop_runtime_packaging_source_category(),
    );
}

fn build_allowlisted_cli_args(
    command: &str,
    args: &[String],
    target_root: &str,
) -> Result<(String, Vec<String>), String> {
    let mut cli_args: Vec<String> = Vec::new();
    let command_label = match command {
        "guide" | "next" | "retry" | "resume" | "status" | "trace" | "init" => {
            cli_args.push(command.to_string());
            if args.iter().any(|arg| arg == "--json") {
                cli_args.push(String::from("--json"));
            }
            command.to_string()
        }
        "sync" => {
            cli_args.push(String::from("sync"));
            if args.iter().any(|arg| arg == "--dry-run") {
                cli_args.push(String::from("--dry-run"));
            }
            if args.iter().any(|arg| arg == "--diff-summary") {
                cli_args.push(String::from("--diff-summary"));
            }
            if args.iter().any(|arg| arg == "--backup") {
                cli_args.push(String::from("--backup"));
            }
            String::from("sync")
        }
        "validate" => {
            cli_args.push(String::from("validate"));
            if let Some(task) = args.first().filter(|value| !value.trim().is_empty() && *value != "--json") {
                cli_args.push(task.clone());
            }
            if args.iter().any(|arg| arg == "--json") {
                cli_args.push(String::from("--json"));
            }
            String::from("validate")
        }
        "run-auto" => {
            let task = args
                .first()
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| String::from("run-auto requires a task description"))?;
            cli_args.push(String::from("run"));
            cli_args.push(task.clone());
            cli_args.push(String::from("--auto"));
            String::from("run --auto")
        }
        "checkpoint" => {
            let label = args
                .first()
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| String::from("checkpoint requires a label"))?;
            cli_args.push(String::from("checkpoint"));
            cli_args.push(label.clone());
            String::from("checkpoint")
        }
        "handoff" => {
            let target = args
                .first()
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| String::from("handoff requires a specialist target"))?;
            cli_args.push(String::from("handoff"));
            cli_args.push(String::from("--to"));
            cli_args.push(target.clone());
            String::from("handoff")
        }
        _ => {
            return Err(format!("unsupported cli command: {command}"));
        }
    };

    cli_args.push(String::from("--target"));
    cli_args.push(target_root.to_string());
    Ok((command_label, cli_args))
}

fn run_cli_process(app: &AppHandle, args: &[String], target_root: &str) -> Result<std::process::Output, std::io::Error> {
    if let Some(script_path) = resolve_source_cli_script() {
        if let Some(node_binary) = resolve_node_binary(None) {
            let mut command = Command::new(node_binary);
            command.current_dir(target_root);
            command.arg(script_path);
            for arg in args {
                command.arg(arg);
            }
            return command.output();
        }
    }

    if let Some(script_path) = resolve_bundled_cli_script(app) {
        if let Some(node_binary) = resolve_node_binary(resolve_bundled_node_binary(app)) {
            let mut command = Command::new(node_binary);
            command.current_dir(target_root);
            command.arg(script_path);
            for arg in args {
                command.arg(arg);
            }
            return command.output();
        }
    }

    for cli_path in resolve_installed_cli_paths() {
        if !cli_path.exists() {
            continue;
        }
        let mut command = Command::new(&cli_path);
        command.current_dir(target_root);
        for arg in args {
            command.arg(arg);
        }
        match command.output() {
            Ok(output) => return Ok(output),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => return Err(error),
        }
    }

    Err(std::io::Error::new(
        std::io::ErrorKind::NotFound,
        "Kiwi Control CLI was not found",
    ))
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

    if cfg!(target_os = "windows") {
        return resolve_global_home_root().join("bin");
    }

    let home_dir = std::env::var("HOME")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("USERPROFILE").map(PathBuf::from))
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

fn resolve_node_binary(preferred: Option<PathBuf>) -> Option<PathBuf> {
    if let Some(candidate) = preferred.filter(|candidate| candidate.exists()) {
        return Some(candidate);
    }

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

fn resolve_bundled_cli_script(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .resolve(&format!("{DESKTOP_CLI_RESOURCE_DIR}/lib/cli.js"), BaseDirectory::Resource)
        .ok()
        .filter(|path| path.exists())
}

fn resolve_bundled_ui_bridge_script(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .resolve(
            &format!("{DESKTOP_CLI_RESOURCE_DIR}/node_modules/@shrey-junior/sj-core/dist/runtime/ui-bridge.js"),
            BaseDirectory::Resource,
        )
        .ok()
        .filter(|path| path.exists())
}

fn resolve_bundled_cli_installer_path(app: &AppHandle) -> Option<PathBuf> {
    let relative_path = if cfg!(target_os = "windows") {
        format!("{DESKTOP_CLI_RESOURCE_DIR}/install.ps1")
    } else {
        format!("{DESKTOP_CLI_RESOURCE_DIR}/install.sh")
    };

    app.path()
        .resolve(&relative_path, BaseDirectory::Resource)
        .ok()
        .filter(|path| path.exists())
}

fn resolve_bundled_node_binary(app: &AppHandle) -> Option<PathBuf> {
    let binary_name = if cfg!(target_os = "windows") { "node.exe" } else { "node" };
    app.path()
        .resolve(&format!("{DESKTOP_NODE_RESOURCE_DIR}/{binary_name}"), BaseDirectory::Resource)
        .ok()
        .filter(|path| path.exists())
}

fn run_bundled_cli_installer(
    installer_path: &PathBuf,
    bundled_node_path: Option<&PathBuf>,
) -> Result<std::process::Output, std::io::Error> {
    let mut command = if cfg!(target_os = "windows") {
        let mut command = Command::new("powershell.exe");
        command
            .arg("-NoProfile")
            .arg("-ExecutionPolicy")
            .arg("Bypass")
            .arg("-File")
            .arg(installer_path);
        command
    } else {
        let mut command = Command::new("/bin/bash");
        command.arg(installer_path);
        command
    };

    command.current_dir(
        installer_path
            .parent()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(".")),
    );
    if let Some(node_path) = bundled_node_path {
        command.env("KIWI_CONTROL_NODE_ABSOLUTE", node_path);
    }
    command.output()
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

fn resolve_source_ui_bridge_script() -> Option<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidate = manifest_dir
        .join("..")
        .join("..")
        .join("..")
        .join("packages")
        .join("sj-core")
        .join("dist")
        .join("runtime")
        .join("ui-bridge.js");

    candidate.exists().then_some(candidate)
}

#[cfg(target_os = "macos")]
fn open_path_with_default_app(path: &PathBuf) -> Result<(), String> {
    Command::new("open")
        .arg(path)
        .status()
        .map_err(|error| format!("failed to open path: {error}"))
        .and_then(|status| {
            if status.success() {
                Ok(())
            } else {
                Err(String::from("open command failed"))
            }
        })
}

#[cfg(target_os = "windows")]
fn open_path_with_default_app(path: &PathBuf) -> Result<(), String> {
    Command::new("cmd")
        .args(["/C", "start", ""])
        .arg(path)
        .status()
        .map_err(|error| format!("failed to open path: {error}"))
        .and_then(|status| {
            if status.success() {
                Ok(())
            } else {
                Err(String::from("start command failed"))
            }
        })
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
fn open_path_with_default_app(path: &PathBuf) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(path)
        .status()
        .map_err(|error| format!("failed to open path: {error}"))
        .and_then(|status| {
            if status.success() {
                Ok(())
            } else {
                Err(String::from("xdg-open command failed"))
            }
        })
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
        launch_source: entry.launch_source.clone(),
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

fn resolve_render_probe_path() -> Option<PathBuf> {
    match std::env::var(RENDER_PROBE_FILE_ENV) {
        Ok(path) if !path.trim().is_empty() => Some(PathBuf::from(path)),
        _ => None,
    }
}

fn resolve_render_probe_view() -> Option<String> {
    match std::env::var(RENDER_PROBE_VIEW_ENV) {
        Ok(view) if !view.trim().is_empty() => Some(view),
        _ => None,
    }
}

fn resolve_launch_source(state: &State<LaunchBridgeState>, request_id: &str) -> Option<String> {
    if let Ok(pending_request) = state.pending_request.lock() {
        if let Some(request) = pending_request
            .as_ref()
            .filter(|request| request.request_id == request_id)
        {
            if request.launch_source.is_some() {
                return request.launch_source.clone();
            }
        }
    }

    Some(infer_runtime_build_source())
}

fn current_desktop_executable_path() -> String {
    std::env::current_exe()
        .ok()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_else(|| String::from("unknown"))
}

fn infer_runtime_build_source() -> String {
    let executable_path = current_desktop_executable_path();
    if executable_path.contains("/Applications/") && executable_path.contains(".app/Contents/MacOS/") {
        return String::from("installed-bundle");
    }
    let normalized_path = executable_path.to_lowercase();
    if normalized_path.contains("\\program files\\")
        || normalized_path.contains("\\appdata\\local\\programs\\")
        || normalized_path.contains("/program files/")
        || normalized_path.contains("/appdata/local/programs/")
    {
        return String::from("installed-bundle");
    }
    if executable_path.contains("/src-tauri/target/release/bundle/macos/") {
        return String::from("source-bundle");
    }
    String::from("fallback-launcher")
}

fn infer_runtime_mode(build_source: &str) -> String {
    if build_source == "source-bundle" {
        return String::from(DESKTOP_RUNTIME_MODE_SOURCE);
    }
    String::from(DESKTOP_RUNTIME_MODE_INSTALLED)
}

fn desktop_runtime_caller_surface() -> String {
    if infer_runtime_build_source() == "source-bundle" {
        return String::from("desktop-source-checkout-app");
    }
    String::from("desktop-bundled-app")
}

fn desktop_runtime_packaging_source_category() -> String {
    if infer_runtime_build_source() == "source-bundle" {
        return String::from("source-bundle-sibling");
    }
    String::from("bundled-sidecar")
}

fn resolve_desktop_install_receipt_path() -> PathBuf {
    for env_name in ["KIWI_CONTROL_DESKTOP_RECEIPT_PATH", "SHREY_JUNIOR_DESKTOP_RECEIPT_PATH"] {
        if let Ok(value) = std::env::var(env_name) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return PathBuf::from(trimmed);
            }
        }
    }

    resolve_global_home_root().join(DESKTOP_INSTALL_RECEIPT_FILE)
}

fn write_desktop_install_receipt(_app: &AppHandle) -> Result<(), String> {
    let receipt_path = resolve_desktop_install_receipt_path();
    if let Some(parent) = receipt_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create desktop install receipt directory: {error}"))?;
    }

    let build_source = infer_runtime_build_source();
    let receipt = DesktopInstallReceipt {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        bundle_id: DESKTOP_APP_BUNDLE_ID.to_string(),
        executable_path: current_desktop_executable_path(),
        build_source: build_source.clone(),
        runtime_mode: infer_runtime_mode(&build_source),
        updated_at: timestamp_now(),
    };

    let serialized = serde_json::to_vec_pretty(&receipt)
        .map_err(|error| format!("failed to serialize desktop install receipt: {error}"))?;
    let temp_path = receipt_path.with_extension("tmp");
    fs::write(&temp_path, serialized)
        .map_err(|error| format!("failed to write desktop install receipt: {error}"))?;
    fs::rename(&temp_path, &receipt_path)
        .map_err(|error| format!("failed to finalize desktop install receipt: {error}"))?;
    Ok(())
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
            launch_source: request.launch_source.clone(),
        }
    }
}
