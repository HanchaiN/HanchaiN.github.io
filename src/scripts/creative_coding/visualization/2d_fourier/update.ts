import {
  createAndLinkProgram,
  createShader,
} from "@/scripts/utils/dom/webgl.js";

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 texCoords;

void main() {
	texCoords = a_position * 0.5 + 0.5;
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
const FRAGMENT_SHADER = `
#define PI 3.1415926535897932384626433832795
precision highp float;
varying vec2 texCoords;
uniform sampler2D texture;
uniform vec2 resolution;
uniform vec2 k;
uniform vec2 v;
uniform float factor;

void main() {
    vec2 uv = texCoords;
    float phase = 2.0 * PI * (k.x * uv.x * resolution.x - k.y * uv.y * resolution.y);
    gl_FragColor = texture2D(texture, texCoords);
    gl_FragColor.xyz += vec3(factor) * (v.x * cos(phase) - v.y * sin(phase));
}
`;
const FRAGMENT_SHADER_OVERLAY = `
#define PI 3.1415926535897932384626433832795
precision highp float;
varying vec2 texCoords;
uniform sampler2D texture;
uniform vec2 resolution;
uniform vec2 k;
uniform vec2 v;
uniform float overlay;

float atan2(in vec2 v)
{
    return abs(v.x) > abs(v.y) ? atan(v.y,v.x) : PI/2.0 - atan(v.x,v.y);
}

vec3 hcl2lab(in vec3 c) {
  return clamp(vec3(c.z, c.y * cos(c.x), c.y * sin(c.x)), vec3(0.0, -1.0, -1.0), vec3(1.0, 1.0, 1.0));
}
vec3 lab2xyz(in vec3 c) {
  const float CBRT_EPSILON = 6.0 / 29.0;
  const float KAPPA = 243.89 / 27.0;
  const vec3 std = vec3(0.9504492182750991, 1.0, 1.0889166484304715);
  float fy = (c.x + 0.16) / 1.16;
  float fx = fy + c.y / 5.0;
  float fz = fy - c.z / 2.0;
  vec3 f = vec3(fx, fy, fz);
  vec3 cutoff = vec3(lessThan(f, vec3(CBRT_EPSILON)));
  vec3 lower = (vec3(1.16) * f - vec3(0.16)) / vec3(KAPPA);
  vec3 higher = f * f * f;
  return clamp(std * mix(higher, lower, cutoff), vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0));
}
vec3 xyz2rgb(in vec3 c) {
    const mat3 xyz2rgb = mat3(
        +8041697.0, -3049000.0, -1591847.0,
        -1752003.0, +4851000.0, +301853.0,
        +17697.0, -49000.0, +3432153.0
    ) / 3400850.0;
    return clamp(c * xyz2rgb, vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0));
}
vec3 rgb2srgb(in vec3 c)
{
    vec3 cutoff = vec3(lessThan(c, vec3(0.0031308)));
    vec3 lower = c * vec3(12.92);
    vec3 higher = vec3(1.055)*pow(c, vec3(1.0/2.4)) - vec3(0.055);
    return clamp(mix(higher, lower, cutoff), vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0));
}

void main() {
    vec2 uv = texCoords;
    float phase = 2.0 * PI * (k.x * uv.x * resolution.x - k.y * uv.y * resolution.y);
    float amplitude = cos(phase + atan2(v)) * 0.25 + 0.5;
    gl_FragColor.xyz = rgb2srgb(mix(
      texture2D(texture, texCoords).xyz,
      xyz2rgb(lab2xyz(hcl2lab(
        vec3(phase, 0.25, amplitude)
      ))),
      overlay
    ));
    gl_FragColor.w = 1.0;
}
`;

export function update(
  gl: WebGLRenderingContext,
  kspace_width: number,
  kspace_height: number,
) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const fragmentShader_overlay = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    FRAGMENT_SHADER_OVERLAY,
  );
  if (!vertexShader || !fragmentShader || !fragmentShader_overlay)
    throw new Error("Failed to create shader");
  const program = createAndLinkProgram(gl, vertexShader, fragmentShader);
  const program_overlay = createAndLinkProgram(
    gl,
    vertexShader,
    fragmentShader_overlay,
  );
  if (!program || !program_overlay) throw new Error("Failed to create program");
  const VERTICES = new Float32Array([-1, -1, -1, 1, 1, 1, -1, -1, 1, 1, 1, -1]);
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, VERTICES, gl.STATIC_DRAW);
  const positionLocation = gl.getAttribLocation(program, "a_position");
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(positionLocation);
  const init = new Float32Array(4 * gl.canvas.width * gl.canvas.height).map(
    (_, i) => [0, 0, 0, 1][i % 4],
  );
  const texture_framebuffer = [init, init].map((init) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.canvas.width,
      gl.canvas.height,
      0,
      gl.RGBA,
      gl.FLOAT,
      init,
    );
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    return { texture, framebuffer };
  });
  let iter = 0;
  return (wx: number, wy: number, re: number, im: number, overlay: number) => {
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(gl.getUniformLocation(program, "k"), wx, wy);
    gl.uniform2f(gl.getUniformLocation(program, "v"), re, im);
    gl.uniform2f(
      gl.getUniformLocation(program, "resolution"),
      kspace_width,
      kspace_height,
    );
    gl.uniform1f(
      gl.getUniformLocation(program, "factor"),
      1 / (kspace_width * kspace_height),
    );
    gl.bindTexture(
      gl.TEXTURE_2D,
      texture_framebuffer[iter % texture_framebuffer.length].texture,
    );
    iter++;
    gl.bindFramebuffer(
      gl.FRAMEBUFFER,
      texture_framebuffer[iter % texture_framebuffer.length].framebuffer,
    );
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.useProgram(program_overlay);
    gl.uniform2f(gl.getUniformLocation(program_overlay, "k"), wx, wy);
    gl.uniform2f(gl.getUniformLocation(program_overlay, "v"), re, im);
    gl.uniform2f(
      gl.getUniformLocation(program_overlay, "resolution"),
      kspace_width,
      kspace_height,
    );
    gl.uniform1f(gl.getUniformLocation(program_overlay, "overlay"), overlay);
    gl.bindTexture(
      gl.TEXTURE_2D,
      texture_framebuffer[iter % texture_framebuffer.length].texture,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
}
