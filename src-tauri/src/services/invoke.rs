use crate::error::OpenClawError;
use crate::services::exec_approvals::ExecApprovalsService;
use crate::services::GatewayService;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawSystemRunParams {
    command: Vec<String>,
    #[allow(dead_code)]
    raw_command: Option<String>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    timeout_ms: Option<u64>,
    #[allow(dead_code)]
    needs_screen_recording: Option<BoolOrString>,
    agent_id: Option<String>,
    session_key: Option<String>,
    #[allow(dead_code)]
    approved: Option<bool>,
    #[allow(dead_code)]
    approval_decision: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawSystemWhichParams {
    bins: Vec<String>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum BoolOrString {
    Bool(bool),
    String(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExecEventPayload {
    session_key: String,
    run_id: String,
    host: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    exit_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    timed_out: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    success: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
}

struct ExecCommandFormatter;

impl ExecCommandFormatter {
    fn display_string(argv: &[String], raw_command: Option<&str>) -> String {
        if let Some(raw) = raw_command {
            let trimmed = raw.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }

        argv.iter()
            .map(|arg| {
                let trimmed = arg.trim();
                if trimmed.is_empty() {
                    return "\"\"".to_string();
                }
                let needs_quotes = trimmed.contains(|c: char| c.is_whitespace() || c == '"');
                if !needs_quotes {
                    return trimmed.to_string();
                }
                let escaped = trimmed.replace('"', "\\\"");
                format!("\"{}\"", escaped)
            })
            .collect::<Vec<_>>()
            .join(" ")
    }
}

pub async fn handle_request(app: AppHandle, req: serde_json::Value, gateway: Arc<GatewayService>) {
    let id = match req["id"].as_str() {
        Some(id) => id,
        None => {
            tracing::error!("invoke request missing required 'id' field, dropping");
            return;
        }
    };
    let node_id = match req["nodeId"].as_str() {
        Some(nid) => nid,
        None => {
            tracing::error!("invoke request missing required 'nodeId' field, dropping");
            return;
        }
    };
    let command = req["command"].as_str().unwrap_or("");
    let params_json = req["paramsJSON"].as_str();

    tracing::info!(
        "Handling gateway request: {} ({}) for node {}",
        command,
        id,
        node_id
    );

    let res = match command {
        "camera.snap" => {
            let p = params_json
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(Value::Null);
            crate::services::media::handle_camera_snap(&app, &p).await
        }
        "camera.list" => {
            let p = params_json
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(Value::Null);
            crate::services::media::handle_camera_list(&app, &p).await
        }
        "screen.record" => {
            let p = params_json
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(Value::Null);
            crate::services::media::handle_screen_record(&app, &p).await
        }
        "system.run" => handle_system_run(&app, params_json, gateway.clone()).await,
        "system.which" => {
            let p = params_json
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(Value::Null);
            handle_system_which(&app, &p).await
        }
        "system.notify" => {
            let p = params_json
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(Value::Null);
            handle_system_notify(&app, &p).await
        }
        "system.exec_approvals.get" => {
            let p = params_json
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(Value::Null);
            handle_exec_approvals_get(&app, &p).await
        }
        "system.exec_approvals.set" => {
            let p = params_json
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(Value::Null);
            handle_exec_approvals_set(&app, &p).await
        }
        _ => {
            tracing::warn!("Unknown command received from gateway: {}", command);
            Err(OpenClawError::Internal(format!(
                "Unknown command: {}",
                command
            )))
        }
    };

    let response = match res {
        Ok(payload) => json!({
            "type": "req",
            "id": uuid::Uuid::new_v4().simple().to_string(),
            "method": "node.invoke.result",
            "params": {
                "id": id,
                "nodeId": node_id,
                "ok": true,
                "payload": payload
            }
        }),
        Err(e) => json!({
            "type": "req",
            "id": uuid::Uuid::new_v4().simple().to_string(),
            "method": "node.invoke.result",
            "params": {
                "id": id,
                "nodeId": node_id,
                "ok": false,
                "error": { "code": "INVOKE_FAILED", "message": e.to_string() }
            }
        }),
    };

    let _ = gateway.send_node_response(response.to_string()).await;
}

async fn handle_system_run(
    app: &AppHandle,
    params_json: Option<&str>,
    gateway: Arc<GatewayService>,
) -> crate::error::Result<serde_json::Value> {
    let run_params: OpenClawSystemRunParams = params_json
        .and_then(|s| serde_json::from_str(s).ok())
        .ok_or_else(|| OpenClawError::Internal("Invalid system.run params".to_string()))?;

    if run_params.command.is_empty() {
        return Err(OpenClawError::Internal("Command required".to_string()));
    }

    let display_command = ExecCommandFormatter::display_string(
        &run_params.command,
        run_params.raw_command.as_deref(),
    );
    let agent_id = run_params.agent_id.as_deref();
    let session_key = run_params
        .session_key
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "main".to_string());
    let run_id = uuid::Uuid::new_v4().to_string();

    let env = sanitize_env(run_params.env);

    let exec_service = app.state::<Arc<ExecApprovalsService>>();

    // Security validation
    match exec_service
        .validate_command(&display_command, agent_id)
        .await
    {
        Ok(_) => {}
        Err(e) => {
            emit_exec_event(
                &gateway,
                "exec.denied",
                ExecEventPayload {
                    session_key: session_key.clone(),
                    run_id,
                    host: "node".to_string(),
                    command: Some(display_command),
                    exit_code: None,
                    timed_out: None,
                    success: None,
                    output: None,
                    reason: Some(e.to_string()),
                },
            )
            .await;
            return Err(e);
        }
    }

    emit_exec_event(
        &gateway,
        "exec.started",
        ExecEventPayload {
            session_key: session_key.clone(),
            run_id: run_id.clone(),
            host: "node".to_string(),
            command: Some(display_command.clone()),
            exit_code: None,
            timed_out: None,
            success: None,
            output: None,
            reason: None,
        },
    )
    .await;

    let system_service = app.state::<Arc<crate::services::system::SystemService>>();
    let result = system_service
        .run_command(
            &run_params.command,
            run_params.cwd,
            env,
            run_params.timeout_ms,
        )
        .await;

    match result {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let exit_code = output.status.code();
            let success = output.status.success();

            let combined_output = if stderr.is_empty() {
                stdout.clone()
            } else if stdout.is_empty() {
                stderr.clone()
            } else {
                format!("{}\n{}", stdout, stderr)
            };

            emit_exec_event(
                &gateway,
                "exec.finished",
                ExecEventPayload {
                    session_key,
                    run_id,
                    host: "node".to_string(),
                    command: Some(display_command),
                    exit_code,
                    timed_out: Some(false),
                    success: Some(success),
                    output: truncate_output(combined_output),
                    reason: None,
                },
            )
            .await;

            Ok(json!({
                "exitCode": exit_code,
                "timedOut": false,
                "success": success,
                "stdout": stdout,
                "stderr": stderr,
                "error": Value::Null,
            }))
        }
        Err(e) if e.to_string().contains("timed out") => {
            emit_exec_event(
                &gateway,
                "exec.finished",
                ExecEventPayload {
                    session_key,
                    run_id,
                    host: "node".to_string(),
                    command: Some(display_command),
                    exit_code: None,
                    timed_out: Some(true),
                    success: Some(false),
                    output: None,
                    reason: Some("Timed out".to_string()),
                },
            )
            .await;

            Ok(json!({
                "exitCode": Value::Null,
                "timedOut": true,
                "success": false,
                "stdout": "",
                "stderr": "",
                "error": "Command timed out"
            }))
        }
        Err(e) => {
            emit_exec_event(
                &gateway,
                "exec.finished",
                ExecEventPayload {
                    session_key,
                    run_id,
                    host: "node".to_string(),
                    command: Some(display_command),
                    exit_code: None,
                    timed_out: Some(false),
                    success: Some(false),
                    output: None,
                    reason: Some(e.to_string()),
                },
            )
            .await;
            Err(e)
        }
    }
}

async fn emit_exec_event(gateway: &GatewayService, event: &str, payload: ExecEventPayload) {
    let msg = json!({
        "type": "event",
        "event": event,
        "payload": payload
    });
    let _ = gateway.send_node_response(msg.to_string()).await;
}

fn truncate_output(s: String) -> Option<String> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }
    let max_chars = 20000;
    if trimmed.len() <= max_chars {
        return Some(trimmed.to_string());
    }
    Some(format!(
        "... (truncated) {}",
        &trimmed[trimmed.len() - max_chars..]
    ))
}

fn sanitize_env(overrides: Option<HashMap<String, String>>) -> Option<HashMap<String, String>> {
    let mut merged = std::env::vars().collect::<HashMap<String, String>>();
    let overrides = overrides?;

    let blocked_keys: std::collections::HashSet<&str> = [
        "PATH",
        "NODE_OPTIONS",
        "PYTHONHOME",
        "PYTHONPATH",
        "PERL5LIB",
        "PERL5OPT",
        "RUBYOPT",
    ]
    .iter()
    .cloned()
    .collect();

    let blocked_prefixes = ["DYLD_", "LD_"];

    for (key, value) in overrides {
        let trimmed_key = key.trim();
        if trimmed_key.is_empty() {
            continue;
        }
        let upper = trimmed_key.to_uppercase();
        if blocked_keys.contains(upper.as_str()) {
            continue;
        }
        if blocked_prefixes.iter().any(|p| upper.starts_with(p)) {
            continue;
        }
        merged.insert(trimmed_key.to_string(), value);
    }
    Some(merged)
}

async fn handle_system_which(
    _app: &AppHandle,
    params: &serde_json::Value,
) -> crate::error::Result<serde_json::Value> {
    let which_params: OpenClawSystemWhichParams = serde_json::from_value(params.clone())
        .map_err(|e| OpenClawError::Internal(format!("Invalid system.which params: {}", e)))?;

    let mut results = std::collections::HashMap::new();

    for bin_str in &which_params.bins {
        if bin_str.is_empty() {
            continue;
        }
        // Simple check using 'where' on Windows
        let output = std::process::Command::new("where").arg(bin_str).output();
        if let Ok(out) = output {
            if out.status.success() {
                let path = String::from_utf8_lossy(&out.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                results.insert(bin_str.to_string(), path);
            }
        }
    }

    Ok(json!({
        "bins": results.keys().cloned().collect::<Vec<_>>(),
        "paths": results,
    }))
}

async fn handle_system_notify(
    app: &AppHandle,
    params: &serde_json::Value,
) -> crate::error::Result<serde_json::Value> {
    let title = params["title"].as_str().unwrap_or("OpenClaw");
    let body = params["body"].as_str().unwrap_or("");

    crate::screens::notification::show_notification(app, title, body);

    Ok(json!(true))
}

async fn handle_exec_approvals_get(
    app: &AppHandle,
    _params: &serde_json::Value,
) -> crate::error::Result<serde_json::Value> {
    let exec_service = app.state::<Arc<ExecApprovalsService>>();
    let snapshot = exec_service.read_snapshot().await?;
    Ok(json!(snapshot))
}

async fn handle_exec_approvals_set(
    app: &AppHandle,
    params: &serde_json::Value,
) -> crate::error::Result<serde_json::Value> {
    let exec_service = app.state::<Arc<ExecApprovalsService>>();
    let file: crate::models::exec_approvals::ExecApprovalsFile =
        serde_json::from_value(params["file"].clone())
            .map_err(|e| OpenClawError::Internal(format!("Invalid file structure: {}", e)))?;

    let hash = exec_service.save_file(file).await?;
    let mut next_snapshot = exec_service.read_snapshot().await?;
    next_snapshot.hash = hash;

    Ok(json!(next_snapshot))
}
