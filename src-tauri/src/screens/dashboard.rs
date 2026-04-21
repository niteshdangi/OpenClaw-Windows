use crate::services::ConfigService;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

/// Opens the gateway control UI in the system browser.
///
/// Resolves the gateway address from config and opens the HTTP control panel.
/// For local gateways this is `http://<address>:<port>/`, for remote-direct
/// gateways the configured remote URL root is used.
pub async fn open(app: &AppHandle) -> crate::error::Result<()> {
    let config_service = app.state::<Arc<ConfigService>>();
    let config = config_service.load().await?;

    let url = match config.gateway_mode.as_str() {
        "remote-direct" => {
            if let Some(remote_url) = &config.remote_url {
                // Convert ws(s):// to http(s)://
                let http_url = remote_url
                    .replace("wss://", "https://")
                    .replace("ws://", "http://");
                // Strip any /ws or /gateway/ws path suffix to get the root
                let base = http_url
                    .trim_end_matches("/ws")
                    .trim_end_matches("/gateway/ws")
                    .trim_end_matches('/')
                    .to_string();
                format!("{}/", base)
            } else {
                format!("http://{}:{}/", config.address, config.port)
            }
        }
        _ => {
            let address = if config.address.is_empty() {
                "127.0.0.1"
            } else {
                &config.address
            };
            let port = if config.port == 0 { 18789 } else { config.port };
            format!("http://{}:{}/", address, port)
        }
    };

    tracing::info!("[Dashboard] Opening gateway control UI: {}", url);
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| crate::error::OpenClawError::Internal(format!("Failed to open browser: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn open_dashboard(app: AppHandle) -> crate::error::Result<()> {
    open(&app).await
}
