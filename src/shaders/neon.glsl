// 霓虹隧道效果
// Author: ShaderToy

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);
    
    float t = iTime * 2.0;
    
    float a = angle / 3.14159 * 4.0 + t;
    float r = radius * 10.0 - t * 2.0;
    
    float v = sin(a * 2.0) * cos(r);
    v = smoothstep(0.0, 1.0, v);
    
    vec3 col1 = vec3(1.0, 0.0, 1.0);
    vec3 col2 = vec3(0.0, 1.0, 1.0);
    vec3 col = mix(col1, col2, sin(t) * 0.5 + 0.5);
    
    col *= v * (1.0 - radius * 0.5);
    
    fragColor = vec4(col, 1.0);
}
