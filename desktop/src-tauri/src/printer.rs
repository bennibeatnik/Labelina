//! Printer transports for the desktop app.
//!
//! The web page builds the Brother raster job (js/ptouch.js) exactly as it does in the
//! browser; this module only moves the bytes. Routes:
//!
//! * `usb`: the printer's USB printer-class interface (usbprint.sys, `\\?\USB#VID_04F9…`)
//!   opened directly. Two-way (status, tape detection, print confirmation), no print queue,
//!   and no driver swap: Brother's driver and P-touch Editor keep working.
//! * `spooler`: fallback through the Windows print queue with the RAW datatype. Write-only,
//!   and on the D610BT jobs were seen to hang in the queue ("Printing, Retained", 0 bytes).
//! * `bluetooth` / `serial`: a COM port (Bluetooth SPP shows up as one once the printer
//!   is paired). The port is held open between prints, and a failed write reopens the
//!   port and tries once more, which covers the printer having slept or been switched off.

use serde::{Deserialize, Serialize};
use std::io::{ErrorKind, Read, Write};
use std::sync::Mutex;
use std::time::{Duration, Instant};

const SERIAL_BAUD: u32 = 115_200;
const SERIAL_TIMEOUT: Duration = Duration::from_secs(5);
/// Per 4 KB chunk; a slow Bluetooth link can take a few seconds while the printer is busy.
const SERIAL_WRITE_TIMEOUT: Duration = Duration::from_secs(20);

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
    /// The printer's USB printer-class interface opened directly (usbprint.sys), bypassing
    /// the print queue. Two-way, so status works, and Brother's driver stays installed.
    #[cfg(windows)]
    UsbDirect { path: String, file: std::fs::File },
}

#[derive(Default)]
pub struct PrinterState(Mutex<Option<Link>>);

// ------------------------------------------------------------------ discovery

pub fn list() -> Vec<PrinterInfo> {
    let mut out = Vec::new();
    #[cfg(windows)]
    {
        out.extend(win::usb_direct_printers());
        out.extend(win::bluetooth_ports());
        // The Windows print queue isn't listed: Brother's port software expects its own job header,
        // and raw jobs were seen to hang there ("Printing, Retained", 0 bytes).
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
            #[cfg(windows)]
            "usb" => Link::UsbDirect { path: t.address.clone(), file: win::open_usb(&t.address)? },
            "spooler" => {
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
            #[cfg(windows)]
            Some(Link::UsbDirect { path, file }) => {
                let attempt = |f: &mut std::fs::File| -> Result<(), (usize, std::io::Error)> {
                    // Drop status bytes left from earlier jobs so the next read is about this one.
                    let mut junk = [0u8; 64];
                    for _ in 0..16 {
                        if !matches!(f.read(&mut junk), Ok(k) if k > 0) { break; }
                    }
                    let mut sent = 0usize;
                    for chunk in data.chunks(16_384) {
                        f.write_all(chunk).map_err(|e| (sent, e))?;
                        sent += chunk.len();
                    }
                    f.flush().map_err(|e| (sent, e))
                };
                match attempt(file) {
                    Ok(()) => Ok(()),
                    // Nothing went out: the printer was probably replugged or power-cycled.
                    Err((0, _)) => {
                        *file = win::open_usb(path)?;
                        attempt(file).map_err(|(_, e)| format!("Sending over USB failed: {e}"))
                    }
                    Err((sent, e)) => Err(format!(
                        "Only {} of {} KB reached the printer before USB failed ({e}). Switch the printer off and on before printing again.",
                        sent / 1024,
                        data.len().div_ceil(1024)
                    )),
                }
            }
            Some(Link::Serial { path, port }) => {
                // Sends in chunks so a slow Bluetooth link can't hit one long timeout, and reports
                // how far it got. Returns the number of bytes that went out before any error.
                let attempt = |p: &mut Box<dyn serialport::SerialPort>| -> Result<(), (usize, std::io::Error)> {
                    let _ = p.clear(serialport::ClearBuffer::Input); // drop stale status bytes
                    let _ = p.set_timeout(SERIAL_WRITE_TIMEOUT);
                    let mut sent = 0usize;
                    for chunk in data.chunks(4096) {
                        p.write_all(chunk).map_err(|e| (sent, e))?;
                        sent += chunk.len();
                    }
                    p.flush().map_err(|e| (sent, e))?;
                    let _ = p.set_timeout(SERIAL_TIMEOUT);
                    Ok(())
                };
                match attempt(port) {
                    Ok(()) => Ok(()),
                    // Nothing reached the printer: it probably slept or was power-cycled. Reopen and retry.
                    Err((0, _)) => {
                        *port = open_serial(path)?;
                        attempt(port).map_err(|(_, e)| format!("Sending to {path} failed: {e}"))
                    }
                    // Part of the job is in the printer; resending would garble it.
                    Err((sent, e)) => Err(format!(
                        "Only {} of {} KB reached the printer before the connection failed ({e}). Switch the printer off and on before printing again.",
                        sent / 1024,
                        data.len().div_ceil(1024)
                    )),
                }
            }
        }
    }

    /// Reads up to `n` bytes within `ms` milliseconds. `None` means nothing arrived or the
    /// route can't read (the Windows print queue).
    pub fn read(&self, n: usize, ms: u64) -> Result<Option<Vec<u8>>, String> {
        let mut g = self.0.lock().map_err(|_| "Printer state is unavailable.")?;
        let deadline = Instant::now() + Duration::from_millis(ms);
        // usbprint returns 0 bytes straight away when the printer has nothing to say, so poll.
        #[cfg(windows)]
        if let Some(Link::UsbDirect { file, .. }) = g.as_mut() {
            let mut buf = Vec::with_capacity(n);
            let mut chunk = [0u8; 64];
            while buf.len() < n && Instant::now() < deadline {
                match file.read(&mut chunk) {
                    Ok(0) => std::thread::sleep(Duration::from_millis(60)),
                    Ok(k) => buf.extend_from_slice(&chunk[..k]),
                    Err(_) => break,
                }
            }
            buf.truncate(n);
            return Ok(if buf.is_empty() { None } else { Some(buf) });
        }
        let Some(Link::Serial { port, .. }) = g.as_mut() else { return Ok(None) };
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

    /// Asks each direct-USB printer for its status (ESC i S). Prints nothing on the tape.
    #[test]
    #[ignore]
    fn usb_status() {
        let mut req = vec![0u8; 100];
        req.extend_from_slice(&[0x1b, 0x40, 0x1b, 0x69, 0x53]);
        for p in super::list().into_iter().filter(|p| p.kind == "usb") {
            let s = super::PrinterState::default();
            s.connect(&super::Target { kind: p.kind.clone(), address: p.address.clone() }).unwrap();
            s.write(&req).unwrap();
            let r = s.read(32, 3000).unwrap().unwrap_or_default();
            println!("{}: {} bytes, width {} mm, media type 0x{:02x}, errors {:02x} {:02x}", p.name, r.len(), r.get(10).copied().unwrap_or(0), r.get(11).copied().unwrap_or(0), r.get(8).copied().unwrap_or(0), r.get(9).copied().unwrap_or(0));
            assert_eq!(r.len(), 32);
        }
    }
}

// ------------------------------------------------------------------ Windows

#[cfg(windows)]
#[allow(dead_code)] // spooler_printers and its helpers are kept as a fallback, but not listed
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
                    kind: "spooler".into(),
                    address: name.clone(),
                    detail: if offline { format!("{how} via Windows print queue · offline") } else { format!("{how} via Windows print queue") },
                    name,
                });
            }
        }
        out
    }

    const USBPRINT_GUID: &str = "{28d78fad-5a12-11d1-ae5b-0000f803a8c2}";
    const BROTHER_VID: &str = "VID_04F9";

    /// Brother printers currently plugged in over USB, found through the USB printer class
    /// interface. Opening that interface needs no driver change (usbprint.sys is Windows' own).
    pub fn usb_direct_printers() -> Vec<PrinterInfo> {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let mut out = Vec::new();
        let Ok(cls) = hklm.open_subkey(format!(r"SYSTEM\CurrentControlSet\Control\DeviceClasses\{USBPRINT_GUID}")) else { return out };
        for link in cls.enum_keys().flatten() {
            // e.g. ##?#USB#VID_04F9&PID_20E1#000K4H471200#{28d78fad-...}
            if !link.to_uppercase().contains(BROTHER_VID) {
                continue;
            }
            // The registry keeps entries for unplugged printers too; only list ones that open.
            let path = format!(r"\\?\{}", link.trim_start_matches("##?#"));
            if open_usb(&path).is_err() {
                continue;
            }
            let parts: Vec<&str> = link.trim_start_matches("##?#").split('#').collect();
            let name = if parts.len() >= 3 {
                hklm.open_subkey(format!(r"SYSTEM\CurrentControlSet\Enum\{}\{}\{}", parts[0], parts[1], parts[2]))
                    .ok()
                    .and_then(|k| k.get_value::<String, _>("FriendlyName").or_else(|_| k.get_value::<String, _>("DeviceDesc")).ok())
                    .map(|s| s.rsplit(';').next().unwrap_or(&s).to_string()) // DeviceDesc can be "@oem.inf,...;Name"
                    .unwrap_or_else(|| "Brother USB printer".into())
            } else {
                "Brother USB printer".into()
            };
            out.push(PrinterInfo { kind: "usb".into(), address: path, name, detail: "USB".into() });
        }
        out
    }

    /// Opens the USB printer interface for reading and writing, shared so the print queue
    /// and P-touch Editor can still use the printer.
    pub fn open_usb(path: &str) -> Result<std::fs::File, String> {
        use std::os::windows::fs::OpenOptionsExt;
        std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .share_mode(0x1 | 0x2) // FILE_SHARE_READ | FILE_SHARE_WRITE
            .open(path)
            .map_err(|e| format!("Couldn't open the printer over USB. Is it plugged in and switched on? ({e})"))
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
