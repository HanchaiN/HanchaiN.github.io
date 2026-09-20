export const supportWebGL = document
  .createElement("canvas")
  .getContext("webgl2")
  ? true
  : false;

export function createAndLinkProgram(
  gl: WebGLRenderingContext,
  vertex_shader: WebGLShader,
  fragment_shader: WebGLShader,
) {
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vertex_shader);
  gl.attachShader(prog, fragment_shader);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("Failed to link program: " + gl.getProgramInfoLog(prog));
  }
  return prog;
}

export function createShader(
  gl: WebGLRenderingContext,
  shader_type: GLenum,
  shader_code: string,
) {
  const shader = gl.createShader(shader_type);
  if (!shader) return null;
  gl.shaderSource(shader, shader_code);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("Failed to compile shader: " + gl.getShaderInfoLog(shader));
  }
  return shader;
}
