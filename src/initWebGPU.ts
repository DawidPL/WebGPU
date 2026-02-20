let device: GPUDevice | undefined;

export async function initWebGPU(): Promise<GPUDevice>{

    if(!navigator.gpu) throw new Error("WebGPU not supported in this browser.");

    const adapter = await navigator.gpu.requestAdapter();
    if(!adapter) throw new Error("No adapter");

    device = await adapter.requestDevice();
    return device;
}