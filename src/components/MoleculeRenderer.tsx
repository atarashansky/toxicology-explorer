"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { JSMol, RDKitModule } from "@rdkit/rdkit";

interface MoleculeRendererProps {
  smiles?: string;
  inchi?: string;
  width?: number;
  height?: number;
  className?: string;
}

const RDKIT_SCRIPT_URL = "/rdkit/RDKit_minimal.js";
const RDKIT_WASM_URL = "/rdkit/RDKit_minimal.wasm";

// Encapsulate global state in a module-level object
const rdkitState = {
  scriptPromise: null as Promise<void> | null,
  modulePromise: null as Promise<RDKitModule> | null,
};

const ensureRDKitScript = (): Promise<void> => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("RDKit can only load in the browser"));
  }

  if (typeof window.initRDKitModule === "function") {
    return Promise.resolve();
  }

  if (rdkitState.scriptPromise) {
    return rdkitState.scriptPromise;
  }

  rdkitState.scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-rdkit-script="true"]'
    );

    const attachListeners = (scriptEl: HTMLScriptElement) => {
      const handleLoad = () => {
        scriptEl.dataset.loaded = "true";
        resolve();
      };

      const handleError = () => {
        rdkitState.scriptPromise = null;
        reject(new Error("Failed to load RDKit script"));
      };

      scriptEl.addEventListener("load", handleLoad, { once: true });
      scriptEl.addEventListener("error", handleError, { once: true });
    };

    if (existing) {
      if (
        existing.dataset.loaded === "true" ||
        typeof window.initRDKitModule === "function"
      ) {
        resolve();
        return;
      }

      attachListeners(existing);
      return;
    }

    const script = document.createElement("script");
    script.src = RDKIT_SCRIPT_URL;
    script.async = true;
    script.dataset.rdkitScript = "true";

    attachListeners(script);

    document.head.appendChild(script);
  });

  return rdkitState.scriptPromise;
};

const loadRDKitModule = async (): Promise<RDKitModule> => {
  if (typeof window === "undefined") {
    throw new Error("RDKit cannot be loaded on the server");
  }

  if (window.RDKit) {
    return window.RDKit;
  }

  if (rdkitState.modulePromise) {
    return rdkitState.modulePromise;
  }

  rdkitState.modulePromise = (async () => {
    await ensureRDKitScript();

    if (!window.initRDKitModule) {
      throw new Error("RDKit loader is not available on window");
    }

    const instance = await window.initRDKitModule({
      locateFile: () => RDKIT_WASM_URL,
    });

    window.RDKit = instance;

    return instance;
  })();

  try {
    return await rdkitState.modulePromise;
  } catch (error) {
    rdkitState.modulePromise = null;
    throw error;
  }
};

const MoleculeRenderer: React.FC<MoleculeRendererProps> = ({
  smiles,
  inchi,
  width = 250,
  height = 200,
  className = "",
}) => {
  const [rdkit, setRdkit] = useState<RDKitModule | null>(null);
  const [loading, setLoading] = useState(true);
  const svgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const initialize = async () => {
      try {
        const instance = await loadRDKitModule();
        if (!abortController.signal.aborted) {
          setRdkit(instance);
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.warn("Failed to load RDKit:", error);
          setRdkit(null);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      abortController.abort();
    };
  }, []);

  const svgContent = useMemo(() => {
    if (!rdkit || (!smiles && !inchi)) {
      return null;
    }

    let mol: JSMol | null = null;

    try {
      if (smiles) {
        mol = rdkit.get_mol(smiles);
      } else if (inchi) {
        mol = rdkit.get_mol(inchi);
      }

      if (!mol) {
        return null;
      }

      return mol.get_svg(width, height);
    } catch (error) {
      console.warn("Error rendering molecule:", error);
      return null;
    } finally {
      mol?.delete();
    }
  }, [rdkit, smiles, inchi, width, height]);

  // Update the DOM directly when svgContent changes
  useEffect(() => {
    if (svgRef.current && svgContent) {
      svgRef.current.innerHTML = svgContent;
    } else if (svgRef.current) {
      svgRef.current.innerHTML = "";
    }
  }, [svgContent]);

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 border border-gray-200 rounded ${className}`}
        style={{ width, height }}
      >
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!rdkit) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 border border-gray-200 rounded ${className}`}
        style={{ width, height }}
      >
        <div className="text-gray-500 text-sm">RDKit unavailable</div>
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded p-2 ${className}`}
        style={{ width, height }}
      >
        <div className="text-gray-500 text-sm mb-1">No structure</div>
        {smiles && (
          <div className="text-xs text-gray-400 font-mono text-center break-all">
            {smiles.length > 30 ? `${smiles.substring(0, 30)}...` : smiles}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={svgRef}
      className={`border border-gray-200 rounded overflow-hidden ${className}`}
      style={{ width, height }}
    />
  );
};

export default MoleculeRenderer;
