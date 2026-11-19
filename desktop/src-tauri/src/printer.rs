//! Printer transports for the desktop app.
//!
//! The web page builds the Brother raster job (js/ptouch.js) exactly as it does in the
//! browser; this module only moves the bytes. Two routes:
//!
//! * `usb`: a Windows printer queue that uses Brother's own driver. The job is sent with
//!   the RAW datatype, so the driver passes the raster commands through untouched. No
//!   WinUSB/Zadig swap is needed and P-touch Editor keeps working. The spooler is
//!   write-only, so the tape can't be read on this route.
//! * `bluetooth` / `serial`: a COM port (Bluetooth SPP shows up as one once the printer
//!   is paired). The port is held open between prints, and a failed write reopens the
//!   port and tries once more, which covers the printer having slept or been switched off.

use serde::{Deserialize, Serialize};
use std::io::{ErrorKind, Read, Write};
use std::sync::Mutex;
use std::time::{Duration, Instant};

const SERIAL_BAUD: u32 = 115_200;
const SERIAL_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Serialize, Clone, Debug)]
pub struct PrinterInfo {
    /// "usb", "bluetooth" or "serial"
    pub kind: String,
    /// Windows printer name (usb) or COM port path (bluetooth/serial)
    pub address: String,
    /// Human-readable name for the picker
    pub name: String,
    /// Extra context, e.g. "Bluetooth · COM5" or "USB · offline"
    pub detail: String,
}

#[derive(Deserialize, Clone, Debug)]
pub struct Target {
    pub kind: String,
    pub address: String,
}

enum Link {
    Spooler { name: String },
    Serial { path: String, port: Box<dyn serialport::SerialPort> },
}

#[derive(Default)]
pub struct PrinterState(Mutex<Option<Link>>);

// ------------------------------------------------------------------ discovery

pub fn list() -> Vec<PrinterInfo> {
    let mut out = Vec::new();
    #[cfg(windows)]
    {
        out.extend(win::spooler_printers());
        out.extend(win::bluetooth_ports());
    }
    #[cfg(not(windows))]
    {
        if let Ok(ports) = serialport::available_ports() {
            for p in ports {
                let bt = matches!(p.port_type, serialport::SerialPortType::BluetoothPort);
                out.push(PrinterInfo {
                    kind: if bt { "bluetooth" } else { "serial" }.into(),
                    name: p.port_name.clone(),
                    detail: if bt { "Bluetooth".into() } else { "Serial port".into() },
                    address: p.port_name,
                });
            }
        }
    }
    out
}

// ------------------------------------------------------------------ connection

fn open_serial(path: &str) -> Result<Box<dyn serialport::SerialPort>, String> {
    serialport::new(path, SERIAL_BAUD)
        .timeout(SERIAL_TIMEOUT)
        .open()
        .map_err(|e| {
            format!("Couldn't open {path}. Is the printer switched on and in range? ({e})")
        })
}

impl PrinterState {
    pub fn connect(&self, t: &Target) -> Result<(), String> {
        let link = match t.kind.as_str() {
            "usb" => {
                #[cfg(windows)]
                win::check_printer(&t.address)?;
                #[cfg(not(windows))]
                return Err("Printing through the system print queue is only supported on Windows.".into());
                #[allow(unreachable_code)]
                Link::Spooler { name: t.address.clone() }
            }
            "bluetooth" | "serial" => Link::Serial { path: t.address.clone(), port: open_serial(&t.address)? },
            other => return Err(format!("Unknown printer type '{other}'.")),
        };
        // Replacing the old link drops it, which closes any open port.
        *self.0.lock().map_err(|_| "Printer state is unavailable.")? = Some(link);
        Ok(())
    }

    pub fn close(&self) {
        if let Ok(mut g) = self.0.lock() {
            *g = None;
        }
    }

    pub fn write(&self, data: &[u8]) -> Result<(), String> {
        let mut g = self.0.lock().map_err(|_| "Printer state is unavailable.")?;
        match g.as_mut() {
            None => Err("No printer is connected.".into()),
            Some(Link::Spooler { name }) => {
                #[cfg(windows)]
                return win::raw_print(name, data);
                #[cfg(not(windows))]
                return Err(format!("Can't print to {name} on this system."));
            }
            Some(Link::Serial { path, port }) => {
                let attempt = |p: &mut Box<dyn serialport::SerialPort>| -> std::io::Result<()> {
                    let _ = p.clear(serialport::ClearBuffer::Input); // drop stale status bytes
                    p.write_all(data)?;
                    p.flush()
                };
                if attempt(port).is_ok() {
                    return Ok(());
                }
                // The printer may have slept or been power-cycled: reopen once and retry.
                *port = open_serial(path)?;
                attempt(port).map_err(|e| format!("Sending to {path} failed: {e}"))
            }
        }
    }

    /// Reads up to `n` bytes within `ms` milliseconds. `None` means nothing arrived or the
    /// route can't read (the Windows print queue).
    pub fn read(&self, n: usize, ms: u64) -> Result<Option<Vec<u8>>, String> {
        let mut g = self.0.lock().map_err(|_| "Printer state is unavailable.")?;
        let Some(Link::Serial { port, .. }) = g.as_mut() else { return Ok(None) };
        let deadline = Instant::now() + Duration::from_millis(ms);
        let mut buf = Vec::with_capacity(n);
        let mut chunk = [0u8; 64];
        while buf.len() < n {
            let left = deadline.saturating_duration_since(Instant::now());
            if left.is_zero() {
                break;
            }
            let _ = port.set_timeout(left.min(Duration::from_millis(250)));
            match port.read(&mut chunk) {
                Ok(0) => {}
                Ok(k) => buf.extend_from_slice(&chunk[..k]),
                Err(e) if e.kind() == ErrorKind::TimedOut => {}
                Err(_) => break,
            }
        }
        let _ = port.set_timeout(SERIAL_TIMEOUT);
        buf.truncate(n);
        Ok(if buf.is_empty() { None } else { Some(buf) })
    }
}

#[cfg(test)]
mod tests {
    /// Lists what this machine can see; touches no printer. Run with
    /// `cargo test -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn list_printers() {
        for p in super::list() {
            println!("{:<10} {:<28} {:<24} {}", p.kind, p.name, p.detail, p.address);
        }
    }
}

// ------------------------------------------------------------------ Windows

#[cfg(windows)]
mod win {
    use super::PrinterInfo;
    use std::collections::HashMap;
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Graphics::Printing::*;
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    const SPP_UUID: &str = "{00001101-0000-1000-8000-00805f9b34fb}";
    const PRINTER_ATTRIBUTE_WORK_OFFLINE: u32 = 0x0000_0400;

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    unsafe fn from_wide(p: *const u16) -> String {
        if p.is_null() {
            return String::new();
        }
        let mut len = 0;
        while *p.add(len) != 0 {
            len += 1;
        }
        String::from_utf16_lossy(std::slice::from_raw_parts(p, len))
    }

    fn last_error() -> String {
        std::io::Error::last_os_error().to_string()
    }

    fn is_ptouch(name: &str, driver: &str) -> bool {
        let s = format!("{name} {driver}").to_lowercase();
        s.contains("pt-") || s.contains("p-touch") || s.contains("ptouch")
    }

    /// P-touch printers installed in Windows (any port, but normally USB001…).
    pub fn spooler_printers() -> Vec<PrinterInfo> {
        let mut out = Vec::new();
        unsafe {
            let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
            let (mut needed, mut count) = (0u32, 0u32);
            EnumPrintersW(flags, null(), 2, null_mut(), 0, &mut needed, &mut count);
            if needed == 0 {
                return out;
            }
            // u64 backing keeps the PRINTER_INFO_2W array suitably aligned.
            let mut buf = vec![0u64; (needed as usize).div_ceil(8)];
            if EnumPrintersW(flags, null(), 2, buf.as_mut_ptr().cast(), needed, &mut needed, &mut count) == 0 {
                return out;
            }
            let infos = std::slice::from_raw_parts(buf.as_ptr() as *const PRINTER_INFO_2W, count as usize);
            for pi in infos {
                let name = from_wide(pi.pPrinterName);
                let driver = from_wide(pi.pDriverName);
                if !is_ptouch(&name, &driver) {
                    continue;
                }
                let port = from_wide(pi.pPortName);
                let offline = pi.Attributes & PRINTER_ATTRIBUTE_WORK_OFFLINE != 0;
                let how = if port.to_uppercase().starts_with("USB") { "USB".to_string() } else { port.clone() };
                out.push(PrinterInfo {
                    kind: "usb".into(),
                    address: name.clone(),
                    detail: if offline { format!("{how} · offline") } else { how },
                    name,
                });
            }
        }
        out
    }

    /// Checks that Windows knows the printer before we call ourselves connected.
    pub fn check_printer(name: &str) -> Result<(), String> {
        let w = wide(name);
        unsafe {
            let mut h = null_mut();
            if OpenPrinterW(w.as_ptr(), &mut h, null()) == 0 {
                return Err(format!("Windows has no printer called \"{name}\" ({}).", last_error()));
            }
            ClosePrinter(h);
        }
        Ok(())
    }

    /// Sends bytes to a Windows print queue unchanged (RAW datatype).
    pub fn raw_print(name: &str, data: &[u8]) -> Result<(), String> {
        let w = wide(name);
        let mut doc = wide("Labelina labels");
        let mut datatype = wide("RAW");
        unsafe {
            let mut h = null_mut();
            if OpenPrinterW(w.as_ptr(), &mut h, null()) == 0 {
                return Err(format!("Couldn't open the printer \"{name}\" ({}).", last_error()));
            }
            let info = DOC_INFO_1W { pDocName: doc.as_mut_ptr(), pOutputFile: null_mut(), pDatatype: datatype.as_mut_ptr() };
            if StartDocPrinterW(h, 1, &info) == 0 {
                let e = last_error();
                ClosePrinter(h);
                return Err(format!("Windows wouldn't start the print job ({e})."));
            }
            StartPagePrinter(h);
            let mut off = 0usize;
            let mut result = Ok(());
            while off < data.len() {
                let chunk = &data[off..data.len().min(off + 65_536)];
                let mut written = 0u32;
                if WritePrinter(h, chunk.as_ptr().cast(), chunk.len() as u32, &mut written) == 0 || written == 0 {
                    result = Err(format!("Sending to \"{name}\" failed ({}).", last_error()));
                    break;
                }
                off += written as usize;
            }
            EndPagePrinter(h);
            EndDocPrinter(h);
            ClosePrinter(h);
            result
        }
    }

    /// Paired Bluetooth devices that expose a serial port (SPP), named from Windows'
    /// pairing records. Incoming ports and devices that are no longer paired are skipped.
    pub fn bluetooth_ports() -> Vec<PrinterInfo> {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let mut names: HashMap<String, String> = HashMap::new();
        if let Ok(devs) = hklm.open_subkey(r"SYSTEM\CurrentControlSet\Services\BTHPORT\Parameters\Devices") {
            for mac in devs.enum_keys().flatten() {
                let name = devs
                    .open_subkey(&mac)
                    .and_then(|k| k.get_raw_value("Name"))
                    .map(|v| String::from_utf8_lossy(&v.bytes).trim_end_matches('\0').trim().to_string())
                    .unwrap_or_default();
                names.insert(mac.to_lowercase(), name);
            }
        }
        let mut out = Vec::new();
        let Ok(bth) = hklm.open_subkey(r"SYSTEM\CurrentControlSet\Enum\BTHENUM") else { return out };
        for svc in bth.enum_keys().flatten() {
            if !svc.to_lowercase().starts_with(SPP_UUID) {
                continue;
            }
            let Ok(svc_key) = bth.open_subkey(&svc) else { continue };
            for inst in svc_key.enum_keys().flatten() {
                // Instance ids end in "&<MAC>_C00000000"; incoming ports use an all-zero MAC.
                let mac = inst.rsplit('&').next().unwrap_or("").split('_').next().unwrap_or("").to_lowercase();
                if mac.len() != 12 || mac == "000000000000" {
                    continue;
                }
                let Some(dev_name) = names.get(&mac) else { continue }; // no longer paired
                let Ok(port) = svc_key
                    .open_subkey(format!(r"{inst}\Device Parameters"))
                    .and_then(|k| k.get_value::<String, _>("PortName"))
                else {
                    continue;
                };
                out.push(PrinterInfo {
                    kind: "bluetooth".into(),
                    address: port.clone(),
                    name: if dev_name.is_empty() { "Bluetooth device".into() } else { dev_name.clone() },
                    detail: format!("Bluetooth · {port}"),
                });
            }
        }
        // Brother printers first.
        out.sort_by_key(|p| !p.name.to_lowercase().contains("pt-"));
        out
    }
}
