// 波浪效果
// Author: ShaderToy

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
    
    float wave = 0.0;
    for(float i = 1.0; i < 10.0; i++) {
        wave += sin(uv.x * i * 10.0 + iTime * i * 0.5) / i;
        wave += sin(uv.y * i * 8.0 + iTime * i * 0.3) / i;
    }
    
    wave = wave * 0.5 + 0.5;
    
    vec3 col = vec3(
        sin(wave * 3.14159) * 0.5 + 0.5,
        sin(wave * 3.14159 + 2.0) * 0.5 + 0.5,
        sin(wave * 3.14159 + 4.0) * 0.5 + 0.5
    );
    
    fragColor = vec4(col, 1.0);
}
