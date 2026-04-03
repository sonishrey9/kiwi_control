#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;

#[tauri::command]
fn load_repo_control_state(target_root: String) -> Result<serde_json::Value, String> {
    let cli_binary = std::env::var("SHREY_JUNIOR_CLI").unwrap_or_else(|_| "shrey-junior".to_string());
    let output = Command::new(cli_binary)
        .arg("ui")
        .arg("--target")
        .arg(target_root)
        .arg("--json")
        .output()
        .map_err(|error| format!("failed to invoke shrey-junior CLI: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    serde_json::from_slice(&output.stdout).map_err(|error| format!("invalid CLI json payload: {error}"))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_repo_control_state])
        .run(tauri::generate_context!())
        .expect("failed to run sj-ui");
}
