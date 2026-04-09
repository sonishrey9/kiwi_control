use crate::db;
use crate::models::{
    ListExecutionEventsQuery, MaterializeDerivedOutputsRequest, OpenTargetRequest,
    PersistDerivedOutputRequest, PersistRepoGraphRequest, RefreshDerivedOutputsRequest,
    RepoGraphQuery, RuntimeDaemonMetadata, RuntimeIdentity, TransitionExecutionStateRequest,
};
use anyhow::{Context, Result};
use axum::extract::DefaultBodyLimit;
use axum::extract::Query;
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tokio::net::TcpListener;

type HttpResult<T> = Result<Json<T>, (StatusCode, String)>;

#[derive(Clone)]
struct AppState {
    identity: RuntimeIdentity,
}

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
    caller_surface: Option<String>,
    packaging_source_category: Option<String>,
    binary_path: Option<String>,
    target_triple: Option<String>,
) -> Result<()> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .context("failed to bind kiwi-runtime daemon")?;
    let address = listener.local_addr()?;
    let identity = build_runtime_identity(
        &metadata_file,
        launch_mode,
        caller_surface,
        packaging_source_category,
        binary_path,
        target_triple,
    )?;
    let metadata = RuntimeDaemonMetadata {
        pid: std::process::id(),
        port: address.port(),
        base_url: format!("http://127.0.0.1:{}", address.port()),
        started_at: identity.started_at.clone(),
        launch_mode: Some(identity.launch_mode.clone()),
        caller_surface: Some(identity.caller_surface.clone()),
        packaging_source_category: Some(identity.packaging_source_category.clone()),
        binary_path: Some(identity.binary_path.clone()),
        binary_sha256: Some(identity.binary_sha256.clone()),
        runtime_version: Some(identity.runtime_version.clone()),
        target_triple: Some(identity.target_triple.clone()),
        metadata_path: Some(identity.metadata_path.clone()),
    };
    write_metadata(&metadata_file, &metadata)?;

    let app = Router::new()
        .route("/health", get(health))
        .route("/runtime-identity", get(runtime_identity))
        .route("/open-target", post(open_target))
        .route("/runtime-snapshot", get(runtime_snapshot))
        .route("/execution-events", get(execution_events))
        .route("/transition-execution-state", post(transition_execution_state))
        .route("/materialize-derived-outputs", post(materialize_outputs))
        .route("/persist-derived-output", post(persist_derived_output))
        .route("/repo-graph", get(repo_graph))
        .route("/repo-graph", post(persist_repo_graph))
        .route("/repo-graph/build", post(persist_repo_graph))
        .route("/repo-graph-status", get(repo_graph_status))
        .route("/repo-graph/status", get(repo_graph_status))
        .route("/repo-graph/revision", get(repo_graph_status))
        .route("/repo-graph/node", get(repo_graph_node))
        .route("/repo-graph/file", get(repo_graph_file))
        .route("/repo-graph/module", get(repo_graph_module))
        .route("/repo-graph/symbol", get(repo_graph_symbol))
        .route("/repo-graph/neighbors", get(repo_graph_neighbors))
        .route("/repo-graph/impact", get(repo_graph_impact))
        .route("/refresh-derived-outputs", post(refresh_derived_outputs))
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
        .with_state(AppState { identity });

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

async fn runtime_identity(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> HttpResult<RuntimeIdentity> {
    Ok(Json(state.identity))
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

async fn refresh_derived_outputs(
    Json(request): Json<RefreshDerivedOutputsRequest>,
) -> HttpResult<serde_json::Value> {
    db::refresh_derived_outputs(&request)
        .map(|snapshot| Json(json!(snapshot)))
        .map_err(internal_error)
}

async fn persist_repo_graph(
    Json(request): Json<PersistRepoGraphRequest>,
) -> HttpResult<serde_json::Value> {
    db::persist_repo_graph(&request)
        .map(|snapshot| Json(json!(snapshot)))
        .map_err(internal_error)
}

async fn repo_graph(Query(query): Query<SnapshotQuery>) -> HttpResult<serde_json::Value> {
    db::get_repo_graph(&query.target_root)
        .map(|snapshot| Json(json!(snapshot)))
        .map_err(internal_error)
}

async fn repo_graph_status(Query(query): Query<SnapshotQuery>) -> HttpResult<serde_json::Value> {
    db::get_repo_graph_status(&query.target_root)
        .map(|status| Json(json!(status)))
        .map_err(internal_error)
}

async fn repo_graph_node(Query(query): Query<RepoGraphQuery>) -> HttpResult<serde_json::Value> {
    db::query_repo_graph_node(&query)
        .map(|payload| Json(json!(payload)))
        .map_err(internal_error)
}

async fn repo_graph_file(Query(query): Query<RepoGraphQuery>) -> HttpResult<serde_json::Value> {
    db::query_repo_graph_file(&query)
        .map(|payload| Json(json!(payload)))
        .map_err(internal_error)
}

async fn repo_graph_module(Query(query): Query<RepoGraphQuery>) -> HttpResult<serde_json::Value> {
    db::query_repo_graph_module(&query)
        .map(|payload| Json(json!(payload)))
        .map_err(internal_error)
}

async fn repo_graph_symbol(Query(query): Query<RepoGraphQuery>) -> HttpResult<serde_json::Value> {
    db::query_repo_graph_symbol(&query)
        .map(|payload| Json(json!(payload)))
        .map_err(internal_error)
}

async fn repo_graph_neighbors(Query(query): Query<RepoGraphQuery>) -> HttpResult<serde_json::Value> {
    db::query_repo_graph_neighbors(&query)
        .map(|payload| Json(json!(payload)))
        .map_err(internal_error)
}

async fn repo_graph_impact(Query(query): Query<RepoGraphQuery>) -> HttpResult<serde_json::Value> {
    db::query_repo_graph_impact(&query)
        .map(|payload| Json(json!(payload)))
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

fn build_runtime_identity(
    metadata_file: &PathBuf,
    launch_mode: Option<String>,
    caller_surface: Option<String>,
    packaging_source_category: Option<String>,
    binary_path: Option<String>,
    target_triple: Option<String>,
) -> Result<RuntimeIdentity> {
    let started_at = metadata_started_at();
    let current_executable = std::env::current_exe()
        .unwrap_or_else(|_| PathBuf::from(binary_path.clone().unwrap_or_else(|| String::from("unknown"))));
    let resolved_binary_path = current_executable.to_string_lossy().to_string();
    let binary_sha256 = fs::read(&current_executable)
        .ok()
        .map(|bytes| {
            let mut hasher = Sha256::new();
            hasher.update(bytes);
            format!("{:x}", hasher.finalize())
        })
        .unwrap_or_else(|| String::from("unavailable"));

    Ok(RuntimeIdentity {
        launch_mode: launch_mode.unwrap_or_else(|| String::from("direct-binary")),
        caller_surface: caller_surface.unwrap_or_else(|| String::from("cli")),
        packaging_source_category: packaging_source_category.unwrap_or_else(|| String::from("env-override")),
        binary_path: resolved_binary_path,
        binary_sha256,
        runtime_version: env!("CARGO_PKG_VERSION").to_string(),
        target_triple: target_triple.unwrap_or_else(default_target_triple),
        started_at,
        metadata_path: metadata_file.to_string_lossy().to_string(),
    })
}

fn default_target_triple() -> String {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => String::from("aarch64-apple-darwin"),
        ("macos", "x86_64") => String::from("x86_64-apple-darwin"),
        ("linux", "aarch64") => String::from("aarch64-unknown-linux-gnu"),
        ("linux", "x86_64") => String::from("x86_64-unknown-linux-gnu"),
        ("windows", "aarch64") => String::from("aarch64-pc-windows-msvc"),
        ("windows", "x86_64") => String::from("x86_64-pc-windows-msvc"),
        _ => String::from("unknown"),
    }
}
