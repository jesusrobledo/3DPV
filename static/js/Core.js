import * as THREE from 'three';

export class CoreObject{

    constructor(){
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
        this.camera.position.z = 5;
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.shaders = null;
        this.gl = this.renderer.getContext();
        document.body.appendChild( this.renderer.domElement );
    }
    init(){
        const geometry = new THREE.BoxGeometry( 1, 1, 1 );
        const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
        const cube = new THREE.Mesh( geometry, material );
        this.scene.add(cube);
    }
    animate = (time) => {
        this.scene.children[0].rotation.x = time / 2000;
        this.scene.children[0].rotation.y = time / 2000;
        this.renderer.render( this.scene, this.camera );
    }
    async loadShaderData (data){
        const response = await fetch('/load_shader_code', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({shaderFile:data.file})
        });
        const responseData = await response.json();
        return {
            name:data.name,
            vertexCode:responseData.vertexShader,
            fragmentCode:responseData.fragmentShader,
            attribute:Object.values(responseData.attributes),
            uniform:Object.values(responseData.uniforms)
        };
    }
    async createGPUEnvironment(){
        let shaderData = [];
        shaderData.push({name:'Test',file:'Test.shd'});

        this.shaders = await Promise.all(shaderData.map(data => this.loadShaderData(data)));
        let x = 0;
    }
}
export class FBO{
    constructor(gl,width,height){
        this.framebuffer = gl.createFramebuffer();
        this.texture = gl.createTexture();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.texture,0);
		gl.bindTexture(gl.TEXTURE_2D,null);
		gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
}
