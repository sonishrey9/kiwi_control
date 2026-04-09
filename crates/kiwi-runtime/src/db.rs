use crate::models::{
    DerivedOutputStatus, ExecutionArtifacts, ExecutionEventList, ListExecutionEventsQuery,
    MaterializeDerivedOutputsRequest, OpenTargetRequest, PersistDerivedOutputRequest,
    PersistRepoGraphRequest, RepoGraphEdge, RepoGraphModule,
    RepoGraphNode, RepoGraphNodeResult, RepoGraphQuery, RepoGraphQueryResolution, RepoGraphSnapshot, RepoGraphStatus,
    RefreshDerivedOutputsRequest,
    RuntimeDecision, RuntimeDecisionAction, RuntimeDecisionRecovery, RuntimeEvent,
    RuntimeLifecycle, RuntimeReadiness, RuntimeSnapshot, TransitionExecutionStateRequest,
    RepoPackSelectionStatus, SetRepoPackSelectionRequest, ClearRepoPackSelectionRequest,
};
use anyhow::{anyhow, Context, Result};
use rusqlite::{params, Connection, OptionalExtension, Transaction, TransactionBehavior};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub const OUTPUT_EXECUTION_STATE: &str = "execution-state";
pub const OUTPUT_EXECUTION_EVENTS: &str = "execution-events";
pub const OUTPUT_REPO_CONTROL_SNAPSHOT: &str = "repo-control-snapshot";
pub const OUTPUT_RUNTIME_LIFECYCLE: &str = "runtime-lifecycle";
pub const OUTPUT_WORKFLOW: &str = "workflow";
pub const OUTPUT_EXECUTION_PLAN: &str = "execution-plan";
pub const OUTPUT_DECISION_LOGIC: &str = "decision-logic";

const ALL_DERIVED_OUTPUTS: &[&str] = &[
    OUTPUT_EXECUTION_STATE,
    OUTPUT_EXECUTION_EVENTS,
    OUTPUT_REPO_CONTROL_SNAPSHOT,
    OUTPUT_RUNTIME_LIFECYCLE,
    OUTPUT_WORKFLOW,
    OUTPUT_EXECUTION_PLAN,
    OUTPUT_DECISION_LOGIC,
];

const REFRESHABLE_DERIVED_OUTPUTS: &[&str] = &[
    OUTPUT_EXECUTION_STATE,
    OUTPUT_EXECUTION_EVENTS,
    OUTPUT_RUNTIME_LIFECYCLE,
    OUTPUT_WORKFLOW,
    OUTPUT_EXECUTION_PLAN,
    OUTPUT_DECISION_LOGIC,
];

const COMPATIBILITY_OUTPUTS: &[&str] = &[OUTPUT_EXECUTION_STATE, OUTPUT_EXECUTION_EVENTS];

pub fn runtime_db_path(target_root: &str) -> PathBuf {
    PathBuf::from(target_root)
        .join(".agent")
        .join("state")
        .join("runtime.sqlite3")
}

pub fn open_target(request: &OpenTargetRequest) -> Result<RuntimeSnapshot> {
    let target_root = normalize_target_root(&request.target_root)?;
    let mut conn = open_connection(&target_root)?;
    ensure_initialized(
        &mut conn,
        &target_root,
        request.root_label.as_deref(),
        request.project_type.as_deref(),
        request.profile_name.as_deref(),
    )?;
    materialize_outputs_for_target(target_root.to_string_lossy().as_ref(), COMPATIBILITY_OUTPUTS)?;
    get_runtime_snapshot(target_root.to_string_lossy().as_ref())
}

pub fn get_runtime_snapshot(target_root: &str) -> Result<RuntimeSnapshot> {
    let target_root = normalize_target_root(target_root)?;
    let mut conn = open_connection(&target_root)?;
    let target_id = ensure_initialized(&mut conn, &target_root, None, None, None)?;
    build_snapshot(&conn, &target_root, target_id)
}

pub fn list_execution_events(query: &ListExecutionEventsQuery) -> Result<ExecutionEventList> {
    let target_root = normalize_target_root(&query.target_root)?;
    let mut conn = open_connection(&target_root)?;
    let target_id = ensure_initialized(&mut conn, &target_root, None, None, None)?;
    let latest_revision = load_state_row(&conn, target_id)?.revision;
    let mut statement = conn.prepare(
        "SELECT event_id, revision, operation_id, event_type, lifecycle, task, source_command, reason,
                next_command, blocked_by_json, artifacts_json, actor, recorded_at
           FROM execution_events
          WHERE target_id = ?1 AND revision > ?2
          ORDER BY revision ASC",
    )?;
    let rows = statement.query_map(params![target_id, query.after_revision.unwrap_or(0)], |row| {
        Ok(RuntimeEvent {
            event_id: row.get(0)?,
            revision: row.get(1)?,
            operation_id: row.get(2)?,
            event_type: row.get(3)?,
            lifecycle: RuntimeLifecycle::from_any(&row.get::<_, String>(4)?)
                .ok_or_else(|| rusqlite::Error::InvalidQuery)?,
            task: row.get(5)?,
            source_command: row.get(6)?,
            reason: row.get(7)?,
            next_command: row.get(8)?,
            blocked_by: json_from_str(&row.get::<_, String>(9)?)
                .map_err(|_| rusqlite::Error::InvalidQuery)?,
            artifacts: json_from_str(&row.get::<_, String>(10)?)
                .map_err(|_| rusqlite::Error::InvalidQuery)?,
            actor: row.get(11)?,
            recorded_at: row.get(12)?,
        })
    })?;

    let mut events = Vec::new();
    for row in rows {
        events.push(row?);
    }

    Ok(ExecutionEventList {
        target_root: target_root.to_string_lossy().to_string(),
        latest_revision,
        events,
    })
}

pub fn transition_execution_state(request: &TransitionExecutionStateRequest) -> Result<RuntimeSnapshot> {
    let target_root = normalize_target_root(&request.target_root)?;
    let mut conn = open_connection(&target_root)?;
    let target_id = ensure_initialized(&mut conn, &target_root, None, None, None)?;
    let mut current = load_state_row(&conn, target_id)?;
    let timestamp = timestamp_now();
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .context("failed to start execution-state transaction")?;

    let next_revision = current.revision + 1;
    let reuse_operation = request
        .reuse_operation
        .unwrap_or(request.lifecycle != RuntimeLifecycle::Idle);
    let next_operation_id = if request.lifecycle == RuntimeLifecycle::Idle {
        None
    } else if let Some(operation_id) = request.operation_id.clone() {
        Some(operation_id)
    } else if reuse_operation {
        current
            .operation_id
            .clone()
            .or_else(|| Some(Uuid::new_v4().to_string()))
    } else {
        Some(Uuid::new_v4().to_string())
    };
    let next_artifacts = if reuse_operation
        && next_operation_id.is_some()
        && next_operation_id == current.operation_id
    {
        merge_artifacts(&current.artifacts, request.artifacts.as_ref())
    } else {
        normalize_artifacts(request.artifacts.clone().unwrap_or_default())
    };
    let next_blocked_by = normalize_string_list(request.blocked_by.clone().unwrap_or_default());
    let next_task = if request.clear_task.unwrap_or(false) {
        None
    } else if let Some(task) = request.task.clone() {
        Some(task)
    } else if reuse_operation {
        current.task.clone()
    } else {
        None
    };
    let next_source_command = if let Some(source_command) = request.source_command.clone() {
        Some(source_command)
    } else if reuse_operation {
        current.source_command.clone()
    } else {
        None
    };

    let event = RuntimeEvent {
        event_id: None,
        revision: next_revision,
        operation_id: next_operation_id.clone(),
        event_type: request.event_type.clone(),
        lifecycle: request.lifecycle,
        task: next_task.clone(),
        source_command: next_source_command.clone(),
        reason: request.reason.clone(),
        next_command: request.next_command.clone(),
        blocked_by: next_blocked_by.clone(),
        artifacts: next_artifacts.clone(),
        actor: request
            .actor
            .clone()
            .unwrap_or_else(|| String::from("kiwi-runtime")),
        recorded_at: timestamp.clone(),
    };
    let event_id = insert_event(&tx, target_id, &event)?;

    current = StoredExecutionState {
        target_id,
        revision: next_revision,
        operation_id: next_operation_id,
        task: next_task,
        source_command: next_source_command,
        lifecycle: request.lifecycle,
        reason: request.reason.clone(),
        next_command: request.next_command.clone(),
        blocked_by: next_blocked_by,
        artifacts: next_artifacts,
        last_updated_at: Some(timestamp.clone()),
        last_event_id: Some(event_id),
    };
    upsert_state(&tx, &current)?;
    let decision = request
        .decision
        .clone()
        .map(|decision| normalize_runtime_decision(decision, &timestamp))
        .unwrap_or_else(|| decision_from_state(&current, &timestamp));
    insert_decision(&tx, target_id, next_revision, &decision)?;

    let invalidated_outputs = if let Some(outputs) = request.invalidate_outputs.clone() {
        outputs
    } else {
        ALL_DERIVED_OUTPUTS.iter().map(|value| (*value).to_string()).collect()
    };
    mark_outputs_stale(&tx, &target_root, target_id, &invalidated_outputs, &timestamp)?;

    let digest = state_digest(&current)?;
    tx.execute(
        "INSERT INTO state_revisions (target_id, revision, change_kind, trigger_command, state_digest, compatibility_dirty, recorded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            target_id,
            next_revision,
            request.event_type,
            request
                .trigger_command
                .clone()
                .or_else(|| request.source_command.clone()),
            digest,
            if invalidated_outputs.is_empty() { 0 } else { 1 },
            timestamp
        ],
    )?;
    tx.commit()?;

    let materialize_outputs = request
        .materialize_outputs
        .clone()
        .unwrap_or_else(|| COMPATIBILITY_OUTPUTS.iter().map(|value| (*value).to_string()).collect());
    if !materialize_outputs.is_empty() {
        materialize_outputs_for_target(
            target_root.to_string_lossy().as_ref(),
            &materialize_outputs
                .iter()
                .map(String::as_str)
                .collect::<Vec<_>>(),
        )?;
    }

    get_runtime_snapshot(target_root.to_string_lossy().as_ref())
}

pub fn materialize_derived_outputs(request: &MaterializeDerivedOutputsRequest) -> Result<RuntimeSnapshot> {
    materialize_outputs_for_target(&request.target_root, &request.outputs.iter().map(String::as_str).collect::<Vec<_>>())?;
    get_runtime_snapshot(&request.target_root)
}

pub fn refresh_derived_outputs(request: &RefreshDerivedOutputsRequest) -> Result<RuntimeSnapshot> {
    let target_root = normalize_target_root(&request.target_root)?;
    materialize_outputs_for_target(
        target_root.to_string_lossy().as_ref(),
        REFRESHABLE_DERIVED_OUTPUTS,
    )?;
    get_runtime_snapshot(target_root.to_string_lossy().as_ref())
}

pub fn persist_derived_output(request: &PersistDerivedOutputRequest) -> Result<RuntimeSnapshot> {
    let target_root = normalize_target_root(&request.target_root)?;
    let mut conn = open_connection(&target_root)?;
    let target_id = ensure_initialized(&mut conn, &target_root, None, None, None)?;
    let state = load_state_row(&conn, target_id)?;
    let output_file_path = output_path(&target_root, &request.output_name);
    write_json_file(&output_file_path, &request.payload)?;
    mark_output_fresh(
        &conn,
        target_id,
        &request.output_name,
        &output_file_path,
        request.source_revision.unwrap_or(state.revision),
        &timestamp_now(),
    )?;
    get_runtime_snapshot(target_root.to_string_lossy().as_ref())
}

pub fn persist_repo_graph(request: &PersistRepoGraphRequest) -> Result<RepoGraphSnapshot> {
    let target_root = normalize_target_root(&request.target_root)?;
    let mut conn = open_connection(&target_root)?;
    let target_id = ensure_initialized(&mut conn, &target_root, None, None, None)?;
    let state = load_state_row(&conn, target_id)?;
    let source_revision = request.source_revision.unwrap_or(state.revision);
    let graph_json = json_string(&json!({ "nodes": request.nodes, "edges": request.edges, "modules": request.modules }))?;
    let source_digest = request.compatibility_hash.clone().unwrap_or_else(|| digest_string(&graph_json));
    let latest = load_normalized_repo_graph_status(&conn)?;

    if let Some(latest) = latest.as_ref() {
        if latest.source_digest == source_digest
            && latest.source_runtime_revision == source_revision
            && latest.status == "ready"
        {
            return get_repo_graph(target_root.to_string_lossy().as_ref());
        }
    }

    let timestamp = timestamp_now();
    let graph_revision = latest.map(|row| row.graph_revision + 1).unwrap_or(1);
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .context("failed to start repo graph transaction")?;
    tx.execute(
        "INSERT INTO repo_graph_revisions (graph_revision, source_runtime_revision, status, summary, created_at, graph_kind, node_count, edge_count, module_count, symbol_count, artifact_path, compatibility_hash)
         VALUES (?1, ?2, 'ready', ?3, ?4, 'repo', ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            graph_revision,
            source_revision,
            request.summary,
            timestamp,
            request.nodes.len() as i64,
            request.edges.len() as i64,
            request.modules.len() as i64,
            request.nodes.iter().filter(|node| node.node_kind == "symbol").count() as i64,
            request.artifact_path.clone().unwrap_or_else(|| String::from(".agent/context/repo-map.json")),
            source_digest
        ],
    )?;
    persist_normalized_repo_graph_rows(&tx, &target_root, graph_revision, &request.modules, &request.nodes, &request.edges)?;
    tx.execute(
        "INSERT INTO repo_graph_events (target_id, graph_revision, source_revision, event_type, source_digest, recorded_at)
         VALUES (?1, ?2, ?3, 'graph-persisted', ?4, ?5)",
        params![target_id, graph_revision, source_revision, source_digest, timestamp],
    )?;
    tx.commit()?;
    get_repo_graph(target_root.to_string_lossy().as_ref())
}

pub fn get_repo_graph(target_root: &str) -> Result<RepoGraphSnapshot> {
    let target_root = normalize_target_root(target_root)?;
    let mut conn = open_connection(&target_root)?;
    let _target_id = ensure_initialized(&mut conn, &target_root, None, None, None)?;
    let status = get_repo_graph_status(target_root.to_string_lossy().as_ref())?;
    let Some(graph_revision) = status.graph_revision else {
        return Ok(RepoGraphSnapshot { status, nodes: Vec::new(), edges: Vec::new(), modules: Vec::new() });
    };
    Ok(RepoGraphSnapshot {
        status,
        nodes: load_repo_graph_nodes(&conn, graph_revision)?,
        edges: load_repo_graph_edges(&conn, graph_revision)?,
        modules: load_repo_graph_modules(&conn, graph_revision)?,
    })
}

pub fn get_repo_graph_status(target_root: &str) -> Result<RepoGraphStatus> {
    let target_root = normalize_target_root(target_root)?;
    let mut conn = open_connection(&target_root)?;
    let target_id = ensure_initialized(&mut conn, &target_root, None, None, None)?;
    repo_graph_status_from_revision(&conn, &target_root, target_id, load_normalized_repo_graph_status(&conn)?.as_ref())
}

pub fn query_repo_graph_node(query: &RepoGraphQuery) -> Result<RepoGraphNodeResult> {
    query_repo_graph(query, "node")
}

pub fn query_repo_graph_file(query: &RepoGraphQuery) -> Result<RepoGraphNodeResult> {
    query_repo_graph(query, "file")
}

pub fn query_repo_graph_module(query: &RepoGraphQuery) -> Result<RepoGraphNodeResult> {
    query_repo_graph(query, "module")
}

pub fn query_repo_graph_symbol(query: &RepoGraphQuery) -> Result<RepoGraphNodeResult> {
    query_repo_graph(query, "symbol")
}

pub fn query_repo_graph_neighbors(query: &RepoGraphQuery) -> Result<RepoGraphNodeResult> {
    query_repo_graph(query, "neighbors")
}

pub fn query_repo_graph_impact(query: &RepoGraphQuery) -> Result<RepoGraphNodeResult> {
    query_repo_graph(query, "impact")
}

pub fn get_repo_pack_selection_status(target_root: &str) -> Result<RepoPackSelectionStatus> {
    let target_root = normalize_target_root(target_root)?;
    let mut conn = open_connection(&target_root)?;
    let target_id = ensure_initialized(&mut conn, &target_root, None, None, None)?;
    Ok(build_repo_pack_selection_status(&conn, &target_root, target_id)?)
}

pub fn set_repo_pack_selection(request: &SetRepoPackSelectionRequest) -> Result<RuntimeSnapshot> {
    let target_root = normalize_target_root(&request.target_root)?;
    let mut conn = open_connection(&target_root)?;
    let target_id = ensure_initialized(&mut conn, &target_root, None, None, None)?;
    let current_selection = load_repo_pack_selection_row(&conn, target_id)?;
    if current_selection
        .as_ref()
        .map(|row| row.selected_pack_id.as_str())
        == Some(request.pack_id.as_str())
    {
        return get_runtime_snapshot(target_root.to_string_lossy().as_ref());
    }

    let mut current = load_state_row(&conn, target_id)?;
    let timestamp = timestamp_now();
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .context("failed to start repo-pack selection transaction")?;
    upsert_repo_pack_selection_row(
        &tx,
        target_id,
        &request.pack_id,
        request.selection_source.as_deref().unwrap_or("runtime-explicit"),
        &timestamp,
    )?;
    apply_repo_pack_selection_event(
        &tx,
        &mut current,
        target_id,
        "repo-pack-selected",
        request.trigger_command.clone(),
        request.actor.clone(),
        format!("Selected MCP pack {}.", request.pack_id),
        &timestamp,
    )?;
    tx.commit()?;
    get_runtime_snapshot(target_root.to_string_lossy().as_ref())
}

pub fn clear_repo_pack_selection(request: &ClearRepoPackSelectionRequest) -> Result<RuntimeSnapshot> {
    let target_root = normalize_target_root(&request.target_root)?;
    let mut conn = open_connection(&target_root)?;
    let target_id = ensure_initialized(&mut conn, &target_root, None, None, None)?;
    if load_repo_pack_selection_row(&conn, target_id)?.is_none() {
        return get_runtime_snapshot(target_root.to_string_lossy().as_ref());
    }

    let mut current = load_state_row(&conn, target_id)?;
    let timestamp = timestamp_now();
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .context("failed to start repo-pack clear transaction")?;
    tx.execute(
        "DELETE FROM repo_pack_selection WHERE target_id = ?1",
        params![target_id],
    )?;
    apply_repo_pack_selection_event(
        &tx,
        &mut current,
        target_id,
        "repo-pack-cleared",
        request.trigger_command.clone(),
        request.actor.clone(),
        String::from("Cleared the explicit MCP pack selection."),
        &timestamp,
    )?;
    tx.commit()?;
    get_runtime_snapshot(target_root.to_string_lossy().as_ref())
}

fn query_repo_graph(query: &RepoGraphQuery, query_kind: &str) -> Result<RepoGraphNodeResult> {
    let target_root = normalize_target_root(&query.target_root)?;
    let mut conn = open_connection(&target_root)?;
    let target_id = ensure_initialized(&mut conn, &target_root, None, None, None)?;
    let status = repo_graph_status_from_revision(&conn, &target_root, target_id, load_normalized_repo_graph_status(&conn)?.as_ref())?;
    let Some(graph_revision) = status.graph_revision else {
        return Ok(RepoGraphNodeResult {
            status,
            query_resolution: None,
            node: None,
            matches: Vec::new(),
            incoming: Vec::new(),
            outgoing: Vec::new(),
        });
    };
    let (matches, query_resolution) = resolve_repo_graph_query_nodes(&conn, graph_revision, query, query_kind)?;
    let node = matches.first().cloned();
    log_repo_graph_query(&conn, graph_revision, query_kind, query)?;
    let (incoming, outgoing) = if let Some(node) = node.as_ref() {
        if query_kind == "impact" {
            (
                load_edges_touching_node(&conn, graph_revision, &node.node_id, true)?,
                load_edges_touching_node(&conn, graph_revision, &node.node_id, false)?,
            )
        } else {
            (
                load_repo_graph_incoming_edges(&conn, graph_revision, &node.node_id)?,
                load_repo_graph_outgoing_edges(&conn, graph_revision, &node.node_id)?,
            )
        }
    } else {
        (Vec::new(), Vec::new())
    };

    Ok(RepoGraphNodeResult {
        status,
        query_resolution,
        node,
        matches,
        incoming,
        outgoing,
    })
}

fn materialize_outputs_for_target(target_root: &str, outputs: &[&str]) -> Result<()> {
    let target_root = normalize_target_root(target_root)?;
    let mut conn = open_connection(&target_root)?;
    let target_id = ensure_initialized(&mut conn, &target_root, None, None, None)?;
    let state = load_state_row(&conn, target_id)?;
    let decision = load_decision_row(&conn, target_id, state.revision)?
        .unwrap_or_else(|| decision_from_state(&state, state.last_updated_at.as_deref().unwrap_or("1970-01-01T00:00:00Z")));
    let events = load_events(&conn, target_id)?;
    let now = timestamp_now();

    for output in outputs {
        match *output {
            OUTPUT_EXECUTION_STATE => {
                let payload = compatibility_execution_state(&state, events.last().cloned())?;
                write_json_file(&output_path(&target_root, output), &payload)?;
                mark_output_fresh(
                    &conn,
                    target_id,
                    output,
                    &output_path(&target_root, output),
                    state.revision,
                    &now,
                )?;
            }
            OUTPUT_EXECUTION_EVENTS => {
                write_events_file(&output_path(&target_root, output), &events)?;
                mark_output_fresh(
                    &conn,
                    target_id,
                    output,
                    &output_path(&target_root, output),
                    state.revision,
                    &now,
                )?;
            }
            OUTPUT_RUNTIME_LIFECYCLE => {
                let payload = compatibility_runtime_lifecycle(&state, &decision, events.last(), &now);
                write_json_file(&output_path(&target_root, output), &payload)?;
                mark_output_fresh(&conn, target_id, output, &output_path(&target_root, output), state.revision, &now)?;
            }
            OUTPUT_WORKFLOW => {
                let payload = compatibility_workflow(&state, &decision, &now);
                write_json_file(&output_path(&target_root, output), &payload)?;
                mark_output_fresh(&conn, target_id, output, &output_path(&target_root, output), state.revision, &now)?;
            }
            OUTPUT_EXECUTION_PLAN => {
                let payload = compatibility_execution_plan(&state, &decision, &now);
                write_json_file(&output_path(&target_root, output), &payload)?;
                mark_output_fresh(&conn, target_id, output, &output_path(&target_root, output), state.revision, &now)?;
            }
            OUTPUT_DECISION_LOGIC => {
                let payload = compatibility_decision_logic(&state, &decision, &now);
                write_json_file(&output_path(&target_root, output), &payload)?;
                mark_output_fresh(&conn, target_id, output, &output_path(&target_root, output), state.revision, &now)?;
            }
            OUTPUT_REPO_CONTROL_SNAPSHOT => {
                let payload = compatibility_repo_control_snapshot(&state, &decision, &now);
                write_json_file(&output_path(&target_root, output), &payload)?;
                mark_output_fresh(&conn, target_id, output, &output_path(&target_root, output), state.revision, &now)?;
            }
            unsupported => {
                mark_output_error(
                    &conn,
                    target_id,
                    unsupported,
                    &output_path(&target_root, unsupported),
                    &format!("materialization is not implemented for {unsupported}"),
                    &now,
                )?;
            }
        }
    }

    Ok(())
}

fn open_connection(target_root: &Path) -> Result<Connection> {
    let db_path = runtime_db_path(target_root.to_string_lossy().as_ref());
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("failed to create {}", parent.display()))?;
    }
    let conn = Connection::open(&db_path)
        .with_context(|| format!("failed to open runtime database at {}", db_path.display()))?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA synchronous=FULL;
         PRAGMA foreign_keys=ON;
         PRAGMA busy_timeout=5000;
         PRAGMA wal_autocheckpoint=1000;",
    )?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS repo_targets (
            id INTEGER PRIMARY KEY,
            canonical_root TEXT UNIQUE NOT NULL,
            root_label TEXT NOT NULL,
            project_type TEXT,
            profile_name TEXT,
            created_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS execution_events (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_id INTEGER NOT NULL,
            revision INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            operation_id TEXT,
            lifecycle TEXT NOT NULL,
            task TEXT,
            source_command TEXT,
            reason TEXT,
            next_command TEXT,
            blocked_by_json TEXT NOT NULL,
            artifacts_json TEXT NOT NULL,
            actor TEXT NOT NULL,
            recorded_at TEXT NOT NULL,
            FOREIGN KEY(target_id) REFERENCES repo_targets(id),
            UNIQUE(target_id, revision)
         );
         CREATE TABLE IF NOT EXISTS execution_state (
            target_id INTEGER PRIMARY KEY,
            revision INTEGER NOT NULL,
            operation_id TEXT,
            task TEXT,
            source_command TEXT,
            lifecycle TEXT NOT NULL,
            reason TEXT,
            next_command TEXT,
            blocked_by_json TEXT NOT NULL,
            artifacts_json TEXT NOT NULL,
            last_event_id INTEGER,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(target_id) REFERENCES repo_targets(id),
            FOREIGN KEY(last_event_id) REFERENCES execution_events(event_id)
         );
         CREATE TABLE IF NOT EXISTS decision_state (
            target_id INTEGER NOT NULL,
            revision INTEGER NOT NULL,
            current_step_id TEXT NOT NULL,
            current_step_label TEXT NOT NULL,
            current_step_status TEXT NOT NULL,
            next_command TEXT,
            readiness_label TEXT NOT NULL,
            readiness_tone TEXT NOT NULL,
            readiness_detail TEXT NOT NULL,
            next_action_json TEXT NOT NULL,
            recovery_json TEXT,
            decision_source TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY(target_id, revision),
            FOREIGN KEY(target_id) REFERENCES repo_targets(id)
         );
         CREATE TABLE IF NOT EXISTS state_revisions (
            target_id INTEGER NOT NULL,
            revision INTEGER NOT NULL,
            change_kind TEXT NOT NULL,
            trigger_command TEXT,
            state_digest TEXT NOT NULL,
            compatibility_dirty INTEGER NOT NULL,
            recorded_at TEXT NOT NULL,
            PRIMARY KEY(target_id, revision),
            FOREIGN KEY(target_id) REFERENCES repo_targets(id)
         );
         CREATE TABLE IF NOT EXISTS derived_outputs (
            target_id INTEGER NOT NULL,
            output_name TEXT NOT NULL,
            path TEXT NOT NULL,
            source_revision INTEGER,
            freshness TEXT NOT NULL,
            generated_at TEXT,
            invalidated_at TEXT,
            last_error TEXT,
            PRIMARY KEY(target_id, output_name),
            FOREIGN KEY(target_id) REFERENCES repo_targets(id)
         );
         CREATE TABLE IF NOT EXISTS repo_graph_events (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_id INTEGER NOT NULL,
            graph_revision INTEGER NOT NULL,
            source_revision INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            source_digest TEXT NOT NULL,
            recorded_at TEXT NOT NULL,
            FOREIGN KEY(target_id) REFERENCES repo_targets(id)
         );
         CREATE TABLE IF NOT EXISTS repo_graph_revisions (
            graph_revision INTEGER PRIMARY KEY,
            source_runtime_revision INTEGER NOT NULL,
            status TEXT NOT NULL,
            summary TEXT,
            created_at TEXT NOT NULL,
            graph_kind TEXT NOT NULL DEFAULT 'repo',
            node_count INTEGER NOT NULL DEFAULT 0,
            edge_count INTEGER NOT NULL DEFAULT 0,
            module_count INTEGER NOT NULL DEFAULT 0,
            symbol_count INTEGER NOT NULL DEFAULT 0,
            artifact_path TEXT,
            compatibility_hash TEXT
         );
         CREATE TABLE IF NOT EXISTS repo_graph_nodes (
            graph_revision INTEGER NOT NULL,
            node_id TEXT NOT NULL,
            node_kind TEXT NOT NULL,
            path TEXT,
            module_id TEXT,
            symbol TEXT,
            display_label TEXT NOT NULL,
            language TEXT,
            attributes_json TEXT NOT NULL,
            PRIMARY KEY(graph_revision, node_id),
            FOREIGN KEY(graph_revision) REFERENCES repo_graph_revisions(graph_revision)
         );
         CREATE TABLE IF NOT EXISTS repo_graph_edges (
            graph_revision INTEGER NOT NULL,
            edge_id TEXT NOT NULL,
            from_node_id TEXT NOT NULL,
            to_node_id TEXT NOT NULL,
            edge_kind TEXT NOT NULL,
            weight REAL,
            evidence_json TEXT NOT NULL,
            PRIMARY KEY(graph_revision, edge_id),
            FOREIGN KEY(graph_revision) REFERENCES repo_graph_revisions(graph_revision)
         );
         CREATE TABLE IF NOT EXISTS repo_graph_modules (
            graph_revision INTEGER NOT NULL,
            module_id TEXT NOT NULL,
            display_label TEXT NOT NULL,
            summary TEXT,
            attributes_json TEXT NOT NULL,
            PRIMARY KEY(graph_revision, module_id),
            FOREIGN KEY(graph_revision) REFERENCES repo_graph_revisions(graph_revision)
         );
         CREATE TABLE IF NOT EXISTS repo_graph_query_log (
            id INTEGER PRIMARY KEY,
            graph_revision INTEGER NOT NULL,
            query_kind TEXT NOT NULL,
            query_value TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(graph_revision) REFERENCES repo_graph_revisions(graph_revision)
         );
         CREATE TABLE IF NOT EXISTS repo_graph_aliases (
            graph_revision INTEGER NOT NULL,
            alias_kind TEXT NOT NULL,
            alias_value TEXT NOT NULL,
            canonical_node_id TEXT NOT NULL,
            canonical_module_id TEXT,
            confidence INTEGER NOT NULL,
            source TEXT NOT NULL,
            PRIMARY KEY(graph_revision, alias_kind, alias_value, canonical_node_id),
            FOREIGN KEY(graph_revision) REFERENCES repo_graph_revisions(graph_revision)
         );
         CREATE TABLE IF NOT EXISTS repo_pack_selection (
            target_id INTEGER PRIMARY KEY,
            selected_pack_id TEXT NOT NULL,
            selection_source TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(target_id) REFERENCES repo_targets(id)
         );",
    )?;
    conn.execute_batch("DROP TABLE IF EXISTS repo_graph_state;")?;
    conn.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_repo_graph_revisions_latest ON repo_graph_revisions(graph_revision DESC);
         CREATE INDEX IF NOT EXISTS idx_repo_graph_nodes_kind ON repo_graph_nodes(graph_revision, node_kind);
         CREATE INDEX IF NOT EXISTS idx_repo_graph_nodes_path ON repo_graph_nodes(graph_revision, path);
         CREATE INDEX IF NOT EXISTS idx_repo_graph_nodes_module ON repo_graph_nodes(graph_revision, module_id);
         CREATE INDEX IF NOT EXISTS idx_repo_graph_nodes_symbol ON repo_graph_nodes(graph_revision, symbol);
         CREATE INDEX IF NOT EXISTS idx_repo_graph_edges_from ON repo_graph_edges(graph_revision, from_node_id);
         CREATE INDEX IF NOT EXISTS idx_repo_graph_edges_to ON repo_graph_edges(graph_revision, to_node_id);
         CREATE INDEX IF NOT EXISTS idx_repo_graph_edges_kind ON repo_graph_edges(graph_revision, edge_kind);
         CREATE INDEX IF NOT EXISTS idx_repo_graph_aliases_value ON repo_graph_aliases(graph_revision, alias_value);
         CREATE INDEX IF NOT EXISTS idx_repo_graph_aliases_kind ON repo_graph_aliases(graph_revision, alias_kind);
         CREATE INDEX IF NOT EXISTS idx_repo_graph_aliases_module ON repo_graph_aliases(graph_revision, canonical_module_id);",
    )?;
    Ok(conn)
}

fn ensure_initialized(
    conn: &mut Connection,
    target_root: &Path,
    root_label: Option<&str>,
    project_type: Option<&str>,
    profile_name: Option<&str>,
) -> Result<i64> {
    let target_id = upsert_target_row(conn, target_root, root_label, project_type, profile_name)?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM execution_state WHERE target_id = ?1",
        params![target_id],
        |row| row.get(0),
    )?;
    if count == 0 {
        import_or_seed(conn, target_root, target_id)?;
    } else {
        backfill_decision_state_if_missing(conn, target_id)?;
    }
    Ok(target_id)
}

fn upsert_target_row(
    conn: &Connection,
    target_root: &Path,
    root_label: Option<&str>,
    project_type: Option<&str>,
    profile_name: Option<&str>,
) -> Result<i64> {
    let canonical_root = target_root.to_string_lossy().to_string();
    let label = root_label
        .map(str::to_string)
        .unwrap_or_else(|| target_root.file_name().map(|value| value.to_string_lossy().to_string()).unwrap_or_else(|| canonical_root.clone()));
    let now = timestamp_now();
    conn.execute(
        "INSERT INTO repo_targets (canonical_root, root_label, project_type, profile_name, created_at, last_seen_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(canonical_root) DO UPDATE SET
             root_label = excluded.root_label,
             project_type = COALESCE(excluded.project_type, repo_targets.project_type),
             profile_name = COALESCE(excluded.profile_name, repo_targets.profile_name),
             last_seen_at = excluded.last_seen_at",
        params![canonical_root, label, project_type, profile_name, now, now],
    )?;
    conn.query_row(
        "SELECT id FROM repo_targets WHERE canonical_root = ?1",
        params![target_root.to_string_lossy().to_string()],
        |row| row.get(0),
    )
    .context("failed to resolve repo target row")
}

fn import_or_seed(conn: &Connection, target_root: &Path, target_id: i64) -> Result<()> {
    if import_legacy_execution_state(conn, target_root, target_id)? {
        return Ok(());
    }

    let timestamp = timestamp_now();
    let state = StoredExecutionState {
        target_id,
        revision: 0,
        operation_id: None,
        task: None,
        source_command: None,
        lifecycle: RuntimeLifecycle::Idle,
        reason: None,
        next_command: None,
        blocked_by: Vec::new(),
        artifacts: BTreeMap::new(),
        last_updated_at: Some(timestamp.clone()),
        last_event_id: None,
    };
    upsert_state_direct(conn, &state)?;
    insert_decision(conn, target_id, 0, &decision_from_state(&state, &timestamp))?;
    conn.execute(
        "INSERT INTO state_revisions (target_id, revision, change_kind, trigger_command, state_digest, compatibility_dirty, recorded_at)
         VALUES (?1, 0, 'seed', NULL, ?2, 1, ?3)",
        params![target_id, state_digest(&state)?, timestamp],
    )?;
    mark_all_outputs_stale(conn, target_root, target_id, &timestamp)?;
    Ok(())
}

#[derive(Clone, Debug)]
struct StoredRepoPackSelection {
    selected_pack_id: String,
    selection_source: String,
    updated_at: String,
}

fn load_repo_pack_selection_row(conn: &Connection, target_id: i64) -> Result<Option<StoredRepoPackSelection>> {
    conn.query_row(
        "SELECT selected_pack_id, selection_source, updated_at
           FROM repo_pack_selection
          WHERE target_id = ?1",
        params![target_id],
        |row| {
            Ok(StoredRepoPackSelection {
                selected_pack_id: row.get(0)?,
                selection_source: row.get(1)?,
                updated_at: row.get(2)?,
            })
        },
    )
    .optional()
    .context("failed to load repo pack selection")
}

fn build_repo_pack_selection_status(
    conn: &Connection,
    target_root: &Path,
    target_id: i64,
) -> Result<RepoPackSelectionStatus> {
    let selection = load_repo_pack_selection_row(conn, target_id)?;
    Ok(RepoPackSelectionStatus {
        target_root: target_root.to_string_lossy().to_string(),
        selected_pack_id: selection.as_ref().map(|row| row.selected_pack_id.clone()),
        selected_pack_source: selection.as_ref().map(|row| row.selection_source.clone()),
        updated_at: selection.as_ref().map(|row| row.updated_at.clone()),
    })
}

fn upsert_repo_pack_selection_row(
    tx: &Transaction<'_>,
    target_id: i64,
    selected_pack_id: &str,
    selection_source: &str,
    updated_at: &str,
) -> Result<()> {
    tx.execute(
        "INSERT INTO repo_pack_selection (target_id, selected_pack_id, selection_source, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(target_id) DO UPDATE SET
            selected_pack_id = excluded.selected_pack_id,
            selection_source = excluded.selection_source,
            updated_at = excluded.updated_at",
        params![target_id, selected_pack_id, selection_source, updated_at],
    )?;
    Ok(())
}

fn apply_repo_pack_selection_event(
    tx: &Transaction<'_>,
    current: &mut StoredExecutionState,
    target_id: i64,
    event_type: &str,
    trigger_command: Option<String>,
    actor: Option<String>,
    reason: String,
    timestamp: &str,
) -> Result<()> {
    let next_revision = current.revision + 1;
    let event = RuntimeEvent {
        event_id: None,
        revision: next_revision,
        operation_id: current.operation_id.clone(),
        event_type: String::from(event_type),
        lifecycle: current.lifecycle,
        task: current.task.clone(),
        source_command: trigger_command.clone(),
        reason: Some(reason),
        next_command: current.next_command.clone(),
        blocked_by: current.blocked_by.clone(),
        artifacts: BTreeMap::new(),
        actor: actor.unwrap_or_else(|| String::from("kiwi-runtime-pack")),
        recorded_at: timestamp.to_string(),
    };
    let event_id = insert_event(tx, target_id, &event)?;
    current.revision = next_revision;
    current.last_event_id = Some(event_id);
    current.last_updated_at = Some(timestamp.to_string());
    upsert_state(tx, current)?;
    let decision = load_decision_row(tx, target_id, current.revision - 1)?
        .unwrap_or_else(|| decision_from_state(current, timestamp));
    insert_decision(tx, target_id, next_revision, &normalize_runtime_decision(decision, timestamp))?;
    let digest = state_digest(current)?;
    tx.execute(
        "INSERT INTO state_revisions (target_id, revision, change_kind, trigger_command, state_digest, compatibility_dirty, recorded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)",
        params![target_id, next_revision, event_type, trigger_command, digest, timestamp],
    )?;
    Ok(())
}

fn import_legacy_execution_state(conn: &Connection, target_root: &Path, target_id: i64) -> Result<bool> {
    let state_root = target_root.join(".agent").join("state");
    let canonical_state_path = state_root.join("execution-state.json");
    if canonical_state_path.exists() {
        let legacy_state: LegacyExecutionStateRecord = read_json_file(&canonical_state_path)
            .with_context(|| format!("failed to read {}", canonical_state_path.display()))?;
        if legacy_state.artifact_type != "kiwi-control/execution-state" || legacy_state.version != 1 {
            return Ok(false);
        }

        let imported_events = read_legacy_events(&state_root.join("execution-events.ndjson"))?;
        let state = StoredExecutionState {
            target_id,
            revision: legacy_state.revision,
            operation_id: legacy_state.operation_id,
            task: legacy_state.task,
            source_command: legacy_state.source_command,
            lifecycle: RuntimeLifecycle::from_any(&legacy_state.lifecycle).unwrap_or(RuntimeLifecycle::Idle),
            reason: legacy_state.reason,
            next_command: legacy_state.next_command,
            blocked_by: normalize_string_list(legacy_state.blocked_by.unwrap_or_default()),
            artifacts: normalize_artifacts(legacy_state.artifacts.unwrap_or_default()),
            last_updated_at: legacy_state.last_updated_at,
            last_event_id: None,
        };
        let mut last_event_id = None;
        if imported_events.is_empty() && state.revision > 0 {
            let synthetic = RuntimeEvent {
                event_id: None,
                revision: state.revision,
                operation_id: state.operation_id.clone(),
                event_type: String::from("legacy-import"),
                lifecycle: state.lifecycle,
                task: state.task.clone(),
                source_command: state.source_command.clone(),
                reason: state.reason.clone(),
                next_command: state.next_command.clone(),
                blocked_by: state.blocked_by.clone(),
                artifacts: state.artifacts.clone(),
                actor: String::from("legacy-import"),
                recorded_at: state
                    .last_updated_at
                    .clone()
                    .unwrap_or_else(timestamp_now),
            };
            last_event_id = Some(insert_event(conn, target_id, &synthetic)?);
        } else {
            for event in imported_events {
                last_event_id = Some(insert_event(conn, target_id, &event)?);
            }
        }

        let imported_state = StoredExecutionState {
            last_event_id,
            ..state
        };
        upsert_state_direct(conn, &imported_state)?;
        let imported_timestamp = imported_state
            .last_updated_at
            .clone()
            .unwrap_or_else(timestamp_now);
        let imported_decision = decision_from_state(&imported_state, &imported_timestamp);
        insert_decision(conn, target_id, imported_state.revision, &imported_decision)?;
        conn.execute(
            "INSERT INTO state_revisions (target_id, revision, change_kind, trigger_command, state_digest, compatibility_dirty, recorded_at)
             VALUES (?1, ?2, 'legacy_import', ?3, ?4, 1, ?5)",
            params![
                target_id,
                imported_state.revision,
                imported_state.source_command,
                state_digest(&imported_state)?,
                imported_timestamp
            ],
        )?;
        mark_all_outputs_stale(conn, target_root, target_id, &imported_timestamp)?;
        return Ok(true);
    }

    let derived = derive_legacy_state_from_secondary_artifacts(&state_root)?;
    let Some(derived) = derived else {
        return Ok(false);
    };

    let derived_state = StoredExecutionState { target_id, ..derived.clone() };
    upsert_state_direct(conn, &derived_state)?;
    let derived_timestamp = derived_state.last_updated_at.clone().unwrap_or_else(timestamp_now);
    insert_decision(conn, target_id, 0, &decision_from_state(&derived_state, &derived_timestamp))?;
    conn.execute(
        "INSERT INTO state_revisions (target_id, revision, change_kind, trigger_command, state_digest, compatibility_dirty, recorded_at)
         VALUES (?1, 0, 'legacy_import', ?2, ?3, 1, ?4)",
        params![
            target_id,
            derived.source_command,
            state_digest(&derived_state)?,
            derived_timestamp
        ],
    )?;
    mark_all_outputs_stale(
        conn,
        target_root,
        target_id,
        &derived_timestamp,
    )?;
    Ok(true)
}

fn derive_legacy_state_from_secondary_artifacts(state_root: &Path) -> Result<Option<StoredExecutionState>> {
    let plan = read_json_if_present::<LegacyExecutionPlanRecord>(&state_root.join("execution-plan.json"))?;
    let lifecycle =
        read_json_if_present::<LegacyRuntimeLifecycleRecord>(&state_root.join("runtime-lifecycle.json"))?;
    let workflow = read_json_if_present::<LegacyWorkflowRecord>(&state_root.join("workflow.json"))?;

    if plan.is_none() && lifecycle.is_none() && workflow.is_none() {
        return Ok(None);
    }

    let task = plan
        .as_ref()
        .and_then(|value| value.task.clone())
        .or_else(|| lifecycle.as_ref().and_then(|value| value.current_task.clone()))
        .or_else(|| workflow.as_ref().and_then(|value| value.task.clone()));
    let reason = plan
        .as_ref()
        .and_then(|value| value.last_error.as_ref().and_then(|value| value.reason.clone()))
        .or_else(|| lifecycle.as_ref().and_then(|value| value.next_recommended_action.clone()))
        .or_else(|| plan.as_ref().and_then(|value| value.summary.clone()));
    let next_command = plan
        .as_ref()
        .and_then(|value| value.last_error.as_ref().and_then(|value| value.fix_command.clone()))
        .or_else(|| plan.as_ref().and_then(|value| value.next_commands.as_ref().and_then(|value| value.first().cloned())))
        .or_else(|| lifecycle.as_ref().and_then(|value| value.next_suggested_command.clone()));
    let last_updated_at = plan
        .as_ref()
        .and_then(|value| value.updated_at.clone())
        .or_else(|| lifecycle.as_ref().and_then(|value| value.timestamp.clone()))
        .or_else(|| workflow.as_ref().and_then(|value| value.timestamp.clone()));

    let lifecycle_value = if matches!(plan.as_ref().and_then(|value| value.state.as_deref()), Some("blocked"))
        || matches!(lifecycle.as_ref().and_then(|value| value.current_stage.as_deref()), Some("blocked"))
    {
        RuntimeLifecycle::Blocked
    } else if matches!(plan.as_ref().and_then(|value| value.state.as_deref()), Some("failed")) {
        RuntimeLifecycle::Failed
    } else if matches!(plan.as_ref().and_then(|value| value.state.as_deref()), Some("completed"))
        || matches!(lifecycle.as_ref().and_then(|value| value.current_stage.as_deref()), Some("checkpointed" | "handed-off"))
    {
        RuntimeLifecycle::Completed
    } else if matches!(workflow.as_ref().and_then(|value| value.status.as_deref()), Some("failed")) {
        RuntimeLifecycle::Blocked
    } else if matches!(lifecycle.as_ref().and_then(|value| value.current_stage.as_deref()), Some("packetized")) {
        RuntimeLifecycle::Queued
    } else if matches!(lifecycle.as_ref().and_then(|value| value.current_stage.as_deref()), Some("prepared"))
        || matches!(plan.as_ref().and_then(|value| value.state.as_deref()), Some("ready" | "planning"))
    {
        RuntimeLifecycle::PacketCreated
    } else if matches!(plan.as_ref().and_then(|value| value.state.as_deref()), Some("executing" | "validating" | "retrying"))
        || matches!(workflow.as_ref().and_then(|value| value.status.as_deref()), Some("running"))
        || matches!(lifecycle.as_ref().and_then(|value| value.current_stage.as_deref()), Some("validating"))
    {
        RuntimeLifecycle::Running
    } else {
        RuntimeLifecycle::Idle
    };

    Ok(Some(StoredExecutionState {
        target_id: 0,
        revision: 0,
        operation_id: None,
        task,
        source_command: None,
        lifecycle: lifecycle_value,
        reason: reason.clone(),
        next_command,
        blocked_by: if matches!(lifecycle_value, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) {
            normalize_string_list(reason.into_iter().collect())
        } else {
            Vec::new()
        },
        artifacts: BTreeMap::new(),
        last_updated_at,
        last_event_id: None,
    }))
}

fn insert_event(conn: &impl EventWriter, target_id: i64, event: &RuntimeEvent) -> Result<i64> {
    let blocked_by_json = json_string(&normalize_string_list(event.blocked_by.clone()))?;
    let artifacts_json = json_string(&normalize_artifacts(event.artifacts.clone()))?;
    conn.execute(
        "INSERT INTO execution_events (target_id, revision, event_type, operation_id, lifecycle, task, source_command, reason, next_command, blocked_by_json, artifacts_json, actor, recorded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            target_id,
            event.revision,
            event.event_type,
            event.operation_id,
            event.lifecycle.as_str(),
            event.task,
            event.source_command,
            event.reason,
            event.next_command,
            blocked_by_json,
            artifacts_json,
            event.actor,
            event.recorded_at
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

fn upsert_state(tx: &Transaction<'_>, state: &StoredExecutionState) -> Result<()> {
    upsert_state_direct(tx, state)
}

fn upsert_state_direct(conn: &impl EventWriter, state: &StoredExecutionState) -> Result<()> {
    conn.execute(
        "INSERT INTO execution_state (target_id, revision, operation_id, task, source_command, lifecycle, reason, next_command, blocked_by_json, artifacts_json, last_event_id, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(target_id) DO UPDATE SET
            revision = excluded.revision,
            operation_id = excluded.operation_id,
            task = excluded.task,
            source_command = excluded.source_command,
            lifecycle = excluded.lifecycle,
            reason = excluded.reason,
            next_command = excluded.next_command,
            blocked_by_json = excluded.blocked_by_json,
            artifacts_json = excluded.artifacts_json,
            last_event_id = excluded.last_event_id,
            updated_at = excluded.updated_at",
        params![
            state.target_id,
            state.revision,
            state.operation_id,
            state.task,
            state.source_command,
            state.lifecycle.as_str(),
            state.reason,
            state.next_command,
            json_string(&state.blocked_by)?,
            json_string(&state.artifacts)?,
            state.last_event_id,
            state.last_updated_at.clone().unwrap_or_else(timestamp_now)
        ],
    )?;
    Ok(())
}

fn load_state_row(conn: &Connection, target_id: i64) -> Result<StoredExecutionState> {
    conn.query_row(
        "SELECT target_id, revision, operation_id, task, source_command, lifecycle, reason, next_command, blocked_by_json, artifacts_json, last_event_id, updated_at
           FROM execution_state
          WHERE target_id = ?1",
        params![target_id],
        |row| {
            let lifecycle = row.get::<_, String>(5)?;
            let blocked_by_json = row.get::<_, String>(8)?;
            let artifacts_json = row.get::<_, String>(9)?;
            Ok(StoredExecutionState {
                target_id: row.get(0)?,
                revision: row.get(1)?,
                operation_id: row.get(2)?,
                task: row.get(3)?,
                source_command: row.get(4)?,
                lifecycle: RuntimeLifecycle::from_any(&lifecycle).ok_or_else(|| rusqlite::Error::InvalidQuery)?,
                reason: row.get(6)?,
                next_command: row.get(7)?,
                blocked_by: json_from_str(&blocked_by_json).map_err(|_| rusqlite::Error::InvalidQuery)?,
                artifacts: json_from_str(&artifacts_json).map_err(|_| rusqlite::Error::InvalidQuery)?,
                last_event_id: row.get(10)?,
                last_updated_at: row.get(11)?,
            })
        },
    )
    .context("failed to load execution_state row")
}

fn load_last_event(conn: &Connection, target_id: i64, event_id: Option<i64>) -> Result<Option<RuntimeEvent>> {
    let Some(event_id) = event_id else {
        return Ok(None);
    };
    conn.query_row(
        "SELECT event_id, revision, operation_id, event_type, lifecycle, task, source_command, reason, next_command, blocked_by_json, artifacts_json, actor, recorded_at
           FROM execution_events
          WHERE target_id = ?1 AND event_id = ?2",
        params![target_id, event_id],
        |row| {
            let lifecycle = row.get::<_, String>(4)?;
            let blocked_by_json = row.get::<_, String>(9)?;
            let artifacts_json = row.get::<_, String>(10)?;
            Ok(RuntimeEvent {
                event_id: row.get(0)?,
                revision: row.get(1)?,
                operation_id: row.get(2)?,
                event_type: row.get(3)?,
                lifecycle: RuntimeLifecycle::from_any(&lifecycle)
                    .ok_or_else(|| rusqlite::Error::InvalidQuery)?,
                task: row.get(5)?,
                source_command: row.get(6)?,
                reason: row.get(7)?,
                next_command: row.get(8)?,
                blocked_by: json_from_str(&blocked_by_json)
                    .map_err(|_| rusqlite::Error::InvalidQuery)?,
                artifacts: json_from_str(&artifacts_json)
                    .map_err(|_| rusqlite::Error::InvalidQuery)?,
                actor: row.get(11)?,
                recorded_at: row.get(12)?,
            })
        },
    )
    .optional()
    .context("failed to load last execution event")
}

fn load_events(conn: &Connection, target_id: i64) -> Result<Vec<RuntimeEvent>> {
    let mut statement = conn.prepare(
        "SELECT event_id, revision, operation_id, event_type, lifecycle, task, source_command, reason, next_command, blocked_by_json, artifacts_json, actor, recorded_at
           FROM execution_events
          WHERE target_id = ?1
          ORDER BY revision ASC",
    )?;
    let rows = statement.query_map(params![target_id], |row| {
        let lifecycle = row.get::<_, String>(4)?;
        let blocked_by_json = row.get::<_, String>(9)?;
        let artifacts_json = row.get::<_, String>(10)?;
        Ok(RuntimeEvent {
            event_id: row.get(0)?,
            revision: row.get(1)?,
            operation_id: row.get(2)?,
            event_type: row.get(3)?,
            lifecycle: RuntimeLifecycle::from_any(&lifecycle).ok_or_else(|| rusqlite::Error::InvalidQuery)?,
            task: row.get(5)?,
            source_command: row.get(6)?,
            reason: row.get(7)?,
            next_command: row.get(8)?,
            blocked_by: json_from_str(&blocked_by_json).map_err(|_| rusqlite::Error::InvalidQuery)?,
            artifacts: json_from_str(&artifacts_json).map_err(|_| rusqlite::Error::InvalidQuery)?,
            actor: row.get(11)?,
            recorded_at: row.get(12)?,
        })
    })?;
    let mut events = Vec::new();
    for row in rows {
        events.push(row?);
    }
    Ok(events)
}

fn build_snapshot(conn: &Connection, target_root: &Path, target_id: i64) -> Result<RuntimeSnapshot> {
    let state = load_state_row(conn, target_id)?;
    let last_event = load_last_event(conn, target_id, state.last_event_id)?;
    let readiness = readiness_from_state(&state);
    let decision = load_decision_row(conn, target_id, state.revision)?
        .unwrap_or_else(|| decision_from_state(&state, state.last_updated_at.as_deref().unwrap_or("1970-01-01T00:00:00Z")));
    let derived_freshness = load_derived_output_statuses(conn, target_id)?;
    Ok(RuntimeSnapshot {
        target_root: target_root.to_string_lossy().to_string(),
        revision: state.revision,
        operation_id: state.operation_id,
        task: state.task,
        source_command: state.source_command,
        lifecycle: state.lifecycle,
        reason: state.reason,
        next_command: state.next_command,
        blocked_by: state.blocked_by,
        artifacts: state.artifacts,
        last_updated_at: state.last_updated_at,
        last_event,
        readiness,
        decision,
        derived_freshness,
    })
}

fn load_derived_output_statuses(conn: &Connection, target_id: i64) -> Result<Vec<DerivedOutputStatus>> {
    let mut statement = conn.prepare(
        "SELECT output_name, path, freshness, source_revision, generated_at, invalidated_at, last_error
           FROM derived_outputs
          WHERE target_id = ?1
          ORDER BY output_name ASC",
    )?;
    let rows = statement.query_map(params![target_id], |row| {
        Ok(DerivedOutputStatus {
            output_name: row.get(0)?,
            path: row.get(1)?,
            freshness: row.get(2)?,
            source_revision: row.get(3)?,
            generated_at: row.get(4)?,
            invalidated_at: row.get(5)?,
            last_error: row.get(6)?,
        })
    })?;
    let mut statuses = Vec::new();
    for row in rows {
        statuses.push(row?);
    }
    Ok(statuses)
}

fn insert_decision(
    conn: &impl EventWriter,
    target_id: i64,
    revision: i64,
    decision: &RuntimeDecision,
) -> Result<()> {
    conn.execute(
        "INSERT INTO decision_state (target_id, revision, current_step_id, current_step_label, current_step_status, next_command, readiness_label, readiness_tone, readiness_detail, next_action_json, recovery_json, decision_source, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            target_id,
            revision,
            decision.current_step_id,
            decision.current_step_label,
            decision.current_step_status,
            decision.next_command,
            decision.readiness_label,
            decision.readiness_tone,
            decision.readiness_detail,
            json_string(&decision.next_action)?,
            json_string(&decision.recovery)?,
            decision.decision_source,
            decision.updated_at
        ],
    )?;
    Ok(())
}

fn load_decision_row(
    conn: &Connection,
    target_id: i64,
    revision: i64,
) -> Result<Option<RuntimeDecision>> {
    conn.query_row(
        "SELECT current_step_id, current_step_label, current_step_status, next_command, readiness_label, readiness_tone, readiness_detail, next_action_json, recovery_json, decision_source, updated_at
           FROM decision_state
          WHERE target_id = ?1 AND revision = ?2",
        params![target_id, revision],
        |row| {
            let next_action_json = row.get::<_, String>(7)?;
            let recovery_json = row.get::<_, String>(8)?;
            Ok(RuntimeDecision {
                current_step_id: row.get(0)?,
                current_step_label: row.get(1)?,
                current_step_status: row.get(2)?,
                next_command: row.get(3)?,
                readiness_label: row.get(4)?,
                readiness_tone: row.get(5)?,
                readiness_detail: row.get(6)?,
                next_action: json_from_str(&next_action_json).map_err(|_| rusqlite::Error::InvalidQuery)?,
                recovery: json_from_str(&recovery_json).map_err(|_| rusqlite::Error::InvalidQuery)?,
                decision_source: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    )
    .optional()
    .context("failed to load decision_state row")
}

fn backfill_decision_state_if_missing(conn: &Connection, target_id: i64) -> Result<()> {
    let state = load_state_row(conn, target_id)?;
    if load_decision_row(conn, target_id, state.revision)?.is_some() {
        return Ok(());
    }

    let timestamp = state
        .last_updated_at
        .clone()
        .unwrap_or_else(timestamp_now);
    insert_decision(
        conn,
        target_id,
        state.revision,
        &decision_from_state(&state, &timestamp),
    )?;
    Ok(())
}

fn decision_from_state(state: &StoredExecutionState, timestamp: &str) -> RuntimeDecision {
    let readiness = readiness_from_state(state);
    match state.lifecycle {
        RuntimeLifecycle::Idle => RuntimeDecision {
            current_step_id: String::from("idle"),
            current_step_label: String::from("Idle"),
            current_step_status: String::from("pending"),
            next_command: state.next_command.clone(),
            readiness_label: readiness.label,
            readiness_tone: readiness.tone,
            readiness_detail: readiness.detail,
            next_action: None,
            recovery: None,
            decision_source: String::from("runtime-default"),
            updated_at: timestamp.to_string(),
        },
        RuntimeLifecycle::PacketCreated => {
            let detail = readiness.detail.clone();
            RuntimeDecision {
                current_step_id: String::from("generate_packets"),
                current_step_label: String::from("Generate run packets"),
                current_step_status: String::from("pending"),
                next_command: state.next_command.clone(),
                readiness_label: readiness.label,
                readiness_tone: readiness.tone,
                readiness_detail: detail.clone(),
                next_action: Some(RuntimeDecisionAction {
                    action: String::from("Generate run packets"),
                    command: state.next_command.clone(),
                    reason: detail,
                    priority: String::from("high"),
                }),
                recovery: None,
                decision_source: String::from("runtime-default"),
                updated_at: timestamp.to_string(),
            }
        }
        RuntimeLifecycle::Queued => {
            let detail = readiness.detail.clone();
            RuntimeDecision {
                current_step_id: String::from("execute_packet"),
                current_step_label: String::from("Execute packet"),
                current_step_status: String::from("pending"),
                next_command: state.next_command.clone(),
                readiness_label: readiness.label,
                readiness_tone: readiness.tone,
                readiness_detail: detail.clone(),
                next_action: Some(RuntimeDecisionAction {
                    action: String::from("Open latest task packet and execute it"),
                    command: None,
                    reason: detail,
                    priority: String::from("high"),
                }),
                recovery: None,
                decision_source: String::from("runtime-default"),
                updated_at: timestamp.to_string(),
            }
        }
        RuntimeLifecycle::Running => {
            let detail = readiness.detail.clone();
            RuntimeDecision {
                current_step_id: infer_running_step_id(state),
                current_step_label: infer_running_step_label(state),
                current_step_status: String::from("running"),
                next_command: state.next_command.clone(),
                readiness_label: readiness.label,
                readiness_tone: readiness.tone,
                readiness_detail: detail.clone(),
                next_action: Some(RuntimeDecisionAction {
                    action: infer_running_step_label(state),
                    command: state.next_command.clone().or_else(|| state.source_command.clone()),
                    reason: detail,
                    priority: String::from("normal"),
                }),
                recovery: None,
                decision_source: String::from("runtime-default"),
                updated_at: timestamp.to_string(),
            }
        }
        RuntimeLifecycle::Completed => {
            let detail = readiness.detail.clone();
            RuntimeDecision {
                current_step_id: String::from("checkpoint"),
                current_step_label: String::from("Checkpoint progress"),
                current_step_status: String::from("pending"),
                next_command: state.next_command.clone(),
                readiness_label: readiness.label,
                readiness_tone: readiness.tone,
                readiness_detail: detail.clone(),
                next_action: state.next_command.as_ref().map(|command| RuntimeDecisionAction {
                    action: String::from("Checkpoint progress"),
                    command: Some(command.clone()),
                    reason: detail.clone(),
                    priority: String::from("normal"),
                }),
                recovery: None,
                decision_source: String::from("runtime-default"),
                updated_at: timestamp.to_string(),
            }
        }
        RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed => {
            let detail = readiness.detail.clone();
            RuntimeDecision {
                current_step_id: infer_blocked_step_id(state),
                current_step_label: infer_blocked_step_label(state),
                current_step_status: String::from("failed"),
                next_command: state.next_command.clone(),
                readiness_label: readiness.label,
                readiness_tone: readiness.tone,
                readiness_detail: detail.clone(),
                next_action: state.next_command.as_ref().map(|command| RuntimeDecisionAction {
                    action: String::from("Fix the blocking execution issue"),
                    command: Some(command.clone()),
                    reason: detail.clone(),
                    priority: String::from("critical"),
                }),
                recovery: Some(RuntimeDecisionRecovery {
                    kind: if state.lifecycle == RuntimeLifecycle::Failed {
                        String::from("failed")
                    } else {
                        String::from("blocked")
                    },
                    reason: detail,
                    fix_command: state.next_command.clone(),
                    retry_command: state.source_command.clone(),
                }),
                decision_source: String::from("runtime-default"),
                updated_at: timestamp.to_string(),
            }
        }
    }
}

fn normalize_runtime_decision(mut decision: RuntimeDecision, timestamp: &str) -> RuntimeDecision {
    if decision.updated_at.trim().is_empty() {
        decision.updated_at = timestamp.to_string();
    }
    decision
}

fn mark_all_outputs_stale(conn: &Connection, target_root: &Path, target_id: i64, timestamp: &str) -> Result<()> {
    mark_outputs_stale(
        conn,
        target_root,
        target_id,
        &ALL_DERIVED_OUTPUTS.iter().map(|value| (*value).to_string()).collect::<Vec<_>>(),
        timestamp,
    )
}

fn mark_outputs_stale(
    conn: &Connection,
    target_root: &Path,
    target_id: i64,
    outputs: &[String],
    timestamp: &str,
) -> Result<()> {
    for output in outputs {
        conn.execute(
            "INSERT INTO derived_outputs (target_id, output_name, path, source_revision, freshness, generated_at, invalidated_at, last_error)
             VALUES (?1, ?2, ?3, NULL, 'stale', NULL, ?4, NULL)
             ON CONFLICT(target_id, output_name) DO UPDATE SET
                path = excluded.path,
                freshness = 'stale',
                invalidated_at = excluded.invalidated_at,
                last_error = NULL",
            params![
                target_id,
                output,
                output_path(target_root, output).to_string_lossy().to_string(),
                timestamp
            ],
        )?;
    }
    Ok(())
}

fn mark_output_fresh(
    conn: &Connection,
    target_id: i64,
    output_name: &str,
    output_path: &Path,
    source_revision: i64,
    timestamp: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO derived_outputs (target_id, output_name, path, source_revision, freshness, generated_at, invalidated_at, last_error)
         VALUES (?1, ?2, ?3, ?4, 'fresh', ?5, NULL, NULL)
         ON CONFLICT(target_id, output_name) DO UPDATE SET
            path = excluded.path,
            source_revision = excluded.source_revision,
            freshness = 'fresh',
            generated_at = excluded.generated_at,
            invalidated_at = NULL,
            last_error = NULL",
        params![
            target_id,
            output_name,
            output_path.to_string_lossy().to_string(),
            source_revision,
            timestamp
        ],
    )?;
    Ok(())
}

fn mark_output_error(
    conn: &Connection,
    target_id: i64,
    output_name: &str,
    output_path: &Path,
    error: &str,
    timestamp: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO derived_outputs (target_id, output_name, path, source_revision, freshness, generated_at, invalidated_at, last_error)
         VALUES (?1, ?2, ?3, NULL, 'error', NULL, ?4, ?5)
         ON CONFLICT(target_id, output_name) DO UPDATE SET
            path = excluded.path,
            freshness = 'error',
            invalidated_at = excluded.invalidated_at,
            last_error = excluded.last_error",
        params![
            target_id,
            output_name,
            output_path.to_string_lossy().to_string(),
            timestamp,
            error
        ],
    )?;
    Ok(())
}

fn output_path(target_root: &Path, output_name: &str) -> PathBuf {
    let state_root = target_root.join(".agent").join("state");
    match output_name {
        OUTPUT_EXECUTION_STATE => state_root.join("execution-state.json"),
        OUTPUT_EXECUTION_EVENTS => state_root.join("execution-events.ndjson"),
        OUTPUT_REPO_CONTROL_SNAPSHOT => state_root.join("repo-control-snapshot.json"),
        OUTPUT_RUNTIME_LIFECYCLE => state_root.join("runtime-lifecycle.json"),
        OUTPUT_WORKFLOW => state_root.join("workflow.json"),
        OUTPUT_EXECUTION_PLAN => state_root.join("execution-plan.json"),
        OUTPUT_DECISION_LOGIC => state_root.join("decision-logic.json"),
        other => state_root.join(format!("{other}.json")),
    }
}

fn graph_authority_path(target_root: &Path) -> String {
    runtime_db_path(target_root.to_string_lossy().as_ref())
        .to_string_lossy()
        .to_string()
}

fn digest_string(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    hex::encode(hasher.finalize())
}

#[derive(Clone, Debug)]
struct StoredNormalizedRepoGraphStatus {
    graph_revision: i64,
    source_runtime_revision: i64,
    status: String,
    created_at: String,
    graph_kind: String,
    node_count: i64,
    edge_count: i64,
    module_count: i64,
    symbol_count: i64,
    artifact_path: Option<String>,
    compatibility_hash: Option<String>,
    source_digest: String,
}

#[derive(Clone)]
struct AliasCandidate {
    alias_kind: String,
    alias_value: String,
    canonical_module_id: Option<String>,
    confidence: i64,
    source: String,
}

const EXPLICIT_ALIAS_SOURCE_RELATIVE_PATH: &str = ".agent/context/graph-aliases.json";

fn persist_normalized_repo_graph_rows(
    tx: &Transaction<'_>,
    target_root: &Path,
    graph_revision: i64,
    modules: &[RepoGraphModule],
    nodes: &[RepoGraphNode],
    edges: &[RepoGraphEdge],
) -> Result<()> {
    persist_repo_graph_aliases(tx, target_root, graph_revision, modules, nodes)?;
    for module in modules {
        tx.execute(
            "INSERT INTO repo_graph_modules (graph_revision, module_id, display_label, summary, attributes_json)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                graph_revision,
                module.module_id,
                module.display_label,
                module.summary,
                json_string(&module.attributes)?,
            ],
        )?;
    }
    for node in nodes {
        tx.execute(
            "INSERT INTO repo_graph_nodes (graph_revision, node_id, node_kind, path, module_id, symbol, display_label, language, attributes_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                graph_revision,
                node.node_id,
                node.node_kind,
                node.path,
                node.module_id,
                node.symbol,
                node.display_label,
                node.language,
                json_string(&node.attributes)?,
            ],
        )?;
    }
    for edge in edges {
        tx.execute(
            "INSERT INTO repo_graph_edges (graph_revision, edge_id, from_node_id, to_node_id, edge_kind, weight, evidence_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                graph_revision,
                edge.edge_id,
                edge.from_node_id,
                edge.to_node_id,
                edge.edge_kind,
                edge.weight,
                json_string(&edge.evidence)?,
            ],
        )?;
    }
    Ok(())
}

fn persist_repo_graph_aliases(
    tx: &Transaction<'_>,
    target_root: &Path,
    graph_revision: i64,
    modules: &[RepoGraphModule],
    nodes: &[RepoGraphNode],
) -> Result<()> {
    for module in modules {
        for alias in module_aliases(module) {
            tx.execute(
                "INSERT OR IGNORE INTO repo_graph_aliases (graph_revision, alias_kind, alias_value, canonical_node_id, canonical_module_id, confidence, source)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    graph_revision,
                    alias.alias_kind,
                    alias.alias_value,
                    format!("module:{}", module.module_id),
                    module.module_id,
                    alias.confidence,
                    alias.source
                ],
            )?;
        }
    }
    for node in nodes {
        for alias in node_aliases(node) {
            tx.execute(
                "INSERT OR IGNORE INTO repo_graph_aliases (graph_revision, alias_kind, alias_value, canonical_node_id, canonical_module_id, confidence, source)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    graph_revision,
                alias.alias_kind,
                alias.alias_value,
                node.node_id,
                alias.canonical_module_id.clone().or_else(|| node.module_id.clone()),
                alias.confidence,
                alias.source
            ],
        )?;
    }
    }
    for alias in load_explicit_module_aliases(target_root)? {
        tx.execute(
            "INSERT OR IGNORE INTO repo_graph_aliases (graph_revision, alias_kind, alias_value, canonical_node_id, canonical_module_id, confidence, source)
             VALUES (?1, 'explicit', ?2, ?3, ?4, ?5, 'repo-local-alias-file')",
            params![
                graph_revision,
                alias.alias_value,
                format!("module:{}", alias.canonical_module_id.clone().unwrap_or_default()),
                alias.canonical_module_id.clone().unwrap_or_default(),
                alias.confidence
            ],
        )?;
    }
    Ok(())
}

fn load_normalized_repo_graph_status(conn: &Connection) -> Result<Option<StoredNormalizedRepoGraphStatus>> {
    conn.query_row(
        "SELECT graph_revision, source_runtime_revision, status, summary, created_at, graph_kind, node_count, edge_count, module_count, symbol_count, artifact_path, compatibility_hash
           FROM repo_graph_revisions
          ORDER BY graph_revision DESC
          LIMIT 1",
        [],
        |row| {
            let compatibility_hash: Option<String> = row.get(11)?;
            Ok(StoredNormalizedRepoGraphStatus {
                graph_revision: row.get(0)?,
                source_runtime_revision: row.get(1)?,
                status: row.get(2)?,
                created_at: row.get(4)?,
                graph_kind: row.get(5)?,
                node_count: row.get(6)?,
                edge_count: row.get(7)?,
                module_count: row.get(8)?,
                symbol_count: row.get(9)?,
                artifact_path: row.get(10)?,
                compatibility_hash: compatibility_hash.clone(),
                source_digest: compatibility_hash.unwrap_or_default(),
            })
        },
    )
    .optional()
    .context("failed to load normalized repo graph status")
}

fn repo_graph_status_from_revision(
    conn: &Connection,
    target_root: &Path,
    target_id: i64,
    row: Option<&StoredNormalizedRepoGraphStatus>,
) -> Result<RepoGraphStatus> {
    let current_runtime_revision = load_state_row(conn, target_id).map(|state| state.revision).unwrap_or(0);
    Ok(match row {
        Some(row) => RepoGraphStatus {
            target_root: target_root.to_string_lossy().to_string(),
            ready: row.status == "ready" && !is_graph_stale(conn, target_id, row.source_runtime_revision, current_runtime_revision)?,
            status: row.status.clone(),
            freshness: if row.status == "ready" && !is_graph_stale(conn, target_id, row.source_runtime_revision, current_runtime_revision)? { String::from("fresh") } else { String::from("stale") },
            graph_revision: Some(row.graph_revision),
            source_revision: Some(row.source_runtime_revision),
            source_runtime_revision: Some(row.source_runtime_revision),
            runtime_revision_drift: current_runtime_revision.saturating_sub(row.source_runtime_revision),
            stale: is_graph_stale(conn, target_id, row.source_runtime_revision, current_runtime_revision)?,
            generated_at: Some(row.created_at.clone()),
            source_kind: Some(row.graph_kind.clone()),
            source_digest: Some(row.source_digest.clone()),
            graph_authority_path: graph_authority_path(target_root),
            graph_authority_kind: String::from("runtime-sqlite-normalized"),
            node_count: row.node_count,
            edge_count: row.edge_count,
            module_count: row.module_count,
            symbol_count: row.symbol_count,
            alias_authority_kind: String::from("runtime-sqlite-normalized-aliases"),
            alias_count: load_alias_count(conn, row.graph_revision).unwrap_or(0),
            alias_ambiguity_count: load_alias_ambiguity_count(conn, row.graph_revision).unwrap_or(0),
            explicit_alias_source_path: EXPLICIT_ALIAS_SOURCE_RELATIVE_PATH.to_string(),
            explicit_alias_source_available: target_root.join(EXPLICIT_ALIAS_SOURCE_RELATIVE_PATH).exists(),
            artifact_path: row.artifact_path.clone(),
            compatibility_hash: row.compatibility_hash.clone(),
            compatibility_export_ready: row.artifact_path.as_ref().map(|relative| target_root.join(relative).exists()).unwrap_or(false),
            compatibility_in_sync: row.compatibility_hash.is_some(),
            compatibility_artifacts: None,
        },
        None => RepoGraphStatus {
            target_root: target_root.to_string_lossy().to_string(),
            ready: false,
            status: String::from("missing"),
            freshness: String::from("missing"),
            graph_revision: None,
            source_revision: None,
            source_runtime_revision: None,
            runtime_revision_drift: current_runtime_revision,
            stale: true,
            generated_at: None,
            source_kind: None,
            source_digest: None,
            graph_authority_path: graph_authority_path(target_root),
            graph_authority_kind: String::from("runtime-sqlite-normalized"),
            node_count: 0,
            edge_count: 0,
            module_count: 0,
            symbol_count: 0,
            alias_authority_kind: String::from("runtime-sqlite-normalized-aliases"),
            alias_count: 0,
            alias_ambiguity_count: 0,
            explicit_alias_source_path: EXPLICIT_ALIAS_SOURCE_RELATIVE_PATH.to_string(),
            explicit_alias_source_available: target_root.join(EXPLICIT_ALIAS_SOURCE_RELATIVE_PATH).exists(),
            artifact_path: None,
            compatibility_hash: None,
            compatibility_export_ready: false,
            compatibility_in_sync: false,
            compatibility_artifacts: None,
        },
    })
}

fn load_repo_graph_nodes(conn: &Connection, graph_revision: i64) -> Result<Vec<RepoGraphNode>> {
    let mut statement = conn.prepare(
        "SELECT node_id, node_kind, path, module_id, symbol, display_label, language, attributes_json
           FROM repo_graph_nodes
          WHERE graph_revision = ?1
          ORDER BY node_kind ASC, display_label ASC
          LIMIT 5000",
    )?;
    let rows = statement.query_map(params![graph_revision], node_from_row)?;
    collect_rows(rows)
}

fn load_repo_graph_edges(conn: &Connection, graph_revision: i64) -> Result<Vec<RepoGraphEdge>> {
    let mut statement = conn.prepare(
        "SELECT edge_id, from_node_id, to_node_id, edge_kind, weight, evidence_json
           FROM repo_graph_edges
          WHERE graph_revision = ?1
          ORDER BY edge_kind ASC, edge_id ASC
          LIMIT 10000",
    )?;
    let rows = statement.query_map(params![graph_revision], edge_from_row)?;
    collect_rows(rows)
}

fn load_repo_graph_modules(conn: &Connection, graph_revision: i64) -> Result<Vec<RepoGraphModule>> {
    let mut statement = conn.prepare(
        "SELECT module_id, display_label, summary, attributes_json
           FROM repo_graph_modules
          WHERE graph_revision = ?1
          ORDER BY module_id ASC",
    )?;
    let rows = statement.query_map(params![graph_revision], |row| {
        let attributes_json = row.get::<_, String>(3)?;
        Ok(RepoGraphModule {
            module_id: row.get(0)?,
            display_label: row.get(1)?,
            summary: row.get(2)?,
            attributes: serde_json::from_str(&attributes_json).map_err(|_| rusqlite::Error::InvalidQuery)?,
        })
    })?;
    collect_rows(rows)
}

fn load_alias_count(conn: &Connection, graph_revision: i64) -> Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM repo_graph_aliases WHERE graph_revision = ?1",
        params![graph_revision],
        |row| row.get(0),
    )
    .context("failed to count repo graph aliases")
}

fn load_alias_ambiguity_count(conn: &Connection, graph_revision: i64) -> Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM (
            SELECT alias_kind, alias_value
              FROM repo_graph_aliases
             WHERE graph_revision = ?1
             GROUP BY alias_kind, alias_value
            HAVING COUNT(DISTINCT canonical_node_id) > 1
        )",
        params![graph_revision],
        |row| row.get(0),
    )
    .context("failed to count ambiguous repo graph aliases")
}

fn load_repo_graph_outgoing_edges(conn: &Connection, graph_revision: i64, node_id: &str) -> Result<Vec<RepoGraphEdge>> {
    let mut statement = conn.prepare(
        "SELECT edge_id, from_node_id, to_node_id, edge_kind, weight, evidence_json
           FROM repo_graph_edges
          WHERE graph_revision = ?1 AND from_node_id = ?2
          ORDER BY edge_kind ASC, weight DESC
          LIMIT 80",
    )?;
    let rows = statement.query_map(params![graph_revision, node_id], edge_from_row)?;
    collect_rows(rows)
}

fn load_repo_graph_incoming_edges(conn: &Connection, graph_revision: i64, node_id: &str) -> Result<Vec<RepoGraphEdge>> {
    let mut statement = conn.prepare(
        "SELECT edge_id, from_node_id, to_node_id, edge_kind, weight, evidence_json
           FROM repo_graph_edges
          WHERE graph_revision = ?1 AND to_node_id = ?2
          ORDER BY edge_kind ASC, weight DESC
          LIMIT 80",
    )?;
    let rows = statement.query_map(params![graph_revision, node_id], edge_from_row)?;
    collect_rows(rows)
}

fn load_edges_touching_node(conn: &Connection, graph_revision: i64, node_id: &str, incoming: bool) -> Result<Vec<RepoGraphEdge>> {
    if incoming {
        load_repo_graph_incoming_edges(conn, graph_revision, node_id)
    } else {
        load_repo_graph_outgoing_edges(conn, graph_revision, node_id)
    }
}

fn resolve_repo_graph_query_nodes(
    conn: &Connection,
    graph_revision: i64,
    query: &RepoGraphQuery,
    query_kind: &str,
) -> Result<(Vec<RepoGraphNode>, Option<RepoGraphQueryResolution>)> {
    if let Some(node_id) = query.node_id.as_deref().filter(|value| !value.trim().is_empty()) {
        return Ok((
            query_nodes_by_clause(conn, graph_revision, "node_id = ?2", node_id, 20)?,
            Some(RepoGraphQueryResolution {
                queried_value: node_id.to_string(),
                resolved_node_id: Some(node_id.to_string()),
                resolved_module_id: None,
                resolution: String::from("exact-node"),
                score: 100,
                candidates: Vec::new(),
                reasons: vec![String::from("exact canonical node id")],
            }),
        ));
    }
    if query_kind == "module" {
        if let Some(module_id) = query.module_id.as_deref().filter(|value| !value.trim().is_empty()) {
            return resolve_module_query(conn, graph_revision, module_id);
        }
    }
    if query_kind == "symbol" {
        if let Some(symbol) = query.symbol.as_deref().filter(|value| !value.trim().is_empty()) {
            return Ok((
                query_nodes_by_clause(conn, graph_revision, "symbol = ?2", symbol, 40)?,
                Some(RepoGraphQueryResolution {
                    queried_value: symbol.to_string(),
                    resolved_node_id: None,
                    resolved_module_id: None,
                    resolution: String::from("exact-symbol"),
                    score: 100,
                    candidates: Vec::new(),
                    reasons: vec![String::from("exact symbol alias")],
                }),
            ));
        }
    }
    if let Some(path) = query.path.as_deref().filter(|value| !value.trim().is_empty()) {
        return Ok((
            query_nodes_by_clause(conn, graph_revision, "path = ?2", path, 40)?,
            Some(RepoGraphQueryResolution {
                queried_value: path.to_string(),
                resolved_node_id: None,
                resolved_module_id: None,
                resolution: String::from("exact-path"),
                score: 100,
                candidates: Vec::new(),
                reasons: vec![String::from("exact file path alias")],
            }),
        ));
    }
    if let Some(module_id) = query.module_id.as_deref().filter(|value| !value.trim().is_empty()) {
        return resolve_module_query(conn, graph_revision, module_id);
    }
    if let Some(symbol) = query.symbol.as_deref().filter(|value| !value.trim().is_empty()) {
        return Ok((
            query_nodes_by_clause(conn, graph_revision, "symbol = ?2", symbol, 40)?,
            Some(RepoGraphQueryResolution {
                queried_value: symbol.to_string(),
                resolved_node_id: None,
                resolved_module_id: None,
                resolution: String::from("exact-symbol"),
                score: 100,
                candidates: Vec::new(),
                reasons: vec![String::from("exact symbol alias")],
            }),
        ));
    }
    Ok((Vec::new(), None))
}

fn query_nodes_by_clause(
    conn: &Connection,
    graph_revision: i64,
    clause: &str,
    value: &str,
    limit: i64,
) -> Result<Vec<RepoGraphNode>> {
    let sql = format!(
        "SELECT node_id, node_kind, path, module_id, symbol, display_label, language, attributes_json
           FROM repo_graph_nodes
          WHERE graph_revision = ?1 AND {clause}
          ORDER BY node_kind ASC, display_label ASC
          LIMIT ?3"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![graph_revision, value, limit], node_from_row)?;
    collect_rows(rows)
}

fn node_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<RepoGraphNode> {
    let attributes_json = row.get::<_, String>(7)?;
    Ok(RepoGraphNode {
        node_id: row.get(0)?,
        node_kind: row.get(1)?,
        path: row.get(2)?,
        module_id: row.get(3)?,
        symbol: row.get(4)?,
        display_label: row.get(5)?,
        language: row.get(6)?,
        attributes: serde_json::from_str(&attributes_json).map_err(|_| rusqlite::Error::InvalidQuery)?,
    })
}

fn edge_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<RepoGraphEdge> {
    let evidence_json = row.get::<_, String>(5)?;
    Ok(RepoGraphEdge {
        edge_id: row.get(0)?,
        from_node_id: row.get(1)?,
        to_node_id: row.get(2)?,
        edge_kind: row.get(3)?,
        weight: row.get(4)?,
        evidence: serde_json::from_str(&evidence_json).map_err(|_| rusqlite::Error::InvalidQuery)?,
    })
}

fn log_repo_graph_query(
    conn: &Connection,
    graph_revision: i64,
    query_kind: &str,
    query: &RepoGraphQuery,
) -> Result<()> {
    let query_value = query.node_id.as_ref()
        .or(query.path.as_ref())
        .or(query.module_id.as_ref())
        .or(query.symbol.as_ref())
        .cloned()
        .unwrap_or_default();
    conn.execute(
        "INSERT INTO repo_graph_query_log (graph_revision, query_kind, query_value, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![graph_revision, query_kind, query_value, timestamp_now()],
    )?;
    Ok(())
}

fn collect_rows<T>(rows: rusqlite::MappedRows<'_, impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>>) -> Result<Vec<T>> {
    let mut values = Vec::new();
    for row in rows {
        values.push(row?);
    }
    Ok(values)
}

fn is_graph_stale(
    conn: &Connection,
    target_id: i64,
    source_runtime_revision: i64,
    current_runtime_revision: i64,
) -> Result<bool> {
    if current_runtime_revision <= source_runtime_revision {
        return Ok(false);
    }
    let mut statement = conn.prepare(
        "SELECT event_type
           FROM execution_events
          WHERE target_id = ?1 AND revision > ?2
          ORDER BY revision ASC",
    )?;
    let rows = statement.query_map(params![target_id, source_runtime_revision], |row| row.get::<_, String>(0))?;
    for row in rows {
        let event_type = row?;
        if event_type != "repo-graph-built" {
            return Ok(true);
        }
    }
    Ok(false)
}

fn resolve_module_query(
    conn: &Connection,
    graph_revision: i64,
    requested: &str,
) -> Result<(Vec<RepoGraphNode>, Option<RepoGraphQueryResolution>)> {
    let matches = query_module_alias_matches(conn, graph_revision, requested)?;
    if matches.is_empty() {
        let modules = load_repo_graph_modules(conn, graph_revision)?;
        return Ok((
            Vec::new(),
            Some(RepoGraphQueryResolution {
                queried_value: requested.to_string(),
                resolved_node_id: None,
                resolved_module_id: None,
                resolution: String::from("unresolved"),
                score: 0,
                candidates: modules.into_iter().map(|module| module.module_id).collect(),
                reasons: vec![String::from("no module alias matched")],
            }),
        ));
    }

    let top_score = matches[0].confidence;
    let top: Vec<_> = matches.iter().filter(|entry| entry.confidence == top_score).collect();
    if top.len() > 1 {
        let candidates = top.iter().map(|entry| entry.canonical_module_id.clone()).collect::<Vec<_>>();
        return Err(anyhow!(
            "ambiguous module alias \"{requested}\"; candidates: {}",
            candidates.join(", ")
        ));
    }

    let best = top[0];
    let candidate_ids = matches.iter().map(|entry| entry.canonical_module_id.clone()).collect::<Vec<_>>();
    Ok((
        query_nodes_by_clause(conn, graph_revision, "node_id = ?2", &best.canonical_node_id, 20)?,
        Some(RepoGraphQueryResolution {
            queried_value: requested.to_string(),
            resolved_node_id: Some(best.canonical_node_id.clone()),
            resolved_module_id: Some(best.canonical_module_id.clone()),
            resolution: best.alias_kind.clone(),
            score: best.confidence,
            candidates: candidate_ids,
            reasons: vec![format!("resolved via {}", best.alias_kind)],
        }),
    ))
}

fn normalize_module_alias(value: &str) -> String {
    value
        .trim()
        .rsplit('/')
        .next()
        .unwrap_or(value)
        .replace(['-', '_'], "")
        .to_lowercase()
}

fn module_aliases(module: &RepoGraphModule) -> Vec<AliasCandidate> {
    let mut aliases = Vec::new();
    let module_id = module.module_id.clone();
    aliases.push(alias("canonical-id", module_id.clone(), 100, "module-id"));
    aliases.push(alias("package-id", module_id.clone(), 95, "package-id"));
    let basename = module_id.rsplit('/').next().unwrap_or(&module_id).to_string();
    aliases.push(alias("basename", basename.clone(), 90, "basename"));
    aliases.push(alias("normalized", normalize_module_alias(&module_id), 80, "normalized"));
    for segment in module_id.split('/').filter(|segment| !segment.is_empty()) {
      aliases.push(alias("path-segment", segment.to_string(), 70, "path-segment"));
    }
    dedupe_aliases(aliases)
}

fn node_aliases(node: &RepoGraphNode) -> Vec<AliasCandidate> {
    let mut aliases = Vec::new();
    if let Some(path) = node.path.as_ref() {
        aliases.push(alias("path", path.clone(), 100, "path"));
        let basename = path.rsplit('/').next().unwrap_or(path).to_string();
        aliases.push(alias("basename", basename.clone(), 60, "path-basename"));
        aliases.push(alias("normalized", normalize_module_alias(&basename), 50, "path-normalized"));
    }
    if let Some(symbol) = node.symbol.as_ref() {
        aliases.push(alias("symbol", symbol.clone(), 100, "symbol"));
        aliases.push(alias("normalized", normalize_module_alias(symbol), 70, "symbol-normalized"));
    }
    dedupe_aliases(aliases)
}

fn alias(alias_kind: &str, alias_value: String, confidence: i64, source: &str) -> AliasCandidate {
    AliasCandidate {
        alias_kind: alias_kind.to_string(),
        alias_value,
        canonical_module_id: None,
        confidence,
        source: source.to_string(),
    }
}

fn dedupe_aliases(input: Vec<AliasCandidate>) -> Vec<AliasCandidate> {
    let mut output: Vec<AliasCandidate> = Vec::new();
    for entry in input {
        if entry.alias_value.trim().is_empty() {
            continue;
        }
        if !output.iter().any(|existing| existing.alias_kind == entry.alias_kind && existing.alias_value == entry.alias_value) {
            output.push(entry);
        }
    }
    output
}

#[derive(Clone)]
struct ResolvedAliasRow {
    alias_kind: String,
    canonical_node_id: String,
    canonical_module_id: String,
    confidence: i64,
}

fn query_module_alias_matches(
    conn: &Connection,
    graph_revision: i64,
    requested: &str,
) -> Result<Vec<ResolvedAliasRow>> {
    let normalized = normalize_module_alias(requested);
    let clauses = [
        ("canonical-id", requested.to_string()),
        ("package-id", requested.to_string()),
        ("explicit", requested.to_string()),
        ("basename", requested.to_string()),
        ("normalized", normalized.clone()),
        ("path-segment", requested.to_string()),
    ];
    for (kind, value) in clauses {
        let rows = query_alias_rows(conn, graph_revision, kind, &value, false, false)?;
        if !rows.is_empty() {
            return Ok(rows);
        }
    }
    let prefix = query_alias_rows(conn, graph_revision, "normalized", &normalized, true, false)?;
    if !prefix.is_empty() {
        return Ok(prefix);
    }
    query_alias_rows(conn, graph_revision, "normalized", &normalized, false, true)
}

fn query_alias_rows(
    conn: &Connection,
    graph_revision: i64,
    alias_kind: &str,
    alias_value: &str,
    prefix: bool,
    contains: bool,
) -> Result<Vec<ResolvedAliasRow>> {
    let predicate = if prefix {
        "alias_value LIKE (?3 || '%')"
    } else if contains {
        "alias_value LIKE ('%' || ?3 || '%')"
    } else {
        "alias_value = ?3"
    };
    let sql = format!(
        "SELECT alias_kind, canonical_node_id, COALESCE(canonical_module_id, ''), confidence
           FROM repo_graph_aliases
          WHERE graph_revision = ?1 AND alias_kind = ?2 AND {predicate}
          ORDER BY confidence DESC, canonical_module_id ASC"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![graph_revision, alias_kind, alias_value], |row| {
        Ok(ResolvedAliasRow {
            alias_kind: row.get(0)?,
            canonical_node_id: row.get(1)?,
            canonical_module_id: row.get(2)?,
            confidence: row.get(3)?,
        })
    })?;
    collect_rows(rows)
}

fn load_explicit_module_aliases(target_root: &Path) -> Result<Vec<AliasCandidate>> {
    let alias_path = target_root.join(EXPLICIT_ALIAS_SOURCE_RELATIVE_PATH);
    if !alias_path.exists() {
        return Ok(Vec::new());
    }
    let payload: Value = read_json_file(&alias_path)
        .with_context(|| format!("failed to read {}", alias_path.display()))?;
    let module_map = payload.get("modules").and_then(|value| value.as_object());
    let Some(module_map) = module_map else {
        return Ok(Vec::new());
    };
    let mut aliases = Vec::new();
    for (alias_value, canonical) in module_map {
        if let Some(canonical_module_id) = canonical.as_str() {
            aliases.push(AliasCandidate {
                alias_kind: String::from("explicit"),
                alias_value: alias_value.to_string(),
                canonical_module_id: Some(canonical_module_id.to_string()),
                confidence: 92,
                source: canonical_module_id.to_string(),
            });
        }
    }
    Ok(dedupe_aliases(aliases))
}

fn readiness_from_state(state: &StoredExecutionState) -> RuntimeReadiness {
    match state.lifecycle {
        RuntimeLifecycle::Blocked => RuntimeReadiness {
            label: String::from("Workflow blocked"),
            tone: String::from("blocked"),
            detail: state
                .reason
                .clone()
                .unwrap_or_else(|| String::from("Kiwi recorded a blocking execution issue.")),
            next_command: state.next_command.clone(),
        },
        RuntimeLifecycle::Failed => RuntimeReadiness {
            label: String::from("Workflow failed"),
            tone: String::from("failed"),
            detail: state
                .reason
                .clone()
                .unwrap_or_else(|| String::from("Kiwi recorded a failed execution state.")),
            next_command: state.next_command.clone(),
        },
        RuntimeLifecycle::PacketCreated => RuntimeReadiness {
            label: String::from("Packet created"),
            tone: String::from("ready"),
            detail: state
                .reason
                .clone()
                .unwrap_or_else(|| String::from("Prepared scope and instructions are ready.")),
            next_command: state.next_command.clone(),
        },
        RuntimeLifecycle::Queued => RuntimeReadiness {
            label: String::from("Queued"),
            tone: String::from("ready"),
            detail: state
                .reason
                .clone()
                .unwrap_or_else(|| String::from("Execution is queued.")),
            next_command: state.next_command.clone(),
        },
        RuntimeLifecycle::Running => RuntimeReadiness {
            label: String::from("Running"),
            tone: String::from("ready"),
            detail: state
                .reason
                .clone()
                .unwrap_or_else(|| String::from("Execution is running.")),
            next_command: state.next_command.clone(),
        },
        RuntimeLifecycle::Completed => RuntimeReadiness {
            label: String::from("Completed"),
            tone: String::from("ready"),
            detail: state
                .reason
                .clone()
                .unwrap_or_else(|| String::from("Execution completed.")),
            next_command: state.next_command.clone(),
        },
        RuntimeLifecycle::Idle => RuntimeReadiness {
            label: String::from("Ready"),
            tone: String::from("ready"),
            detail: state
                .reason
                .clone()
                .unwrap_or_else(|| String::from("Repo-local state is loaded and no active execution is in flight.")),
            next_command: state.next_command.clone(),
        },
    }
}

fn infer_running_step_id(state: &StoredExecutionState) -> String {
    if state
        .source_command
        .as_deref()
        .unwrap_or_default()
        .contains("validate")
    {
        String::from("validate")
    } else if state
        .source_command
        .as_deref()
        .unwrap_or_default()
        .contains("run")
    {
        String::from("execute_packet")
    } else if state
        .source_command
        .as_deref()
        .unwrap_or_default()
        .contains("prepare")
    {
        String::from("prepare")
    } else {
        String::from("execute_packet")
    }
}

fn infer_running_step_label(state: &StoredExecutionState) -> String {
    match infer_running_step_id(state).as_str() {
        "validate" => String::from("Validate outcome"),
        "prepare" => String::from("Prepare bounded context"),
        _ => String::from("Execute packet"),
    }
}

fn infer_blocked_step_id(state: &StoredExecutionState) -> String {
    if state
        .source_command
        .as_deref()
        .unwrap_or_default()
        .contains("prepare")
    {
        String::from("prepare")
    } else if state
        .source_command
        .as_deref()
        .unwrap_or_default()
        .contains("run")
    {
        String::from("execute_packet")
    } else if state
        .source_command
        .as_deref()
        .unwrap_or_default()
        .contains("checkpoint")
    {
        String::from("checkpoint")
    } else if state
        .source_command
        .as_deref()
        .unwrap_or_default()
        .contains("handoff")
    {
        String::from("handoff")
    } else {
        String::from("validate")
    }
}

fn infer_blocked_step_label(state: &StoredExecutionState) -> String {
    match infer_blocked_step_id(state).as_str() {
        "prepare" => String::from("Prepare bounded context"),
        "execute_packet" => String::from("Execute packet"),
        "checkpoint" => String::from("Checkpoint progress"),
        "handoff" => String::from("Handoff work"),
        _ => String::from("Validate outcome"),
    }
}

fn compatibility_execution_state(
    state: &StoredExecutionState,
    last_event: Option<RuntimeEvent>,
) -> Result<LegacyExecutionStateRecord> {
    Ok(LegacyExecutionStateRecord {
        artifact_type: String::from("kiwi-control/execution-state"),
        version: 1,
        revision: state.revision,
        operation_id: state.operation_id.clone(),
        task: state.task.clone(),
        source_command: state.source_command.clone(),
        lifecycle: String::from(state.lifecycle.legacy_str()),
        reason: state.reason.clone(),
        next_command: state.next_command.clone(),
        blocked_by: Some(state.blocked_by.clone()),
        last_updated_at: state.last_updated_at.clone(),
        artifacts: Some(state.artifacts.clone()),
        last_event: last_event.map(|event| LegacyExecutionStateEvent {
            revision: event.revision,
            operation_id: event.operation_id,
            event_type: event.event_type,
            lifecycle: String::from(event.lifecycle.legacy_str()),
            task: event.task,
            source_command: event.source_command,
            reason: event.reason,
            next_command: event.next_command,
            blocked_by: event.blocked_by,
            artifacts: event.artifacts,
            recorded_at: event.recorded_at,
        }),
    })
}

fn compatibility_runtime_lifecycle(
    state: &StoredExecutionState,
    decision: &RuntimeDecision,
    last_event: Option<&RuntimeEvent>,
    timestamp: &str,
) -> Value {
    json!({
        "artifactType": "kiwi-control/runtime-lifecycle",
        "version": 1,
        "timestamp": timestamp,
        "currentTask": state.task,
        "currentStage": runtime_lifecycle_stage(state, decision),
        "validationStatus": runtime_validation_status(state),
        "nextSuggestedCommand": decision.next_command,
        "nextRecommendedAction": decision.next_action.as_ref().map(|action| action.action.clone()).unwrap_or_else(|| decision.readiness_detail.clone()),
        "recentEvents": last_event.map(|event| vec![json!({
            "timestamp": event.recorded_at,
            "type": event.event_type,
            "stage": runtime_lifecycle_stage(state, decision),
            "status": if matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) { "error" } else { "ok" },
            "summary": event.reason.clone().unwrap_or_else(|| decision.readiness_detail.clone()),
            "task": event.task,
            "command": event.next_command,
            "validation": event.reason,
            "failureReason": if matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) { state.reason.clone() } else { None::<String> },
            "files": [],
            "skillsApplied": [],
            "tokenUsage": {
                "measuredTokens": Value::Null,
                "estimatedTokens": Value::Null,
                "source": "none"
            }
        })]).unwrap_or_default()
    })
}

fn compatibility_workflow(
    state: &StoredExecutionState,
    decision: &RuntimeDecision,
    timestamp: &str,
) -> Value {
    let steps = vec![
        workflow_step("prepare-context", "Prepare context", workflow_step_status("prepare-context", state, decision), state, decision, timestamp),
        workflow_step("generate-run-packets", "Generate run packets", workflow_step_status("generate-run-packets", state, decision), state, decision, timestamp),
        workflow_step("validate-outcome", "Validate outcome", workflow_step_status("validate-outcome", state, decision), state, decision, timestamp),
        workflow_step("checkpoint-progress", "Checkpoint progress", workflow_step_status("checkpoint-progress", state, decision), state, decision, timestamp),
        workflow_step("handoff-work", "Handoff work", workflow_step_status("handoff-work", state, decision), state, decision, timestamp),
    ];
    let current_step = steps.iter().find(|step| {
        step.get("status")
            .and_then(|value| value.as_str())
            .map(|value| value == "running" || value == "failed")
            .unwrap_or(false)
    }).and_then(|step| step.get("stepId").cloned()).unwrap_or(Value::Null);

    json!({
        "artifactType": "kiwi-control/workflow",
        "version": 3,
        "timestamp": timestamp,
        "task": state.task,
        "status": workflow_status(state),
        "currentStepId": current_step,
        "steps": steps
    })
}

fn compatibility_execution_plan(
    state: &StoredExecutionState,
    decision: &RuntimeDecision,
    timestamp: &str,
) -> Value {
    let steps = vec![
        execution_plan_step("prepare", "Prepare bounded context", state, decision),
        execution_plan_step("execute", "Modify the selected files", state, decision),
        execution_plan_step("validate", "Validate the task outcome", state, decision),
        execution_plan_step("checkpoint", "Checkpoint the validated work", state, decision),
        execution_plan_step("handoff", "Handoff the work", state, decision),
    ];
    let current_step_index = steps.iter().position(|step| {
        step.get("status")
            .and_then(|value| value.as_str())
            .map(|value| value == "running" || value == "failed")
            .unwrap_or(false)
    }).unwrap_or(0);

    json!({
        "artifactType": "kiwi-control/execution-plan",
        "version": 2,
        "task": state.task,
        "intent": Value::Null,
        "hierarchy": {
            "goal": state.task,
            "subtasks": state.task.as_ref().map(|task| vec![json!({
                "id": "primary",
                "title": task,
                "stepIds": ["prepare", "execute", "validate", "checkpoint", "handoff"]
            })]).unwrap_or_default()
        },
        "state": execution_plan_state(state),
        "currentStepIndex": current_step_index,
        "confidence": Value::Null,
        "risk": "low",
        "blocked": matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed),
        "summary": decision.recovery.as_ref().map(|value| value.reason.clone()).unwrap_or_else(|| decision.readiness_detail.clone()),
        "steps": steps,
        "nextCommands": decision.next_command.as_ref().map(|command| vec![command.clone()]).unwrap_or_default(),
        "lastError": execution_plan_last_error(state, decision),
        "contextSnapshot": {
            "selectedFiles": [],
            "selectedModuleGroups": [],
            "confidence": Value::Null,
            "contextTreePath": Value::Null,
            "dependencyChains": {},
            "forwardDependencies": [],
            "reverseDependencies": []
        },
        "impactPreview": {
            "likelyFiles": [],
            "moduleGroups": []
        },
        "verificationLayers": [
            { "id": "syntax", "description": "Syntax and shape validation for the selected scope." }
        ],
        "partialResults": [],
        "evalSummary": Value::Null,
        "updatedAt": timestamp
    })
}

fn compatibility_decision_logic(
    state: &StoredExecutionState,
    decision: &RuntimeDecision,
    timestamp: &str,
) -> Value {
    json!({
        "artifactType": "kiwi-control/decision-logic",
        "version": 1,
        "timestamp": timestamp,
        "summary": decision.next_action.as_ref().map(|action| format!("{}: {}", action.action, action.reason)).unwrap_or_else(|| decision.readiness_detail.clone()),
        "decisionPriority": decision.next_action.as_ref().map(|action| action.priority.clone()).unwrap_or_else(|| String::from("low")),
        "inputSignals": [
            format!("execution lifecycle: {}", state.lifecycle.as_str()),
            format!("current step: {}", decision.current_step_id),
            format!("decision source: {}", decision.decision_source),
        ],
        "reasoningChain": [
            "Runtime decision state is the canonical source of truth for next-step decisions.",
            format!("The active runtime step is {}.", decision.current_step_id),
        ],
        "ignoredSignals": [
            "Compatibility artifacts are runtime-derived snapshots."
        ]
    })
}

fn compatibility_repo_control_snapshot(
    state: &StoredExecutionState,
    decision: &RuntimeDecision,
    timestamp: &str,
) -> Value {
    json!({
        "artifactType": "kiwi-control/repo-control-snapshot",
        "version": 1,
        "savedAt": timestamp,
        "state": {
            "targetRoot": Value::Null,
            "loadState": {
                "source": "fresh",
                "freshness": "fresh",
                "generatedAt": timestamp,
                "snapshotSavedAt": Value::Null,
                "snapshotAgeMs": Value::Null,
                "detail": "Runtime-derived snapshot"
            },
            "executionState": {
                "revision": state.revision,
                "lifecycle": state.lifecycle.legacy_str(),
                "task": state.task,
                "reason": state.reason,
                "nextCommand": state.next_command
            },
            "runtimeDecision": {
                "currentStepId": decision.current_step_id,
                "readinessLabel": decision.readiness_label,
                "decisionSource": decision.decision_source
            }
        }
    })
}

fn runtime_lifecycle_stage(state: &StoredExecutionState, decision: &RuntimeDecision) -> &'static str {
    match state.lifecycle {
        RuntimeLifecycle::Idle => "idle",
        RuntimeLifecycle::PacketCreated => "prepared",
        RuntimeLifecycle::Queued => "packetized",
        RuntimeLifecycle::Running => {
            if decision.current_step_id == "validate" { "validating" } else { "packetized" }
        }
        RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed => "blocked",
        RuntimeLifecycle::Completed => {
            if decision.current_step_id == "handoff" { "handed-off" } else { "checkpointed" }
        }
    }
}

fn runtime_validation_status(state: &StoredExecutionState) -> Option<&'static str> {
    match state.lifecycle {
        RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed => Some("error"),
        RuntimeLifecycle::Completed => Some("ok"),
        _ => None,
    }
}

fn workflow_status(state: &StoredExecutionState) -> &'static str {
    match state.lifecycle {
        RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed => "failed",
        RuntimeLifecycle::Completed => "success",
        RuntimeLifecycle::Idle => "pending",
        _ => "running",
    }
}

fn workflow_step(
    step_id: &str,
    action: &str,
    status: &str,
    state: &StoredExecutionState,
    _decision: &RuntimeDecision,
    timestamp: &str,
) -> Value {
    let failed = matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) && status == "failed";
    json!({
        "stepId": step_id,
        "action": action,
        "status": status,
        "input": state.task,
        "expectedOutput": Value::Null,
        "output": Value::Null,
        "validation": Value::Null,
        "failureReason": if failed { state.reason.clone() } else { None::<String> },
        "attemptCount": 0,
        "retryCount": 0,
        "files": [],
        "skillsApplied": [],
        "tokenUsage": {
            "source": "none",
            "measuredTokens": Value::Null,
            "estimatedTokens": Value::Null,
            "note": "No token usage has been recorded for this step yet."
        },
        "result": {
            "ok": if status == "success" { Value::Bool(true) } else if status == "failed" { Value::Bool(false) } else { Value::Null },
            "summary": Value::Null,
            "validation": Value::Null,
            "failureReason": if failed { state.reason.clone() } else { None::<String> },
            "suggestedFix": if failed { state.next_command.clone() } else { None::<String> },
            "retryCommand": if status == "failed" { state.next_command.clone() } else { None::<String> }
        },
        "updatedAt": timestamp
    })
}

fn workflow_step_status(step_id: &str, state: &StoredExecutionState, decision: &RuntimeDecision) -> &'static str {
    match step_id {
        "prepare-context" => {
            if matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) && decision.current_step_id == "prepare" {
                "failed"
            } else if state.lifecycle == RuntimeLifecycle::Idle {
                "pending"
            } else {
                "success"
            }
        }
        "generate-run-packets" => {
            if state.lifecycle == RuntimeLifecycle::PacketCreated { "running" }
            else if matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) && decision.current_step_id == "generate_packets" { "failed" }
            else if matches!(state.lifecycle, RuntimeLifecycle::Queued | RuntimeLifecycle::Running | RuntimeLifecycle::Completed) { "success" }
            else { "pending" }
        }
        "validate-outcome" => {
            if state.lifecycle == RuntimeLifecycle::Running && decision.current_step_id == "validate" { "running" }
            else if matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) && decision.current_step_id == "validate" { "failed" }
            else if state.lifecycle == RuntimeLifecycle::Completed { "success" }
            else { "pending" }
        }
        "checkpoint-progress" => {
            if matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) && decision.current_step_id == "checkpoint" { "failed" }
            else if state.lifecycle == RuntimeLifecycle::Completed && decision.current_step_id == "checkpoint" { "running" }
            else { "pending" }
        }
        "handoff-work" => {
            if matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) && decision.current_step_id == "handoff" { "failed" }
            else if state.lifecycle == RuntimeLifecycle::Completed && decision.current_step_id == "handoff" { "running" }
            else { "pending" }
        }
        _ => "pending"
    }
}

fn execution_plan_state(state: &StoredExecutionState) -> &'static str {
    match state.lifecycle {
        RuntimeLifecycle::Idle => "idle",
        RuntimeLifecycle::PacketCreated => "ready",
        RuntimeLifecycle::Queued | RuntimeLifecycle::Running => "executing",
        RuntimeLifecycle::Blocked => "blocked",
        RuntimeLifecycle::Failed => "failed",
        RuntimeLifecycle::Completed => "completed",
    }
}

fn execution_plan_step(step_id: &str, description: &str, state: &StoredExecutionState, decision: &RuntimeDecision) -> Value {
    let status = match step_id {
        "prepare" => {
            if matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) && decision.current_step_id == "prepare" { "failed" }
            else if !matches!(state.lifecycle, RuntimeLifecycle::Idle) { "success" } else { "pending" }
        }
        "execute" => {
            if matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) && decision.current_step_id == "generate_packets" { "failed" }
            else if state.lifecycle == RuntimeLifecycle::PacketCreated { "running" }
            else if matches!(state.lifecycle, RuntimeLifecycle::Queued | RuntimeLifecycle::Running | RuntimeLifecycle::Completed) { "success" }
            else { "pending" }
        }
        "validate" => {
            if matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) && decision.current_step_id == "validate" { "failed" }
            else if state.lifecycle == RuntimeLifecycle::Running && decision.current_step_id == "validate" { "running" }
            else if state.lifecycle == RuntimeLifecycle::Completed { "success" }
            else { "pending" }
        }
        "checkpoint" => {
            if matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) && decision.current_step_id == "checkpoint" { "failed" }
            else if state.lifecycle == RuntimeLifecycle::Completed && decision.current_step_id == "checkpoint" { "running" }
            else { "pending" }
        }
        "handoff" => {
            if matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) && decision.current_step_id == "handoff" { "failed" }
            else if state.lifecycle == RuntimeLifecycle::Completed && decision.current_step_id == "handoff" { "running" }
            else { "pending" }
        }
        _ => "pending"
    };

    json!({
        "id": step_id,
        "description": description,
        "command": decision.next_command,
        "expectedOutput": description,
        "expectedOutcome": {
            "expectedFiles": [],
            "expectedChanges": []
        },
        "validation": "Runtime-derived snapshot",
        "status": status,
        "workflowStepId": Value::Null,
        "result": {
            "ok": if status == "success" { Value::Bool(true) } else if status == "failed" { Value::Bool(false) } else { Value::Null },
            "summary": Value::Null,
            "validation": Value::Null,
            "failureReason": if status == "failed" { state.reason.clone() } else { None::<String> },
            "suggestedFix": if status == "failed" { state.next_command.clone() } else { None::<String> }
        },
        "fixCommand": if status == "failed" { state.next_command.clone() } else { None::<String> },
        "retryCommand": state.next_command
    })
}

fn execution_plan_last_error(state: &StoredExecutionState, decision: &RuntimeDecision) -> Value {
    if !matches!(state.lifecycle, RuntimeLifecycle::Blocked | RuntimeLifecycle::Failed) {
        return Value::Null;
    }
    let error_type = if decision.current_step_id == "generate_packets" || decision.current_step_id == "prepare" {
        "context_error"
    } else {
        "logic_error"
    };
    let retry_strategy = if error_type == "context_error" { "expand" } else { "re-plan" };
    json!({
        "errorType": error_type,
        "retryStrategy": retry_strategy,
        "reason": state.reason,
        "fixCommand": decision.recovery.as_ref().and_then(|value| value.fix_command.clone()).or_else(|| state.next_command.clone()),
        "retryCommand": decision.recovery.as_ref().and_then(|value| value.retry_command.clone()).or_else(|| state.next_command.clone())
    })
}

fn write_events_file(output_path: &Path, events: &[RuntimeEvent]) -> Result<()> {
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut payload = String::new();
    for event in events {
        let compatibility = LegacyExecutionStateEvent {
            revision: event.revision,
            operation_id: event.operation_id.clone(),
            event_type: event.event_type.clone(),
            lifecycle: String::from(event.lifecycle.legacy_str()),
            task: event.task.clone(),
            source_command: event.source_command.clone(),
            reason: event.reason.clone(),
            next_command: event.next_command.clone(),
            blocked_by: event.blocked_by.clone(),
            artifacts: event.artifacts.clone(),
            recorded_at: event.recorded_at.clone(),
        };
        payload.push_str(&serde_json::to_string(&compatibility)?);
        payload.push('\n');
    }
    fs::write(output_path, payload)?;
    Ok(())
}

fn write_json_file<T: Serialize>(output_path: &Path, value: &T) -> Result<()> {
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_path, format!("{}\n", serde_json::to_string_pretty(value)?))?;
    Ok(())
}

fn read_json_if_present<T: DeserializeOwned>(path: &Path) -> Result<Option<T>> {
    if !path.exists() {
        return Ok(None);
    }
    Ok(Some(read_json_file(path)?))
}

fn read_json_file<T: DeserializeOwned>(path: &Path) -> Result<T> {
    let payload = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&payload)?)
}

fn read_legacy_events(path: &Path) -> Result<Vec<RuntimeEvent>> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let payload = fs::read_to_string(path)?;
    let mut events = Vec::new();
    for line in payload.lines().filter(|line| !line.trim().is_empty()) {
        let parsed: LegacyExecutionStateEvent = serde_json::from_str(line)?;
        let lifecycle = RuntimeLifecycle::from_any(&parsed.lifecycle)
            .ok_or_else(|| anyhow!("unsupported legacy lifecycle {}", parsed.lifecycle))?;
        events.push(RuntimeEvent {
            event_id: None,
            revision: parsed.revision,
            operation_id: parsed.operation_id,
            event_type: parsed.event_type,
            lifecycle,
            task: parsed.task,
            source_command: parsed.source_command,
            reason: parsed.reason,
            next_command: parsed.next_command,
            blocked_by: normalize_string_list(parsed.blocked_by),
            artifacts: normalize_artifacts(parsed.artifacts),
            actor: String::from("legacy-import"),
            recorded_at: parsed.recorded_at,
        });
    }
    Ok(events)
}

fn normalize_target_root(target_root: &str) -> Result<PathBuf> {
    let trimmed = target_root.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("target_root is required"));
    }
    let path = PathBuf::from(trimmed);
    if path.exists() {
        return Ok(fs::canonicalize(&path).unwrap_or(path));
    }
    Ok(path)
}

fn state_digest(state: &StoredExecutionState) -> Result<String> {
    let payload = serde_json::to_vec(&state.digest_view())?;
    let mut hasher = Sha256::new();
    hasher.update(payload);
    Ok(hex::encode(hasher.finalize()))
}

fn json_string<T: Serialize>(value: &T) -> Result<String> {
    Ok(serde_json::to_string(value)?)
}

fn json_from_str<T: DeserializeOwned>(value: &str) -> Result<T> {
    Ok(serde_json::from_str(value)?)
}

fn normalize_artifacts(input: ExecutionArtifacts) -> ExecutionArtifacts {
    let mut normalized = BTreeMap::new();
    for (key, values) in input {
        let next_values = normalize_string_list(values);
        if !next_values.is_empty() {
            normalized.insert(key, next_values);
        }
    }
    normalized
}

fn merge_artifacts(current: &ExecutionArtifacts, patch: Option<&ExecutionArtifacts>) -> ExecutionArtifacts {
    let mut merged = current.clone();
    if let Some(patch) = patch {
        for (key, values) in patch {
            let normalized = normalize_string_list(values.clone());
            if !normalized.is_empty() {
                merged.insert(key.clone(), normalized);
            }
        }
    }
    normalize_artifacts(merged)
}

fn normalize_string_list(values: Vec<String>) -> Vec<String> {
    let mut next = Vec::new();
    for value in values {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            continue;
        }
        if !next.iter().any(|existing| existing == trimmed) {
            next.push(trimmed.to_string());
        }
    }
    next
}

fn timestamp_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    chrono_like_iso8601(now)
}

fn chrono_like_iso8601(epoch_seconds: u64) -> String {
    // Keep the runtime dependency-light while still producing stable UTC timestamps.
    let datetime = time::OffsetDateTime::from_unix_timestamp(epoch_seconds as i64)
        .unwrap_or(time::OffsetDateTime::UNIX_EPOCH);
    datetime
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| String::from("1970-01-01T00:00:00Z"))
}

#[derive(Clone, Debug)]
struct StoredExecutionState {
    target_id: i64,
    revision: i64,
    operation_id: Option<String>,
    task: Option<String>,
    source_command: Option<String>,
    lifecycle: RuntimeLifecycle,
    reason: Option<String>,
    next_command: Option<String>,
    blocked_by: Vec<String>,
    artifacts: ExecutionArtifacts,
    last_updated_at: Option<String>,
    last_event_id: Option<i64>,
}

impl StoredExecutionState {
    fn digest_view(&self) -> DigestView<'_> {
        DigestView {
            revision: self.revision,
            operation_id: self.operation_id.as_deref(),
            task: self.task.as_deref(),
            source_command: self.source_command.as_deref(),
            lifecycle: self.lifecycle.as_str(),
            reason: self.reason.as_deref(),
            next_command: self.next_command.as_deref(),
            blocked_by: &self.blocked_by,
            artifacts: &self.artifacts,
            last_updated_at: self.last_updated_at.as_deref(),
        }
    }
}

#[derive(Serialize)]
struct DigestView<'a> {
    revision: i64,
    operation_id: Option<&'a str>,
    task: Option<&'a str>,
    source_command: Option<&'a str>,
    lifecycle: &'a str,
    reason: Option<&'a str>,
    next_command: Option<&'a str>,
    blocked_by: &'a [String],
    artifacts: &'a ExecutionArtifacts,
    last_updated_at: Option<&'a str>,
}

trait EventWriter {
    fn execute<P: rusqlite::Params>(&self, sql: &str, params: P) -> rusqlite::Result<usize>;
    fn last_insert_rowid(&self) -> i64;
}

impl EventWriter for Connection {
    fn execute<P: rusqlite::Params>(&self, sql: &str, params: P) -> rusqlite::Result<usize> {
        Connection::execute(self, sql, params)
    }

    fn last_insert_rowid(&self) -> i64 {
        Connection::last_insert_rowid(self)
    }
}

impl<'a> EventWriter for Transaction<'a> {
    fn execute<P: rusqlite::Params>(&self, sql: &str, params: P) -> rusqlite::Result<usize> {
        let mut statement = self.prepare(sql)?;
        statement.execute(params)
    }

    fn last_insert_rowid(&self) -> i64 {
        self.query_row("SELECT last_insert_rowid()", [], |row| row.get(0))
            .unwrap_or_default()
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct LegacyExecutionStateRecord {
    artifact_type: String,
    version: i64,
    revision: i64,
    operation_id: Option<String>,
    task: Option<String>,
    source_command: Option<String>,
    lifecycle: String,
    reason: Option<String>,
    next_command: Option<String>,
    blocked_by: Option<Vec<String>>,
    last_updated_at: Option<String>,
    artifacts: Option<ExecutionArtifacts>,
    last_event: Option<LegacyExecutionStateEvent>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct LegacyExecutionStateEvent {
    revision: i64,
    operation_id: Option<String>,
    #[serde(rename = "type", alias = "eventType")]
    event_type: String,
    lifecycle: String,
    task: Option<String>,
    source_command: Option<String>,
    reason: Option<String>,
    next_command: Option<String>,
    blocked_by: Vec<String>,
    artifacts: ExecutionArtifacts,
    recorded_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyExecutionPlanRecord {
    task: Option<String>,
    state: Option<String>,
    summary: Option<String>,
    next_commands: Option<Vec<String>>,
    last_error: Option<LegacyExecutionPlanError>,
    updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyExecutionPlanError {
    reason: Option<String>,
    fix_command: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyRuntimeLifecycleRecord {
    current_task: Option<String>,
    current_stage: Option<String>,
    next_suggested_command: Option<String>,
    next_recommended_action: Option<String>,
    timestamp: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyWorkflowRecord {
    task: Option<String>,
    status: Option<String>,
    timestamp: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn create_target() -> Result<tempfile::TempDir> {
        let dir = tempdir()?;
        fs::create_dir_all(dir.path().join(".agent").join("state"))?;
        Ok(dir)
    }

    #[test]
    fn initializes_db_with_wal_and_idle_state() -> Result<()> {
        let dir = create_target()?;
        let target_root = dir.path().to_string_lossy().to_string();
        let snapshot = open_target(&OpenTargetRequest {
            target_root: target_root.clone(),
            root_label: None,
            project_type: Some(String::from("node")),
            profile_name: Some(String::from("product-build")),
        })?;

        assert_eq!(snapshot.revision, 0);
        assert_eq!(snapshot.lifecycle, RuntimeLifecycle::Idle);

        let conn = open_connection(dir.path())?;
        let mode: String = conn.query_row("PRAGMA journal_mode;", [], |row| row.get(0))?;
        assert_eq!(mode.to_lowercase(), "wal");
        assert!(runtime_db_path(&target_root).exists());
        Ok(())
    }

    #[test]
    fn transitions_state_and_materializes_compatibility_outputs() -> Result<()> {
        let dir = create_target()?;
        let target_root = dir.path().to_string_lossy().to_string();
        open_target(&OpenTargetRequest {
            target_root: target_root.clone(),
            root_label: None,
            project_type: None,
            profile_name: None,
        })?;

        let snapshot = transition_execution_state(&TransitionExecutionStateRequest {
            target_root: target_root.clone(),
            actor: Some(String::from("test")),
            trigger_command: Some(String::from("kiwi-control prepare \"runtime authority\"")),
            event_type: String::from("prepare-completed"),
            lifecycle: RuntimeLifecycle::PacketCreated,
            task: Some(String::from("runtime authority")),
            source_command: Some(String::from("kiwi-control prepare \"runtime authority\"")),
            reason: Some(String::from("Prepared scope is ready.")),
            next_command: Some(String::from("kiwi-control run \"runtime authority\"")),
            blocked_by: Some(Vec::new()),
            artifacts: Some(BTreeMap::from([(
                String::from("instructions"),
                vec![String::from(".agent/context/generated-instructions.md")],
            )])),
            operation_id: None,
            reuse_operation: Some(false),
            clear_task: Some(false),
            decision: None,
            invalidate_outputs: None,
            materialize_outputs: None,
        })?;

        assert_eq!(snapshot.revision, 1);
        assert_eq!(snapshot.lifecycle, RuntimeLifecycle::PacketCreated);
        assert!(output_path(dir.path(), OUTPUT_EXECUTION_STATE).exists());
        assert!(output_path(dir.path(), OUTPUT_EXECUTION_EVENTS).exists());

        let compatibility: LegacyExecutionStateRecord =
            read_json_file(&output_path(dir.path(), OUTPUT_EXECUTION_STATE))?;
        assert_eq!(compatibility.lifecycle, "packet-created");
        assert_eq!(compatibility.revision, 1);
        Ok(())
    }

    #[test]
    fn persists_runtime_decision_state_with_transition() -> Result<()> {
        let dir = create_target()?;
        let target_root = dir.path().to_string_lossy().to_string();
        open_target(&OpenTargetRequest {
            target_root: target_root.clone(),
            root_label: None,
            project_type: None,
            profile_name: None,
        })?;

        let snapshot = transition_execution_state(&TransitionExecutionStateRequest {
            target_root,
            actor: Some(String::from("test")),
            trigger_command: Some(String::from("kiwi-control run \"demo\"")),
            event_type: String::from("run-packetized"),
            lifecycle: RuntimeLifecycle::Queued,
            task: Some(String::from("demo")),
            source_command: Some(String::from("kiwi-control run \"demo\"")),
            reason: Some(String::from("Packets are ready.")),
            next_command: Some(String::from("kiwi-control validate \"demo\"")),
            blocked_by: Some(Vec::new()),
            artifacts: Some(BTreeMap::new()),
            operation_id: None,
            reuse_operation: Some(false),
            clear_task: Some(false),
            decision: Some(RuntimeDecision {
                current_step_id: String::from("execute_packet"),
                current_step_label: String::from("Execute packet"),
                current_step_status: String::from("pending"),
                next_command: Some(String::from("kiwi-control validate \"demo\"")),
                readiness_label: String::from("Queued"),
                readiness_tone: String::from("ready"),
                readiness_detail: String::from("Packets are ready."),
                next_action: Some(RuntimeDecisionAction {
                    action: String::from("Open latest task packet and execute it"),
                    command: None,
                    reason: String::from("Packets are ready."),
                    priority: String::from("high"),
                }),
                recovery: None,
                decision_source: String::from("test"),
                updated_at: String::new(),
            }),
            invalidate_outputs: None,
            materialize_outputs: None,
        })?;

        assert_eq!(snapshot.decision.current_step_id, "execute_packet");
        assert_eq!(snapshot.decision.readiness_label, "Queued");
        assert_eq!(snapshot.decision.decision_source, "test");
        Ok(())
    }

    #[test]
    fn imports_legacy_execution_state_once() -> Result<()> {
        let dir = create_target()?;
        let legacy_state_path = dir.path().join(".agent").join("state").join("execution-state.json");
        write_json_file(
            &legacy_state_path,
            &LegacyExecutionStateRecord {
                artifact_type: String::from("kiwi-control/execution-state"),
                version: 1,
                revision: 4,
                operation_id: Some(String::from("op-1")),
                task: Some(String::from("legacy task")),
                source_command: Some(String::from("kiwi-control validate \"legacy task\"")),
                lifecycle: String::from("blocked"),
                reason: Some(String::from("Prepared scope drifted.")),
                next_command: Some(String::from("kiwi-control explain")),
                blocked_by: Some(vec![String::from("Prepared scope drifted.")]),
                last_updated_at: Some(String::from("2026-04-08T00:00:00Z")),
                artifacts: Some(BTreeMap::new()),
                last_event: None,
            },
        )?;

        let snapshot = open_target(&OpenTargetRequest {
            target_root: dir.path().to_string_lossy().to_string(),
            root_label: None,
            project_type: None,
            profile_name: None,
        })?;

        assert_eq!(snapshot.revision, 4);
        assert_eq!(snapshot.lifecycle, RuntimeLifecycle::Blocked);
        assert_eq!(snapshot.reason.as_deref(), Some("Prepared scope drifted."));
        Ok(())
    }

    #[test]
    fn persists_and_clears_repo_pack_selection_with_runtime_revision_changes() -> Result<()> {
        let dir = create_target()?;
        let target_root = dir.path().to_string_lossy().to_string();
        open_target(&OpenTargetRequest {
            target_root: target_root.clone(),
            root_label: None,
            project_type: Some(String::from("node")),
            profile_name: Some(String::from("product-build")),
        })?;

        let set_snapshot = set_repo_pack_selection(&SetRepoPackSelectionRequest {
            target_root: target_root.clone(),
            pack_id: String::from("research-pack"),
            selection_source: Some(String::from("runtime-explicit")),
            trigger_command: Some(String::from("kiwi-control pack set research-pack")),
            actor: Some(String::from("test")),
        })?;
        assert_eq!(set_snapshot.revision, 1);

        let status = get_repo_pack_selection_status(&target_root)?;
        assert_eq!(status.selected_pack_id.as_deref(), Some("research-pack"));
        assert_eq!(status.selected_pack_source.as_deref(), Some("runtime-explicit"));

        let repeated_snapshot = set_repo_pack_selection(&SetRepoPackSelectionRequest {
            target_root: target_root.clone(),
            pack_id: String::from("research-pack"),
            selection_source: Some(String::from("runtime-explicit")),
            trigger_command: Some(String::from("kiwi-control pack set research-pack")),
            actor: Some(String::from("test")),
        })?;
        assert_eq!(repeated_snapshot.revision, 1);

        let cleared_snapshot = clear_repo_pack_selection(&ClearRepoPackSelectionRequest {
            target_root: target_root.clone(),
            trigger_command: Some(String::from("kiwi-control pack clear")),
            actor: Some(String::from("test")),
        })?;
        assert_eq!(cleared_snapshot.revision, 2);

        let cleared = get_repo_pack_selection_status(&target_root)?;
        assert_eq!(cleared.selected_pack_id, None);
        assert_eq!(cleared.selected_pack_source, None);
        Ok(())
    }
}
