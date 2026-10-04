// Desktop-only imports (system tray). These are gated so the same crate also
// compiles for Android/iOS, where the tray API is unavailable.
#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

/// Show and focus the main window (used by the tray menu / left click).
#[cfg(desktop)]
fn show_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Plugins that work on every platform (desktop + mobile).
    let mut builder = tauri::Builder::default()
        // HTTP plugin lets the webview reach the user's AstrBot server without CORS.
        .plugin(tauri_plugin_http::init())
        // System notifications (desktop notification center / Android notifications).
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init());

    // ----- Desktop-only: system tray, close-to-tray, auto-start -----
    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::MacosLauncher;

        builder = builder
            .plugin(tauri_plugin_autostart::init(
                MacosLauncher::LaunchAgent,
                None,
            ))
            .setup(|app| {
                // System tray: keep running in the background after closing.
                let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
                let quit_item =
                    MenuItem::with_id(app, "quit", "退出 AstrBot+", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

                let _tray = TrayIconBuilder::with_id("main-tray")
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("AstrBot+")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => show_main(app),
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            show_main(tray.app_handle());
                        }
                    })
                    .build(app)?;

                Ok(())
            })
            // Closing the window hides it to the tray instead of quitting, so the
            // client keeps running in the background and can still notify.
            .on_window_event(|window, event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window.hide();
                    api.prevent_close();
                }
            });
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running AstrBot+");
}
