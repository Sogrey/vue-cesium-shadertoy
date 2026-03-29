// Zero7
// Author: https://www.shadertoy.com/view/fc2GWK

#define T iTime
#define s1(v) (sin(v)*.5+.5)
#define P(z) vec3(cos((z)*.1)*4.,sin((z)*.1)*4.,(z))
#define t_path T*3.

mat2 rotate(float a){
  float s = sin(a);
  float c = cos(a);
  return mat2(c,-s,s,c);
}

// https://www.shadertoy.com/view/lsKcDD
mat3 setCamera( in vec3 ro, in vec3 ta, float cr )
{
	vec3 cw = normalize(ta-ro);            // 相机前
	vec3 cp = vec3(sin(cr), cos(cr),0.0);  // 滚角
	vec3 cu = normalize( cross(cw,cp) );   // 相机右
	vec3 cv = normalize( cross(cu,cw) );   // 相机上
  return mat3( cu, cv, cw );
}

float noise(vec3 p){
  float n1 = dot(cos(p+sin(p*.4)*4.), vec3(.1));
  float n2 = dot(cos(p), vec3(.1));
  return mix(n1,n2,s1(T*.5));
}

vec3 C = vec3(10,2,1);
vec3 RO;
float fbm(vec3 p){
  float amp = 1.;
  float n = 0.;

  for(float i=0.;i<4.;i++){
    p += sin(p.zxy+T*i*2.)*amp;
    n += abs(noise(p))*amp;
    amp *= .5;
    p *= 2.;
    C += amp*.1;
  }
  return n;
}

vec3 col = vec3(0);
float map(vec3 p){

  float d = fbm(p);
  float d1 = length(p - RO)-4.;
  d = max(d, -d1);
  col += s1(C+T)/(max(d, .01));

  return d;
}

void mainImage(out vec4 O, in vec2 I){
  vec2 R = iResolution.xy;
  vec2 uv = (I*2.-R)/R.y;

  O.rgb *= 0.;
  O.a = 1.;

  vec3 ro = P(t_path);
  RO = ro;
  vec3 rd = setCamera(ro, P(t_path+1.), sin(T*.5)*.4) * normalize(vec3(uv, 1.));

  float z = .1;

  float i=0.;
  while(i++<80.){
    vec3 p = ro + rd * z;

    float d = map(p);
    z += d;
  }


  O.rgb += col;
  O.rgb = tanh(O.rgb/8e2);
}
