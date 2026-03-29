// MetaShader - Common
// URL: https://www.shadertoy.com/view/sf23Dc

//*====================================================================================*//
//                                                                                      //
//  _______ _______ _______ _______ _______ _______ _______ _____  _______ ______       //
// |   |   |   ___|_      _|   _   |       __|   |   |   _   |     \|   ___|   __ \     //
// |       |   ___| |   | |       |__     |       |       |  --  |   ___|      <        //
// |__|_|__|_______| |___| |___|___|_______|___|___|___|_____/|_______|___|__|          //
//                                                                                      //
//======================================================================================//
//:: [ Optimized for NVIDIA GeForce GeForce GTX 1080 Ti ] ::                            //
//======================================================================================//

mat2 rotation(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

vec3 hachage33(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yxz + 19.19);
    return fract((p.xxy + p.yxx) * p.zyx);
}

float voronoi(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    float res = 8.0;
    for(int j=-1; j<=1; j++)
    for(int i=-1; i<=1; i++) {
        vec3 b = vec3(float(i), float(j), 0.0);
        vec3 r = b - f + hachage33(p + b);
        float d = dot(r, r);
        res = min(res, d);
    }
    return sqrt(res);
}

vec2 trajectoire(float z) {
    return vec2(sin(z * 0.15) * 3.5, cos(z * 0.1) * 2.5);
}

float carte(vec3 p, float tps) {
    vec2 decalage = trajectoire(p.z);
    vec3 q = p;
    q.xy -= decalage;
    q.xy *= rotation(p.z * 0.12 + tps * 0.4);
    float tunnel = 4.2 - length(q.xy);
    float relief = 0.0;
    float amovible = 0.5;
    vec3 coord_bruit = q * 0.5;
    for(int i=0; i<4; i++) {
        relief += amovible * abs(voronoi(coord_bruit) - 0.5);
        coord_bruit *= 2.1;
        amovible *= 0.5;
    }
    return (tunnel - relief) * 0.6;
}
