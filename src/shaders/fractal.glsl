// 分形波纹效果
// Author: ShaderToy

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    float d = length(uv);
    vec3 col = vec3(0.0);
    
    for(float i = 0.0; i < 5.0; i++) {
        d = length(uv);
        uv = fract(uv * 1.5) - 0.5;
        d = sin(d * 8.0 + iTime) / 8.0;
        d = abs(d);
        d = 0.02 / d;
        col += d * vec3(0.5 + 0.5 * sin(iTime + i), 0.5 + 0.5 * cos(iTime + i * 0.5), 1.0);
    }
    
    fragColor = vec4(col * 0.2, 1.0);
}
