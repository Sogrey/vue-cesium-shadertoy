// MetaShader - BufferA
// URL: https://www.shadertoy.com/view/sf23Dc

vec3 calculerNormale(vec3 p, float tps) {
    vec2 e = vec2(1.0, -1.0) * 0.002;
    return normalize(e.xyy * carte(p + e.xyy, tps) + e.yyx * carte(p + e.yyx, tps) + 
                     e.yxy * carte(p + e.yxy, tps) + e.xxx * carte(p + e.xxx, tps));
}

float plancton(vec3 p) {
    vec3 q = p * 12.0;
    float n = hachage33(floor(q)).x;
    if(n > 0.015) return 0.0;
    return smoothstep(0.5, 0.0, length(fract(q) - 0.5)) * n * 60.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord * 2.0 - iResolution.xy) / iResolution.y;
    float temps = iTime;
    
    vec3 ro = vec3(0.0, 0.0, temps * 4.0);
    ro.xy += trajectoire(ro.z);
    vec3 cible = vec3(0.0, 0.0, ro.z + 5.0);
    cible.xy += trajectoire(cible.z);
    
    vec3 fwd = normalize(cible - ro);
    vec3 rgt = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 up = cross(fwd, rgt);
    vec3 rd = normalize(fwd * 1.3 + rgt * uv.x + up * uv.y);
    
    float t = 0.0, acc = 0.0, flc = 0.0, rayons = 0.0;
    for(int i=0; i<100; i++) {
        vec3 p = ro + rd * t;
        float d = carte(p, temps);
        if(abs(d) < 0.001 || t > 40.0) break;
        t += d;
        acc += exp(-t * 0.15);
        flc += plancton(p) * exp(-t * 0.2);
        
        float r_pos = dot(p.xy - trajectoire(p.z), vec2(0.707));
        rayons += pow(max(0.0, sin(r_pos * 1.5 + temps) * 0.5 + 0.5), 8.0) * exp(-t * 0.1);
    }
    
    vec3 col = vec3(0.005, 0.03, 0.05);
    if(t < 40.0) {
        vec3 p = ro + rd * t, n = calculerNormale(p, temps);
        vec3 ld = normalize(ro + vec3(0.0, 10.0, 5.0) - p);
        float dif = max(dot(n, ld), 0.0);
        vec3 pl = p; pl.xy -= trajectoire(p.z);
        pl.xy *= rotation(p.z * 0.12 + temps * 0.4);
        float cau = pow(1.0 - voronoi(pl * 0.9 + vec3(0.0, 0.0, temps)), 4.0);
        col = mix(vec3(0.0, 0.1, 0.2), vec3(0.1, 0.5, 0.45), cau) * (dif + 0.2);
        col += vec3(0.4, 0.9, 0.8) * cau * dif * 1.8;
        col += vec3(0.7, 0.9, 1.0) * pow(max(dot(reflect(-ld, n), -rd), 0.0), 32.0);
        col = mix(vec3(0.0, 0.02, 0.04), col, exp(-t * 0.08));
    }
    col += vec3(0.1, 0.4, 0.6) * acc * 0.04 + vec3(0.8, 1.0, 0.9) * flc * 0.08;
    col += vec3(0.2, 0.6, 0.7) * rayons * 0.02;
    
    // 自反馈：读取上一帧
    vec2 uv_ecran = fragCoord / iResolution.xy;
    vec3 precedent = texture(iChannel0, uv_ecran).rgb;
    col = mix(col, precedent, 0.1); 
    
    fragColor = vec4(col, 1.0);
}
