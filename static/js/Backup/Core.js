import * as THREE from 'three';
export class FBO{
    constructor(gl,width,height){
        this.framebuffer = gl.createFramebuffer();
        this.texture = gl.createTexture();
        this.width = width;
        this.height = height;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.texture,0);
		gl.bindTexture(gl.TEXTURE_2D,null);
		gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
}
export class Shader{
    constructor(gl,data){

        // This method includes the basic definition of the shader obtained from
        // external files and create the backbone in terms of the vertex and
        // fragment shaders and their associated attributes and uniforms

        this.webGLObject = {};
        let errorLog = "";

        // Include vertex shader
        this.vertexShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(this.vertexShader,data.vertexShader);
		gl.compileShader(this.vertexShader);
		if ( gl.getShaderInfoLog(this.vertexShader) !== '' )
			errorLog += "VertexShader: \n" + gl.getShaderInfoLog(this.vertexShader)+"\n";

        // Include fragment shader
        this.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(this.fragmentShader,data.fragmentShader);
		gl.compileShader(this.fragmentShader);
		if ( gl.getShaderInfoLog(this.fragmentShader) !== '' )
			errorLog += "FragmentShader: \n" + gl.getShaderInfoLog(this.fragmentShader)+"\n";

		if (errorLog != "")
		    alert (errorLog);

        // Link the program
        this.program = gl.createProgram();
		gl.attachShader(this.program,this.vertexShader);
		gl.attachShader(this.program,this.fragmentShader);
		gl.linkProgram(this.program);

		// Allocate attributes
		this.attributes = [];
		for (let i=0;i<data.attributes.length;i++){
			this.program[data.attributes[i].name] = gl.getAttribLocation(this.program,data.attributes[i].name);
			this.attributes.push(data.attributes[i]);
		}

		// Allocate uniforms
		this.uniforms = [];
		for (let i=0;i<data.uniforms.length;i++){
			this.program[data.uniforms[i].name] = gl.getUniformLocation(this.program,data.uniforms[i].name);
			this.uniforms.push(data.uniforms[i]);
		}
    }
	createWebGL2BufferArrays(gl,items){

        const dataType = {'float':gl.FLOAT};
        for (const item of Object.values(items)){
		    this.webGLObject[item.name] = {};
		    this.webGLObject[item.name]['vao'] = gl.createVertexArray();
		    this.webGLObject[item.name]['nVertices'] = item.nVertices;

		    gl.bindVertexArray(this.webGLObject[item.name].vao);
		    for (const attribute of Object.values(this.attributes)){
                gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(item.vertexData[attribute.name]),gl.STATIC_DRAW);
                let attrLoc = gl.getAttribLocation(this.program,attribute.name);
                gl.enableVertexAttribArray(attrLoc);
                gl.vertexAttribPointer(attrLoc,
                                       attribute.size,
                                       dataType[attribute.type],
                                       false,
                                       attribute.size*Float32Array.BYTES_PER_ELEMENT,
                                       0);
            }
            gl.bindVertexArray(null);
        }
	}
	executeGPUCode(gl,FBO,uniforms){

	    gl.useProgram(this.program);

	    gl.bindFramebuffer(gl.FRAMEBUFFER,FBO.frameBuffer);
		gl.bindTexture(gl.TEXTURE_2D,FBO.texture);

		gl.viewport(0,0,FBO.width,FBO.height);
	    gl.clearColor(0.5,0.5,0.5,1.0);
	    gl.clear(gl.COLOR_BUFFER_BIT);

        for (let i in this.uniforms){
            switch (this.uniforms[i].type){
                case "vec3":
				    gl.uniform3fv(gl.getUniformLocation(this.program, this.uniforms[i].name),uniforms[this.uniforms[i].name]);
					break;
                case 'f':
                    gl.uniform1f(gl.getUniformLocation(this.program, this.uniforms[i].name),uniforms[this.uniforms[i].name]);
					break;
            }
        }

        for (let item of Object.values(this.webGLObject)){
            gl.bindVertexArray(item.vao);
	        gl.drawArrays(gl.POINTS,0,item.nVertices);
	    }

	    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.bindTexture(gl.TEXTURE_2D, null);
	}
}
export class GPUEngine{
    constructor(){
        this.gl = canvas.getContext("webgl2");
        this.shaders = {};
        this.FBO = {};
    }
    async loadShader (data){
        const response = await fetch('/load_shader_code', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({shaderFile:data.file})
        });
        const responseData = await response.json();
        return {
            name:data.name,
            vertexShader:responseData.vertexShader,
            fragmentShader:responseData.fragmentShader,
            attributes:Object.values(responseData.attributes),
            uniforms:Object.values(responseData.uniforms)
        };
    }
    async createGPUEnvironment(){
        let shadersDefinition = [];
        let shadersData = [];
        shadersDefinition.push({name:'test',file:'Test.shd'});
        shadersDefinition.push({name:'test2',file:'Test2.shd'});
        shadersData = await Promise.all(shadersDefinition.map(data => this.loadShader(data)));
        for (const shaderData of shadersData){
            this.shaders[shaderData.name] = new Shader(this.gl,shaderData);
        }
    }
    downloadTexture(name,fileName){
        const pixels = new Uint8Array(this.FBO[name].width * this.FBO[name].height * 4);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.FBO[name].frameBuffer);
        this.gl.readPixels(0, 0, this.FBO[name].width, this.FBO[name].height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

        const canvas2d = document.createElement('canvas');
        canvas2d.width = this.FBO[name].width;
        canvas2d.height = this.FBO[name].height;
        const ctx2d = canvas2d.getContext('2d');

        const imageData = ctx2d.createImageData(this.FBO[name].width, this.FBO[name].height);
        const flippedPixels = new Uint8Array(this.FBO[name].width * this.FBO[name].height * 4);
        const rowSize = this.FBO[name].width * 4;
        for (let y = 0; y < this.FBO[name].height; y++) {
            const srcOffset = y * rowSize;
            const dstOffset = (this.FBO[name].height - 1 - y) * rowSize;
            flippedPixels.set(pixels.subarray(srcOffset, srcOffset + rowSize), dstOffset);
        }
        //imageData.data.set(flippedPixels);
        imageData.data.set(pixels);
        ctx2d.putImageData(imageData, 0, 0);
        canvas2d.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName+".png";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }
}
export class Scene3D{

    constructor(){
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
        this.camera.position.z = 3;
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.gl = this.renderer.getContext("webgl2");
        document.body.appendChild( this.renderer.domElement );
        this.myTexture = new THREE.Texture();
    }
    init(){
        const geometry = new THREE.BoxGeometry( 1, 1, 1 );
        const textureLoader = new THREE.TextureLoader();
        const colorTexture = textureLoader.load('static/textures/Calibration.jpg');
        colorTexture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshBasicMaterial( { map: colorTexture, } );
        const cube = new THREE.Mesh( geometry, material );
        this.scene.add(cube);
    }
    animate = (time) => {
        this.scene.children[0].rotation.x = time / 2000;
        this.scene.children[0].rotation.y = time / 2000;
        this.renderer.render( this.scene, this.camera );
    }
    /*
    captureExternalTexture(texture){
        this.bitmapTexture = new THREE.Texture(texture);
        bitmapTexture.colorSpace = THREE.SRGBColorSpace;
        bitmapTexture.needsUpdate = true;
    }
    */
}


