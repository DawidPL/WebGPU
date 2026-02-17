import './styles/style.css'
import {runMonteCarloCPU} from "./monteCarloCPU";
import {runMonteCarloGPU} from "./monteCarloGPU";

/// <reference types="@webgpu/types" />

type Module = "gpu" | "ai" | "analytics";
let currentModule: Module = "gpu";

const screen = document.getElementById("screen") as HTMLElement; 


async function initWebGPU(){
    if(!navigator.gpu){
        alert("WebGPU not supported in this browser.");
        return;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if(!adapter){
        alert('No GPU adapter found.');
        return;
    }
    const device = await adapter.requestDevice();
    console.log("Device ready:", device);

    const canvas = document.getElementById('gpu-canvas') as HTMLCanvasElement;
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;

    const context = canvas.getContext('webgpu') as GPUCanvasContext;

    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device: device,
        format: format,
        alphaMode: "opaque",
    });

    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
            {
                view: textureView,
                clearValue: {r: 0.05, g: 0.02, b: 0.1, a: 1},
                loadOp: 'clear',
                storeOp: 'store',
            }
           
        ]
    });
    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
}
function renderScreen(){
    if (currentModule === "gpu"){
        screen.innerHTML = `
        <h2 class="text-accent font-2xl">GPU Compute Module</h2>
        <p>Interactive Monte Carlo Stock Simulator powered by WebGPU</p>
        <button class="my-10 py-2 px-2 bg-accent text-main-dark rounded-xl outline-extra outline-4" id="cpu-time-current">start CPU </button>
        <button class="my-10 py-2 px-2 bg-accent text-main-dark rounded-xl outline-extra outline-4" id="gpu-time-current">start GPU </button>
        <button class="my-10 py-2 px-2 mx-5 bg-accent text-main-dark rounded-xl outline-extra outline-4" id="cpu-time-history">historical results</button>
        <canvas id="gpu-canvas" class="border border-accent"></canvas>
        <p id="cpu-time-current-display"> </p>
        <p id="cpu-time-best"></p>
        <ul id="cpu-time-history-display" class="opacity-0"></ul>
        `;
        initWebGPU();
        CPUTimeDisplay();
        CPUHistoricalDisplay();
        GPUTimeDisplay();
    }
    if (currentModule == "ai"){
        screen.innerHTML = `
        <h2 class="text-accent font-2xl">AI Module</h2>
        `;
    }
    if (currentModule == "analytics"){
        screen.innerHTML = `
        <h2 class="text-accent font-2xl">Analytics Module</h2>
        `;
    }
}
document.querySelectorAll("[data-module]").forEach((button) =>{
    button.addEventListener("click", (event)=>{
        const target = event.currentTarget as HTMLElement;
        const module = target.dataset.module as Module;
        currentModule = module;

        renderScreen();
    })
})


function addTimeToList(time:number){
    const ul = document.getElementById('cpu-time-history-display') as HTMLElement;
    const li = document.createElement('li') as HTMLElement;
    li.textContent = time.toString();
    ul.appendChild(li);

}

let bestCpuTime: number | null = null;
function showBestTime(time:number){
    const bestTime = document.getElementById('cpu-time-best');
    if (!bestTime) return;
    if(bestCpuTime === null || time < bestCpuTime){
        bestCpuTime = time;
        bestTime.textContent = 'Best time: ' + time + 'ms';
    }
}

function CPUTimeDisplay(){
    const btn = document.getElementById('cpu-time-current') as HTMLElement;
    const display = document.getElementById('cpu-time-current-display') as HTMLElement;
    btn.addEventListener('click', ()=>{

        const monteCarloResult = runMonteCarloCPU({
            entry_price: 100,
            average_return: 0.1,
            volatility: 0.2,
            days: 252,
            paths: 1000000 
        });
        const timeFormatted = monteCarloResult.time.toFixed(4);
        const timeFormattedCopy = timeFormatted;
        //console.log("CPU Time:", monteCarloResult.time, "ms")
        //console.log("Example path:", monteCarloResult.paths[0]);

        display.innerHTML = 'CPU time:' + timeFormattedCopy.toString();;
        addTimeToList(timeFormatted);
        showBestTime(timeFormatted);
    })
}

function CPUHistoricalDisplay(){
    const btn = document.getElementById('cpu-time-history');
    const display = document.getElementById('cpu-time-history-display');

    if (!btn || !display) return;

    btn.addEventListener('click', () =>{
        display.classList.replace("opacity-0", "opacity-100");
    })
}

function GPUTimeDisplay(){
    const btn = document.getElementById('gpu-time-current') as HTMLElement;

    btn.addEventListener("click", async () =>{
        const params = {
            entry_price: 100,
            average_return: 0.1,
            volatility: 0.2,
            days: 252,
            paths: 1000000
        };
        const startTime = performance.now();
        const gpuResults = await runMonteCarloGPU(params);
        const endTime = performance.now()
        const gpuTime = endTime - startTime
        console.log("GPU Time:", gpuTime);
    });
}
/*
function createTimeList(arr:Array<number>){
    const ul = document.getElementById('cpu-time-history-display') as HTMLElement;
    for(let i = 0; i < arr.length; i++){
        ul.append('<li>' + arr[i] + '</li>')
    }
}
*/  