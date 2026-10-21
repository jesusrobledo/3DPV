///////////////////////////////////////////////////////////////////////////////
// Libraries and classes imported
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import {GPUEngine} from 'Classes_AI.js';

// Methods ////////////////////////////////////////////////////////////////////
async function loadCase(){
    try{
        const response = await fetch('/load_case',{method: 'POST',
                                                   headers: {'Content-Type':'application/json'},
                                                   body: JSON.stringify({name:"5Km"})
                                                  });
        if (!response.ok)
            throw new Error('Server error: ${response.status}');
        const result = await response.json();
        return result;
    } catch(error){
        console.error(error);
    }
}

// Renderer initialization ////////////////////////////////////////////////////
let renderer = new WebGPURenderer({ antialias: true });
const width = 512;
const height = 512;
renderer.setSize(width,height);
await renderer.init();
document.getElementById("canvas3D").appendChild(renderer.domElement );

// Default graph definition ///////////////////////////////////////////////////
const graph_layout = {margin:{l:40,r:20,b:30,t:60,pad:0},
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      plot_bgcolor: 'rgba(0,0,0,0)',
                      xaxis:{gridcolor:"#888888",
                             color:'#000000'},
                      yaxis:{gridcolor:"#888888",
                             color:'#000000'},
                      legend:{x:0.5,
                              y:0.2,
                              font:{color:'#000000'}}};

// GPU engine definition and specific 3D elements /////////////////////////////
const gpuEngine = new GPUEngine();

function updateGraph(data){
    const graph_data = [];
    let gpuData;
    switch (data.option){
        case "cells":
            gpuData = renderer.getArrayBufferAsync(gpuEngine.arrays[data.key].cell.attribute.voltage).then((result) => {
                gpuData = new Float32Array(result);
                for (let iCell=0;iCell<gpuEngine.arrays[data.key].nCells;iBlock++){
                    const x = [];
                    const y = [];
                    for (let i=0;i<gpuEngine.array[data.key].IVsize;i++){
                        x.push(gpuData[data.blocks[iBlock]*gpuEngine.array[data.key].IVsize+i]);
                        y.push(20.0/(gpuEngine.array[data.key].IVsize-1)*i);
                    }
                    graph_data.push({x:x,y:y,mode:'lines'});
                }
                Plotly.newPlot('graph',graph_data,graph_layout);
                menu.showModal();
            });
            break;

    }
}

// Main render loop
function animate() {
    controls.update();
    handleKeyboard();
    renderer.render(scene,camera);
}
renderer.setAnimationLoop(animate);

// GUI interactions
const button0 = document.getElementById('button0');
const button1 = document.getElementById('button1');
const button2 = document.getElementById('button2');
const button3 = document.getElementById('button3');
const button4 = document.getElementById('button4');
const button5 = document.getElementById('button5');
const menu = document.getElementById('menu');
const menu_close = document.getElementById('menu_close');
menu_close.addEventListener('click', () => {

    menu.close();
});
button0.addEventListener('click', () => {

    loadCase().then((result) =>{
        terrain = new Terrain(result.objFile,result.textureFile);
        scene.add(terrain);
        sceneIndices['terrain'] = scene.children[scene.children.length-1].id;
        pvModule = new PVmodule();
        pvModule.loadMesh({fileName:result.arrays.A1.layouts.L1.pvModule.fileName,
                           frontTexture:result.arrays.A1.layouts.L1.pvModule.frontTexture,
                           rearTexture:result.arrays.A1.layouts.L1.pvModule.rearTexture,
                           lateralTexture:result.arrays.A1.layouts.L1.pvModule.lateralTexture}).then(() => {
            pvLayout = new PVlayout({pvModule:pvModule,
                                     position:result.arrays.A1.layouts.L1.position,
                                     rotation:result.arrays.A1.layouts.L1.rotation}
                                     );
            pvArray = new PVarray({pvLayout:pvLayout,
                                   position:result.arrays.A1.position,
                                   rotation:result.arrays.A1.rotation});
            pvArray.position.set(0.0,0.0,250.0);
            scene.add(pvArray);
            sceneIndices['pvArray'] = scene.children[scene.children.length-1].id;

            // GPU engine definition
            const module = result.arrays.A1.layouts.L1.pvModule;
            const nModules = result.arrays.A1.layouts.L1.position.length * result.arrays.A1.position.length;
            const strings = result.arrays.A1.strings;
            const irradiance = new Float32Array(module.nCellsPerChain*module.nChainsPerDiode*module.nDiodes*nModules);
            const temperature = new Float32Array(module.nCellsPerChain*module.nChainsPerDiode*module.nDiodes*nModules);
            for (let i=0;i<irradiance.length;i++){
                irradiance[i] = 1000;
                temperature[i] = 25;
            }
            let moduleIrradiance=[1000,900,500,500,300,1000,800,800,800,800];
            for (let iModule=0;iModule<nModules;iModule++){
                for (let iCell=0;iCell<144;iCell++){
                    irradiance[iModule*144+iCell] = moduleIrradiance[iModule];
                }
            }
            gpuEngine.createArray({key:'baseline',
                                   module:module,
                                   nModules:nModules,
                                   strings:strings});
            gpuEngine.updateBuffer('baseline','cell','irradiance',irradiance);
            gpuEngine.updateBuffer('baseline','cell','temperature',temperature);
        });
    });
});
button1.addEventListener('click', () => {
    gpuEngine.computeShader(renderer,'cellsVoltage','baseline');
    gpuEngine.computeShader(renderer,'chainsVoltage','baseline');
    gpuEngine.computeShader(renderer,'chainsCurrent','baseline');
    gpuEngine.computeShader(renderer,'blocksCurrent','baseline');
    gpuEngine.computeShader(renderer,'blocksVoltage','baseline');
    gpuEngine.computeShader(renderer,'stringsVoltage','baseline').then(()=>{alert("GPU done")});
});
button2.addEventListener('click', () => {
    /*
    updateGraph({key:"baseline",
                 option:'blocks',
                 blocks:[0,1,3]});
    */
    updateGraph({key:"baseline",
                 option:'strings'});
});
button3.addEventListener('click', () => {
    gpuEngine.computeShader(renderer,'cellsVoltage','baseline');
    gpuEngine.computeShader(renderer,'chainsVoltage','baseline');
    gpuEngine.computeShader(renderer,'chainsCurrent','baseline');
    gpuEngine.computeShader(renderer,'blocksCurrent','baseline');
    gpuEngine.computeShader(renderer,'blocksVoltage','baseline');
    gpuEngine.computeShader(renderer,'stringsVoltage','baseline').then(result =>{
        const graph_data = [];
        //for (let iChain=0;iChain<gpuEngine.array.baseline.nChains;iChain++){
        //for (let iChain=0;iChain<6;iChain++){
        //for (let iBlock=0;iBlock<6;iBlock++){
        for (let iString=0;iString<1;iString++){
            const x = [];
            const y = [];
            for (let i=0;i<gpuEngine.array.baseline.IVsize;i++){
                //x.push(result[iChain*gpuEngine.array.baseline.IVsize+i]);
                //y.push(10.0/(gpuEngine.array.baseline.IVsize-1)*i);
                //x.push(-1.0 + 18/(gpuEngine.array.baseline.IVsize-1)*i);
                //y.push(result[iChain*gpuEngine.array.baseline.IVsize+i]);
                //y.push(result[iBlock*gpuEngine.array.baseline.IVsize+i]);
                //x.push(result[iBlock*gpuEngine.array.baseline.IVsize+i]);
                //y.push(20.0/(gpuEngine.array.baseline.IVsize-1)*i);
                x.push(result[iString*gpuEngine.array.baseline.IVsize+i]);
                y.push(20.0/(gpuEngine.array.baseline.IVsize-1)*i*x[x.length-1]);
            }
            graph_data.push({x:x,y:y,mode:'lines'});
        }
        Plotly.newPlot('graph',graph_data,graph_layout);
        menu.showModal();
    });
});
button4.addEventListener('click', () => {

    pvArray.children[0].material = [pvArray.analysisMaterial,baselineMaterial[1],baselineMaterial[2]];
});
button5.addEventListener('click', () => {

    pvArray.children[0].material = baselineMaterial;
});


