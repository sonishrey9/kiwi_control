use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

pub type ExecutionArtifacts = BTreeMap<String, Vec<String>>;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeLifecycle {
    Idle,
    PacketCreated,
    Queued,
    Running,
    Blocked,
    Failed,
    Completed,
}

impl RuntimeLifecycle {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Idle => "idle",
            Self::PacketCreated => "packet_created",
            Self::Queued => "queued",
            Self::Running => "running",
            Self::Blocked => "blocked",
            Self::Failed => "failed",
            Self::Completed => "completed",
        }
    }

    pub fn legacy_str(self) -> &'static str {
        match self {
            Self::PacketCreated => "packet-created",
            _ => self.as_str(),
        }
    }

    pub fn from_any(value: &str) -> Option<Self> {
        match value.trim() {
            "idle" => Some(Self::Idle),
            "packet_created" | "packet-created" => Some(Self::PacketCreated),
            "queued" => Some(Self::Queued),
            "running" => Some(Self::Running),
            "blocked" => Some(Self::Blocked),
            "failed" => Some(Self::Failed),
            "completed" => Some(Self::Completed),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeReadiness {
    pub label: String,
    pub tone: String,
    pub detail: String,
    pub next_command: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDecisionAction {
    pub action: String,
    pub command: Option<String>,
    pub reason: String,
    pub priority: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDecisionRecovery {
    pub kind: String,
    pub reason: String,
    pub fix_command: Option<String>,
    pub retry_command: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDecision {
    pub current_step_id: String,
    pub current_step_label: String,
    pub current_step_status: String,
    pub next_command: Option<String>,
    pub readiness_label: String,
    pub readiness_tone: String,
    pub readiness_detail: String,
    pub next_action: Option<RuntimeDecisionAction>,
    pub recovery: Option<RuntimeDecisionRecovery>,
    pub decision_source: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeEvent {
    pub event_id: Option<i64>,
    pub revision: i64,
    pub operation_id: Option<String>,
    pub event_type: String,
    pub lifecycle: RuntimeLifecycle,
    pub task: Option<String>,
    pub source_command: Option<String>,
    pub reason: Option<String>,
    pub next_command: Option<String>,
    pub blocked_by: Vec<String>,
    pub artifacts: ExecutionArtifacts,
    pub actor: String,
    pub recorded_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DerivedOutputStatus {
    pub output_name: String,
    pub path: String,
    pub freshness: String,
    pub source_revision: Option<i64>,
    pub generated_at: Option<String>,
    pub invalidated_at: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSnapshot {
    pub target_root: String,
    pub revision: i64,
    pub operation_id: Option<String>,
    pub task: Option<String>,
    pub source_command: Option<String>,
    pub lifecycle: RuntimeLifecycle,
    pub reason: Option<String>,
    pub next_command: Option<String>,
    pub blocked_by: Vec<String>,
    pub artifacts: ExecutionArtifacts,
    pub last_updated_at: Option<String>,
    pub last_event: Option<RuntimeEvent>,
    pub readiness: RuntimeReadiness,
    pub decision: RuntimeDecision,
    pub derived_freshness: Vec<DerivedOutputStatus>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenTargetRequest {
    pub target_root: String,
    pub root_label: Option<String>,
    pub project_type: Option<String>,
    pub profile_name: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransitionExecutionStateRequest {
    pub target_root: String,
    pub actor: Option<String>,
    pub trigger_command: Option<String>,
    pub event_type: String,
    pub lifecycle: RuntimeLifecycle,
    pub task: Option<String>,
    pub source_command: Option<String>,
    pub reason: Option<String>,
    pub next_command: Option<String>,
    pub blocked_by: Option<Vec<String>>,
    pub artifacts: Option<ExecutionArtifacts>,
    pub operation_id: Option<String>,
    pub reuse_operation: Option<bool>,
    pub clear_task: Option<bool>,
    pub decision: Option<RuntimeDecision>,
    pub invalidate_outputs: Option<Vec<String>>,
    pub materialize_outputs: Option<Vec<String>>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterializeDerivedOutputsRequest {
    pub target_root: String,
    pub outputs: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistDerivedOutputRequest {
    pub target_root: String,
    pub output_name: String,
    pub payload: Value,
    pub source_revision: Option<i64>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListExecutionEventsQuery {
    pub target_root: String,
    pub after_revision: Option<i64>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionEventList {
    pub target_root: String,
    pub latest_revision: i64,
    pub events: Vec<RuntimeEvent>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDaemonMetadata {
    pub pid: u32,
    pub port: u16,
    pub base_url: String,
    pub started_at: String,
    pub launch_mode: Option<String>,
    pub caller_surface: Option<String>,
    pub packaging_source_category: Option<String>,
    pub binary_path: Option<String>,
    pub binary_sha256: Option<String>,
    pub runtime_version: Option<String>,
    pub target_triple: Option<String>,
    pub metadata_path: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeIdentity {
    pub launch_mode: String,
    pub caller_surface: String,
    pub packaging_source_category: String,
    pub binary_path: String,
    pub binary_sha256: String,
    pub runtime_version: String,
    pub target_triple: String,
    pub started_at: String,
    pub metadata_path: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshDerivedOutputsRequest {
    pub target_root: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoGraphCompatibilityArtifacts {
    pub repo_map: Option<String>,
    pub symbol_index: Option<String>,
    pub dependency_graph: Option<String>,
    pub impact_map: Option<String>,
    pub decision_graph: Option<String>,
    pub history_graph: Option<String>,
    pub review_graph: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistRepoGraphRequest {
    pub target_root: String,
    pub source_kind: String,
    pub summary: Option<String>,
    pub source_revision: Option<i64>,
    #[serde(default)]
    pub graph: Option<Value>,
    pub artifact_path: Option<String>,
    pub compatibility_hash: Option<String>,
    pub compatibility_artifacts: RepoGraphCompatibilityArtifacts,
    pub nodes: Vec<RepoGraphNode>,
    pub edges: Vec<RepoGraphEdge>,
    pub modules: Vec<RepoGraphModule>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoGraphNode {
    pub node_id: String,
    pub node_kind: String,
    pub path: Option<String>,
    pub module_id: Option<String>,
    pub symbol: Option<String>,
    pub display_label: String,
    pub language: Option<String>,
    pub attributes: Value,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoGraphEdge {
    pub edge_id: String,
    pub from_node_id: String,
    pub to_node_id: String,
    pub edge_kind: String,
    pub weight: Option<f64>,
    pub evidence: Value,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoGraphModule {
    pub module_id: String,
    pub display_label: String,
    pub summary: Option<String>,
    pub attributes: Value,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoGraphStatus {
    pub target_root: String,
    pub ready: bool,
    pub status: String,
    pub freshness: String,
    pub graph_revision: Option<i64>,
    pub source_revision: Option<i64>,
    pub source_runtime_revision: Option<i64>,
    pub runtime_revision_drift: i64,
    pub stale: bool,
    pub generated_at: Option<String>,
    pub source_kind: Option<String>,
    pub source_digest: Option<String>,
    pub graph_authority_path: String,
    pub graph_authority_kind: String,
    pub node_count: i64,
    pub edge_count: i64,
    pub module_count: i64,
    pub symbol_count: i64,
    pub alias_authority_kind: String,
    pub alias_count: i64,
    pub alias_ambiguity_count: i64,
    pub explicit_alias_source_path: String,
    pub explicit_alias_source_available: bool,
    pub artifact_path: Option<String>,
    pub compatibility_hash: Option<String>,
    pub compatibility_export_ready: bool,
    pub compatibility_in_sync: bool,
    pub compatibility_artifacts: Option<RepoGraphCompatibilityArtifacts>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoGraphSnapshot {
    pub status: RepoGraphStatus,
    pub nodes: Vec<RepoGraphNode>,
    pub edges: Vec<RepoGraphEdge>,
    pub modules: Vec<RepoGraphModule>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoGraphQuery {
    pub target_root: String,
    pub node_id: Option<String>,
    pub path: Option<String>,
    pub module_id: Option<String>,
    pub symbol: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoGraphNodeResult {
    pub status: RepoGraphStatus,
    pub query_resolution: Option<RepoGraphQueryResolution>,
    pub node: Option<RepoGraphNode>,
    pub matches: Vec<RepoGraphNode>,
    pub incoming: Vec<RepoGraphEdge>,
    pub outgoing: Vec<RepoGraphEdge>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoGraphQueryResolution {
    pub queried_value: String,
    pub resolved_node_id: Option<String>,
    pub resolved_module_id: Option<String>,
    pub resolution: String,
    pub score: i64,
    pub candidates: Vec<String>,
    pub reasons: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeProofResponse {
    pub identity: RuntimeIdentity,
    pub snapshot: RuntimeSnapshot,
    pub derived_freshness: Vec<DerivedOutputStatus>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoPackSelectionStatus {
    pub target_root: String,
    pub selected_pack_id: Option<String>,
    pub selected_pack_source: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetRepoPackSelectionRequest {
    pub target_root: String,
    pub pack_id: String,
    pub selection_source: Option<String>,
    pub trigger_command: Option<String>,
    pub actor: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearRepoPackSelectionRequest {
    pub target_root: String,
    pub trigger_command: Option<String>,
    pub actor: Option<String>,
}
