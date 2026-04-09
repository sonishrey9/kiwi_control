use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager, State};

pub const REPO_STATE_CHANGED_EVENT: &str = "repo-state-changed";

const RUNTIME_START_TIMEOUT: Duration = Duration::from_secs(20);
const RUNTIME_HEALTH_TIMEOUT: Duration = Duration::from_secs(4);
const RUNTIME_POLL_INTERVAL: Duration = Duration::from_millis(250);

#[derive(Default)]
pub struct RepoStateWatchState {
    pub active_target_root: Mutex<Option<String>>,
    pub last_seen_revision: Mutex<u64>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoStateChangedPayload {
    pub target_root: String,
    pub revision: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeDaemonMetadata {
    base_url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeEventList {
    latest_revision: u64,
}

pub fn set_active_repo_target(
    app: &AppHandle,
    state: &State<RepoStateWatchState>,
    target_root: String,
    revision: u64,
) -> Result<(), String> {
    let normalized_target_root = target_root.trim().to_string();
    if !normalized_target_root.is_empty() {
        open_runtime_target(app, &normalized_target_root)?;
    }

    let mut active_target_root = state
        .active_target_root
        .lock()
        .map_err(|_| String::from("failed to lock active repo target state"))?;
    let mut last_seen_revision = state
        .last_seen_revision
        .lock()
        .map_err(|_| String::from("failed to lock repo-state watch revision"))?;

    *active_target_root = if normalized_target_root.is_empty() {
        None
    } else {
        Some(normalized_target_root)
    };
    *last_seen_revision = revision;
    Ok(())
}

pub fn start_repo_state_watcher(app: AppHandle) {
    thread::spawn(move || loop {
        let target_root: Option<String> = match app.state::<RepoStateWatchState>().active_target_root.lock() {
            Ok(active_target_root) => active_target_root.clone(),
            Err(_) => None,
        };

        let Some(target_root) = target_root else {
            thread::sleep(RUNTIME_POLL_INTERVAL);
            continue;
        };

        let after_revision = match app.state::<RepoStateWatchState>().last_seen_revision.lock() {
            Ok(last_seen_revision) => *last_seen_revision,
            Err(_) => 0,
        };

        let latest_revision = match list_runtime_events(&app, &target_root, after_revision) {
            Ok(latest_revision) => latest_revision,
            Err(_) => {
                thread::sleep(RUNTIME_POLL_INTERVAL);
                continue;
            }
        };

        let should_emit = match app.state::<RepoStateWatchState>().last_seen_revision.lock() {
            Ok(mut last_seen_revision) => {
                if latest_revision > *last_seen_revision {
                    *last_seen_revision = latest_revision;
                    true
                } else {
                    false
                }
            }
            Err(_) => false,
        };

        if should_emit {
            let _ = app.emit(
                REPO_STATE_CHANGED_EVENT,
                RepoStateChangedPayload {
                    target_root: target_root.clone(),
                    revision: latest_revision,
                },
            );
        }

        thread::sleep(RUNTIME_POLL_INTERVAL);
    });
}

fn list_runtime_events(app: &AppHandle, target_root: &str, after_revision: u64) -> Result<u64, String> {
    let metadata = ensure_runtime_daemon(app)?;
    let response = ureq::get(&format!("{}/execution-events", metadata.base_url))
        .query("targetRoot", target_root)
        .query("afterRevision", &after_revision.to_string())
        .timeout(RUNTIME_HEALTH_TIMEOUT)
        .call()
        .map_err(|error| format!("failed to query runtime events: {error}"))?;

    let payload: RuntimeEventList = response
        .into_json()
        .map_err(|error| format!("failed to decode runtime event payload: {error}"))?;
    Ok(payload.latest_revision)
}

fn open_runtime_target(app: &AppHandle, target_root: &str) -> Result<(), String> {
    let metadata = ensure_runtime_daemon(app)?;
    ureq::post(&format!("{}/open-target", metadata.base_url))
        .timeout(RUNTIME_HEALTH_TIMEOUT)
        .send_json(json!({ "targetRoot": target_root }))
        .map_err(|error| format!("failed to open runtime target: {error}"))?;
    Ok(())
}

fn ensure_runtime_daemon(app: &AppHandle) -> Result<RuntimeDaemonMetadata, String> {
    if let Some(metadata) = read_runtime_metadata()? {
        if runtime_healthy(&metadata) {
            return Ok(metadata);
        }
    }

    let metadata_path = runtime_metadata_path();
    if let Some(parent) = metadata_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create runtime metadata dir: {error}"))?;
    }

    let (command, args) = resolve_runtime_launch_command(app)?;
    Command::new(command)
        .args(args)
        .current_dir(resolve_source_product_root())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("failed to launch kiwi runtime daemon: {error}"))?;

    let started_at = Instant::now();
    while started_at.elapsed() < RUNTIME_START_TIMEOUT {
        if let Some(metadata) = read_runtime_metadata()? {
            if runtime_healthy(&metadata) {
                return Ok(metadata);
            }
        }
        thread::sleep(Duration::from_millis(200));
    }

    Err(String::from(
        "kiwi runtime daemon did not become healthy in time",
    ))
}

fn runtime_healthy(metadata: &RuntimeDaemonMetadata) -> bool {
    ureq::get(&format!("{}/health", metadata.base_url))
        .timeout(RUNTIME_HEALTH_TIMEOUT)
        .call()
        .map(|response| response.status() == 200)
        .unwrap_or(false)
}

fn read_runtime_metadata() -> Result<Option<RuntimeDaemonMetadata>, String> {
    let metadata_path = runtime_metadata_path();
    if !metadata_path.exists() {
        return Ok(None);
    }

    let payload = fs::read_to_string(&metadata_path)
        .map_err(|error| format!("failed to read runtime metadata: {error}"))?;
    let metadata = serde_json::from_str::<RuntimeDaemonMetadata>(&payload)
        .map_err(|error| format!("failed to parse runtime metadata: {error}"))?;
    Ok(Some(metadata))
}

fn resolve_runtime_launch_command(app: &AppHandle) -> Result<(String, Vec<String>), String> {
    if let Some(runtime_binary) = resolve_explicit_runtime_binary() {
        return Ok((
            runtime_binary.to_string_lossy().to_string(),
            vec![
                String::from("daemon"),
                String::from("--metadata-file"),
                runtime_metadata_path().to_string_lossy().to_string(),
                String::from("--launch-mode"),
                String::from("env-override"),
                String::from("--binary-path"),
                runtime_binary.to_string_lossy().to_string(),
            ],
        ));
    }

    if let Some(sidecar_binary) = resolve_bundled_runtime_sidecar(app) {
        return Ok((
            sidecar_binary.to_string_lossy().to_string(),
            vec![
                String::from("daemon"),
                String::from("--metadata-file"),
                runtime_metadata_path().to_string_lossy().to_string(),
                String::from("--launch-mode"),
                String::from("bundled-sidecar"),
                String::from("--binary-path"),
                sidecar_binary.to_string_lossy().to_string(),
            ],
        ));
    }

    if let Some(source_binary) = resolve_source_staged_runtime_binary() {
        return Ok((
            source_binary.to_string_lossy().to_string(),
            vec![
                String::from("daemon"),
                String::from("--metadata-file"),
                runtime_metadata_path().to_string_lossy().to_string(),
                String::from("--launch-mode"),
                String::from("local-staged"),
                String::from("--binary-path"),
                source_binary.to_string_lossy().to_string(),
            ],
        ));
    }

    if allow_dev_runtime_fallback() {
        let cargo_command = if cfg!(target_os = "windows") {
            String::from("cargo.exe")
        } else {
            String::from("cargo")
        };
        return Ok((
            cargo_command,
            vec![
                String::from("run"),
                String::from("--manifest-path"),
                resolve_source_product_root()
                    .join("crates")
                    .join("kiwi-runtime")
                    .join("Cargo.toml")
                    .to_string_lossy()
                    .to_string(),
                String::from("--quiet"),
                String::from("--bin"),
                String::from("kiwi-control-runtime"),
                String::from("--"),
                String::from("daemon"),
                String::from("--metadata-file"),
                runtime_metadata_path().to_string_lossy().to_string(),
                String::from("--launch-mode"),
                String::from("dev-cargo-fallback"),
                String::from("--binary-path"),
                resolve_source_product_root()
                    .join("crates")
                    .join("kiwi-runtime")
                    .join("Cargo.toml")
                    .to_string_lossy()
                    .to_string(),
            ],
        ));
    }

    Err(String::from(
        "Kiwi runtime sidecar is not available in this desktop build. Run `node scripts/prepare-runtime-sidecar.mjs` or set KIWI_CONTROL_ALLOW_DEV_RUNTIME_FALLBACK=1 for an explicit contributor-only cargo fallback.",
    ))
}

fn resolve_explicit_runtime_binary() -> Option<PathBuf> {
    env::var("KIWI_CONTROL_RUNTIME_BIN")
        .ok()
        .or_else(|| env::var("SHREY_JUNIOR_RUNTIME_BIN").ok())
        .map(PathBuf::from)
        .filter(|path| path.exists())
}

fn resolve_bundled_runtime_sidecar(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(current_executable) = env::current_exe() {
        if let Some(parent) = current_executable.parent() {
            let sibling = parent.join(current_runtime_executable_name());
            if sibling.exists() {
                return Some(sibling);
            }
        }
    }

    let relative_path = format!(
        "binaries/kiwi-control-runtime-{}{}",
        current_rust_target_triple()?,
        if cfg!(target_os = "windows") { ".exe" } else { "" }
    );
    app.path()
        .resolve(relative_path, BaseDirectory::Resource)
        .ok()
        .filter(|path| path.exists())
}

fn resolve_source_staged_runtime_binary() -> Option<PathBuf> {
    let relative_name = format!(
        "kiwi-control-runtime-{}{}",
        current_rust_target_triple()?,
        if cfg!(target_os = "windows") { ".exe" } else { "" }
    );
    let candidate = resolve_source_product_root()
        .join("apps")
        .join("sj-ui")
        .join("src-tauri")
        .join("binaries")
        .join(relative_name);
    if candidate.exists() {
        return Some(candidate);
    }

    None
}

fn current_runtime_executable_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "kiwi-control-runtime.exe"
    } else {
        "kiwi-control-runtime"
    }
}

fn resolve_source_product_root() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .join("..")
        .join("..")
        .join("..")
        .canonicalize()
        .unwrap_or_else(|_| manifest_dir)
}

fn resolve_global_home_root() -> PathBuf {
    if let Ok(value) = env::var("KIWI_CONTROL_HOME") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }
    if let Ok(value) = env::var("SHREY_JUNIOR_HOME") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    let home_dir = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .unwrap_or_else(|_| String::from("."));
    let kiwi_home = PathBuf::from(&home_dir).join(".kiwi-control");
    let legacy_home = PathBuf::from(&home_dir).join(".shrey-junior");
    if kiwi_home.exists() || !legacy_home.exists() {
        kiwi_home
    } else {
        legacy_home
    }
}

fn allow_dev_runtime_fallback() -> bool {
    let value = env::var("KIWI_CONTROL_ALLOW_DEV_RUNTIME_FALLBACK")
        .ok()
        .or_else(|| env::var("SHREY_JUNIOR_ALLOW_DEV_RUNTIME_FALLBACK").ok())
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    value == "1" || value == "true" || value == "yes"
}

fn current_rust_target_triple() -> Option<&'static str> {
    match (env::consts::OS, env::consts::ARCH) {
        ("macos", "aarch64") => Some("aarch64-apple-darwin"),
        ("macos", "x86_64") => Some("x86_64-apple-darwin"),
        ("linux", "aarch64") => Some("aarch64-unknown-linux-gnu"),
        ("linux", "x86_64") => Some("x86_64-unknown-linux-gnu"),
        ("windows", "aarch64") => Some("aarch64-pc-windows-msvc"),
        ("windows", "x86_64") => Some("x86_64-pc-windows-msvc"),
        _ => None,
    }
}

fn runtime_metadata_path() -> PathBuf {
    if let Ok(value) = env::var("KIWI_CONTROL_RUNTIME_DIR") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed).join("daemon.json");
        }
    }
    if let Ok(value) = env::var("SHREY_JUNIOR_RUNTIME_DIR") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed).join("daemon.json");
        }
    }

    resolve_global_home_root().join("runtime").join("daemon.json")
}
