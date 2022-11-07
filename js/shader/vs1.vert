attribute vec3  position;
attribute vec4  color;
uniform   vec2  uResolution;
uniform   vec2  uMouse;      // [-1.0, 1.0]の正規化された値が送られてくる
uniform   float uClientX;    // [0, 1.0]
uniform   mat4  modelMatrix;
uniform   float uFlag;
varying   vec4  vColor;

void main(){
  float aspect = 1.0 / (uResolution.x / uResolution.y); // アスペクト比を計算する
  float scale  = mix(0.1, 1.0, uClientX);
  vec3  pos    = position * vec3(aspect, 1.0, 1.0);
  vColor       = color;
  vec4 movePos = modelMatrix * vec4(pos * vec3(scale, scale, 1.0) + vec3(uMouse, 0.0), 1.0);
  vec4 newPos  = modelMatrix * vec4(pos, 1.0);
  gl_Position  = mix(movePos, newPos, uFlag);
  gl_PointSize = .8;
}