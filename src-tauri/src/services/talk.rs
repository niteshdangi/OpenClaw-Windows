use crate::providers::{AudioHandle, AudioProvider, SpeechProvider};
use crate::providers::speech::{RecognitionEvent, RecognitionOptions};
use crate::services::runtime::BackgroundService;
use crate::services::GatewayService;
use async_trait::async_trait;
use serde_json::json;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

pub struct TalkService {
    audio_provider: Arc<dyn AudioProvider>,
    speech_provider: Arc<dyn SpeechProvider>,
    gateway: Arc<GatewayService>,
    is_enabled: Arc<Mutex<bool>>,
    audio_handle: Arc<Mutex<Option<Box<dyn AudioHandle>>>>,
}

impl TalkService {
    pub fn new(
        audio_provider: Arc<dyn AudioProvider>,
        speech_provider: Arc<dyn SpeechProvider>,
        gateway: Arc<GatewayService>,
    ) -> Self {
        Self {
            audio_provider,
            speech_provider,
            gateway,
            is_enabled: Arc::new(Mutex::new(false)),
            audio_handle: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn set_enabled(
        &self,
        app: &AppHandle,
        enabled: bool,
    ) -> crate::error::Result<()> {
        let mut is_enabled = self.is_enabled.lock().await;

        if enabled == *is_enabled {
            return Ok(());
        }

        if enabled {
            tracing::info!("[TalkMode] Starting speech recognition...");

            // Start audio level monitoring for UI feedback
            let app_handle = app.clone();
            let mut audio_lock = self.audio_handle.lock().await;
            if audio_lock.is_none() {
                let handle = self.audio_provider.build_input_stream(Box::new(
                    move |data: &[f32]| {
                        if data.is_empty() {
                            return;
                        }
                        let mut sum = 0.0;
                        for &sample in data {
                            sum += sample * sample;
                        }
                        let rms = (sum / data.len() as f32).sqrt();
                        let level = (rms * 3.0).min(1.0);
                        let _ = app_handle.emit("voice_audio_level", json!({ "level": level }));
                    },
                ))?;
                handle.play()?;
                *audio_lock = Some(handle);
            }

            // Start Windows Speech Recognition for transcription
            let gateway = self.gateway.clone();
            let app_clone = app.clone();
            self.speech_provider
                .start_recognition(
                    RecognitionOptions::default(),
                    Box::new(move |event: RecognitionEvent| {
                        if event.session_completed {
                            tracing::info!("[TalkMode] Speech session completed (status={:?})", event.status);
                            return;
                        }

                        let transcript = event.transcript.trim().to_string();
                        if transcript.is_empty() {
                            return;
                        }

                        // Emit partial/final transcript to the voice overlay UI
                        let _ = app_clone.emit(
                            "voice_wake_active",
                            json!({
                                "transcript": transcript,
                                "token": "talk-mode",
                            }),
                        );

                        if event.is_final && !transcript.is_empty() {
                            tracing::info!("[TalkMode] Final transcript: {}", transcript);

                            let gw = gateway.clone();
                            let app_inner = app_clone.clone();
                            let text = transcript.clone();
                            tokio::spawn(async move {
                                Self::send_to_gateway(&app_inner, &gw, &text).await;
                            });
                        }
                    }),
                )
                .await?;

            // Broadcast talk.mode enabled to gateway
            self.broadcast_talk_mode(true, Some("listening")).await;
        } else {
            tracing::info!("[TalkMode] Stopping speech recognition...");

            self.speech_provider.stop_recognition().await?;

            let mut audio_lock = self.audio_handle.lock().await;
            *audio_lock = None;

            // Broadcast talk.mode disabled to gateway
            self.broadcast_talk_mode(false, None).await;
        }

        *is_enabled = enabled;
        Ok(())
    }

    async fn send_to_gateway(app: &AppHandle, gateway: &GatewayService, text: &str) {
        let machine_name = std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .unwrap_or_else(|_| "Windows PC".to_string());

        let request = json!({
            "id": format!("talk_{}", uuid::Uuid::new_v4().simple()),
            "type": "req",
            "method": "agent",
            "params": {
                "message": format!(
                    "<system>Voice dictation from {} (talk mode)</system>\n{}",
                    machine_name, text
                ),
                "sessionKey": "main",
                "thinking": "low",
                "deliver": true,
                "to": "",
                "channel": "last",
                "idempotencyKey": uuid::Uuid::new_v4().simple().to_string()
            }
        });

        // Show sending state in overlay
        let _ = app.emit(
            "voice_wake_triggered",
            json!({
                "token": "talk-mode",
                "command": text,
                "sendChime": "Glass",
            }),
        );

        match gateway.request(request.to_string()).await {
            Ok(_) => {
                tracing::info!("[TalkMode] Transcript sent to gateway successfully");
            }
            Err(e) => {
                tracing::error!("[TalkMode] Failed to send transcript to gateway: {}", e);
            }
        }
    }

    async fn broadcast_talk_mode(&self, enabled: bool, phase: Option<&str>) {
        let req = json!({
            "id": format!("talk_mode_{}", uuid::Uuid::new_v4().simple()),
            "type": "req",
            "method": "talk.mode",
            "params": {
                "enabled": enabled,
                "phase": phase,
            }
        });

        let _ = self.gateway.request(req.to_string()).await.map_err(|e| {
            tracing::warn!("[TalkMode] Failed to broadcast talk.mode: {}", e);
        });
    }

    pub async fn is_enabled(&self) -> bool {
        *self.is_enabled.lock().await
    }
}

#[async_trait]
impl BackgroundService for TalkService {
    fn name(&self) -> &'static str {
        "TalkService"
    }

    async fn start(&self, _app: AppHandle) -> anyhow::Result<()> {
        tracing::info!("Starting TalkService (Windows)...");
        Ok(())
    }

    async fn stop(&self) -> anyhow::Result<()> {
        tracing::info!("Stopping TalkService...");
        // Stop speech recognition and audio on shutdown
        let _ = self.speech_provider.stop_recognition().await;
        let mut audio_lock = self.audio_handle.lock().await;
        *audio_lock = None;
        let mut enabled = self.is_enabled.lock().await;
        *enabled = false;
        Ok(())
    }
}

#[tauri::command]
pub async fn set_talk_mode_enabled(app: AppHandle, enabled: bool) -> crate::error::Result<()> {
    // Mutual exclusion: disable voice wake when talk mode starts
    if enabled {
        let voice_wake = app.state::<Arc<crate::services::VoiceWakeService>>();
        if *voice_wake.is_enabled.lock().await {
            tracing::info!("[TalkMode] Disabling voice wake for talk mode");
            voice_wake.set_enabled(app.clone(), false).await?;
        }
    }
    let service = app.state::<Arc<TalkService>>();
    service.set_enabled(&app, enabled).await
}

#[tauri::command]
pub async fn get_talk_mode_status(app: AppHandle) -> crate::error::Result<bool> {
    let service = app.state::<Arc<TalkService>>();
    Ok(service.is_enabled().await)
}
