use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowState {
    pub id: Uuid,
    pub patient_id: String,
    pub current_stage: WorkflowStage,
    pub assigned_user: Option<String>,
    pub assigned_role: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_stages: Vec<WorkflowStage>,
    pub pending_tasks: Vec<Task>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WorkflowStage {
    Registration,
    Consultation,
    Billing,
    Pharmacy,
    Completed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub assigned_to: String,
    pub assigned_role: String,
    pub priority: TaskPriority,
    pub status: TaskStatus,
    pub created_at: DateTime<Utc>,
    pub due_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TaskPriority {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TaskStatus {
    Pending,
    InProgress,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowTransition {
    pub from_stage: WorkflowStage,
    pub to_stage: WorkflowStage,
    pub required_role: String,
    pub auto_assign: bool,
    pub notification_required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowRule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub conditions: Vec<WorkflowCondition>,
    pub actions: Vec<WorkflowAction>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowCondition {
    pub field: String,
    pub operator: ConditionOperator,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConditionOperator {
    Equals,
    NotEquals,
    GreaterThan,
    LessThan,
    Contains,
    In,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowAction {
    pub action_type: ActionType,
    pub parameters: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActionType {
    AssignTask,
    SendNotification,
    UpdateWorkflow,
    CreateInvoice,
    SendPrescription,
    UpdateStatus,
}

#[derive(Clone)]
pub struct WorkflowEngine {
    workflows: HashMap<Uuid, WorkflowState>,
    rules: Vec<WorkflowRule>,
    transitions: Vec<WorkflowTransition>,
}

impl WorkflowEngine {
    pub fn new() -> Self {
        let mut engine = Self {
            workflows: HashMap::new(),
            rules: Vec::new(),
            transitions: Vec::new(),
        };
        
        engine.initialize_default_transitions();
        engine.initialize_default_rules();
        engine
    }

    fn initialize_default_transitions(&mut self) {
        self.transitions = vec![
            WorkflowTransition {
                from_stage: WorkflowStage::Registration,
                to_stage: WorkflowStage::Consultation,
                required_role: "receptionist".to_string(),
                auto_assign: true,
                notification_required: true,
            },
            WorkflowTransition {
                from_stage: WorkflowStage::Consultation,
                to_stage: WorkflowStage::Billing,
                required_role: "clinician".to_string(),
                auto_assign: true,
                notification_required: true,
            },
            WorkflowTransition {
                from_stage: WorkflowStage::Billing,
                to_stage: WorkflowStage::Pharmacy,
                required_role: "receptionist".to_string(),
                auto_assign: true,
                notification_required: true,
            },
            WorkflowTransition {
                from_stage: WorkflowStage::Pharmacy,
                to_stage: WorkflowStage::Completed,
                required_role: "pharmacist".to_string(),
                auto_assign: true,
                notification_required: true,
            },
        ];
    }

    fn initialize_default_rules(&mut self) {
        self.rules = vec![
            WorkflowRule {
                id: "auto_assign_consultation".to_string(),
                name: "Auto-assign Consultation".to_string(),
                description: "Automatically assign consultation to available clinician".to_string(),
                conditions: vec![
                    WorkflowCondition {
                        field: "current_stage".to_string(),
                        operator: ConditionOperator::Equals,
                        value: serde_json::Value::String("consultation".to_string()),
                    },
                ],
                actions: vec![
                    WorkflowAction {
                        action_type: ActionType::AssignTask,
                        parameters: {
                            let mut params = HashMap::new();
                            params.insert("role".to_string(), serde_json::Value::String("clinician".to_string()));
                            params.insert("title".to_string(), serde_json::Value::String("Patient Consultation Required".to_string()));
                            params
                        },
                    },
                    WorkflowAction {
                        action_type: ActionType::SendNotification,
                        parameters: {
                            let mut params = HashMap::new();
                            params.insert("message".to_string(), serde_json::Value::String("New patient ready for consultation".to_string()));
                            params.insert("role".to_string(), serde_json::Value::String("clinician".to_string()));
                            params
                        },
                    },
                ],
                is_active: true,
            },
            WorkflowRule {
                id: "auto_generate_invoice".to_string(),
                name: "Auto-generate Invoice".to_string(),
                description: "Automatically generate invoice after consultation".to_string(),
                conditions: vec![
                    WorkflowCondition {
                        field: "current_stage".to_string(),
                        operator: ConditionOperator::Equals,
                        value: serde_json::Value::String("billing".to_string()),
                    },
                ],
                actions: vec![
                    WorkflowAction {
                        action_type: ActionType::CreateInvoice,
                        parameters: {
                            let mut params = HashMap::new();
                            params.insert("auto_populate".to_string(), serde_json::Value::Bool(true));
                            params
                        },
                    },
                    WorkflowAction {
                        action_type: ActionType::AssignTask,
                        parameters: {
                            let mut params = HashMap::new();
                            params.insert("role".to_string(), serde_json::Value::String("receptionist".to_string()));
                            params.insert("title".to_string(), serde_json::Value::String("Process Payment".to_string()));
                            params
                        },
                    },
                ],
                is_active: true,
            },
            WorkflowRule {
                id: "auto_send_prescription".to_string(),
                name: "Auto-send Prescription".to_string(),
                description: "Automatically send prescription to pharmacy".to_string(),
                conditions: vec![
                    WorkflowCondition {
                        field: "current_stage".to_string(),
                        operator: ConditionOperator::Equals,
                        value: serde_json::Value::String("pharmacy".to_string()),
                    },
                ],
                actions: vec![
                    WorkflowAction {
                        action_type: ActionType::SendPrescription,
                        parameters: {
                            let mut params = HashMap::new();
                            params.insert("auto_dispense".to_string(), serde_json::Value::Bool(false));
                            params
                        },
                    },
                    WorkflowAction {
                        action_type: ActionType::AssignTask,
                        parameters: {
                            let mut params = HashMap::new();
                            params.insert("role".to_string(), serde_json::Value::String("pharmacist".to_string()));
                            params.insert("title".to_string(), serde_json::Value::String("Dispense Prescription".to_string()));
                            params
                        },
                    },
                ],
                is_active: true,
            },
        ];
    }

    pub fn create_workflow(&mut self, patient_id: String, initial_role: String) -> Uuid {
        let workflow_id = Uuid::new_v4();
        let now = Utc::now();

        let workflow = WorkflowState {
            id: workflow_id,
            patient_id,
            current_stage: WorkflowStage::Registration,
            assigned_user: None,
            assigned_role: Some(initial_role),
            created_at: now,
            updated_at: now,
            completed_stages: Vec::new(),
            pending_tasks: Vec::new(),
            metadata: HashMap::new(),
        };

        self.workflows.insert(workflow_id, workflow);
        self.process_workflow_rules(workflow_id);
        workflow_id
    }

    pub fn advance_workflow(&mut self, workflow_id: Uuid, user_role: String) -> Result<(), String> {
        let current_stage = {
            let workflow = self.workflows.get(&workflow_id)
                .ok_or("Workflow not found")?;
            workflow.current_stage.clone()
        };

        let next_stage = self.get_next_stage(&current_stage, &user_role)?;

        // Update workflow state
        if let Some(workflow) = self.workflows.get_mut(&workflow_id) {
            workflow.current_stage = next_stage.clone();
            workflow.updated_at = Utc::now();
            workflow.completed_stages.push(current_stage);
        }

        // Process workflow rules for the new stage
        self.process_workflow_rules(workflow_id);

        Ok(())
    }

    fn get_next_stage(&self, current_stage: &WorkflowStage, user_role: &str) -> Result<WorkflowStage, String> {
        for transition in &self.transitions {
            if transition.from_stage == *current_stage && transition.required_role == user_role {
                return Ok(transition.to_stage.clone());
            }
        }
        Err(format!("No valid transition from {:?} for role {}", current_stage, user_role))
    }

    fn process_workflow_rules(&mut self, workflow_id: Uuid) {
        let workflow = self.workflows.get(&workflow_id).unwrap().clone();
        let rules = self.rules.clone();
        
        for rule in &rules {
            if !rule.is_active {
                continue;
            }

            if self.evaluate_conditions(&rule.conditions, &workflow) {
                self.execute_actions(&rule.actions, workflow_id);
            }
        }
    }

    fn evaluate_conditions(&self, conditions: &[WorkflowCondition], workflow: &WorkflowState) -> bool {
        for condition in conditions {
            let field_value = match condition.field.as_str() {
                "current_stage" => serde_json::Value::String(format!("{:?}", workflow.current_stage).to_lowercase()),
                "assigned_role" => workflow.assigned_role.as_ref()
                    .map(|r| serde_json::Value::String(r.clone()))
                    .unwrap_or(serde_json::Value::Null),
                _ => continue,
            };

            if !self.evaluate_condition(&field_value, &condition.operator, &condition.value) {
                return false;
            }
        }
        true
    }

    fn evaluate_condition(&self, field_value: &serde_json::Value, operator: &ConditionOperator, expected_value: &serde_json::Value) -> bool {
        match operator {
            ConditionOperator::Equals => field_value == expected_value,
            ConditionOperator::NotEquals => field_value != expected_value,
            ConditionOperator::GreaterThan => {
                if let (Some(field_num), Some(expected_num)) = (field_value.as_f64(), expected_value.as_f64()) {
                    field_num > expected_num
                } else {
                    false
                }
            },
            ConditionOperator::LessThan => {
                if let (Some(field_num), Some(expected_num)) = (field_value.as_f64(), expected_value.as_f64()) {
                    field_num < expected_num
                } else {
                    false
                }
            },
            ConditionOperator::Contains => {
                if let (Some(field_str), Some(expected_str)) = (field_value.as_str(), expected_value.as_str()) {
                    field_str.contains(expected_str)
                } else {
                    false
                }
            },
            ConditionOperator::In => {
                if let Some(expected_array) = expected_value.as_array() {
                    expected_array.contains(field_value)
                } else {
                    false
                }
            },
        }
    }

    fn execute_actions(&mut self, actions: &[WorkflowAction], workflow_id: Uuid) {
        for action in actions {
            match action.action_type {
                ActionType::AssignTask => {
                    self.create_task(workflow_id, action);
                },
                ActionType::SendNotification => {
                    self.send_notification(workflow_id, action);
                },
                ActionType::UpdateWorkflow => {
                    self.update_workflow(workflow_id, action);
                },
                ActionType::CreateInvoice => {
                    self.create_invoice(workflow_id, action);
                },
                ActionType::SendPrescription => {
                    self.send_prescription(workflow_id, action);
                },
                ActionType::UpdateStatus => {
                    self.update_status(workflow_id, action);
                },
            }
        }
    }

    fn create_task(&mut self, workflow_id: Uuid, action: &WorkflowAction) {
        if let Some(workflow) = self.workflows.get_mut(&workflow_id) {
            let task = Task {
                id: Uuid::new_v4(),
                title: action.parameters.get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("New Task")
                    .to_string(),
                description: action.parameters.get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                assigned_to: "".to_string(), // Will be assigned to available user
                assigned_role: action.parameters.get("role")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                priority: TaskPriority::Medium,
                status: TaskStatus::Pending,
                created_at: Utc::now(),
                due_at: None,
                completed_at: None,
                metadata: HashMap::new(),
            };

            workflow.pending_tasks.push(task);
        }
    }

    fn send_notification(&self, _workflow_id: Uuid, action: &WorkflowAction) {
        // Implementation would integrate with notification system
        let message = action.parameters.get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("Notification");
        let role = action.parameters.get("role")
            .and_then(|v| v.as_str())
            .unwrap_or("all");
        
        println!("📢 Notification to {}: {}", role, message);
    }

    fn update_workflow(&mut self, _workflow_id: Uuid, _action: &WorkflowAction) {
        // Implementation for workflow updates
    }

    fn create_invoice(&mut self, _workflow_id: Uuid, _action: &WorkflowAction) {
        // Implementation would integrate with billing system
        println!("💰 Auto-generating invoice...");
    }

    fn send_prescription(&mut self, _workflow_id: Uuid, _action: &WorkflowAction) {
        // Implementation would integrate with pharmacy system
        println!("💊 Sending prescription to pharmacy...");
    }

    fn update_status(&mut self, _workflow_id: Uuid, _action: &WorkflowAction) {
        // Implementation for status updates
    }

    pub fn get_workflow(&self, workflow_id: Uuid) -> Option<&WorkflowState> {
        self.workflows.get(&workflow_id)
    }

    pub fn get_tasks_for_role(&self, role: &str) -> Vec<&Task> {
        self.workflows
            .values()
            .flat_map(|workflow| &workflow.pending_tasks)
            .filter(|task| task.assigned_role == role && task.status == TaskStatus::Pending)
            .collect()
    }

    pub fn get_workflows_for_stage(&self, stage: &WorkflowStage) -> Vec<&WorkflowState> {
        self.workflows
            .values()
            .filter(|workflow| workflow.current_stage == *stage)
            .collect()
    }

    pub fn complete_task(&mut self, task_id: Uuid) -> Result<(), String> {
        for workflow in self.workflows.values_mut() {
            for task in &mut workflow.pending_tasks {
                if task.id == task_id {
                    task.status = TaskStatus::Completed;
                    task.completed_at = Some(Utc::now());
                    return Ok(());
                }
            }
        }
        Err("Task not found".to_string())
    }
}

impl Default for WorkflowEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workflow_creation() {
        let mut engine = WorkflowEngine::new();
        let workflow_id = engine.create_workflow("PAT-001".to_string(), "receptionist".to_string());
        
        let workflow = engine.get_workflow(workflow_id).unwrap();
        assert_eq!(workflow.current_stage, WorkflowStage::Registration);
        assert_eq!(workflow.patient_id, "PAT-001");
    }

    #[test]
    fn test_workflow_advancement() {
        let mut engine = WorkflowEngine::new();
        let workflow_id = engine.create_workflow("PAT-001".to_string(), "receptionist".to_string());
        
        let result = engine.advance_workflow(workflow_id, "receptionist".to_string());
        assert!(result.is_ok());
        
        let workflow = engine.get_workflow(workflow_id).unwrap();
        assert_eq!(workflow.current_stage, WorkflowStage::Consultation);
    }

    #[test]
    fn test_task_creation() {
        let mut engine = WorkflowEngine::new();
        let workflow_id = engine.create_workflow("PAT-001".to_string(), "receptionist".to_string());
        
        // Advance to consultation stage to trigger task creation
        engine.advance_workflow(workflow_id, "receptionist".to_string()).unwrap();
        
        let workflow = engine.get_workflow(workflow_id).unwrap();
        assert!(!workflow.pending_tasks.is_empty());
    }
}
