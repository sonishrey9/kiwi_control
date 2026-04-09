use crate::db;
use crate::models::{
    ListExecutionEventsQuery, MaterializeDerivedOutputsRequest, OpenTargetRequest,
    PersistDerivedOutputRequest, RuntimeDaemonMetadata, TransitionExecutionStateRequest,
};
use anyhow::{Context, Result};
use axum::extract::Query;
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use tokio::net::TcpListener;

type HttpResult<T> = Result<Json<T>, (StatusCode, String)>;

#[derive(Clone)]
struct AppState;

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotQuery {
    target_root: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    ok: bool,
    pid: u32,
}

pub async fn run_daemon(
    metadata_file: PathBuf,
    launch_mode: Option<String>,
    binary_path: Option<String>,
) -> Result<()> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .context("failed to bind kiwi-runtime daemon")?;
    let address = listener.local_addr()?;
    let metadata = RuntimeDaemonMetadata {
        pid: std::process::id(),
        port: address.port(),
        base_url: format!("http://127.0.0.1:{}", address.port()),
        started_at: metadata_started_at(),
        launch_mode,
        binary_path,
    };
    write_metadata(&metadata_file, &metadata)?;

    let app = Router::new()
        .route("/health", get(health))
        .route("/open-target", post(open_target))
        .route("/runtime-snapshot", get(runtime_snapshot))
        .route("/execution-events", get(execution_events))
        .route("/transition-execution-state", post(transition_execution_state))
        .route("/materialize-derived-outputs", post(materialize_outputs))
        .route("/persist-derived-output", post(persist_derived_output))
        .with_state(AppState);

    axum::serve(listener, app)
        .await
        .context("kiwi-runtime daemon stopped unexpectedly")?;
    Ok(())
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        ok: true,
        pid: std::process::id(),
    })
}

async fn open_target(Json(request): Json<OpenTargetRequest>) -> HttpResult<serde_json::Value> {
    db::open_target(&request)
        .map(|snapshot| Json(json!(snapshot)))
        .map_err(internal_error)
}

async fn runtime_snapshot(Query(query): Query<SnapshotQuery>) -> HttpResult<serde_json::Value> {
    db::get_runtime_snapshot(&query.target_root)
        .map(|snapshot| Json(json!(snapshot)))
        .map_err(internal_error)
}

async fn execution_events(Query(query): Query<ListExecutionEventsQuery>) -> HttpResult<serde_json::Value> {
    db::list_execution_events(&query)
        .map(|events| Json(json!(events)))
        .map_err(internal_error)
}

async fn transition_execution_state(
    Json(request): Json<TransitionExecutionStateRequest>,
) -> HttpResult<serde_json::Value> {
    db::transition_execution_state(&request)
        .map(|snapshot| Json(json!(snapshot)))
        .map_err(internal_error)
}

async fn materialize_outputs(
    Json(request): Json<MaterializeDerivedOutputsRequest>,
) -> HttpResult<serde_json::Value> {
    db::materialize_derived_outputs(&request)
        .map(|snapshot| Json(json!(snapshot)))
        .map_err(internal_error)
}

async fn persist_derived_output(
    Json(request): Json<PersistDerivedOutputRequest>,
) -> HttpResult<serde_json::Value> {
    db::persist_derived_output(&request)
        .map(|snapshot| Json(json!(snapshot)))
        .map_err(internal_error)
}

fn internal_error(error: anyhow::Error) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, error.to_string())
}

fn write_metadata(metadata_file: &PathBuf, metadata: &RuntimeDaemonMetadata) -> Result<()> {
    if let Some(parent) = metadata_file.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }
    let payload = serde_json::to_string_pretty(metadata)?;
    fs::write(metadata_file, format!("{payload}\n"))
        .with_context(|| format!("failed to write {}", metadata_file.display()))?;
    Ok(())
}

fn metadata_started_at() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{seconds}")
}
