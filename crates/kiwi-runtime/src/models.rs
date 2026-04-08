use serde::{Deserialize, Serialize};
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
}
