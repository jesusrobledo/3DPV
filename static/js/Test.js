const canvas = document.getElementById('canvas');
    const gl = canvas.getContext('webgl2');

    if (!gl) {
      console.error('WebGL2 not supported');
    }

    // 1. Shaders (GLSL 3.00 ES)
    const vsSource = `#version 300 es
    in vec2 a_position;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      gl_PointSize = 1.0; // Point size in pixels
    }`;

    const fsSource = `#version 300 es
    precision mediump float;

    uniform vec4 u_color; // Color defined via uniform
    out vec4 fragColor;

    void main() {
      fragColor = u_color;
    }`;

    // Helper: compile shader
    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    // 2. Build program
    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);

    // 3. Define Point Positions in Clip Space (-1.0 to 1.0)
    const positions = new Float32Array([
      -0.5,  0.5,   // Top-Left
       0.5,  0.5,   // Top-Right
       0.0,  0.0,   // Center
      -0.5, -0.5,   // Bottom-Left
       0.5, -0.5    // Bottom-Right
    ]);

    // 4. Set up Buffer and VAO
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // 5. Render
    gl.viewport(0, 0, gl.canvas.width,gl.canvas.height);
    gl.clearColor(0.05, 0.05, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // Pass color uniform (R, G, B, A) — e.g., bright cyan
    const colorUniformLocation = gl.getUniformLocation(program, 'u_color');
    gl.uniform4f(colorUniformLocation, 0.5, 0.8, 1.0, 1.0);

    // Draw points
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.POINTS, 0, positions.length / 2);