mod printer;

use printer::{PrinterInfo, PrinterState, Target};
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

/// Runs blocking printer work off the UI thread.
async fn blocking<T: Send + 'static>(
    app: AppHandle,
    f: impl FnOnce(&PrinterState) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || f(&app.state::<PrinterState>()))
        .await
        .map_err(|e| e.to_string())?
}

fn raw_body(request: &Request<'_>) -> Result<Vec<u8>, String> {
    match request.body() {
        InvokeBody::Raw(b) => Ok(b.clone()),
        InvokeBody::Json(_) => Err("Expected binary data.".into()),
    }
}

#[tauri::command]
async fn printer_list() -> Vec<PrinterInfo> {
    tauri::async_runtime::spawn_blocking(printer::list).await.unwrap_or_default()
}

#[tauri::command]
async fn printer_connect(app: AppHandle, target: Target) -> Result<(), String> {
    blocking(app, move |s| s.connect(&target)).await
}

#[tauri::command]
async fn printer_close(app: AppHandle) -> Result<(), String> {
    blocking(app, |s| {
        s.close();
        Ok(())
    })
    .await
}

#[tauri::command]
async fn printer_write(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let data = raw_body(&request)?;
    blocking(app, move |s| s.write(&data)).await
}

#[tauri::command]
async fn printer_read(app: AppHandle, n: usize, ms: u64) -> Result<Option<Vec<u8>>, String> {
    blocking(app, move |s| s.read(n, ms)).await
}

/// Shows a Save dialog and writes the file. Returns false if the user cancelled.
#[tauri::command]
async fn save_file(app: AppHandle, request: Request<'_>) -> Result<bool, String> {
    let data = raw_body(&request)?;
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.to_string())
        .unwrap_or_else(|| "labels".into());
    let name = percent_decode(&name);
    let ext = name.rsplit_once('.').map(|(_, e)| e.to_string());
    let app2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut dlg = app2.dialog().file().set_file_name(&name);
        if let Some(ext) = &ext {
            dlg = dlg.add_filter(ext.to_uppercase(), &[ext.as_str()]);
        }
        let Some(path) = dlg.blocking_save_file() else { return Ok(false) };
        let path = path.into_path().map_err(|e| e.to_string())?;
        std::fs::write(&path, &data).map_err(|e| format!("Couldn't save {}: {e}", path.display()))?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// File names travel in a header, so the page percent-encodes them.
fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(PrinterState::default())
        .invoke_handler(tauri::generate_handler![
            printer_list,
            printer_connect,
            printer_close,
            printer_write,
            printer_read,
            save_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Labelina");
}
