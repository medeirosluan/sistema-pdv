mod printing;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            printing::list_printers,
            printing::print_raw
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
