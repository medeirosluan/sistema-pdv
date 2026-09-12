use printers::common::base::job::PrinterJobOptions;

#[derive(serde::Serialize)]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
}

/// Lista as impressoras instaladas no sistema operacional.
#[tauri::command]
pub fn list_printers() -> Vec<PrinterInfo> {
    printers::get_printers()
        .into_iter()
        .map(|printer| PrinterInfo {
            name: printer.name,
            is_default: printer.is_default,
        })
        .collect()
}

/// Envia bytes crus (ESC/POS) diretamente para a fila de impressão do
/// sistema, sem abrir nenhum diálogo — a impressora deve estar instalada
/// e configurada para aceitar trabalhos RAW (padrão para impressoras
/// térmicas de cupom).
#[tauri::command]
pub fn print_raw(printer_name: Option<String>, data: Vec<u8>) -> Result<(), String> {
    let printer = match printer_name.as_deref() {
        Some(name) => printers::get_printer_by_name(name),
        None => printers::get_default_printer(),
    };
    let printer = printer.ok_or_else(|| "Nenhuma impressora encontrada".to_string())?;
    printer
        .print(&data, PrinterJobOptions::none())
        .map(|_job_id| ())
        .map_err(|err| err.message)
}
