use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

// ---------------------------------------------------------------------------
// Tauri Commands — called from the React frontend via invoke()
// ---------------------------------------------------------------------------

/// Update OS-level media metadata (System Media Transport Controls on Windows,
/// MPRIS on Linux, Now Playing widget on macOS).
/// The frontend calls this via: invoke('update_media_metadata', { ... })
#[tauri::command]
fn update_media_metadata(
    title: String,
    artist: String,
    album: String,
    artwork: String,
    is_playing: bool,
    position_sec: u32,
    duration_sec: u32,
) {
    // Platform-specific implementations in separate modules below.
    // On unsupported platforms this is a no-op — the Media Session API
    // in the WebView handles it as fallback.
    log::debug!(
        "Media metadata: {} - {} ({}) playing={} pos={}s/{}s",
        artist, title, album, is_playing, position_sec, duration_sec
    );

    #[cfg(target_os = "windows")]
    windows_smtc::update(
        &title, &artist, &album, &artwork, is_playing, position_sec, duration_sec,
    );
}

/// Get the AURA app version from Cargo.toml
#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Open the AURA downloads directory in the system file manager
#[tauri::command]
fn open_downloads_folder(app: tauri::AppHandle) -> Result<(), String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let downloads = data_dir.join("downloads");
    std::fs::create_dir_all(&downloads).ok();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(downloads)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(downloads)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(downloads)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Windows SMTC (System Media Transport Controls)
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
mod windows_smtc {
    /// Attempt to update Windows SMTC.
    /// This is best-effort — failure is logged, not propagated.
    pub fn update(
        title: &str,
        artist: &str,
        album: &str,
        _artwork: &str,
        is_playing: bool,
        _position_sec: u32,
        _duration_sec: u32,
    ) {
        // Full Windows SMTC implementation requires the WinRT APIs
        // and a background thread — this stub logs the intent.
        // A production implementation would use the `windows` crate
        // with SystemMediaTransportControls WinRT class.
        log::info!(
            "[SMTC] {} - {} | {} | playing={}",
            artist, title, album, is_playing
        );
    }
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

pub fn run() {
    tauri::Builder::default()
        // -- Plugins --
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // When a second instance is launched, focus the existing window
            // and emit any deep-link args as an event to the frontend.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                if let Some(url) = args.get(1) {
                    let _ = window.emit("deep-link://new-url", url.clone());
                }
            }
        }))
        // -- Commands --
        .invoke_handler(tauri::generate_handler![
            update_media_metadata,
            get_app_version,
            open_downloads_folder,
        ])
        // -- Setup --
        .setup(|app| {
            // Show main window after setup to avoid white flash
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }

            // Register deep-link URL scheme (aura://)
            #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
            app.deep_link().register_all()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running AURA desktop application");
}
