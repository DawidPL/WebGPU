/// <reference types="@webgpu/types" />

export interface MonteCarloParams {
    entry_price: number;
    average_return: number;
    volatility: number;
    days: number;
    paths: number; 
}

export async function runMonteCarloGPU(device: GPUDevice, params: MonteCarloParams){

    const {entry_price, average_return, volatility, days, paths} = params;

    const resultBufferSize = paths * 4; // 4 bajty na Float32
    const resultBuffer = device.createBuffer({ //GPU, zarezerwuj mi kawałek swojej pamięci
        size: resultBufferSize, // Ile miejsca ma zarezerwować. Jeśli damy za mało → shader wyjdzie poza zakres i będzie błąd. GPU musi znać dokładny rozmiar z góry.
        usage: GPUBufferUsage.STORAGE | 
                GPUBufferUsage.COPY_SRC |
                GPUBufferUsage.VERTEX //Tu mówimy GPU do czego ten buffer będzie używany. STORAGE - Shader będzie zapisywał do tego bufferu, czyli ten buffer będzie magazynem wyników. COPY_SRC - kopiowanie danych z GPU do CPU bo po obliczeniach chcemy odczytać wynik.

    })
    const paramData =  new Float32Array([
        entry_price,
        average_return,
        volatility,
        days,
    ])
    const paramBuffer = device.createBuffer({
        size: paramData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(paramBuffer, 0,paramData);

    const shaderModule = device.createShaderModule({ //shader to instrukcja
        code: `
    struct Params {
        entry_price: f32,
        average_return: f32,
        volatility: f32,
        days: f32,
    }
    @group(0) @binding(0)
    var<uniform> params: Params;

    @group(0) @binding(1)
    var<storage, read_write> results: array<f32>;

    fn random(seed: f32) -> f32{
        return fract(sin(seed * 12.9898) * 43758.5453);
    }
    
    @compute @workgroup_size(64)
    fn main(@builtin(global_invocation_id) id: vec3<u32>){
        let index = id.x;

        var price = params.entry_price;
        let dt = 1.0 / 252.0;

        for(var i: u32 = 0u; i < u32(params.days); i = i +1u){
            
            let seed = f32(index) + f32(i);
            let rand = random(seed);
            
            price = price * (1.0 + params.average_return    * dt + params.volatility * sqrt(dt) * (rand - 0.5)); 
        }
        results[index] = price;
    }
    `
    });
    const pipeline = device.createComputePipeline({ // mówi użyj instrukcji jako programu obliczeniowego
        layout: "auto",
        compute: {
            module: shaderModule,
            entryPoint: "main"
        }
    });
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: { buffer: paramBuffer }
            },
            {
                binding: 1,
                resource: { buffer: resultBuffer }
            }
        ]
    });
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();

    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(paths / 64));
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);

    //przeniesienie wyników z pamięci GPU do CPU

    const readBuffer = device.createBuffer({
        size: resultBufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    const readEncoder = device.createCommandEncoder();
    readEncoder.copyBufferToBuffer(
        resultBuffer,
        0,
        readBuffer,
        0,
        resultBufferSize
    );
    device.queue.submit([readEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);

    const arrayBuffer = readBuffer.getMappedRange();
    const results = new Float32Array(arrayBuffer.slice(0));
    readBuffer.unmap();

    //return results; - Float32Array
    return resultBuffer;
}

export function renderResults(device, resultBuffer, paths){
    // render pipeline

    const canvas = document.getElementById("gpu-chart") as HTMLCanvasElement;
    const context = canvas.getContext("webgpu") as GPUCanvasContext;

    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format,
        alphaMode: "opaque"
    });

    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: textureView,
            loadOp: "clear",
            clearValue: {r: 0.1, g: 0.1, b: 0.1, a: 1},
            storeOp: "store"
        }]
    });

    const uniformData = new Float32Array([paths]);
    const uniformBuffer = device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const shaderModule = device.createShaderModule({
        code: `

        struct RenderParams {
            paths: f32
        };

        @group(0) @binding(0)
        var<uniform> params:RenderParams;

        @vertex
        fn vs(
            @location(0) price: f32, 
            @builtin(vertex_index) index: u32
        ) -> @builtin(position) vec4<f32>{
               
            let x = (f32(index) / params.paths) * 2.0 - 1.0;
            
            let y = (price / 200.0) - 1.0;

            return vec4<f32>(x, y, 0.0, 1.0);
        }
        @fragment
        fn fs() -> @location(0) vec4<f32>{
            return vec4<f32>(0.2, 0.8, 1.0, 1.0);
        }
        `
    });

    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: shaderModule,
            entryPoint: 'vs',
            buffers: [{
                arrayStride: 4,
                attributes: [{
                    shaderLocation: 0,
                    offset: 0,
                    format: "float32"
                }]
            }]
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs',
            targets: [{
                format: navigator.gpu.getPreferredCanvasFormat()
            }]
        },
        primitive: {
            topology: 'point-list'
        }
    });
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{
            binding: 0,
            resource: {
                buffer: uniformBuffer
            }
        }]
    });

    renderPass.setPipeline(pipeline);
    renderPass.setVertexBuffer(0, resultBuffer);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(paths);

    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
}

