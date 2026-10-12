use tauri::WebviewWindow;

#[tauri::command]
fn set_always_on_top(window: WebviewWindow, always_on_top: bool) -> Result<bool, String> {
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())?;
    Ok(always_on_top)
}

#[tauri::command]
fn set_compact_size(window: WebviewWindow, compact: bool) -> Result<(), String> {
    if compact {
        window.set_size(tauri::LogicalSize::new(660.0, 160.0)).map_err(|e| e.to_string())?;
    } else {
        window.set_size(tauri::LogicalSize::new(940.0, 520.0)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            set_always_on_top,
            set_compact_size
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
