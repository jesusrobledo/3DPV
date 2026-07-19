const canvas = document.getElementById('glCanvas');
canvas.width = 500;
canvas.height = 500;

const gl = canvas.getContext('webgl2');
if (!gl) alert('WebGL2 not supported!');

// 1. Shaders
const vsSource = `#version 300 es
                  in vec2 a_position;
                  void main() {
                    gl_Position = vec4(a_position, 0.0, 1.0);
                    gl_PointSize = 12.0; // Sets pixel diameter when rendering gl.POINTS
                  }`;

const fsSource = `#version 300 es
                  precision highp float;
                  out vec4 outColor;
                  void main() {
                    outColor = vec4(1.0, 0.3, 0.3, 1.0); // Vibrant Red/Coral
                  }`;

// Helper function for compilation
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}

const program = gl.createProgram();
gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vsSource));
gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
gl.linkProgram(program);

// 2. Geometry: 5 Coordinates tracking a zigzag path
const positions = [
    -0.6,  0.6,   // Point 0 (Top Left)
    -0.3, -0.6,   // Point 1 (Bottom Left-ish)
    0.0,  0.3,   // Point 2 (Center Spike)
    0.3, -0.6,   // Point 3 (Bottom Right-ish)
    0.6,  0.6    // Point 4 (Top Right)
];

// 3. Buffer and VAO Setup
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(positionAttributeLocation);
gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

// 4. Draw Function mapping different primitive modes
function draw(mode) {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.08, 0.08, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    // 5 vertices to draw total
    gl.drawArrays(mode, 0, 5);
}

// Initial draw state
draw(gl.POINTS);

// Interactive Button handling
const buttons = {
            btnPoints: gl.POINTS,
            btnLines: gl.LINES,
            btnLineLoop: gl.LINE_LOOP
};

Object.keys(buttons).forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => {
        document.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        draw(buttons[id]);
    });
});