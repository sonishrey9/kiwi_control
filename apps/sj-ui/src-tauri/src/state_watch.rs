use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

pub const REPO_STATE_CHANGED_EVENT: &str = "repo-state-changed";

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
struct ExecutionStateSnapshot {
    revision: u64,
}

pub fn set_active_repo_target(
    state: &State<RepoStateWatchState>,
    target_root: String,
    revision: u64,
) -> Result<(), String> {
    let mut active_target_root = state
        .active_target_root
        .lock()
        .map_err(|_| String::from("failed to lock active repo target state"))?;
    let mut last_seen_revision = state
        .last_seen_revision
        .lock()
        .map_err(|_| String::from("failed to lock repo-state watch revision"))?;

    *active_target_root = if target_root.trim().is_empty() {
        None
    } else {
        Some(target_root)
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
            thread::sleep(Duration::from_millis(250));
            continue;
        };

        let revision = match read_execution_state_revision(&target_root) {
            Some(revision) => revision,
            None => {
                thread::sleep(Duration::from_millis(250));
                continue;
            }
        };

        let should_emit = match app.state::<RepoStateWatchState>().last_seen_revision.lock() {
            Ok(mut last_seen_revision) => {
                if revision > *last_seen_revision {
                    *last_seen_revision = revision;
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
                    revision,
                },
            );
        }

        thread::sleep(Duration::from_millis(250));
    });
}

fn read_execution_state_revision(target_root: &str) -> Option<u64> {
    let file_path = PathBuf::from(target_root)
        .join(".agent")
        .join("state")
        .join("execution-state.json");
    let payload = fs::read_to_string(file_path).ok()?;
    let snapshot = serde_json::from_str::<ExecutionStateSnapshot>(&payload).ok()?;
    Some(snapshot.revision)
}
