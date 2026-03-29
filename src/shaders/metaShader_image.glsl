// MetaShader - Image
// URL: https://www.shadertoy.com/view/sf23Dc


// ┌─────────────────────────────────────────┐
// │  Common (公共函数)                       │
// │  - rotation()                            │
// │  - hachage33()                           │
// │  - voronoi()                             │
// │  - trajectoire()                         │
// │  - carte()                               │
// └──────────────┬──────────────────────────┘
//                │
//                ├──────────┐
//                │          │
//                ▼          ▼
// ┌──────────────────┐  ┌──────────────────┐
// │ BufferA          │  │ Image            │
// │                  │  │                  │
// │ iChannel0 ◄──────┼──┼── iChannel0      │
// │ (self 自反馈)    │  │ (读取 BufferA)    │
// └──────────────────┘  └──────────────────┘


void mainImage(out vec4 couleurFrag, in vec2 coordonneesFrag) {
    vec2 uv = coordonneesFrag / iResolution.xy;
    vec2 dcv = (coordonneesFrag * 2.0 - iResolution.xy) / iResolution.y;
    
    float distanceCentre = dot(dcv, dcv);
    
    float zoom = 0.95;
    vec2 uv_centrees = (uv - 0.5) * zoom + 0.5;
    
    vec3 flou = vec3(0.0);
    float poidsTotal = 0.0;
    for(float i=-2.0; i<=2.0; i++) {
        for(float j=-2.0; j<=2.0; j++) {
            vec2 decalage = vec2(i, j) * 0.0025;
            vec3 echantillon = texture(iChannel0, uv_centrees + decalage).rgb;
            float p = exp(-(i*i + j*j) * 0.5);
            flou += pow(max(echantillon - 0.35, vec3(0.0)), vec3(2.2)) * p;
            poidsTotal += p;
        }
    }
    flou /= poidsTotal;
    
    vec3 couleurFinale;
    float intensiteDistorsion = 0.07;
    float aberration = 0.005;
    
    for(int k=0; k<3; k++) {
        float decalageCouleur = float(k-1) * aberration * distanceCentre;
        float distorsionTotale = distanceCentre * intensiteDistorsion + decalageCouleur;
        
        vec2 uvDistordu = uv_centrees + (uv_centrees - 0.5) * distorsionTotale;
        
        couleurFinale[k] = texture(iChannel0, uvDistordu)[k];
    }
    
    couleurFinale += flou * 1.6;
    
    couleurFinale = mix(couleurFinale, vec3(dot(couleurFinale, vec3(0.299, 0.587, 0.114))), -0.15);
    
    couleurFinale = smoothstep(-0.03, 1.08, couleurFinale);
    couleurFinale = pow(max(couleurFinale, vec3(0.0)), vec3(0.4545));
    
    float vignetage = smoothstep(1.2, 0.4, distanceCentre * 0.5);
    couleurFinale *= vignetage;
    
    float bruit = hachage33(vec3(coordonneesFrag, iTime)).x * 0.015;
    couleurFinale += bruit;
    
    couleurFrag = vec4(couleurFinale, 1.0);
}
