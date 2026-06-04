type NavigatorWithGpu = Navigator & {
  gpu?: {
    requestAdapter: () => Promise<unknown>;
  };
};

export type WebGPUStatus =
  | { supported: true }
  | { supported: false; reason: string };

export async function checkWebGPUSupport(): Promise<WebGPUStatus> {
  if (typeof navigator === "undefined") {
    return { supported: false, reason: "WebGPU can only be checked in the browser." };
  }

  const gpu = (navigator as NavigatorWithGpu).gpu;
  if (!gpu) {
    return {
      supported: false,
      reason: "WebGPU is not available in this browser. Use Chrome or Edge 113+ with WebGPU enabled.",
    };
  }

  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        reason: "No WebGPU adapter was found. Check browser GPU settings and hardware acceleration.",
      };
    }
    return { supported: true };
  } catch {
    return {
      supported: false,
      reason: "WebGPU adapter detection failed. Check browser GPU settings and try again.",
    };
  }
}
