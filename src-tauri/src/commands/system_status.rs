use serde::Serialize;
use sysinfo::System;

#[derive(Serialize)]
pub struct SystemStatus {
    pub os_name: String,
    pub os_version: String,
    pub total_memory_mb: u64,
    pub available_memory_mb: u64,
    pub used_memory_mb: u64,
    pub cpu_count: usize,
    pub hostname: String,
}

#[tauri::command]
pub fn check_system_status() -> SystemStatus {
    let mut sys = System::new_all();
    sys.refresh_all();

    let total_mem = sys.total_memory() / 1024 / 1024;
    let available_mem = sys.available_memory() / 1024 / 1024;
    let used_mem = total_mem - available_mem;

    SystemStatus {
        os_name: System::name().unwrap_or_else(|| "Unknown".to_string()),
        os_version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        total_memory_mb: total_mem,
        available_memory_mb: available_mem,
        used_memory_mb: used_mem,
        cpu_count: sys.cpus().len(),
        hostname: System::host_name().unwrap_or_else(|| "Unknown".to_string()),
    }
}
