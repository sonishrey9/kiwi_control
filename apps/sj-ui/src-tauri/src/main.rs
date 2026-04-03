#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLaunchRequest {
    target_root: String,
}

#[tauri::command]
fn load_repo_control_state(target_root: String) -> Result<serde_json::Value, String> {
    let output = run_cli_command(&target_root)
        .map_err(|error| format!("failed to invoke Kiwi Control CLI: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    serde_json::from_slice(&output.stdout).map_err(|error| format!("invalid CLI json payload: {error}"))
}

#[tauri::command]
fn consume_launch_target_root() -> Result<Option<String>, String> {
    let request_path = resolve_launch_request_path();
    if !request_path.exists() {
        return Ok(None);
    }

    let payload = fs::read_to_string(&request_path)
        .map_err(|error| format!("failed to read desktop launch request: {error}"))?;
    let request: DesktopLaunchRequest = serde_json::from_str(&payload)
        .map_err(|error| format!("failed to parse desktop launch request: {error}"))?;

    remove_launch_request(&request_path);

    let trimmed_target_root = request.target_root.trim();
    if trimmed_target_root.is_empty() {
        return Ok(None);
    }

    Ok(Some(trimmed_target_root.to_string()))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![consume_launch_target_root, load_repo_control_state])
        .run(tauri::generate_context!())
        .expect("failed to run Kiwi Control desktop");
}

fn run_cli_command(target_root: &str) -> Result<std::process::Output, std::io::Error> {
    let source_cli = resolve_source_cli_script();
    for cli_env in ["KIWI_CONTROL_CLI", "SHREY_JUNIOR_CLI"] {
        if let Ok(value) = std::env::var(cli_env) {
            if value.trim().is_empty() {
                continue;
            }
            return build_cli_process(&value, target_root).output();
        }
    }

    if let Some(script_path) = source_cli {
        return Command::new("node")
            .arg(script_path)
            .arg("ui")
            .arg("--target")
            .arg(target_root)
            .arg("--json")
            .output();
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
            Err(error) => return Err(error)
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
    if cli_value.ends_with(".js") || Path::new(cli_value).extension().map(|extension| extension == "js").unwrap_or(false) {
        let mut command = Command::new("node");
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

fn resolve_launch_request_path() -> PathBuf {
    std::env::temp_dir()
        .join("kiwi-control")
        .join("desktop-launch-request.json")
}

fn remove_launch_request(request_path: &Path) {
    if let Err(error) = fs::remove_file(request_path) {
        if error.kind() != std::io::ErrorKind::NotFound {
            eprintln!("failed to clear desktop launch request at {}: {error}", request_path.display());
        }
    }
}
