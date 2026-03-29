// Buffer A - 简单的反馈效果
void mainImage(out vec4 O, vec2 I)
{
    vec2 uv = I / iResolution.xy;
    
    // 从上一帧读取（自反馈）
    vec4 prev = texture(iChannel0, uv);
    
    // 简单的衰减 + 新颜色
    O = mix(prev, vec4(uv, 0.5 + 0.5 * sin(iTime), 1.0), 0.05);
}
