import { useEffect, useRef, useState } from "react";

// Declare global V86Starter
declare global {
  interface Window {
    V86Starter: any;
  }
}

interface V86TerminalProps {
  onReady?: () => void;
}

export function V86Terminal({ onReady }: V86TerminalProps) {
  const screenRef = useRef<HTMLDivElement>(null);
  const emulatorRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [bootStatus, setBootStatus] = useState("Initializing WebAssembly runtime...");

  useEffect(() => {
    if (!screenRef.current) return;

    // Load libv86.js dynamically
    const script = document.createElement("script");
    script.src = "/v86/libv86.js";
    script.onload = () => {
      setBootStatus("Booting Linux...");
      
      const emulator = new window.V86Starter({
        wasm_path: "/v86/v86.wasm",
        memory_size: 512 * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        screen_container: screenRef.current,
        bios: { url: "/v86/seabios.bin" },
        vga_bios: { url: "/v86/vgabios.bin" },
        cdrom: { url: "/v86/linux3.iso" },
        autostart: true,
      });

      emulatorRef.current = emulator;

      // Listen for download progress
      emulator.add_listener("download-progress", (e: any) => {
        if (e.file_name === "/v86/linux3.iso") {
          const percent = Math.floor((e.loaded / e.total) * 100);
          setBootStatus(`Downloading OS image... ${percent}%`);
        }
      });

      emulator.add_listener("emulator-ready", () => {
        setLoading(false);
        if (onReady) onReady();
      });
    };

    document.body.appendChild(script);

    return () => {
      if (emulatorRef.current) {
        emulatorRef.current.destroy();
      }
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="flex flex-col w-full h-full relative bg-zinc-950 overflow-hidden font-mono text-sm">
      <div 
        ref={screenRef} 
        className="flex-1 w-full h-full p-2 z-10 text-zinc-100 overflow-auto whitespace-pre-wrap outline-none" 
      />
      {loading && (
        <div className="absolute inset-0 bg-black/80 z-20 flex items-center justify-center pointer-events-none">
          <div className="text-white flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
            <span>{bootStatus}</span>
          </div>
        </div>
      )}
    </div>
  );
}
